'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-test-jwt-key-2026';
process.env.JWT_EXPIRES_IN = '1h';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
process.env.LOGIN_RATE_LIMIT_MAX = '5'; // Lower threshold for testing rate limiter

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { sequelize, User, Doctor, Patient, AuditLog } = require('../src/models');
const { generateToken } = require('../src/utils/token');

let seedAdminToken;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const seedAdmin = await User.create({
    name: 'Seed Admin',
    email: 'seed.admin@clinic.local',
    password_hash: 'SeedAdmin123!',
    role: 'admin',
  });
  seedAdminToken = generateToken(seedAdmin);
});

afterAll(async () => {
  await sequelize.close();
});

describe('Phase 1 — Authentication & Authorization (02_TEST_PLAN.md §1)', () => {
  const testUser = {
    name: 'Dr. Jane Smith',
    email: 'jane.smith@clinic.local',
    password: 'SecurePassword123!',
    role: 'doctor',
  };

  describe('AUTH-00: Public signup is disabled', () => {
    it('should reject unauthenticated registration on /api/auth/register and /api/register with 401', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(401);

      await request(app)
        .post('/api/register')
        .send(testUser)
        .expect(401);
    });
  });

  describe('AUTH-01: User Registration with bcrypt hash (by Admin)', () => {
    it('should register a new user and store password as a bcrypt hash (not plaintext)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${seedAdminToken}`)
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('message', 'User registered successfully');
      expect(res.body.user).toHaveProperty('user_id');
      expect(res.body.user).toHaveProperty('email', testUser.email);
      expect(res.body.user).toHaveProperty('role', 'doctor');
      // Password hash must never appear in response
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();

      // Check in DB directly
      const dbUser = await User.findOne({ where: { email: testUser.email } });
      expect(dbUser).not.toBeNull();
      expect(dbUser.password_hash).not.toBe(testUser.password);
      expect(dbUser.password_hash.startsWith('$2b$') || dbUser.password_hash.startsWith('$2a$')).toBe(true);

      // Linked Doctor profile should also be provisioned
      const dbDoctor = await Doctor.findOne({ where: { user_id: dbUser.user_id } });
      expect(dbDoctor).not.toBeNull();
      expect(dbDoctor.email).toBe(testUser.email);
    });
  });

  describe('AUTH-02: Duplicate Email Rejection', () => {
    it('should reject registration with duplicate email with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${seedAdminToken}`)
        .send(testUser)
        .expect(409);

      expect(res.body).toHaveProperty('error', 'Email already registered');
    });
  });

  describe('AUTH-03: Login with Valid Credentials', () => {
    it('should return signed JWT and stripped user profile without password hash', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toHaveProperty('email', testUser.email);
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();

      // Verify JWT payload
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('email', testUser.email);
      expect(decoded).toHaveProperty('role', 'doctor');
    });
  });

  describe('AUTH-04: Login with Wrong Password & Audit Log', () => {
    it('should return 401 and record failed login attempt in audit log', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword999!' })
        .expect(401);

      expect(res.body).toHaveProperty('error', 'Invalid email or password');

      // Verify audit log has recorded the failure
      const auditEntry = await AuditLog.findOne({
        where: { action: 'LOGIN_FAILURE' },
        order: [['log_id', 'DESC']],
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry.details).toContain('Invalid password');
    });
  });

  describe('AUTH-05: Rate Limiting on Rapid Login Attempts', () => {
    it('should return 429 when login attempts exceed rate limit threshold', async () => {
      // Threshold is set to 5 for test environment
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: testUser.email, password: 'WrongPassword!' });
      }

      // 6th attempt should be blocked
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword!' });

      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/too many login attempts/i);
    });
  });

  describe('Protected Routes & Authorization Middleware', () => {
    let validDoctorToken;
    let validAdminToken;

    beforeAll(async () => {
      // Create admin user
      const admin = await User.create({
        name: 'Clinic Admin',
        email: 'admin@clinic.local',
        password_hash: 'AdminSecret123!',
        role: 'admin',
      });

      const doctor = await User.findOne({ where: { email: testUser.email } });

      validDoctorToken = generateToken(doctor);
      validAdminToken = generateToken(admin);
    });

    describe('AUTH-06: Expired JWT Handling', () => {
      it('should return 401 when calling protected route with expired token', async () => {
        const expiredToken = jwt.sign(
          { id: 1, email: 'test@clinic.local', role: 'doctor' },
          process.env.JWT_SECRET,
          { expiresIn: '-1s' } // Expired 1 second ago
        );

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(res.body.error).toMatch(/token expired/i);
      });
    });

    describe('AUTH-07: Tampered JWT Handling', () => {
      it('should return 401 when token signature is tampered or invalid', async () => {
        const tamperedToken = validDoctorToken + 'tampered-signature-bits';

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${tamperedToken}`)
          .expect(401);

        expect(res.body.error).toMatch(/invalid or tampered/i);
      });
    });

    describe('AUTH-08: Missing Authorization Header', () => {
      it('should return 401 when Authorization header is absent', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .expect(401);

        expect(res.body.error).toMatch(/access denied\. no token provided/i);
      });

      it('should return 200 when valid token is provided to /api/auth/me', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${validDoctorToken}`)
          .expect(200);

        expect(res.body.user).toHaveProperty('email', testUser.email);
        expect(res.body.user).toHaveProperty('role', 'doctor');
      });
    });

    describe('AUTH-09: Role-Based Access Control (RBAC)', () => {
      it('should return 403 when user with Doctor role hits Admin-only route', async () => {
        const res = await request(app)
          .get('/api/auth/admin-check')
          .set('Authorization', `Bearer ${validDoctorToken}`)
          .expect(403);

        expect(res.body.error).toMatch(/insufficient permissions/i);
      });

      it('should return 200 when user with Admin role hits Admin-only route', async () => {
        const res = await request(app)
          .get('/api/auth/admin-check')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('message', 'Admin access verified');
        expect(res.body.user).toHaveProperty('role', 'admin');
      });
    });

    describe('AUTH-10: Role-Scoped User & Doctor Creation (Admin vs Receptionist)', () => {
      let receptionistToken;
      let patientToken;

      beforeAll(async () => {
        const receptionist = await User.create({
          name: 'Front Desk',
          email: 'frontdesk.auth10@clinic.local',
          password_hash: 'ReceptionPass123!',
          role: 'receptionist',
        });
        receptionistToken = generateToken(receptionist);

        const patientUser = await User.create({
          name: 'Patient User',
          email: 'patient.auth10@clinic.local',
          password_hash: 'PatientPass123!',
          role: 'patient',
        });
        patientToken = generateToken(patientUser);
      });

      it('receptionist can add a new patient user and a new doctor user via /api/users', async () => {
        const patRes = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({
            name: 'New Patient By Reception',
            email: 'new.patient.rec@clinic.local',
            password: 'Password123!',
            role: 'patient',
            contact: '077-111-2222',
          })
          .expect(201);

        expect(patRes.body.user.role).toBe('patient');
        const patProfile = await Patient.findOne({ where: { user_id: patRes.body.user.user_id } });
        expect(patProfile).not.toBeNull();
        expect(patProfile.contact).toBe('077-111-2222');

        const docRes = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({
            name: 'Dr. Reception Added',
            email: 'dr.rec.added@clinic.local',
            password: 'Password123!',
            role: 'doctor',
            specialization: 'Pediatrics',
            contact: '077-333-4444',
          })
          .expect(201);

        expect(docRes.body.user.role).toBe('doctor');
        const docProfile = await Doctor.findOne({ where: { user_id: docRes.body.user.user_id } });
        expect(docProfile).not.toBeNull();
        expect(docProfile.specialization).toBe('Pediatrics');
      });

      it('receptionist cannot add a receptionist or admin user (403)', async () => {
        await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({
            name: 'Unauthorized Receptionist',
            email: 'unauth.rec@clinic.local',
            password: 'Password123!',
            role: 'receptionist',
          })
          .expect(403);

        await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({
            name: 'Unauthorized Admin',
            email: 'unauth.admin@clinic.local',
            password: 'Password123!',
            role: 'admin',
          })
          .expect(403);
      });

      it('receptionist listing /api/users only receives patient and doctor accounts', async () => {
        const res = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .expect(200);

        const roles = res.body.data.map((u) => u.role);
        expect(roles.length).toBeGreaterThan(0);
        expect(roles.every((r) => r === 'patient' || r === 'doctor')).toBe(true);
      });

      it('receptionist can add a doctor via POST /api/doctors with optional login password', async () => {
        const res = await request(app)
          .post('/api/doctors')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({
            name: 'Dr. Direct Roster',
            specialization: 'Dermatology',
            contact: '077-555-6666',
            email: 'dr.direct.roster@clinic.local',
            password: 'DoctorPass123!',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('doctor_id');
        expect(res.body.data.user_id).toBeTruthy();

        const docUser = await User.findByPk(res.body.data.user_id);
        expect(docUser).not.toBeNull();
        expect(docUser.role).toBe('doctor');
      });

      it('admin can add receptionist, admin, doctor, and patient accounts via /api/users', async () => {
        const recRes = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            name: 'Admin Added Receptionist',
            email: 'admin.added.rec@clinic.local',
            password: 'Password123!',
            role: 'receptionist',
          })
          .expect(201);
        expect(recRes.body.user.role).toBe('receptionist');

        const admRes = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            name: 'Admin Added Admin',
            email: 'admin.added.adm@clinic.local',
            password: 'Password123!',
            role: 'admin',
          })
          .expect(201);
        expect(admRes.body.user.role).toBe('admin');
      });

      it('doctor and patient cannot create users via /api/users (403)', async () => {
        await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${validDoctorToken}`)
          .send({
            name: 'Blocked User',
            email: 'blocked.doc@clinic.local',
            password: 'Password123!',
            role: 'patient',
          })
          .expect(403);

        await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${patientToken}`)
          .send({
            name: 'Blocked User',
            email: 'blocked.pat@clinic.local',
            password: 'Password123!',
            role: 'patient',
          })
          .expect(403);
      });
    });
    describe('AUTH-10: Full-Day Default Token Lifetime', () => {
      it('defaults JWT expiration to 12h for full-day clinic sessions when JWT_EXPIRES_IN is unset', () => {
        const previousExpiry = process.env.JWT_EXPIRES_IN;
        delete process.env.JWT_EXPIRES_IN;
        let defaultGenerateToken;
        jest.isolateModules(() => {
          ({ generateToken: defaultGenerateToken } = require('../src/utils/token'));
        });
        process.env.JWT_EXPIRES_IN = previousExpiry;

        const token = defaultGenerateToken({
          user_id: 99,
          email: 'shift@clinic.local',
          role: 'doctor',
        });
        const decoded = jwt.decode(token);
        expect(decoded.exp - decoded.iat).toBe(12 * 60 * 60);
      });
    });
  });
});
