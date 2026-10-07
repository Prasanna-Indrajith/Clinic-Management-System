'use strict';

const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const createAppointmentValidation = [
  body('patient_id')
    .custom((value, { req }) => {
      if (req.user && req.user.role === 'patient') {
        return true;
      }
      if (value === undefined || value === null || value === '' || isNaN(parseInt(value, 10)) || parseInt(value, 10) < 1) {
        throw new Error('patient_id is required');
      }
      return true;
    }),
  body('doctor_id')
    .notEmpty()
    .withMessage('doctor_id is required')
    .isInt({ min: 1 })
    .withMessage('doctor_id must be a valid integer ID'),
  body('date_time')
    .notEmpty()
    .withMessage('date_time is required')
    .isISO8601()
    .withMessage('date_time must be a valid ISO8601 date string'),
  body('remarks').optional().trim(),
  validate,
];

const updateAppointmentValidation = [
  body('date_time').optional().isISO8601().withMessage('date_time must be a valid ISO8601 date string'),
  body('status')
    .optional()
    .isIn(['scheduled', 'completed', 'cancelled'])
    .withMessage('status must be scheduled, completed, or cancelled'),
  body('remarks').optional().trim(),
  validate,
];

module.exports = {
  createAppointmentValidation,
  updateAppointmentValidation,
};
