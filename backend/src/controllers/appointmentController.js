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

module.exports = {
  createAppointment,
};
