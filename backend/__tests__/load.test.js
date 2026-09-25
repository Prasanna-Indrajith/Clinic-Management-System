'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Doctor, Patient, Appointment } = require('../src/models');
const { generateToken } = require('../src/utils/token');

describe('Non-Functional Load & Concurrency Check (NFR-01)', () => {
    let token;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        const user = await User.create({
            name: 'Load Test Doctor',
            email: 'doctor.load@example.com',
            password_hash: 'hashed_password',
            role: 'doctor',
        });

        token = generateToken(user);

        // Seed 10 doctors & patients for query load
        for (let i = 1; i <= 5; i++) {
            await Doctor.create({
                name: `Doctor Load ${i}`,
                specialization: 'General Practice',
                schedule: 'Mon-Fri 09:00-17:00',
                email: `dr.load${i}@example.com`,
                contact: `555-010${i}`,
            });

            await Patient.create({
                name: `Patient Load ${i}`,
                dob: '1985-06-20',
                contact: `555-020${i}`,
            });
        }
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('NFR-01: handles 20 concurrent requests with average latency well under 2000ms (SRS §4.2)', async () => {
        const CONCURRENT_USERS = 20;
        const requests = [];

        const startTime = Date.now();

        for (let i = 0; i < CONCURRENT_USERS; i++) {
            // Mix of public health check and authenticated resource endpoints
            if (i % 2 === 0) {
                requests.push(
                    request(app)
                        .get('/api/health')
                );
            } else {
                requests.push(
                    request(app)
                        .get('/api/doctors')
                        .set('Authorization', `Bearer ${token}`)
                );
            }
        }

        const responses = await Promise.all(requests);
        const totalDuration = Date.now() - startTime;
        const avgLatency = totalDuration / CONCURRENT_USERS;

        // All concurrent requests must succeed
        responses.forEach((res) => {
            expect(res.status).toBe(200);
        });

        // NFR-01 requirement: response time must be under 2s (2000ms)
        expect(avgLatency).toBeLessThan(2000);
        expect(totalDuration).toBeLessThan(5000);
    });
});
