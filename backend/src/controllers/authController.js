'use strict';

const { User, Patient } = require('../models');
const logger = require('../config/logger');
const { generateToken } = require('../utils/token');
const audit = require('../utils/auditLog');

/**
 * Register a new user with bcrypt-hashed password
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if email already registered
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create user (password is hashed automatically by User model hook)
    const user = await User.create({
      name,
      email,
      password_hash: password,
      role: role || 'patient',
    });

    if (user.role === 'patient') {
      await Patient.create({
        user_id: user.user_id,
        name: user.name,
        dob: '2000-01-01',
        contact: 'Pending update',
      });
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    await audit.log({
      userId: user.user_id,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: user.user_id,
      ipAddress,
      details: { email: user.email, role: user.role },
    });

    logger.info(`New user registered: ${user.email} (${user.role})`);

    return res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
    });
  } catch (err) {
    logger.error('Registration error', { message: err.message });
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
};

/**
 * Authenticate user, return signed JWT and stripped user profile
 */
const login = async (req, res) => {
  const ipAddress = req.ip || req.socket.remoteAddress;
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      await audit.log({
        userId: null,
        action: 'LOGIN_FAILURE',
        entity: 'User',
        entityId: null,
        ipAddress,
        details: { email, reason: 'User not found' },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await audit.log({
        userId: user.user_id,
        action: 'LOGIN_FAILURE',
        entity: 'User',
        entityId: user.user_id,
        ipAddress,
        details: { email, reason: 'Invalid password' },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Sign JWT token
    const token = generateToken(user);

    await audit.log({
      userId: user.user_id,
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.user_id,
      ipAddress,
      details: { email: user.email },
    });

    logger.info(`User logged in: ${user.email} (${user.role})`);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    logger.error('Login error', { message: err.message });
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

/**
 * Return current authenticated user profile
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
};

module.exports = {
  register,
  login,
  getMe,
};
