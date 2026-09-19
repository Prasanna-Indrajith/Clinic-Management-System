'use strict';

const { Op } = require('sequelize');
const { Appointment, Patient, Doctor } = require('../models');
const logger = require('../config/logger');
const audit = require('../utils/auditLog');

/**
 * Daily report — appointments for a given date, with counts by status.
 * Admin sees all; Doctor sees only their own appointments.
 */
const dailyReport = async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const whereClause = {
      date_time: { [Op.between]: [startOfDay, endOfDay] },
    };

    // Doctor scoped to own appointments
    if (req.user.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
      if (!doctorProfile) {
        return res.status(200).json({ data: { date, appointments: [], summary: {} } });
      }
      whereClause.doctor_id = doctorProfile.doctor_id;
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        { model: Patient, as: 'patient', attributes: ['patient_id', 'name', 'contact'] },
        { model: Doctor, as: 'doctor', attributes: ['doctor_id', 'name', 'specialization'] },
      ],
      order: [['date_time', 'ASC']],
    });

    const summary = {
      total: appointments.length,
      scheduled: appointments.filter((a) => a.status === 'scheduled').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    };

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user.id,
      action: 'GENERATE_DAILY_REPORT',
      entity: 'Report',
      entityId: null,
      ipAddress,
      details: { date, requestedBy: req.user.role },
    });

    return res.status(200).json({
      data: {
        date,
        summary,
        appointments,
      },
    });
  } catch (err) {
    logger.error('Error generating daily report', { message: err.message });
    return res.status(500).json({ error: 'Failed to generate daily report' });
  }
};

/**
 * Monthly report — visits per doctor and per patient for a given month.
 */
const monthlyReport = async (req, res) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required (YYYY, MM)' });
    }

    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'month must be between 1 and 12' });
    }

    const startOfMonth = new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00.000Z`);
    const endOfMonth = new Date(
      new Date(startOfMonth.getFullYear(), monthNum, 0, 23, 59, 59, 999).toISOString()
    );

    const whereClause = {
      date_time: { [Op.between]: [startOfMonth, endOfMonth] },
    };

    // Doctor scoped
    if (req.user.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
      if (!doctorProfile) {
        return res.status(200).json({
          data: { year, month, perDoctor: [], perPatient: [], summary: {} },
        });
      }
      whereClause.doctor_id = doctorProfile.doctor_id;
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        { model: Patient, as: 'patient', attributes: ['patient_id', 'name'] },
        { model: Doctor, as: 'doctor', attributes: ['doctor_id', 'name', 'specialization'] },
      ],
      order: [['date_time', 'ASC']],
    });

    // Per-doctor totals
    const perDoctorMap = {};
    appointments.forEach((a) => {
      const key = a.doctor.doctor_id;
      if (!perDoctorMap[key]) {
        perDoctorMap[key] = { doctor_id: key, name: a.doctor.name, specialization: a.doctor.specialization, total: 0 };
      }
      perDoctorMap[key].total += 1;
    });

    // Per-patient totals
    const perPatientMap = {};
    appointments.forEach((a) => {
      const key = a.patient.patient_id;
      if (!perPatientMap[key]) {
        perPatientMap[key] = { patient_id: key, name: a.patient.name, total: 0 };
      }
      perPatientMap[key].total += 1;
    });

    const summary = {
      total: appointments.length,
      scheduled: appointments.filter((a) => a.status === 'scheduled').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    };

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user.id,
      action: 'GENERATE_MONTHLY_REPORT',
      entity: 'Report',
      entityId: null,
      ipAddress,
      details: { year, month, requestedBy: req.user.role },
    });

    return res.status(200).json({
      data: {
        year,
        month,
        summary,
        perDoctor: Object.values(perDoctorMap),
        perPatient: Object.values(perPatientMap),
      },
    });
  } catch (err) {
    logger.error('Error generating monthly report', { message: err.message });
    return res.status(500).json({ error: 'Failed to generate monthly report' });
  }
};

module.exports = {
  dailyReport,
  monthlyReport,
};