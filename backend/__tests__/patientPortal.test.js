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

    const futureAvailDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

    it('PORTAL-06: patient can view doctor availability for a target date', async () => {
        const res = await request(app)
            .get(`/api/doctors/${doctor.doctor_id}/availability?date=${futureAvailDate}`)
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('doctor');
        expect(res.body.doctor.doctor_id).toBe(doctor.doctor_id);
        expect(res.body.date).toBe(futureAvailDate);
        expect(Array.isArray(res.body.slots)).toBe(true);
        expect(res.body.slots.length).toBeGreaterThan(0);
        expect(res.body.slots[0]).toHaveProperty('time');
        expect(res.body.slots[0]).toHaveProperty('available');
    });

    it('PORTAL-07: doctor availability reflects booked appointments', async () => {
        // Book a specific slot for the doctor
        const bookedDateTime = `${futureAvailDate}T08:30:00.000Z`;
        await Appointment.create({
            patient_id: patient2.patient_id,
            doctor_id: doctor.doctor_id,
            date_time: new Date(bookedDateTime),
            status: 'scheduled',
            remarks: 'Early morning slot',
        });

        const res = await request(app)
            .get(`/api/doctors/${doctor.doctor_id}/availability?date=${futureAvailDate}`)
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

    it('PORTAL-10: availability marks past slots for today as unavailable and applies tzOffset', async () => {
        const tzOffset = -330; // +05:30 local timezone
        const nowLocal = new Date(Date.now() - tzOffset * 60 * 1000);
        const todayStr = nowLocal.toISOString().split('T')[0];

        const res = await request(app)
            .get(`/api/doctors/${doctor.doctor_id}/availability?date=${todayStr}&tzOffset=${tzOffset}`)
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(200);
        const nowMs = Date.now();
        res.body.slots.forEach((slot) => {
            const slotMs = new Date(slot.dateTime).getTime();
            // Local 08:30 in +05:30 should convert to 03:00Z on that date
            if (slot.time === '08:30') {
                expect(slot.dateTime).toBe(`${todayStr}T03:00:00.000Z`);
            }
            if (slotMs <= nowMs) {
                expect(slot.available).toBe(false);
                if (slot.reason !== 'Booked') {
                    expect(slot.reason).toBe('Past');
                }
            }
        });
    });

    it('PORTAL-11: patient cannot call complete endpoint on appointments (403)', async () => {
        const res = await request(app)
            .patch(`/api/appointments/${appointment1.appointment_id}/complete`)
            .set('Authorization', `Bearer ${patient1Token}`);

        expect(res.status).toBe(403);
    });

    it('PORTAL-12: patient and receptionist can view completed appointment report while other patient is blocked (403)', async () => {
        const receptionistUser = await User.create({
            name: 'Front Desk Portal',
            email: 'reception.portal@clinic.local',
            password_hash: 'ReceptionPass123!',
            role: 'receptionist',
        });
        const receptionistToken = generateToken(receptionistUser);

        // Doctor finishes appointment1 with a clinical entry
        await request(app)
            .patch(`/api/appointments/${appointment1.appointment_id}/complete`)
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({
                diagnosis: 'Seasonal rhinitis',
                prescription: 'Cetirizine 10mg nocte',
                notes: 'Follow up in 2 weeks',
            })
            .expect(200);

        // Patient1 can view their own completed appointment report
        const ownRes = await request(app)
            .get(`/api/medical-records/appointment/${appointment1.appointment_id}`)
            .set('Authorization', `Bearer ${patient1Token}`)
            .expect(200);

        expect(ownRes.body.data.appointment.appointment_id).toBe(appointment1.appointment_id);
        expect(ownRes.body.data.medicalRecord).not.toBeNull();
        expect(ownRes.body.data.medicalRecord.diagnosis).toBe('Seasonal rhinitis');

        // Patient2 cannot view Patient1's appointment report (403)
        await request(app)
            .get(`/api/medical-records/appointment/${appointment1.appointment_id}`)
            .set('Authorization', `Bearer ${patient2Token}`)
            .expect(403);

        // Receptionist can view completed appointment report (200)
        const recRes = await request(app)
            .get(`/api/medical-records/appointment/${appointment1.appointment_id}`)
            .set('Authorization', `Bearer ${receptionistToken}`)
            .expect(200);
        expect(recRes.body.data.medicalRecord.diagnosis).toBe('Seasonal rhinitis');
    });
});
