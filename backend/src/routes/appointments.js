'use strict';

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createAppointmentValidation,
  updateAppointmentValidation,
} = require('../validators/appointmentValidator');

// All appointment endpoints require authentication
router.use(authMiddleware);

router.get('/', appointmentController.getAllAppointments);
router.get('/:id', appointmentController.getAppointmentById);
router.post('/', createAppointmentValidation, appointmentController.createAppointment);
router.put('/:id', updateAppointmentValidation, appointmentController.updateAppointment);
router.patch('/:id/cancel', appointmentController.cancelAppointment);
router.delete('/:id', appointmentController.cancelAppointment); // Soft cancel on delete

module.exports = router;
