'use strict';

const { Op } = require('sequelize');
const { sequelize, Appointment, Patient, Doctor } = require('../models');
const logger = require('../config/logger');
const audit = require('../utils/auditLog');

let bookingMutex = Promise.resolve();

/**
 * Book a new appointment with transaction-level double-booking prevention
 */
const createAppointment = async (req, res) => {
  return new Promise((resolve) => {
    bookingMutex = bookingMutex
      .then(async () => {
        const { patient_id, doctor_id, date_time, remarks } = req.body;

        try {
          const appointment = await sequelize.transaction(async (t) => {
            // Verify patient exists
            const patient = await Patient.findByPk(patient_id, { transaction: t });
            if (!patient) {
              const error = new Error('Patient not found');
              error.status = 404;
              throw error;
            }

            // Verify doctor exists
            const doctor = await Doctor.findByPk(doctor_id, { transaction: t });
            if (!doctor) {
              const error = new Error('Doctor not found');
              error.status = 404;
              throw error;
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
            });

            if (existingConflict) {
              const error = new Error('Doctor is already booked at this exact date and time.');
              error.status = 409;
              throw error;
            }

            return Appointment.create(
              {
                patient_id,
                doctor_id,
                date_time: appointmentDate,
                status: 'scheduled',
                remarks,
              },
              { transaction: t }
            );
          });

          const ipAddress = req.ip || req.socket.remoteAddress;
          await audit.log({
            userId: req.user ? req.user.id : null,
            action: 'CREATE_APPOINTMENT',
            entity: 'Appointment',
            entityId: appointment.appointment_id,
            ipAddress,
            details: { patient_id, doctor_id, date_time },
          });

          logger.info(`Appointment booked: #${appointment.appointment_id} for Doctor #${doctor_id}`);

          res.status(201).json({
            message: 'Appointment booked successfully',
            data: appointment,
          });
        } catch (err) {
          if (err.status) {
            res.status(err.status).json({ error: err.message });
          } else if (
            err.name === 'SequelizeUniqueConstraintError' ||
            err.name === 'SequelizeDatabaseError' ||
            err.message?.includes('SQLITE_BUSY')
          ) {
            res.status(409).json({ error: 'Doctor is already booked at this exact date and time.' });
          } else {
            logger.error('Error creating appointment', { message: err.message });
            res.status(500).json({ error: 'Failed to book appointment' });
          }
        }
        resolve();
      })
      .catch((fatalErr) => {
        logger.error('Unexpected booking queue failure', { message: fatalErr.message });
        res.status(500).json({ error: 'Internal server error' });
        resolve();
      });
  });
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
    } else if (req.user.role === 'patient') {
      const patientProfile = await Patient.findOne({ where: { user_id: req.user.id } });
      const currentPatientId = patientProfile ? patientProfile.patient_id : null;
      if (!currentPatientId) {
        return res.status(200).json({ data: [], pagination: { total: 0, page, limit, totalPages: 0 } });
      }
      whereClause.patient_id = currentPatientId;
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

    // Role checks (Doctor or Patient IDOR scoping)
    if (req.user.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
      if (doctorProfile && appointment.doctor_id !== doctorProfile.doctor_id) {
        return res.status(403).json({ error: "Forbidden: You cannot access another doctor's appointment." });
      }
    } else if (req.user.role === 'patient') {
      const patientProfile = await Patient.findOne({ where: { user_id: req.user.id } });
      if (!patientProfile || appointment.patient_id !== patientProfile.patient_id) {
        return res.status(403).json({ error: "Forbidden: You cannot access another patient's appointment." });
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
  const { id } = req.params;
  const { date_time, status, remarks } = req.body;

  try {
    const updated = await sequelize.transaction(async (t) => {
      const appointment = await Appointment.findByPk(id, { transaction: t });
      if (!appointment) {
        const error = new Error('Appointment not found');
        error.status = 404;
        throw error;
      }

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
        });

        if (conflict) {
          const error = new Error('Doctor is already booked at this new date and time.');
          error.status = 409;
          throw error;
        }

        appointment.date_time = newDateTime;
      }

      if (status !== undefined) appointment.status = status;
      if (remarks !== undefined) appointment.remarks = remarks;

      await appointment.save({ transaction: t });
      return appointment;
    });

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user ? req.user.id : null,
      action: 'UPDATE_APPOINTMENT',
      entity: 'Appointment',
      entityId: updated.appointment_id,
      ipAddress,
      details: req.body,
    });

    logger.info(`Appointment updated: #${updated.appointment_id}`);

    return res.status(200).json({
      message: 'Appointment updated successfully',
      data: updated,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
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

    // Patient role check: can only cancel own appointment
    if (req.user.role === 'patient') {
      const patientProfile = await Patient.findOne({ where: { user_id: req.user.id } });
      if (!patientProfile || appointment.patient_id !== patientProfile.patient_id) {
        return res.status(403).json({ error: "Forbidden: You cannot cancel another patient's appointment." });
      }
    }

    appointment.status = 'cancelled';
    await appointment.save();

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user ? req.user.id : null,
      action: 'CANCEL_APPOINTMENT',
      entity: 'Appointment',
      entityId: id,
      ipAddress,
      details: { status: 'cancelled' },
    });

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
