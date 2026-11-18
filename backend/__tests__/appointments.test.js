'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-test-jwt-key-2026';

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

describe('Phase 2 — Appointment Management & Race Condition (02_TEST_PLAN.md §4)', () => {
  let adminToken;
  let doctorRecord;
  let patientRecord1;
  let patientRecord2;

  beforeAll(async () => {
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin.apt@clinic.local',
      password_hash: 'AdminPass123!',
      role: 'admin',
    });
    adminToken = generateToken(adminUser);

    doctorRecord = await Doctor.create({
      name: 'Dr. Stephen Strange',
      specialization: 'Neuro-Surgery',
      contact: '555-7777',
      email: 'strange@clinic.local',
    });

    patientRecord1 = await Patient.create({
      name: 'Alice Wonder',
      dob: '1995-04-12',
      contact: '555-8881',
    });

    patientRecord2 = await Patient.create({
      name: 'Bob Builder',
      dob: '1988-11-20',
      contact: '555-8882',
    });
  });

  describe('APT-01: Successful Booking', () => {
    it('should successfully book an appointment at a free time slot', async () => {
      const slotTime = '2026-10-15T09:00:00.000Z';

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: patientRecord1.patient_id,
          doctor_id: doctorRecord.doctor_id,
          date_time: slotTime,
          remarks: 'Regular Consultation',
        })
        .expect(201);

      expect(res.body).toHaveProperty('message', 'Appointment booked successfully');
      expect(res.body.data).toHaveProperty('appointment_id');
      expect(res.body.data.status).toBe('scheduled');
      expect(new Date(res.body.data.date_time).toISOString()).toBe(slotTime);
    });
  });

  describe('APT-02: Double-Booking Sequential Rejection', () => {
    it('should reject booking when doctor is already booked at that exact date and time (409)', async () => {
      const slotTime = '2026-10-15T10:00:00.000Z';

      // First booking succeeds
      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: patientRecord1.patient_id,
          doctor_id: doctorRecord.doctor_id,
          date_time: slotTime,
        })
        .expect(201);

      // Second booking for the same doctor & time must be rejected
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: patientRecord2.patient_id,
          doctor_id: doctorRecord.doctor_id,
          date_time: slotTime,
        })
        .expect(409);

      expect(res.body.error).toMatch(/already booked/i);
    });
  });

  describe('APT-03: Double-Booking Concurrent Race Condition Test', () => {
    it('should allow exactly one success and reject the concurrent conflict when two simultaneous requests arrive', async () => {
      const slotTime = '2026-10-15T14:00:00.000Z';

      // Fire two concurrent requests simultaneously with Promise.all
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/appointments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            patient_id: patientRecord1.patient_id,
            doctor_id: doctorRecord.doctor_id,
            date_time: slotTime,
            remarks: 'Concurrent Patient 1',
          }),
        request(app)
          .post('/api/appointments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            patient_id: patientRecord2.patient_id,
            doctor_id: doctorRecord.doctor_id,
            date_time: slotTime,
            remarks: 'Concurrent Patient 2',
          }),
      ]);

      const statuses = [res1.status, res2.status];

      // Exactly one must be 201 Created and the other must be 409 Conflict
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

      // Verify in DB that only one row was actually created for this doctor & time
      const count = await Appointment.count({
        where: {
          doctor_id: doctorRecord.doctor_id,
          date_time: new Date(slotTime),
          status: 'scheduled',
        },
      });
      expect(count).toBe(1);
    });
  });

  describe('APT-04: Foreign Key Constraints', () => {
    it('should reject booking if patient_id does not exist', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: 999999,
          doctor_id: doctorRecord.doctor_id,
          date_time: '2026-10-16T11:00:00.000Z',
        })
        .expect(404);

      expect(res.body.error).toMatch(/patient not found/i);
    });

    it('should reject booking if doctor_id does not exist', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: patientRecord1.patient_id,
          doctor_id: 999999,
          date_time: '2026-10-16T11:00:00.000Z',
        })
        .expect(404);

      expect(res.body.error).toMatch(/doctor not found/i);
    });
  });

  describe('APT-05: Cancellation & Status Tracking', () => {
    it('should cancel an appointment and update status to cancelled', async () => {
      const bookRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: patientRecord1.patient_id,
          doctor_id: doctorRecord.doctor_id,
          date_time: '2026-10-17T15:00:00.000Z',
        })
        .expect(201);

      const aptId = bookRes.body.data.appointment_id;

      // Cancel appointment
      const cancelRes = await request(app)
        .patch(`/api/appointments/${aptId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(cancelRes.body.data.status).toBe('cancelled');

      // Now that it is cancelled, that slot can be re-booked by another patient
      const rebookRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: patientRecord2.patient_id,
          doctor_id: doctorRecord.doctor_id,
          date_time: '2026-10-17T15:00:00.000Z',
        })
        .expect(201);

      expect(rebookRes.body.data.status).toBe('scheduled');
    });
  });

  describe('APT-06: Parameterized Filtering by Date, Doctor, and Status', () => {
    it('should filter appointments by status', async () => {
      const res = await request(app)
        .get('/api/appointments?status=cancelled')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.every((apt) => apt.status === 'cancelled')).toBe(true);
    });

    it('should filter appointments by doctor_id', async () => {
      const res = await request(app)
        .get(`/api/appointments?doctor_id=${doctorRecord.doctor_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.every((apt) => apt.doctor_id === doctorRecord.doctor_id)).toBe(true);
    });
  });

  describe('APT-07: Completing Appointments (Doctor Only with Clinical Entry)', () => {
    it('allows assigned doctor to finish a scheduled appointment with diagnosis and blocks receptionist/admin/other doctor', async () => {
      const doctorUser = await User.create({
        name: 'Dr. Strange User',
        email: 'strange.user@clinic.local',
        password_hash: 'DoctorPass123!',
        role: 'doctor',
      });
      await doctorRecord.update({ user_id: doctorUser.user_id });
      const doctorToken = generateToken(doctorUser);

      const receptionistUser = await User.create({
        name: 'Front Desk User',
        email: 'reception.apt@clinic.local',
        password_hash: 'ReceptionPass123!',
        role: 'receptionist',
      });
      const receptionistToken = generateToken(receptionistUser);

      const otherDoctorUser = await User.create({
        name: 'Dr. Other',
        email: 'other.doc@clinic.local',
        password_hash: 'DoctorPass123!',
        role: 'doctor',
      });
      await Doctor.create({
        user_id: otherDoctorUser.user_id,
        name: 'Dr. Other',
        specialization: 'General',
        contact: '555-9999',
        email: 'other.doc@clinic.local',
      });
      const otherDoctorToken = generateToken(otherDoctorUser);

      const apt1Res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: patientRecord1.patient_id,
          doctor_id: doctorRecord.doctor_id,
          date_time: '2026-10-18T09:30:00.000Z',
        })
        .expect(201);

      // Receptionist and Admin cannot complete appointments
      await request(app)
        .patch(`/api/appointments/${apt1Res.body.data.appointment_id}/complete`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ diagnosis: 'Viral fever' })
        .expect(403);

      await request(app)
        .patch(`/api/appointments/${apt1Res.body.data.appointment_id}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ diagnosis: 'Viral fever' })
        .expect(403);

      // Receptionist cannot bypass via PUT /api/appointments/:id status='completed'
      await request(app)
        .put(`/api/appointments/${apt1Res.body.data.appointment_id}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ status: 'completed' })
        .expect(403);

      // Another doctor cannot complete Dr. Strange's appointment
      await request(app)
        .patch(`/api/appointments/${apt1Res.body.data.appointment_id}/complete`)
        .set('Authorization', `Bearer ${otherDoctorToken}`)
        .send({ diagnosis: 'Viral fever' })
        .expect(403);

      // Missing diagnosis is rejected (400)
      await request(app)
        .patch(`/api/appointments/${apt1Res.body.data.appointment_id}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ prescription: 'Paracetamol' })
        .expect(400);

      // Assigned doctor completes appointment with clinical entry
      const docCompleteRes = await request(app)
        .patch(`/api/appointments/${apt1Res.body.data.appointment_id}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          diagnosis: 'Acute viral upper respiratory infection',
          prescription: 'Paracetamol 500mg tds x 3 days',
          notes: 'Hydration and rest advised',
        })
        .expect(200);

      expect(docCompleteRes.body.data.status).toBe('completed');
      expect(docCompleteRes.body.medicalRecord).toBeDefined();
      expect(docCompleteRes.body.medicalRecord.diagnosis).toBe('Acute viral upper respiratory infection');
      expect(docCompleteRes.body.medicalRecord.patient_id).toBe(patientRecord1.patient_id);
      expect(docCompleteRes.body.medicalRecord.doctor_id).toBe(doctorRecord.doctor_id);

      const savedRecord = await MedicalRecord.findByPk(docCompleteRes.body.medicalRecord.record_id);
      expect(savedRecord).not.toBeNull();
      expect(savedRecord.prescription).toBe('Paracetamol 500mg tds x 3 days');
    });

    it('rejects completing a cancelled appointment (400)', async () => {
      const doctorUser = await User.findOne({ where: { email: 'strange.user@clinic.local' } });
      const doctorToken = generateToken(doctorUser);

      const aptRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patient_id: patientRecord1.patient_id,
          doctor_id: doctorRecord.doctor_id,
          date_time: '2026-10-19T14:00:00.000Z',
        })
        .expect(201);

      await request(app)
        .patch(`/api/appointments/${aptRes.body.data.appointment_id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app)
        .patch(`/api/appointments/${aptRes.body.data.appointment_id}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ diagnosis: 'Cancelled visit' })
        .expect(400);

      expect(res.body.error).toMatch(/cancelled/i);
    });
  });

  describe('APT-08: Appointment Search by Patient or Doctor Name', () => {
    it('filters appointments case-insensitively by patient name or doctor name', async () => {
      const patRes = await request(app)
        .get('/api/appointments?search=wonder')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(patRes.body.data.length).toBeGreaterThan(0);
      expect(patRes.body.data.every((apt) => apt.patient.name.toLowerCase().includes('wonder'))).toBe(true);

      const docRes = await request(app)
        .get('/api/appointments?search=strange')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(docRes.body.data.length).toBeGreaterThan(0);
      expect(docRes.body.data.every((apt) => apt.doctor.name.toLowerCase().includes('strange'))).toBe(true);
    });
  });
});
