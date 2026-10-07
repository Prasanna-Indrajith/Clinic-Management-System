'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Patient, Doctor, Appointment, MedicalRecord } = require('../src/models');
const { generateToken } = require('../src/utils/token');

describe('Patient Portal & IDOR Scoping (Phase 4 / SRS §3.1)', () => {
    let patient1User, patient2User, doctorUser;
    let patient1Token, patient2Token, doctorToken;
    let patient1, patient2, doctor;
    let appointment1, appointment2;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        patient1User = await User.create({
            name: 'Alice Patient',
            email: 'alice@patient.local',
            password_hash: 'Password123!',
            role: 'patient',
        });
        patient1Token = generateToken(patient1User);

        patient2User = await User.create({
            name: 'Bob Patient',
            email: 'bob@patient.local',
            password_hash: 'Password123!',
            role: 'patient',
        });
        patient2Token = generateToken(patient2User);

        doctorUser = await User.create({
            name: 'Dr. Gregory House',
            email: 'dr.house@clinic.local',
            password_hash: 'Password123!',
            role: 'doctor',
        });
        doctorToken = generateToken(doctorUser);

        doctor = await Doctor.create({
            user_id: doctorUser.user_id,
            name: 'Dr. Gregory House',
            specialization: 'Diagnostic Medicine',
            schedule: 'Mon-Fri 09:00-17:00',
            email: 'dr.house@clinic.local',
            contact: '555-1234',
        });

        patient1 = await Patient.create({
            user_id: patient1User.user_id,
            name: 'Alice Patient',
            dob: '1990-01-01',
            contact: '555-0001',
        });

        patient2 = await Patient.create({
            user_id: patient2User.user_id,
            name: 'Bob Patient',
            dob: '1988-02-02',
            contact: '555-0002',
        });

        appointment1 = await Appointment.create({
            patient_id: patient1.patient_id,
            doctor_id: doctor.doctor_id,
            date_time: new Date(Date.now() + 86400000),
            status: 'scheduled',
            remarks: 'Consultation for Alice',
        });

        appointment2 = await Appointment.create({
            patient_id: patient2.patient_id,
            doctor_id: doctor.doctor_id,
            date_time: new Date(Date.now() + 172800000),
            status: 'scheduled',
            remarks: 'Consultation for Bob',
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('PORTAL-01: patient querying appointments only sees their own appointments', async () => {
        const res = await request(app)
            .get('/api/appointments')
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].appointment_id).toBe(appointment1.appointment_id);
        expect(res.body.data[0].patient.name).toBe('Alice Patient');
    });

    it('PORTAL-02: patient attempting to access another patient\'s appointment by ID gets 403 (IDOR check)', async () => {
        const res = await request(app)
            .get(`/api/appointments/${appointment2.appointment_id}`)
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/forbidden/i);
    });

    it('PORTAL-03: patient attempting to cancel another patient\'s appointment gets 403 (IDOR check)', async () => {
        const res = await request(app)
            .patch(`/api/appointments/${appointment2.appointment_id}/cancel`)
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/forbidden/i);
    });

    it('PORTAL-04: patient attempting to view another patient\'s profile by ID gets 403 (IDOR check)', async () => {
        const res = await request(app)
            .get(`/api/patients/${patient2.patient_id}`)
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/forbidden/i);
    });

    it('PORTAL-05: patient cannot create medical records (403)', async () => {
        const res = await request(app)
            .post(`/api/medical-records/${patient1.patient_id}`)
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({ diagnosis: 'Self diagnosed cold' });

        expect(res.status).toBe(403);
    });

    it('PORTAL-06: patient can view doctor availability for a target date', async () => {
        const res = await request(app)
            .get(`/api/doctors/${doctor.doctor_id}/availability?date=2026-11-20`)
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('doctor');
        expect(res.body.doctor.doctor_id).toBe(doctor.doctor_id);
        expect(res.body.date).toBe('2026-11-20');
        expect(Array.isArray(res.body.slots)).toBe(true);
        expect(res.body.slots.length).toBeGreaterThan(0);
        expect(res.body.slots[0]).toHaveProperty('time');
        expect(res.body.slots[0]).toHaveProperty('available');
    });

    it('PORTAL-07: doctor availability reflects booked appointments', async () => {
        // Book a specific slot for the doctor
        const bookedDateTime = '2026-11-20T08:30:00.000Z';
        await Appointment.create({
            patient_id: patient2.patient_id,
            doctor_id: doctor.doctor_id,
            date_time: new Date(bookedDateTime),
            status: 'scheduled',
            remarks: 'Early morning slot',
        });

        const res = await request(app)
            .get(`/api/doctors/${doctor.doctor_id}/availability?date=2026-11-20`)
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(200);
        const slot0830 = res.body.slots.find((s) => s.time === '08:30');
        expect(slot0830).toBeDefined();
        expect(slot0830.available).toBe(false);
        expect(slot0830.reason).toBe('Booked');

        const slot0930 = res.body.slots.find((s) => s.time === '09:30');
        expect(slot0930).toBeDefined();
        expect(slot0930.available).toBe(true);
    });

    it('PORTAL-08: patient can book appointment with doctor without passing patient_id', async () => {
        const bookingTime = '2026-11-21T09:30:00.000Z';
        const res = await request(app)
            .post('/api/appointments')
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({
                doctor_id: doctor.doctor_id,
                date_time: bookingTime,
                remarks: 'Patient self-booked consultation',
            });

        expect(res.status).toBe(201);
        expect(res.body.data.patient_id).toBe(patient1.patient_id);
        expect(res.body.data.status).toBe('scheduled');
    });

    it('PORTAL-09: patient attempting to update another patient\'s appointment gets 403', async () => {
        const res = await request(app)
            .put(`/api/appointments/${appointment2.appointment_id}`)
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({ remarks: 'Malicious modification' });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/forbidden/i);
    });
});
