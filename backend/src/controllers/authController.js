'use strict';

const { User } = require('../models');
const logger = require('../config/logger');
const { generateToken } = require('../utils/token');
const audit = require('../utils/auditLog');
const { createAccountWithProfile } = require('../services/userService');

/**
 * Create a new user account (Admin or Receptionist only)
 */
const register = async (req, res) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const user = await createAccountWithProfile(req.body, {
      actorId: req.user ? req.user.id : null,
      actorRole: req.user ? req.user.role : null,
      ipAddress,
      auditAction: 'USER_REGISTERED',
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
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
      logger.warn(`Failed login attempt: User not found for email ${email}`);
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
      logger.warn(`Failed login attempt: Invalid password for email ${email}`);
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
