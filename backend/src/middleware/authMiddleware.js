'use strict';

const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/token');
const { User } = require('../models');

/**
 * Authentication middleware.
 * Verifies JWT token from Authorization header and attaches user to req.user.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    // Optionally check if user still exists in DB
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    req.user = {
      id: user.user_id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid or tampered authentication token.' });
  }
};

module.exports = authMiddleware;
