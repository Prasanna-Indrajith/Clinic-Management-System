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

const createDoctorValidation = [
  body('name').trim().notEmpty().withMessage('Doctor name is required').isLength({ max: 100 }),
  body('specialization')
    .trim()
    .notEmpty()
    .withMessage('Specialization is required')
    .isLength({ max: 100 }),
  body('contact').trim().notEmpty().withMessage('Contact is required').isLength({ max: 50 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('user_id').optional({ nullable: true }).isInt().withMessage('user_id must be an integer'),
  validate,
];

const updateDoctorValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
  body('specialization').optional().trim().notEmpty().withMessage('Specialization cannot be empty'),
  body('contact').optional().trim().notEmpty().withMessage('Contact cannot be empty'),
  body('email').optional().trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('user_id').optional({ nullable: true }).isInt().withMessage('user_id must be an integer'),
  validate,
];

module.exports = {
  createDoctorValidation,
  updateDoctorValidation,
};
