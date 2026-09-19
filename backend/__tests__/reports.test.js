'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-test-jwt-key-2026';
process.env.JWT_EXPIRES_IN = '1h';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
process.env.LOGIN_RATE_LIMIT_MAX = '5';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Patient, Doctor, Appointment } = require('../src/models');
const { generateToken } = require('../src/utils/token');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Phase 5 - Reports', () => {
  let adminToken;
  let doctorToken;
  let doctorRecord;
  let patientRecord;
  let adminUser;

  beforeAll(async () => {
    adminUser = await User.create({
      name: 'Report Admin',
      email: 'report-admin@clinic.local',
      password_hash: 'AdminPass123!',
      role: 'admin',
    });
    adminToken = generateToken(adminUser);

    const doctorUser = await User.create({
      name: 'Report Doctor',
      email: 'report-doctor@clinic.local',
      password_hash: 'DoctorPass123!',
      role: 'doctor',
    });
    doctorToken = generateToken(doctorUser);

    doctorRecord = await Doctor.create({
      name: 'Report Doctor',
      specialization: 'General Practice',
      contact: '555-0101',
      email: 'report-doctor@clinic.local',
      user_id: doctorUser.user_id,
    });

    patientRecord = await Patient.create({
      name: 'Report Patient',
      dob: '1990-05-15',
      contact: '555-0102',
    });
  });

  describe('REP-01: Report endpoints require auth', () => {
    it('daily report without token returns 401', async () => {
      const res = await request(app)
        .post('/api/reports/daily')
        .send({ date: '2026-10-15' })
        .expect(401);
      expect(res.body.error).toMatch(/no token provided/i);
    });

    it('monthly report without token returns 401', async () => {
      const res = await request(app)
        .post('/api/reports/monthly')
        .send({ year: 2026, month: 10 })
        .expect(401);
      expect(res.body.error).toMatch(/no token provided/i);
    });

    it('daily report with invalid token returns 401', async () => {
      const res = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer invalid-token')
        .send({ date: '2026-10-15' })
        .expect(401);
      expect(res.body.error).toMatch(/invalid or tampered/i);
    });
  });

  describe('REP-02: Report validation', () => {
    it('daily report without date returns 400', async () => {
      const res = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({})
        .expect(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('monthly report without year/month returns 400', async () => {
      const res = await request(app)
        .post('/api/reports/monthly')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({})
        .expect(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('REP-03: Daily report data accuracy', () => {
    it('admin gets daily report with correct summary counts', async () => {
      const reportDate = '2026-10-15';
      const baseTime = new Date(reportDate + 'T10:00:00.000Z');

      await Appointment.create({
        patient_id: patientRecord.patient_id,
        doctor_id: doctorRecord.doctor_id,
        date_time: baseTime,
        status: 'scheduled',
      });
      await Appointment.create({
        patient_id: patientRecord.patient_id,
        doctor_id: doctorRecord.doctor_id,
        date_time: new Date(baseTime.getTime() + 3600000),
        status: 'completed',
      });
      await Appointment.create({
        patient_id: patientRecord.patient_id,
        doctor_id: doctorRecord.doctor_id,
        date_time: new Date(baseTime.getTime() + 7200000),
        status: 'cancelled',
      });

      const res = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ date: reportDate })
        .expect(200);

      expect(res.body.data.date).toBe(reportDate);
      expect(res.body.data.summary.total).toBe(3);
      expect(res.body.data.summary.scheduled).toBe(1);
      expect(res.body.data.summary.completed).toBe(1);
      expect(res.body.data.summary.cancelled).toBe(1);
      expect(res.body.data.appointments).toHaveLength(3);
    });

    it('daily report with no appointments returns empty', async () => {
      const res = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ date: '2026-12-25' })
        .expect(200);
      expect(res.body.data.summary.total).toBe(0);
      expect(res.body.data.appointments).toHaveLength(0);
    });
  });

  describe('REP-04: Monthly report data accuracy', () => {
    it('admin gets monthly report with correct totals', async () => {
      const res = await request(app)
        .post('/api/reports/monthly')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ year: 2026, month: 10 })
        .expect(200);

      expect(res.body.data.year).toBe(2026);
      expect(res.body.data.month).toBe(10);
      expect(res.body.data.summary.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.perDoctor).toBeDefined();
      expect(res.body.data.perPatient).toBeDefined();

      const docEntry = res.body.data.perDoctor.find((d) => d.doctor_id === doctorRecord.doctor_id);
      expect(docEntry).toBeDefined();
      expect(docEntry.total).toBeGreaterThanOrEqual(3);

      const patEntry = res.body.data.perPatient.find((p) => p.patient_id === patientRecord.patient_id);
      expect(patEntry).toBeDefined();
      expect(patEntry.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe('REP-05: Doctor scope restriction', () => {
    it('doctor gets only own appointments in daily report', async () => {
      const res = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer ' + doctorToken)
        .send({ date: '2026-10-15' })
        .expect(200);

      expect(res.body.data.summary.total).toBeGreaterThanOrEqual(3);
      res.body.data.appointments.forEach((a) => {
        expect(a.doctor.doctor_id).toBe(doctorRecord.doctor_id);
      });
    });

    it('doctor gets only own data in monthly report', async () => {
      const res = await request(app)
        .post('/api/reports/monthly')
        .set('Authorization', 'Bearer ' + doctorToken)
        .send({ year: 2026, month: 10 })
        .expect(200);

      res.body.data.perDoctor.forEach((d) => {
        expect(d.doctor_id).toBe(doctorRecord.doctor_id);
      });
    });
  });
});
