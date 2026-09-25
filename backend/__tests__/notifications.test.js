'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Patient, Doctor, Appointment } = require('../src/models');
const { generateToken } = require('../src/utils/token');

describe('Notifications API', () => {
    let receptionistToken;
    let appointmentId;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        const user = await User.create({
            name: 'Receptionist Test',
            email: 'reception@example.com',
            password_hash: 'hashedpassword',
            role: 'receptionist',
        });

        const patient = await Patient.create({
            name: 'Jane Doe',
            dob: '1992-05-15',
            contact: '555-9876',
        });

        const doctor = await Doctor.create({
            name: 'Dr. John Smith',
            specialization: 'Cardiology',
            schedule: 'Mon-Fri 09:00-17:00',
            email: 'dr.smith@example.com',
            contact: '555-1122',
        });

        const appointment = await Appointment.create({
            patient_id: patient.patient_id,
            doctor_id: doctor.doctor_id,
            date_time: new Date(Date.now() + 86400000),
            status: 'scheduled',
        });

        appointmentId = appointment.appointment_id;
        receptionistToken = generateToken(user);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('NOTIF-01: requires authentication to send reminder', async () => {
        const res = await request(app).post(`/api/notifications/reminder/${appointmentId}`);
        expect(res.status).toBe(401);
    });

    it('NOTIF-02: returns 404 for non-existent appointment', async () => {
        const res = await request(app)
            .post('/api/notifications/reminder/99999')
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
    });

    it('NOTIF-03: returns 400 for invalid appointment ID', async () => {
        const res = await request(app)
            .post('/api/notifications/reminder/invalid-id')
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(res.status).toBe(400);
    });

    it('NOTIF-04: successfully queues notification reminder for valid appointment', async () => {
        const res = await request(app)
            .post(`/api/notifications/reminder/${appointmentId}`)
            .set('Authorization', `Bearer ${receptionistToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.appointment_id).toBe(appointmentId);
        expect(res.body.message).toContain('Jane Doe');
    });
});
