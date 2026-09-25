'use strict';

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
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

const exportDailyValidation = [
  body('date').trim().isISO8601().withMessage('date must be a valid date (YYYY-MM-DD)'),
  body('format').optional().isIn(['pdf', 'csv']).withMessage('format must be pdf or csv'),
  validate,
];

const exportMonthlyValidation = [
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('year must be a valid integer (2000-2100)'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('month must be between 1 and 12'),
  body('format').optional().isIn(['pdf', 'csv']).withMessage('format must be pdf or csv'),
  validate,
];

// All report endpoints require authentication and either admin or doctor role
router.use(authMiddleware);
router.use(requireRole(['admin', 'doctor']));

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
 *       403:
 *         description: Forbidden - admin or doctor only
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
 *       403:
 *         description: Forbidden - admin or doctor only
 */
router.post('/monthly', monthlyReportValidation, reportController.monthlyReport);

/**
 * @openapi
 * /api/reports/daily/export:
 *   post:
 *     summary: Export daily report as streamed PDF or CSV
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
 *               format:
 *                 type: string
 *                 enum: [pdf, csv]
 *                 default: pdf
 *     responses:
 *       200:
 *         description: Streamed PDF or CSV file
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - admin or doctor only
 */
router.post('/daily/export', exportDailyValidation, reportController.exportDailyReport);

/**
 * @openapi
 * /api/reports/monthly/export:
 *   post:
 *     summary: Export monthly report as streamed PDF or CSV
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
 *               format:
 *                 type: string
 *                 enum: [pdf, csv]
 *                 default: pdf
 *     responses:
 *       200:
 *         description: Streamed PDF or CSV file
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - admin or doctor only
 */
router.post('/monthly/export', exportMonthlyValidation, reportController.exportMonthlyReport);

module.exports = router;