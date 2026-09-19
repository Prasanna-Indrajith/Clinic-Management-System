'use strict';

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
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

const dailyReportValidation = [
  body('date').trim().isISO8601().withMessage('date must be a valid date (YYYY-MM-DD)'),
  validate,
];

const monthlyReportValidation = [
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('year must be a valid integer (2000-2100)'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('month must be between 1 and 12'),
  validate,
];

// All report endpoints require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/reports/daily:
 *   post:
 *     summary: Generate daily report for a given date
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Daily report
 *       400:
 *         description: Invalid date
 */
router.post('/daily', dailyReportValidation, reportController.dailyReport);

/**
 * @openapi
 * /api/reports/monthly:
 *   post:
 *     summary: Generate monthly report for a given year/month
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [year, month]
 *             properties:
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Monthly report
 *       400:
 *         description: Invalid year or month
 */
router.post('/monthly', monthlyReportValidation, reportController.monthlyReport);

module.exports = router;