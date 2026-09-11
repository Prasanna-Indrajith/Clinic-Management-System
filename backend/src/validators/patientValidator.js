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

const createPatientValidation = [
  body('name').trim().notEmpty().withMessage('Patient name is required').isLength({ max: 100 }),
  body('dob')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),
  body('contact').trim().notEmpty().withMessage('Contact number is required').isLength({ max: 50 }),
  body('address').optional().trim(),
  body('notes').optional().trim(),
  validate,
];

const updatePatientValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
  body('dob').optional().isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),
  body('contact').optional().trim().notEmpty().withMessage('Contact cannot be empty').isLength({ max: 50 }),
  body('address').optional().trim(),
  body('notes').optional().trim(),
  validate,
];

module.exports = {
  createPatientValidation,
  updatePatientValidation,
};
