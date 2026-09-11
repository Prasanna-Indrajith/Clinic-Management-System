'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-test-jwt-key-2026';
process.env.JWT_EXPIRES_IN = '1h';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
process.env.LOGIN_RATE_LIMIT_MAX = '5'; // Lower threshold for testing rate limiter

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { sequelize, User, AuditLog } = require('../src/models');
const { generateToken } = require('../src/utils/token');

beforeAll(async () => {
  await sequelize.sync({ force: true });
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

  describe('AUTH-01: User Registration with bcrypt hash', () => {
    it('should register a new user and store password as a bcrypt hash (not plaintext)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
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
    });
  });

  describe('AUTH-02: Duplicate Email Rejection', () => {
    it('should reject registration with duplicate email with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
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
  });
});
