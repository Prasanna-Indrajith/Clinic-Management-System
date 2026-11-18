'use strict';

const { Op } = require('sequelize');
const { sequelize, Doctor, Appointment, User } = require('../models');
const logger = require('../config/logger');

const { buildSearchClause, getPagination } = require('../utils/search');

/**
 * List doctors with pagination and search
 */
const getAllDoctors = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const search = req.query.search || req.query.q || '';
    const specialization = req.query.specialization;

    const whereClause = {};

    const searchClause = buildSearchClause(search, ['name', 'specialization', 'email']);
    if (searchClause) {
      Object.assign(whereClause, searchClause);
    }

    if (specialization) {
      whereClause.specialization = specialization;
    }

    const { count, rows } = await Doctor.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['name', 'ASC']],
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
    logger.error('Error fetching doctors', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve doctors' });
  }
};

/**
 * Get single doctor by ID
 */
const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByPk(id);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    return res.status(200).json({ data: doctor });
  } catch (err) {
    logger.error('Error fetching doctor', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve doctor details' });
  }
};

const audit = require('../utils/auditLog');

/**
 * Create new doctor (Admin or Receptionist)
 * Optionally creates a linked User account (role: 'doctor') if password is provided.
 */
const createDoctor = async (req, res) => {
  try {
    const { name, specialization, contact, email, user_id, password } = req.body;

    const existingDoctor = await Doctor.findOne({ where: { email } });
    if (existingDoctor) {
      return res.status(409).json({ error: 'A doctor with this email already exists' });
    }

    const doctor = await sequelize.transaction(async (t) => {
      let effectiveUserId = user_id || null;

      if (password && !effectiveUserId) {
        const existingUser = await User.findOne({ where: { email }, transaction: t });
        if (existingUser) {
          const err = new Error('Email already registered');
          err.status = 409;
          throw err;
        }

        const createdUser = await User.create(
          {
            name,
            email,
            password_hash: password,
            role: 'doctor',
          },
          { transaction: t }
        );
        effectiveUserId = createdUser.user_id;
      }

      return Doctor.create(
        {
          name,
          specialization,
          contact,
          email,
          user_id: effectiveUserId,
        },
        { transaction: t }
      );
    });

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user ? req.user.id : null,
      action: 'CREATE_DOCTOR',
      entity: 'Doctor',
      entityId: doctor.doctor_id,
      ipAddress,
      details: {
        name: doctor.name,
        specialization: doctor.specialization,
        withUserAccount: Boolean(doctor.user_id),
      },
    });

    logger.info(`Doctor created: ${doctor.name} (ID: ${doctor.doctor_id})`);

    return res.status(201).json({
      message: 'Doctor created successfully',
      data: doctor,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    logger.error('Error creating doctor', { message: err.message });
    return res.status(500).json({ error: 'Failed to create doctor' });
  }
};

/**
 * Update doctor (Admin only)
 */
const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByPk(id);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const { name, specialization, contact, email, user_id } = req.body;
    await doctor.update({
      ...(name !== undefined && { name }),
      ...(specialization !== undefined && { specialization }),
      ...(contact !== undefined && { contact }),
      ...(email !== undefined && { email }),
      ...(user_id !== undefined && { user_id }),
    });

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user ? req.user.id : null,
      action: 'UPDATE_DOCTOR',
      entity: 'Doctor',
      entityId: doctor.doctor_id,
      ipAddress,
      details: req.body,
    });

    logger.info(`Doctor updated: ${doctor.doctor_id}`);

    return res.status(200).json({
      message: 'Doctor updated successfully',
      data: doctor,
    });
  } catch (err) {
    logger.error('Error updating doctor', { message: err.message });
    return res.status(500).json({ error: 'Failed to update doctor' });
  }
};

/**
 * Delete doctor (Admin only)
 */
const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByPk(id);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    await doctor.destroy();

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: req.user ? req.user.id : null,
      action: 'DELETE_DOCTOR',
      entity: 'Doctor',
      entityId: id,
      ipAddress,
      details: { doctor_id: id },
    });

    logger.info(`Doctor deleted: ${id}`);

    return res.status(200).json({
      message: 'Doctor deleted successfully',
    });
  } catch (err) {
    logger.error('Error deleting doctor', { message: err.message });
    return res.status(500).json({ error: 'Failed to delete doctor' });
  }
};

/**
 * Get doctor's availability slots for a specific date
 * Query params: ?date=YYYY-MM-DD
 */
const getDoctorAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByPk(id);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const tzOffsetRaw = req.query.tzOffset;
    const parsedOffset = Number(tzOffsetRaw);
    const tzOffsetMinutes =
      tzOffsetRaw !== undefined && tzOffsetRaw !== '' && Number.isFinite(parsedOffset)
        ? parsedOffset
        : 0;

    const nowMs = Date.now();
    const defaultLocalDate = new Date(nowMs - tzOffsetMinutes * 60 * 1000).toISOString().split('T')[0];
    const targetDate = req.query.date || defaultLocalDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Standard clinical consultation slot definitions
    const slotDefinitions = [
      { time: '08:30', hour: 8, minute: 30 },
      { time: '09:30', hour: 9, minute: 30 },
      { time: '10:45', hour: 10, minute: 45 },
      { time: '11:45', hour: 11, minute: 45 },
      { time: '14:00', hour: 14, minute: 0 },
      { time: '15:15', hour: 15, minute: 15 },
      { time: '16:30', hour: 16, minute: 30 },
      { time: '17:30', hour: 17, minute: 30 },
    ];

    const [year, month, day] = targetDate.split('-').map(Number);
    // Buffer query range by 12 hours on both sides to handle UTC / local timezone boundaries seamlessly
    const queryStart = new Date(Date.UTC(year, month - 1, day - 1, 12, 0, 0, 0));
    const queryEnd = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0, 0));

    const existingAppointments = await Appointment.findAll({
      where: {
        doctor_id: doctor.doctor_id,
        date_time: {
          [Op.between]: [queryStart, queryEnd],
        },
        status: {
          [Op.ne]: 'cancelled',
        },
      },
      attributes: ['appointment_id', 'date_time', 'status'],
    });

    const slots = slotDefinitions.map((def) => {
      const slotTimestamp =
        Date.UTC(year, month - 1, day, def.hour, def.minute, 0, 0) + tzOffsetMinutes * 60 * 1000;
      const slotDate = new Date(slotTimestamp);
      const isPast = slotDate.getTime() <= nowMs;

      // Match if existing appointment is within 25 minutes of slot timestamp
      const isBooked = existingAppointments.some((apt) => {
        const aptDate = new Date(apt.date_time);
        const diffMs = Math.abs(aptDate.getTime() - slotDate.getTime());
        return diffMs < 25 * 60 * 1000;
      });

      const available = !isBooked && !isPast;
      const reason = isBooked ? 'Booked' : isPast ? 'Past' : 'Available';

      return {
        time: def.time,
        dateTime: slotDate.toISOString(),
        available,
        reason,
      };
    });

    return res.status(200).json({
      doctor: {
        doctor_id: doctor.doctor_id,
        name: doctor.name,
        specialization: doctor.specialization,
      },
      date: targetDate,
      totalSlots: slots.length,
      availableSlotsCount: slots.filter((s) => s.available).length,
      slots,
    });
  } catch (err) {
    logger.error('Error fetching doctor availability', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve doctor availability' });
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  getDoctorAvailability,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
