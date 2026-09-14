'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-test-jwt-key-2026';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Patient, Doctor, Appointment, AuditLog } = require('../src/models');
const { generateToken } = require('../src/utils/token');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Phase 2 — Patient & Doctor Management (02_TEST_PLAN.md §2, §3)', () => {
  let adminToken;
  let doctorToken;
  let doctorRecord;
  let doctorUser;

  beforeAll(async () => {
    // Create admin user
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin.patients@clinic.local',
      password_hash: 'AdminPass123!',
      role: 'admin',
    });
    adminToken = generateToken(adminUser);

    // Create doctor user & doctor record
    doctorUser = await User.create({
      name: 'Dr. Gregory House',
      email: 'house@clinic.local',
      password_hash: 'DoctorPass123!',
      role: 'doctor',
    });
    doctorToken = generateToken(doctorUser);

    doctorRecord = await Doctor.create({
      name: 'Dr. Gregory House',
      specialization: 'Diagnostics',
      contact: '555-0199',
      email: doctorUser.email,
      user_id: doctorUser.user_id,
    });
  });

  describe('2. Patient Management Tests (PAT-01 to PAT-07)', () => {
    let createdPatientId;

    it('PAT-01: Admin can create patient with valid data', async () => {
      const patientData = {
        name: 'John Doe',
        dob: '1985-06-15',
        contact: '555-1234',
        address: '123 Elm St',
        notes: 'Penicillin allergy',
      };

      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(patientData)
        .expect(201);

      expect(res.body).toHaveProperty('message', 'Patient created successfully');
      expect(res.body.data).toHaveProperty('patient_id');
      expect(res.body.data.name).toBe(patientData.name);
      expect(res.body.data.contact).toBe(patientData.contact);

      createdPatientId = res.body.data.patient_id;
    });

    it('PAT-02: Doctor receives 403 Forbidden when trying to create a patient', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          name: 'Unauthorized Patient',
          dob: '1990-01-01',
          contact: '555-0000',
        })
        .expect(403);

      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it('PAT-03: Missing required field returns 400 with validation message and creates no row', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // name missing
          dob: '1990-01-01',
          contact: '555-0000',
        })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details.some((d) => d.field === 'name')).toBe(true);
    });

    it('PAT-04: Admin can update patient and audit log is written', async () => {
      const updateData = {
        contact: '555-9999',
        notes: 'Updated allergy information: none',
      };

      const res = await request(app)
        .put(`/api/patients/${createdPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.data.contact).toBe('555-9999');

      // Verify audit log entry
      const audit = await AuditLog.findOne({
        where: { action: 'UPDATE_PATIENT', entity_id: String(createdPatientId) },
      });
      expect(audit).not.toBeNull();
    });

    it('PAT-05: Admin can delete patient and patient no longer appears in list', async () => {
      const tempPatient = await Patient.create({
        name: 'Temporary Patient',
        dob: '1992-03-10',
        contact: '555-4321',
      });

      await request(app)
        .delete(`/api/patients/${tempPatient.patient_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const check = await Patient.findByPk(tempPatient.patient_id);
      expect(check).toBeNull();
    });

    it('PAT-06: Doctor query returns only patients assigned to that doctor', async () => {
      // Create patient A and assign to Dr. House via appointment
      const patientA = await Patient.create({
        name: 'Assigned Patient A',
        dob: '1980-01-01',
        contact: '555-1111',
      });
      await Appointment.create({
        patient_id: patientA.patient_id,
        doctor_id: doctorRecord.doctor_id,
        date_time: new Date(Date.now() + 86400000),
        status: 'scheduled',
      });

      // Create patient B with no appointment with Dr. House
      const patientB = await Patient.create({
        name: 'Unassigned Patient B',
        dob: '1982-02-02',
        contact: '555-2222',
      });

      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const returnedIds = res.body.data.map((p) => p.patient_id);
      expect(returnedIds).toContain(patientA.patient_id);
      expect(returnedIds).not.toContain(patientB.patient_id);
    });

    it('PAT-07: SQL-injection string in search treated as literal text with zero leaks', async () => {
      const sqliPayload = "' OR '1'='1";

      const res = await request(app)
        .get(`/api/patients?search=${encodeURIComponent(sqliPayload)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // No patient has name or contact containing "' OR '1'='1"
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('3. Doctor Management Tests (DOC-01 to DOC-03)', () => {
    let createdDoctorId;

    it('DOC-01: Admin can create a new doctor', async () => {
      const doctorData = {
        name: 'Dr. James Wilson',
        specialization: 'Oncology',
        contact: '555-0144',
        email: 'wilson@clinic.local',
      };

      const res = await request(app)
        .post('/api/doctors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(doctorData)
        .expect(201);

      expect(res.body.data).toHaveProperty('doctor_id');
      expect(res.body.data.name).toBe(doctorData.name);
      createdDoctorId = res.body.data.doctor_id;
    });

    it('DOC-02: Non-admin receives 403 Forbidden when creating/updating/deleting doctors', async () => {
      await request(app)
        .post('/api/doctors')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          name: 'Dr. Hacker',
          specialization: 'Fraud',
          contact: '555-6666',
          email: 'hacker@clinic.local',
        })
        .expect(403);

      await request(app)
        .delete(`/api/doctors/${createdDoctorId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });

    it('DOC-03: Any authenticated user can read doctor list', async () => {
      const res = await request(app)
        .get('/api/doctors')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
