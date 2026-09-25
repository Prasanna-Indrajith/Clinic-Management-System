'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { Appointment, Patient, Doctor } = require('../models');
const logger = require('../config/logger');
const auditLog = require('../utils/auditLog');

router.use(authMiddleware);

/**
 * @openapi
 * /api/notifications/reminder/{appointmentId}:
 *   post:
 *     summary: Queue a reminder notification for an appointment
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reminder notification queued
 *       404:
 *         description: Appointment not found
 */
router.post('/reminder/:appointmentId', async (req, res, next) => {
    try {
        const appointmentId = parseInt(req.params.appointmentId, 10);
        if (isNaN(appointmentId)) {
            return res.status(400).json({ error: 'Invalid appointment ID' });
        }

        const appointment = await Appointment.findByPk(appointmentId, {
            include: [
                { model: Patient, as: 'patient', attributes: ['patient_id', 'name', 'contact'] },
                { model: Doctor, as: 'doctor', attributes: ['doctor_id', 'name'] },
            ],
        });

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Stub notification delivery — logs details for audit/future SMS/email provider
        const patientName = appointment.patient?.name || 'Patient';
        const contact = appointment.patient?.contact || 'N/A';
        logger.info(
            `[NOTIFICATION STUB] Appointment reminder queued for appointment #${appointment.appointment_id} -> ${patientName} (${contact})`
        );

        await auditLog.log({
            userId: req.user.id || req.user.user_id,
            action: 'NOTIFICATION_SENT',
            entity: 'Appointment',
            entityId: appointment.appointment_id,
            details: {
                type: 'reminder',
                recipient: patientName,
                dateTime: appointment.date_time,
            },
        });

        return res.status(200).json({
            success: true,
            message: `Reminder notification queued for ${patientName}`,
            appointment_id: appointment.appointment_id,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
