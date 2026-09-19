'use strict';

const express = require('express');
const router = express.Router();
const medicalRecordController = require('../controllers/medicalRecordController');
const authMiddleware = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    }
    next();
};

const createRecordValidation = [
    body('diagnosis').trim().notEmpty().withMessage('Diagnosis is required'),
    body('prescription').optional().trim(),
    body('notes').optional().trim(),
    body('doctor_id').optional({ nullable: true }).isInt().withMessage('doctor_id must be an integer'),
    validate,
];

// All medical record endpoints require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/medical-records/{patientId}:
 *   get:
 *     summary: List medical records for a patient
 *     tags: [MedicalRecords]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of medical records
 *       403:
 *         description: Forbidden - doctor can only see own patients
 *       404:
 *         description: Patient not found
 */
router.get('/:patientId', medicalRecordController.getRecordsByPatient);

/**
 * @openapi
 * /api/medical-records/{patientId}:
 *   post:
 *     summary: Create a medical record for a patient
 *     tags: [MedicalRecords]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [diagnosis]
 *             properties:
 *               diagnosis:
 *                 type: string
 *               prescription:
 *                 type: string
 *               notes:
 *                 type: string
 *               doctor_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Medical record created
 *       403:
 *         description: Forbidden
 */
router.post('/:patientId', createRecordValidation, medicalRecordController.createRecord);

module.exports = router;
