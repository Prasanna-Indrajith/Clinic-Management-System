'use strict';

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const authMiddleware = require('../middleware/authMiddleware');
const { createAppointmentValidation } = require('../validators/appointmentValidator');

// All appointment endpoints require authentication
router.use(authMiddleware);

// Book new appointment
router.post('/', createAppointmentValidation, appointmentController.createAppointment);

module.exports = router;
