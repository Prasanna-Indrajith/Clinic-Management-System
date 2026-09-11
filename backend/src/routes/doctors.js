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

// Read endpoints: Any authenticated role can view
router.get('/', doctorController.getAllDoctors);
router.get('/:id', doctorController.getDoctorById);

// Write endpoints: Admin only
router.post('/', requireRole(['admin']), createDoctorValidation, doctorController.createDoctor);
router.put('/:id', requireRole(['admin']), updateDoctorValidation, doctorController.updateDoctor);
router.delete('/:id', requireRole(['admin']), doctorController.deleteDoctor);

module.exports = router;
