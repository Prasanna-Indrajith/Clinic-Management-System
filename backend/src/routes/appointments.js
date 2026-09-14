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

/**
 * @openapi
 * /api/appointments:
 *   get:
 *     summary: List appointments with role-scoping and filters
 *     tags: [Appointments]
 *     parameters:
 *       - in: query
 *         name: doctor_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: patient_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled]
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of appointments
 */
router.get('/', appointmentController.getAllAppointments);

/**
 * @openapi
 * /api/appointments/{id}:
 *   get:
 *     summary: Get appointment by ID
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment details
 *       404:
 *         description: Appointment not found
 */
router.get('/:id', appointmentController.getAppointmentById);

/**
 * @openapi
 * /api/appointments:
 *   post:
 *     summary: Book an appointment (with double-booking check)
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patient_id, doctor_id, date_time]
 *             properties:
 *               patient_id:
 *                 type: integer
 *               doctor_id:
 *                 type: integer
 *               date_time:
 *                 type: string
 *                 format: date-time
 *               remarks:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment booked successfully
 *       409:
 *         description: Conflict - doctor already booked at this time
 */
router.post('/', createAppointmentValidation, appointmentController.createAppointment);

/**
 * @openapi
 * /api/appointments/{id}:
 *   put:
 *     summary: Update or reschedule appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date_time:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [scheduled, completed, cancelled]
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment updated successfully
 *       409:
 *         description: Conflict - doctor already booked at new time
 */
router.put('/:id', updateAppointmentValidation, appointmentController.updateAppointment);

/**
 * @openapi
 * /api/appointments/{id}/cancel:
 *   patch:
 *     summary: Cancel appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment cancelled successfully
 */
router.patch('/:id/cancel', appointmentController.cancelAppointment);
router.delete('/:id', appointmentController.cancelAppointment); // Soft cancel on delete

module.exports = router;
