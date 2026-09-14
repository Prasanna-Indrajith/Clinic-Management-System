'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerValidation, loginValidation } = require('../validators/authValidator');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { loginLimiter } = require('../middleware/rateLimiter');

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [admin, doctor, receptionist, patient]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email already registered
 */
router.post('/register', registerValidation, authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and receive JWT
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns JWT
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Rate limited due to excessive attempts
 */
router.post('/login', loginLimiter, loginValidation, authController.login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Retrieve currently authenticated user profile
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Missing or invalid token
 */
router.get('/me', authMiddleware, authController.getMe);

/**
 * @openapi
 * /api/auth/admin-check:
 *   get:
 *     summary: Admin RBAC verification ping
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Admin access verified
 *       403:
 *         description: Forbidden - non-admin role
 */
router.get('/admin-check', authMiddleware, requireRole(['admin']), (req, res) => {
  res.status(200).json({ message: 'Admin access verified', user: req.user });
});

module.exports = router;
