'use strict';

const { Op } = require('sequelize');
const { sequelize, Appointment, Patient, Doctor } = require('../models');
const logger = require('../config/logger');

/**
 * Book a new appointment with transaction-level double-booking prevention
 */
const createAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { patient_id, doctor_id, date_time, remarks } = req.body;

    // Verify patient exists
    const patient = await Patient.findByPk(patient_id, { transaction: t });
    if (!patient) {
      await t.rollback();
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Verify doctor exists
    const doctor = await Doctor.findByPk(doctor_id, { transaction: t });
    if (!doctor) {
      await t.rollback();
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const appointmentDate = new Date(date_time);

    // Double-booking conflict check: doctor cannot have two active appointments at the same timestamp
    const existingConflict = await Appointment.findOne({
      where: {
        doctor_id,
        date_time: appointmentDate,
        status: { [Op.ne]: 'cancelled' },
      },
      transaction: t,
      lock: t.LOCK?.UPDATE,
    });

    if (existingConflict) {
      await t.rollback();
      return res.status(409).json({
        error: 'Doctor is already booked at this exact date and time.',
      });
    }

    const appointment = await Appointment.create(
      {
        patient_id,
        doctor_id,
        date_time: appointmentDate,
        status: 'scheduled',
        remarks,
      },
      { transaction: t }
    );

    await t.commit();
    logger.info(`Appointment booked: #${appointment.appointment_id} for Doctor #${doctor_id}`);

    return res.status(201).json({
      message: 'Appointment booked successfully',
      data: appointment,
    });
  } catch (err) {
    await t.rollback();
    logger.error('Error creating appointment', { message: err.message });
    return res.status(500).json({ error: 'Failed to book appointment' });
  }
};

/**
 * List appointments with pagination, role scoping, and filtering
 */
const getAllAppointments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const { doctor_id, patient_id, status, startDate, endDate, date } = req.query;
    const whereClause = {};

    // Role-based scoping
    if (req.user.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
      const currentDoctorId = doctorProfile ? doctorProfile.doctor_id : null;
      if (!currentDoctorId) {
        return res.status(200).json({ data: [], pagination: { total: 0, page, limit, totalPages: 0 } });
      }
      whereClause.doctor_id = currentDoctorId;
    } else if (doctor_id) {
      whereClause.doctor_id = doctor_id;
    }

    if (patient_id) {
      whereClause.patient_id = patient_id;
    }

    if (status) {
      whereClause.status = status;
    }

    // Parameterized date filtering
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      whereClause.date_time = { [Op.between]: [startOfDay, endOfDay] };
    } else if (startDate && endDate) {
      whereClause.date_time = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      whereClause.date_time = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      whereClause.date_time = { [Op.lte]: new Date(endDate) };
    }

    const { count, rows } = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        { model: Patient, as: 'patient', attributes: ['patient_id', 'name', 'contact'] },
        { model: Doctor, as: 'doctor', attributes: ['doctor_id', 'name', 'specialization'] },
      ],
      limit,
      offset,
      order: [['date_time', 'ASC']],
    });

    return res.status(200).json({
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    logger.error('Error fetching appointments', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
};

/**
 * Get appointment by ID
 */
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Patient, as: 'patient' },
        { model: Doctor, as: 'doctor' },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Doctor role check
    if (req.user.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
      if (doctorProfile && appointment.doctor_id !== doctorProfile.doctor_id) {
        return res.status(403).json({ error: 'Forbidden: You cannot access another doctor\'s appointment.' });
      }
    }

    return res.status(200).json({ data: appointment });
  } catch (err) {
    logger.error('Error fetching appointment', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve appointment' });
  }
};

/**
 * Update appointment (reschedule, update remarks or status)
 */
const updateAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const appointment = await Appointment.findByPk(id, { transaction: t });

    if (!appointment) {
      await t.rollback();
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const { date_time, status, remarks } = req.body;

    // If date_time changed, verify no conflicting appointment exists
    if (date_time && new Date(date_time).getTime() !== new Date(appointment.date_time).getTime()) {
      const newDateTime = new Date(date_time);
      const conflict = await Appointment.findOne({
        where: {
          doctor_id: appointment.doctor_id,
          date_time: newDateTime,
          appointment_id: { [Op.ne]: appointment.appointment_id },
          status: { [Op.ne]: 'cancelled' },
        },
        transaction: t,
        lock: t.LOCK?.UPDATE,
      });

      if (conflict) {
        await t.rollback();
        return res.status(409).json({ error: 'Doctor is already booked at this new date and time.' });
      }

      appointment.date_time = newDateTime;
    }

    if (status !== undefined) appointment.status = status;
    if (remarks !== undefined) appointment.remarks = remarks;

    await appointment.save({ transaction: t });
    await t.commit();

    logger.info(`Appointment updated: #${appointment.appointment_id}`);

    return res.status(200).json({
      message: 'Appointment updated successfully',
      data: appointment,
    });
  } catch (err) {
    await t.rollback();
    logger.error('Error updating appointment', { message: err.message });
    return res.status(500).json({ error: 'Failed to update appointment' });
  }
};

/**
 * Cancel appointment
 */
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    logger.info(`Appointment cancelled: #${id}`);

    return res.status(200).json({
      message: 'Appointment cancelled successfully',
      data: appointment,
    });
  } catch (err) {
    logger.error('Error cancelling appointment', { message: err.message });
    return res.status(500).json({ error: 'Failed to cancel appointment' });
  }
};

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
};
