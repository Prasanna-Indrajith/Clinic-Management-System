'use strict';

const { Op } = require('sequelize');
const { MedicalRecord, Patient, Doctor, Appointment } = require('../models');
const logger = require('../config/logger');
const audit = require('../utils/auditLog');

/**
 * List medical records for a specific patient (Doctor sees only their own patients' records).
 */
const getRecordsByPatient = async (req, res) => {
    try {
        const { patientId } = req.params;

        // Verify patient exists
        const patient = await Patient.findByPk(patientId);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Role-based access: Doctor can only see records for patients they've treated
        if (req.user.role === 'doctor') {
            const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
            if (!doctorProfile) {
                return res.status(403).json({ error: 'Forbidden: No doctor profile found' });
            }

            const hasAccess = await MedicalRecord.findOne({
                where: { patient_id: patientId, doctor_id: doctorProfile.doctor_id },
            });
            if (!hasAccess) {
                return res.status(403).json({ error: 'Forbidden: Access to this patient\'s records is restricted' });
            }
        } else if (req.user.role === 'patient') {
            if (patient.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden: Access to this patient\'s records is restricted' });
            }
        }

        const records = await MedicalRecord.findAll({
            where: { patient_id: patientId },
            include: [
                { model: Doctor, as: 'doctor', attributes: ['doctor_id', 'name', 'specialization'] },
                { model: Appointment, as: 'appointment', attributes: ['appointment_id', 'date_time', 'status', 'remarks'] },
            ],
            order: [['record_date', 'DESC'], ['record_id', 'DESC']],
        });

        return res.status(200).json({ data: records });
    } catch (err) {
        logger.error('Error fetching medical records', { message: err.message });
        return res.status(500).json({ error: 'Failed to retrieve medical records' });
    }
};

/**
 * Create a new medical record (Doctor only — for patients they've treated).
 */
const createRecord = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { diagnosis, prescription, notes } = req.body;

        // Verify patient exists
        const patient = await Patient.findByPk(patientId);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        if (req.user.role === 'patient' || req.user.role === 'receptionist') {
            return res.status(403).json({ error: 'Forbidden: Only doctors and administrators can create medical records' });
        }

        // Doctor must have a doctor profile
        if (req.user.role === 'doctor') {
            const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
            if (!doctorProfile) {
                return res.status(403).json({ error: 'Forbidden: No doctor profile found' });
            }

            // Verify doctor has treated this patient (has an appointment)
            const { Appointment } = require('../models');
            const hasTreated = await Appointment.findOne({
                where: { patient_id: patientId, doctor_id: doctorProfile.doctor_id },
            });
            if (!hasTreated) {
                return res.status(403).json({ error: 'Forbidden: You have not treated this patient' });
            }

            const record = await MedicalRecord.create({
                patient_id: patientId,
                doctor_id: doctorProfile.doctor_id,
                diagnosis,
                prescription,
                notes,
            });

            const ipAddress = req.ip || req.socket.remoteAddress;
            await audit.log({
                userId: req.user.id,
                action: 'CREATE_MEDICAL_RECORD',
                entity: 'MedicalRecord',
                entityId: record.record_id,
                ipAddress,
                details: { patient_id: patientId, doctor_id: doctorProfile.doctor_id },
            });

            logger.info(`Medical record created: #${record.record_id} for Patient #${patientId}`);

            return res.status(201).json({
                message: 'Medical record created successfully',
                data: record,
            });
        }

        // Admin can create records for any patient
        if (req.user.role === 'admin') {
            const { doctor_id } = req.body;
            const record = await MedicalRecord.create({
                patient_id: patientId,
                doctor_id: doctor_id || null,
                diagnosis,
                prescription,
                notes,
            });

            const ipAddress = req.ip || req.socket.remoteAddress;
            await audit.log({
                userId: req.user.id,
                action: 'CREATE_MEDICAL_RECORD',
                entity: 'MedicalRecord',
                entityId: record.record_id,
                ipAddress,
                details: { patient_id: patientId, doctor_id: doctor_id || null },
            });

            logger.info(`Medical record created: #${record.record_id} for Patient #${patientId} by Admin`);

            return res.status(201).json({
                message: 'Medical record created successfully',
                data: record,
            });
        }

        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    } catch (err) {
        logger.error('Error creating medical record', { message: err.message });
        return res.status(500).json({ error: 'Failed to create medical record' });
    }
};

/**
 * Get the clinical report / medical record for a specific appointment.
 */
const getRecordByAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const appointment = await Appointment.findByPk(appointmentId, {
            include: [
                { model: Patient, as: 'patient', attributes: ['patient_id', 'name', 'contact', 'user_id'] },
                { model: Doctor, as: 'doctor', attributes: ['doctor_id', 'name', 'specialization'] },
            ],
        });

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        if (req.user.role === 'patient') {
            const patientProfile = await Patient.findOne({ where: { user_id: req.user.id } });
            if (!patientProfile || appointment.patient_id !== patientProfile.patient_id) {
                return res.status(403).json({ error: "Forbidden: You cannot access another patient's report." });
            }
        } else if (req.user.role === 'doctor') {
            const doctorProfile = await Doctor.findOne({ where: { user_id: req.user.id } });
            if (!doctorProfile || appointment.doctor_id !== doctorProfile.doctor_id) {
                return res.status(403).json({ error: "Forbidden: You cannot access another doctor's report." });
            }
        } else if (req.user.role !== 'admin' && req.user.role !== 'receptionist') {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        let medicalRecord = await MedicalRecord.findOne({
            where: { appointment_id: appointment.appointment_id },
            include: [{ model: Doctor, as: 'doctor', attributes: ['doctor_id', 'name', 'specialization'] }],
        });

        // Fallback for older/seeded records created without appointment_id
        if (!medicalRecord) {
            const apptMs = new Date(appointment.date_time).getTime();
            const candidateDates = [-86400000, 0, 86400000].map((offset) =>
                new Date(apptMs + offset).toISOString().split('T')[0]
            );
            medicalRecord = await MedicalRecord.findOne({
                where: {
                    patient_id: appointment.patient_id,
                    doctor_id: appointment.doctor_id,
                    record_date: { [Op.in]: candidateDates },
                },
                include: [{ model: Doctor, as: 'doctor', attributes: ['doctor_id', 'name', 'specialization'] }],
                order: [['record_id', 'DESC']],
            });
        }

        return res.status(200).json({
            data: {
                appointment,
                medicalRecord,
            },
        });
    } catch (err) {
        logger.error('Error fetching appointment report', { message: err.message });
        return res.status(500).json({ error: 'Failed to retrieve appointment report' });
    }
};

module.exports = {
    getRecordsByPatient,
    getRecordByAppointment,
    createRecord,
};
