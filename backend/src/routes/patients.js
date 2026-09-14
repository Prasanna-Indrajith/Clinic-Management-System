'use strict';

const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  createPatientValidation,
  updatePatientValidation,
} = require('../validators/patientValidator');

// All patient endpoints require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/patients:
 *   get:
 *     summary: List patients (Admin sees all; Doctors see assigned patients)
 *     tags: [Patients]
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
 *     responses:
 *       200:
 *         description: List of patients
 *       401:
 *         description: Unauthorized
 */
router.get('/', patientController.getAllPatients);

/**
 * @openapi
 * /api/patients/{id}:
 *   get:
 *     summary: Get patient details by ID
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Patient details
 *       404:
 *         description: Patient not found
 */
router.get('/:id', patientController.getPatientById);

/**
 * @openapi
 * /api/patients:
 *   post:
 *     summary: Create new patient record (Admin only)
 *     tags: [Patients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, dob, contact]
 *             properties:
 *               name:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *               contact:
 *                 type: string
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Patient created successfully
 *       403:
 *         description: Forbidden - admin only
 */
router.post('/', requireRole(['admin']), createPatientValidation, patientController.createPatient);

/**
 * @openapi
 * /api/patients/{id}:
 *   put:
 *     summary: Update patient record (Admin only)
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Patient updated successfully
 *       403:
 *         description: Forbidden - admin only
 *       404:
 *         description: Patient not found
 */
router.put('/:id', requireRole(['admin']), updatePatientValidation, patientController.updatePatient);

/**
 * @openapi
 * /api/patients/{id}:
 *   delete:
 *     summary: Delete patient record (Admin only)
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Patient deleted successfully
 *       403:
 *         description: Forbidden - admin only
 *       404:
 *         description: Patient not found
 */
router.delete('/:id', requireRole(['admin']), patientController.deletePatient);

module.exports = router;
