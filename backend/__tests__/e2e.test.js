'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-test-jwt-key-2026';
process.env.JWT_EXPIRES_IN = '1h';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
process.env.LOGIN_RATE_LIMIT_MAX = '5';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Patient, Doctor, Appointment, MedicalRecord } = require('../src/models');
const { generateToken } = require('../src/utils/token');

beforeAll(async () => {
    await sequelize.sync({ force: true });
});

afterAll(async () => {
    await sequelize.close();
});

describe('Phase 4 — End-to-End Integration (02_TEST_PLAN.md §5)', () => {
    let adminToken;
    let doctorToken;
    let doctorUser;
    let doctorRecord;
    let patientRecord;
    let appointmentRecord;

    beforeAll(async () => {
        // Create admin user
        const adminUser = await User.create({
            name: 'E2E Admin',
            email: 'e2e-admin@clinic.local',
            password_hash: 'AdminPass123!',
            role: 'admin',
        });
        adminToken = generateToken(adminUser);

        // Create doctor user
        doctorUser = await User.create({
            name: 'E2E Doctor',
            email: 'e2e-doctor@clinic.local',
            password_hash: 'DoctorPass123!',
            role: 'doctor',
        });
        doctorToken = generateToken(doctorUser);

        // Create doctor profile
        doctorRecord = await Doctor.create({
            name: 'E2E Doctor',
            specialization: 'General Practice',
            contact: '555-0001',
            email: 'e2e-doctor@clinic.local',
            user_id: doctorUser.user_id,
        });
    });

    describe('E2E-01: Full admin workflow — register doctor, add patient, book appointment', () => {
        it('admin can register a new doctor user via /api/auth/register', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'New Doctor',
                    email: 'new-doctor@clinic.local',
                    password: 'DoctorPass123!',
                    role: 'doctor',
                })
                .expect(201);

            expect(res.body.user).toHaveProperty('user_id');
            expect(res.body.user.role).toBe('doctor');
            expect(res.body.user.password_hash).toBeUndefined();
        });

        it('admin can create a patient via /api/patients', async () => {
            const res = await request(app)
                .post('/api/patients')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'E2E Patient',
                    dob: '1990-05-15',
                    contact: '555-0002',
                    address: '123 Test St',
                    notes: 'Test patient for E2E',
                })
                .expect(201);

            expect(res.body.data).toHaveProperty('patient_id');
            expect(res.body.data.name).toBe('E2E Patient');
            patientRecord = res.body.data;
        });

        it('admin can book an appointment for the patient and doctor', async () => {
            const slotTime = '2026-10-20T10:00:00.000Z';
            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    patient_id: patientRecord.patient_id,
                    doctor_id: doctorRecord.doctor_id,
                    date_time: slotTime,
                    remarks: 'E2E booking test',
                })
                .expect(201);

            expect(res.body.data).toHaveProperty('appointment_id');
            expect(res.body.data.status).toBe('scheduled');
            appointmentRecord = res.body.data;
        });

        it('doctor can see the appointment in their scoped list', async () => {
            const res = await request(app)
                .get('/api/appointments')
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            const found = res.body.data.find((a) => a.appointment_id === appointmentRecord.appointment_id);
            expect(found).toBeDefined();
            expect(found.patient.name).toBe('E2E Patient');
        });
    });

    describe('E2E-02: Doctor views patient and adds diagnosis/prescription', () => {
        it('doctor can view the patient record (has appointment with this doctor)', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientRecord.patient_id}`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            expect(res.body.data.name).toBe('E2E Patient');
        });

        it('doctor can add a medical record (diagnosis + prescription) for the patient', async () => {
            const res = await request(app)
                .post(`/api/medical-records/${patientRecord.patient_id}`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    diagnosis: 'Hypertension',
                    prescription: 'Lisinopril 10mg daily',
                    notes: 'Follow up in 3 months',
                })
                .expect(201);

            expect(res.body.data).toHaveProperty('record_id');
            expect(res.body.data.diagnosis).toBe('Hypertension');
            expect(res.body.data.prescription).toBe('Lisinopril 10mg daily');
        });

        it('doctor can retrieve the medical record and it is attributed to them', async () => {
            const res = await request(app)
                .get(`/api/medical-records/${patientRecord.patient_id}`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            const record = res.body.data[0];
            expect(record.diagnosis).toBe('Hypertension');
            expect(record.doctor.name).toBe('E2E Doctor');
        });
    });

    describe('E2E-03: Logout clears session — protected route returns 401', () => {
        it('calling protected route without token returns 401', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .expect(401);

            expect(res.body.error).toMatch(/no token provided/i);
        });

        it('calling protected route with invalid token returns 401', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token-here')
                .expect(401);

            expect(res.body.error).toMatch(/invalid or tampered/i);
        });
    });

    describe('E2E-04: IDOR — Doctor cannot access another patient\'s records', () => {
        let otherPatient;
        let otherDoctor;
        let otherDoctorUser;

        beforeAll(async () => {
            // Create a second doctor and patient that the first doctor has NOT treated
            otherDoctorUser = await User.create({
                name: 'Other Doctor',
                email: 'other-doctor@clinic.local',
                password_hash: 'DoctorPass123!',
                role: 'doctor',
            });

            otherDoctor = await Doctor.create({
                name: 'Other Doctor',
                specialization: 'Pediatrics',
                contact: '555-0003',
                email: 'other-doctor@clinic.local',
                user_id: otherDoctorUser.user_id,
            });

            otherPatient = await Patient.create({
                name: 'Other Patient',
                dob: '1985-03-20',
                contact: '555-0004',
            });

            // Create an appointment between the OTHER doctor and the OTHER patient
            // (so the first doctor has no relationship with this patient)
            await Appointment.create({
                patient_id: otherPatient.patient_id,
                doctor_id: otherDoctor.doctor_id,
                date_time: new Date(Date.now() + 86400000),
                status: 'scheduled',
            });
        });

        it('doctor cannot view a patient they have not treated (403)', async () => {
            const res = await request(app)
                .get(`/api/patients/${otherPatient.patient_id}`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(403);

            expect(res.body.error).toMatch(/forbidden/i);
        });

        it('doctor cannot create a medical record for a patient they have not treated (403)', async () => {
            const res = await request(app)
                .post(`/api/medical-records/${otherPatient.patient_id}`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    diagnosis: 'Should be blocked',
                    prescription: 'Nothing',
                })
                .expect(403);

            expect(res.body.error).toMatch(/forbidden/i);
        });

        it('doctor cannot view medical records for a patient they have not treated (403)', async () => {
            const res = await request(app)
                .get(`/api/medical-records/${otherPatient.patient_id}`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(403);

            expect(res.body.error).toMatch(/forbidden/i);
        });
    });
});
