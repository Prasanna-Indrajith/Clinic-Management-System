'use strict';

const { Doctor } = require('../models');
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

/**
 * Create new doctor (Admin only)
 */
const createDoctor = async (req, res) => {
  try {
    const { name, specialization, contact, email, user_id } = req.body;

    const doctor = await Doctor.create({
      name,
      specialization,
      contact,
      email,
      user_id: user_id || null,
    });

    logger.info(`Doctor created: ${doctor.name} (ID: ${doctor.doctor_id})`);

    return res.status(201).json({
      message: 'Doctor created successfully',
      data: doctor,
    });
  } catch (err) {
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
    logger.info(`Doctor deleted: ${id}`);

    return res.status(200).json({
      message: 'Doctor deleted successfully',
    });
  } catch (err) {
    logger.error('Error deleting doctor', { message: err.message });
    return res.status(500).json({ error: 'Failed to delete doctor' });
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
