'use strict';

const { User } = require('../models');
const logger = require('../config/logger');
const { generateToken } = require('../utils/token');

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

/**
 * Authenticate user, return signed JWT and stripped user profile
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Sign JWT token
    const token = generateToken(user);
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

module.exports = {
  register,
  login,
};
