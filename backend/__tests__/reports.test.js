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
  let receptionistToken;
  let patientToken;
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

    const receptionistUser = await User.create({
      name: 'Report Receptionist',
      email: 'report-receptionist@clinic.local',
      password_hash: 'ReceptionPass123!',
      role: 'receptionist',
    });
    receptionistToken = generateToken(receptionistUser);

    const patientUser = await User.create({
      name: 'Report Patient User',
      email: 'report-patient@clinic.local',
      password_hash: 'PatientPass123!',
      role: 'patient',
    });
    patientToken = generateToken(patientUser);

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

  describe('REP-02: Role-based access control (RBAC)', () => {
    it('receptionist role is forbidden from generating daily reports (403)', async () => {
      const res = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer ' + receptionistToken)
        .send({ date: '2026-10-15' })
        .expect(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it('patient role is forbidden from generating daily reports (403)', async () => {
      const res = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer ' + patientToken)
        .send({ date: '2026-10-15' })
        .expect(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it('receptionist role is forbidden from generating monthly reports (403)', async () => {
      const res = await request(app)
        .post('/api/reports/monthly')
        .set('Authorization', 'Bearer ' + receptionistToken)
        .send({ year: 2026, month: 10 })
        .expect(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });
  });

  describe('REP-03: Report validation', () => {
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

  describe('REP-04: Daily report data accuracy', () => {
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

    it('daily report with no appointments returns empty state (REP-05)', async () => {
      const res = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ date: '2026-12-25' })
        .expect(200);
      expect(res.body.data.summary.total).toBe(0);
      expect(res.body.data.appointments).toHaveLength(0);
    });
  });

  describe('REP-05: Monthly report data accuracy', () => {
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

  describe('REP-06: Doctor scope restriction', () => {
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

  describe('REP-07: Streamed Export Endpoints (PDF & CSV)', () => {
    it('exports daily report as streamed PDF', async () => {
      const res = await request(app)
        .post('/api/reports/daily/export')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ date: '2026-10-15', format: 'pdf' })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="daily-report-2026-10-15\.pdf"/);
      expect(res.body).toBeDefined();
    });

    it('exports daily report as streamed CSV', async () => {
      const res = await request(app)
        .post('/api/reports/daily/export')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ date: '2026-10-15', format: 'csv' })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="daily-report-2026-10-15\.csv"/);
      expect(res.text).toContain('Daily Appointments Report');
      expect(res.text).toContain('Report Patient');
    });

    it('exports monthly report as streamed PDF', async () => {
      const res = await request(app)
        .post('/api/reports/monthly/export')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ year: 2026, month: 10, format: 'pdf' })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="monthly-report-2026-10\.pdf"/);
    });

    it('exports monthly report as streamed CSV', async () => {
      const res = await request(app)
        .post('/api/reports/monthly/export')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ year: 2026, month: 10, format: 'csv' })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="monthly-report-2026-10\.csv"/);
      expect(res.text).toContain('Monthly Activity Report');
      expect(res.text).toContain('Report Doctor');
    });

    it('handles empty date cleanly in PDF export without 500 error (REP-05)', async () => {
      const res = await request(app)
        .post('/api/reports/daily/export')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ date: '2029-01-01', format: 'pdf' })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('REP-08: Sensitive fields are never leaked (REP-03 Security checklist)', () => {
    it('daily JSON and CSV reports do not contain password hashes or security secrets', async () => {
      const jsonRes = await request(app)
        .post('/api/reports/daily')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ date: '2026-10-15' })
        .expect(200);

      const jsonStr = JSON.stringify(jsonRes.body);
      expect(jsonStr).not.toContain('password_hash');
      expect(jsonStr).not.toContain('AdminPass123!');
      expect(jsonStr).not.toContain('DoctorPass123!');

      const csvRes = await request(app)
        .post('/api/reports/daily/export')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ date: '2026-10-15', format: 'csv' })
        .expect(200);

      expect(csvRes.text).not.toContain('password_hash');
      expect(csvRes.text).not.toContain('AdminPass123!');
      expect(csvRes.text).not.toContain('DoctorPass123!');
    });

    it('monthly JSON and CSV reports do not contain password hashes or security secrets', async () => {
      const jsonRes = await request(app)
        .post('/api/reports/monthly')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ year: 2026, month: 10 })
        .expect(200);

      const jsonStr = JSON.stringify(jsonRes.body);
      expect(jsonStr).not.toContain('password_hash');
      expect(jsonStr).not.toContain('AdminPass123!');

      const csvRes = await request(app)
        .post('/api/reports/monthly/export')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ year: 2026, month: 10, format: 'csv' })
        .expect(200);

      expect(csvRes.text).not.toContain('password_hash');
      expect(csvRes.text).not.toContain('AdminPass123!');
    });
  });
});
