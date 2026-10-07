'use strict';

const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  createDoctorValidation,
  updateDoctorValidation,
} = require('../validators/doctorValidator');

// All doctor endpoints require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/doctors:
 *   get:
 *     summary: List all doctors
 *     tags: [Doctors]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of doctors
 */
router.get('/', doctorController.getAllDoctors);

/**
 * @openapi
 * /api/doctors/{id}:
 *   get:
 *     summary: Get doctor by ID
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor details
 *       404:
 *         description: Doctor not found
 */
router.get('/:id', doctorController.getDoctorById);

/**
 * @openapi
 * /api/doctors/{id}/availability:
 *   get:
 *     summary: Get doctor availability slots by date
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Doctor availability slots
 *       404:
 *         description: Doctor not found
 */
router.get('/:id/availability', doctorController.getDoctorAvailability);

/**
 * @openapi
 * /api/doctors:
 *   post:
 *     summary: Create doctor record (Admin only)
 *     tags: [Doctors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, specialization, contact, email]
 *             properties:
 *               name:
 *                 type: string
 *               specialization:
 *                 type: string
 *               contact:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Doctor created successfully
 *       403:
 *         description: Forbidden - admin only
 */
router.post('/', requireRole(['admin']), createDoctorValidation, doctorController.createDoctor);

/**
 * @openapi
 * /api/doctors/{id}:
 *   put:
 *     summary: Update doctor record (Admin only)
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor updated successfully
 *       403:
 *         description: Forbidden - admin only
 *       404:
 *         description: Doctor not found
 */
router.put('/:id', requireRole(['admin']), updateDoctorValidation, doctorController.updateDoctor);

/**
 * @openapi
 * /api/doctors/{id}:
 *   delete:
 *     summary: Delete doctor record (Admin only)
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor deleted successfully
 *       403:
 *         description: Forbidden - admin only
 *       404:
 *         description: Doctor not found
 */
router.delete('/:id', requireRole(['admin']), doctorController.deleteDoctor);

module.exports = router;
