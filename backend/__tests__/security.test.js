'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-test-jwt-key-2026';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const { sequelize, User, Patient, Doctor, Appointment } = db;
const { generateToken } = require('../src/utils/token');

describe('Phase 6 — Security Hardening & Penetration Verification (02_TEST_PLAN.md §7)', () => {
  let adminToken;
  let doctor1Token;
  let doctor2Token;
  let doctor1Record;
  let doctor2Record;
  let patientA;
  let patientB;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Seed Admin
    const adminUser = await User.create({
      name: 'Security Admin',
      email: 'sec_admin@clinic.local',
      password_hash: 'SecureAdmin123!',
      role: 'admin',
    });
    adminToken = generateToken(adminUser);

    // Seed Doctor 1
    const doc1User = await User.create({
      name: 'Dr. Security One',
      email: 'sec_doc1@clinic.local',
      password_hash: 'SecureDoc123!',
      role: 'doctor',
    });
    doctor1Record = await Doctor.create({
      name: 'Dr. Security One',
      specialization: 'Cardiology',
      contact: '555-0101',
      email: doc1User.email,
      user_id: doc1User.user_id,
    });
    doctor1Token = generateToken(doc1User);

    // Seed Doctor 2
    const doc2User = await User.create({
      name: 'Dr. Security Two',
      email: 'sec_doc2@clinic.local',
      password_hash: 'SecureDoc123!',
      role: 'doctor',
    });
    doctor2Record = await Doctor.create({
      name: 'Dr. Security Two',
      specialization: 'Neurology',
      contact: '555-0202',
      email: doc2User.email,
      user_id: doc2User.user_id,
    });
    doctor2Token = generateToken(doc2User);

    // Seed Patient A (assigned to Doctor 1 via appointment)
    patientA = await Patient.create({
      name: 'Secure Patient A',
      dob: '1985-05-15',
      contact: '555-0101',
    });
    await Appointment.create({
      patient_id: patientA.patient_id,
      doctor_id: doctor1Record.doctor_id,
      date_time: new Date(Date.now() + 86400000),
      status: 'scheduled',
    });

    // Seed Patient B (assigned to Doctor 2 via appointment)
    patientB = await Patient.create({
      name: 'Secure Patient B',
      dob: '1990-08-20',
      contact: '555-0202',
    });
    await Appointment.create({
      patient_id: patientB.patient_id,
      doctor_id: doctor2Record.doctor_id,
      date_time: new Date(Date.now() + 172800000),
      status: 'scheduled',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('SEC-01: SQL Injection payloads treated as literal text', () => {
    test('SQL injection attempt in patient search returns 0 results and causes no SQL errors', async () => {
      const sqliPayload = "' OR '1'='1";
      const res = await request(app)
        .get(`/api/patients?search=${encodeURIComponent(sqliPayload)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    test('SQL injection in login returns validation error or 401 without SQL leak', async () => {
      const sqliLogin = "' OR '1'='1' --";
      const res = await request(app).post('/api/auth/login').send({
        email: sqliLogin,
        password: 'any_password',
      });

      expect([400, 401]).toContain(res.statusCode);
      expect(res.body.token).toBeUndefined();
    });
  });

  describe('SEC-02: XSS payloads safely stored and treated as text', () => {
    test('XSS script tag in patient contact/name is stored without executing', async () => {
      const xssName = 'Alice <script>alert("XSS")</script>';
      const createRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: xssName,
          dob: '1992-01-01',
          contact: '555-9999',
        });

      expect(createRes.statusCode).toBe(201);
      expect(createRes.body.data.name).toBe(xssName);

      const getRes = await request(app)
        .get(`/api/patients/${createRes.body.data.patient_id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.data.name).toBe(xssName);
    });
  });

  describe('SEC-03: IDOR & Horizontal Privilege Escalation Protection', () => {
    test('Doctor 2 querying patients only sees patients assigned to Doctor 2', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctor2Token}`);

      expect(res.statusCode).toBe(200);
      const returnedIds = (res.body.data || []).map((p) => p.patient_id);
      expect(returnedIds).toContain(patientB.patient_id);
      expect(returnedIds).not.toContain(patientA.patient_id);
    });

    test('Doctor 2 querying appointments only sees appointments for Doctor 2', async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${doctor2Token}`);

      expect(res.statusCode).toBe(200);
      const appts = res.body.data || [];
      const hasDoc1Appt = appts.some((a) => a.doctor_id === doctor1Record.doctor_id);
      expect(hasDoc1Appt).toBe(false);
    });
  });

  describe('SEC-04: CORS Policy Enforcement', () => {
    test('CORS rejects unauthorized origin when in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://malicious-site.attacker.com');

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/CORS/i);

      process.env.NODE_ENV = originalEnv;
    });

    test('CORS permits authorized frontend origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('SEC-05: Password hashes and sensitive fields never leaked in responses', () => {
    test('GET /api/auth/me does not expose password_hash', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();
    });

    test('GET /api/users does not expose user password hashes', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const users = res.body.data || [];
      expect(users.length).toBeGreaterThan(0);
      users.forEach((u) => {
        expect(u.password).toBeUndefined();
        expect(u.password_hash).toBeUndefined();
      });
    });

    test('GET /api/doctors does not expose doctor user passwords', async () => {
      const res = await request(app)
        .get('/api/doctors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const doctors = res.body.data || [];
      expect(doctors.length).toBeGreaterThan(0);
      doctors.forEach((d) => {
        expect(d.password).toBeUndefined();
        expect(d.password_hash).toBeUndefined();
        if (d.User) {
          expect(d.User.password).toBeUndefined();
          expect(d.User.password_hash).toBeUndefined();
        }
      });
    });
  });

  describe('SEC-08: Production error masking prevents stack and SQL leaks', () => {
    test('Non-existent route returns clean 404 message without stack or internals', async () => {
      const res = await request(app).get('/api/non-existent-secret-path');

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Not found');
      expect(res.body.stack).toBeUndefined();
    });
  });
});
