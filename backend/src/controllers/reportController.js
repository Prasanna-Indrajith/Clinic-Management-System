'use strict';

const { Op } = require('sequelize');
const { Appointment, Patient, Doctor } = require('../models');
const logger = require('../config/logger');
const audit = require('../utils/auditLog');
const { streamDailyReportPDF, streamMonthlyReportPDF } = require('../utils/pdfGenerator');

/**
 * Helper to fetch daily report dataset respecting role scoping.
 */
async function fetchDailyReportData(date, user) {
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const whereClause = {
    date_time: { [Op.between]: [startOfDay, endOfDay] },
  };

  // Doctor scoped to own appointments
  if (user.role === 'doctor') {
    const doctorProfile = await Doctor.findOne({ where: { user_id: user.id } });
    if (!doctorProfile) {
      return {
        date,
        appointments: [],
        summary: { total: 0, scheduled: 0, completed: 0, cancelled: 0 },
      };
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

  return { date, appointments, summary };
}

/**
 * Helper to fetch monthly report dataset respecting role scoping.
 */
async function fetchMonthlyReportData(year, month, user) {
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  const startOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));

  const whereClause = {
    date_time: { [Op.between]: [startOfMonth, endOfMonth] },
  };

  // Doctor scoped
  if (user.role === 'doctor') {
    const doctorProfile = await Doctor.findOne({ where: { user_id: user.id } });
    if (!doctorProfile) {
      return {
        year: yearNum,
        month: monthNum,
        summary: { total: 0, scheduled: 0, completed: 0, cancelled: 0 },
        perDoctor: [],
        byDoctor: [],
        perPatient: [],
        byPatient: [],
      };
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
    if (a.doctor) {
      const key = a.doctor.doctor_id;
      if (!perDoctorMap[key]) {
        perDoctorMap[key] = { doctor_id: key, name: a.doctor.name, specialization: a.doctor.specialization, total: 0 };
      }
      perDoctorMap[key].total += 1;
    }
  });

  // Per-patient totals
  const perPatientMap = {};
  appointments.forEach((a) => {
    if (a.patient) {
      const key = a.patient.patient_id;
      if (!perPatientMap[key]) {
        perPatientMap[key] = { patient_id: key, name: a.patient.name, total: 0 };
      }
      perPatientMap[key].total += 1;
    }
  });

  const summary = {
    total: appointments.length,
    scheduled: appointments.filter((a) => a.status === 'scheduled').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
    cancelled: appointments.filter((a) => a.status === 'cancelled').length,
  };

  const doctorList = Object.values(perDoctorMap);
  const patientList = Object.values(perPatientMap);

  return {
    year: yearNum,
    month: monthNum,
    summary,
    perDoctor: doctorList,
    byDoctor: doctorList,
    perPatient: patientList,
    byPatient: patientList,
  };
}

/**
 * Daily report — appointments for a given date, with counts by status (JSON).
 */
const dailyReport = async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }

    const data = await fetchDailyReportData(date, req.user);

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user.id,
      action: 'GENERATE_DAILY_REPORT',
      entity: 'Report',
      entityId: null,
      ipAddress,
      details: { date, requestedBy: req.user.role },
    });

    logger.info(`Daily report generated for ${date} by ${req.user.email} (${req.user.role})`);

    return res.status(200).json({ data });
  } catch (err) {
    logger.error('Error generating daily report', { message: err.message });
    return res.status(500).json({ error: 'Failed to generate daily report' });
  }
};

/**
 * Monthly report — visits per doctor and per patient for a given month (JSON).
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

    const data = await fetchMonthlyReportData(year, monthNum, req.user);

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user.id,
      action: 'GENERATE_MONTHLY_REPORT',
      entity: 'Report',
      entityId: null,
      ipAddress,
      details: { year, month: monthNum, requestedBy: req.user.role },
    });

    logger.info(`Monthly report generated for ${year}-${monthNum} by ${req.user.email} (${req.user.role})`);

    return res.status(200).json({ data });
  } catch (err) {
    logger.error('Error generating monthly report', { message: err.message });
    return res.status(500).json({ error: 'Failed to generate monthly report' });
  }
};

/**
 * Export daily report as streamed PDF or CSV.
 */
const exportDailyReport = async (req, res) => {
  try {
    const { date, format = 'pdf' } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }

    const data = await fetchDailyReportData(date, req.user);

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user.id,
      action: 'EXPORT_DAILY_REPORT',
      entity: 'Report',
      entityId: null,
      ipAddress,
      details: { date, format, requestedBy: req.user.role },
    });

    logger.info(`Daily report exported (${format}) for ${date} by ${req.user.email}`);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="daily-report-${date}.csv"`);

      const rows = [
        ['Report', 'Daily Appointments Report'],
        ['Date', data.date],
        ['Total Appointments', data.summary.total],
        ['Scheduled', data.summary.scheduled],
        ['Completed', data.summary.completed],
        ['Cancelled', data.summary.cancelled],
        [],
        ['Appointment ID', 'Time', 'Patient ID', 'Patient Name', 'Contact', 'Doctor Name', 'Specialization', 'Status'],
        ...data.appointments.map((a) => [
          a.appointment_id || '',
          a.date_time ? new Date(a.date_time).toISOString() : '',
          a.patient?.patient_id || '',
          a.patient?.name || '',
          a.patient?.contact || '',
          a.doctor?.name || '',
          a.doctor?.specialization || '',
          a.status || '',
        ]),
      ];

      const csvContent = rows
        .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      return res.send(csvContent);
    }

    // Default: PDF format
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="daily-report-${date}.pdf"`);

    return streamDailyReportPDF(res, {
      ...data,
      requestedBy: req.user.name || req.user.email,
      requestedRole: req.user.role,
    });
  } catch (err) {
    logger.error('Error exporting daily report', { message: err.message });
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to export daily report' });
    }
  }
};

/**
 * Export monthly report as streamed PDF or CSV.
 */
const exportMonthlyReport = async (req, res) => {
  try {
    const { year, month, format = 'pdf' } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required (YYYY, MM)' });
    }

    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'month must be between 1 and 12' });
    }

    const data = await fetchMonthlyReportData(year, monthNum, req.user);

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user.id,
      action: 'EXPORT_MONTHLY_REPORT',
      entity: 'Report',
      entityId: null,
      ipAddress,
      details: { year, month: monthNum, format, requestedBy: req.user.role },
    });

    const monthFormatted = String(monthNum).padStart(2, '0');

    logger.info(`Monthly report exported (${format}) for ${year}-${monthNum} by ${req.user.email}`);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${year}-${monthFormatted}.csv"`);

      const rows = [
        ['Report', 'Monthly Activity Report'],
        ['Year', data.year],
        ['Month', data.month],
        ['Total Visits', data.summary.total],
        ['Scheduled', data.summary.scheduled],
        ['Completed', data.summary.completed],
        ['Cancelled', data.summary.cancelled],
        [],
        ['--- VISITS PER DOCTOR ---'],
        ['Doctor ID', 'Doctor Name', 'Specialization', 'Total Visits'],
        ...data.perDoctor.map((d) => [d.doctor_id, d.name, d.specialization, d.total]),
        [],
        ['--- VISITS PER PATIENT ---'],
        ['Patient ID', 'Patient Name', 'Total Visits'],
        ...data.perPatient.map((p) => [p.patient_id, p.name, p.total]),
      ];

      const csvContent = rows
        .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      return res.send(csvContent);
    }

    // Default: PDF format
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${year}-${monthFormatted}.pdf"`);

    return streamMonthlyReportPDF(res, {
      ...data,
      requestedBy: req.user.name || req.user.email,
      requestedRole: req.user.role,
    });
  } catch (err) {
    logger.error('Error exporting monthly report', { message: err.message });
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to export monthly report' });
    }
  }
};

module.exports = {
  dailyReport,
  monthlyReport,
  exportDailyReport,
  exportMonthlyReport,
};