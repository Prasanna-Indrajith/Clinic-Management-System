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

// Read endpoints: Admin and Doctor (Doctor gets assigned patients only)
router.get('/', patientController.getAllPatients);
router.get('/:id', patientController.getPatientById);

// Write endpoints: Admin only
router.post('/', requireRole(['admin']), createPatientValidation, patientController.createPatient);
router.put('/:id', requireRole(['admin']), updatePatientValidation, patientController.updatePatient);
router.delete('/:id', requireRole(['admin']), patientController.deletePatient);

module.exports = router;
