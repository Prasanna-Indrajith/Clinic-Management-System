'use strict';

const { User } = require('../models');
const logger = require('../config/logger');

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

module.exports = {
  register,
};
