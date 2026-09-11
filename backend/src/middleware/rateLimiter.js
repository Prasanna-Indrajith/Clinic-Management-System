'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for sensitive authentication endpoints (e.g. login).
 * Protects against brute-force attacks per SRS §4.1 / Test Plan AUTH-05.
 */
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Please try again later.',
  },
  statusCode: 429,
});

module.exports = {
  loginLimiter,
};
