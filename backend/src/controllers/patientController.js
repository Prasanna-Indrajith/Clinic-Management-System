'use strict';

const { Op } = require('sequelize');
const { Patient, Appointment, Doctor } = require('../models');
const logger = require('../config/logger');

/**
 * List patients with pagination and role-based filtering
 */
const getAllPatients = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = req.query.search || req.query.q || '';

    const whereClause = {};

    // Parameterized search against SQL injection
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { contact: { [Op.like]: `%${search}%` } },
      ];
    }

    const includeClause = [];

    // If requester is a Doctor, scope access to patients assigned to this doctor
    if (req.user.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
      const doctorId = doctorProfile ? doctorProfile.doctor_id : null;

      if (!doctorId) {
        return res.status(200).json({
          data: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
        });
      }

      includeClause.push({
        model: Appointment,
        as: 'appointments',
        where: { doctor_id: doctorId },
        attributes: [],
      });
    }

    const { count, rows } = await Patient.findAndCountAll({
      where: whereClause,
      include: includeClause,
      distinct: true,
      limit,
      offset,
      order: [['created_at', 'DESC']],
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
    logger.error('Error fetching patients', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve patients' });
  }
};

/**
 * Get single patient by ID
 */
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findByPk(id, {
      include: [
        {
          model: Appointment,
          as: 'appointments',
          limit: 5,
          order: [['date_time', 'DESC']],
        },
      ],
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Role check for Doctor: ensure doctor has treated or is scheduled to treat patient
    if (req.user.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
      const doctorId = doctorProfile ? doctorProfile.doctor_id : null;

      const hasAccess = await Appointment.findOne({
        where: { patient_id: id, doctor_id: doctorId },
      });

      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: Access to this patient is restricted.' });
      }
    }

    return res.status(200).json({ data: patient });
  } catch (err) {
    logger.error('Error fetching patient details', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve patient details' });
  }
};

/**
 * Create new patient record (Admin only)
 */
const createPatient = async (req, res) => {
  try {
    const { name, dob, contact, address, notes } = req.body;

    const patient = await Patient.create({
      name,
      dob,
      contact,
      address,
      notes,
    });

    logger.info(`Patient created: ${patient.name} (ID: ${patient.patient_id})`);

    return res.status(201).json({
      message: 'Patient created successfully',
      data: patient,
    });
  } catch (err) {
    logger.error('Error creating patient', { message: err.message });
    return res.status(500).json({ error: 'Failed to create patient' });
  }
};

/**
 * Update patient record (Admin only)
 */
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findByPk(id);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const { name, dob, contact, address, notes } = req.body;
    await patient.update({
      ...(name !== undefined && { name }),
      ...(dob !== undefined && { dob }),
      ...(contact !== undefined && { contact }),
      ...(address !== undefined && { address }),
      ...(notes !== undefined && { notes }),
    });

    logger.info(`Patient updated: ${patient.patient_id}`);

    return res.status(200).json({
      message: 'Patient updated successfully',
      data: patient,
    });
  } catch (err) {
    logger.error('Error updating patient', { message: err.message });
    return res.status(500).json({ error: 'Failed to update patient' });
  }
};

/**
 * Delete patient record (Admin only)
 */
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findByPk(id);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await patient.destroy();
    logger.info(`Patient deleted: ${id}`);

    return res.status(200).json({
      message: 'Patient deleted successfully',
    });
  } catch (err) {
    logger.error('Error deleting patient', { message: err.message });
    return res.status(500).json({ error: 'Failed to delete patient' });
  }
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
};
