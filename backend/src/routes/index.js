'use strict';

const { Router } = require('express');
const healthRouter = require('./health');
const authRouter = require('./auth');

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/', authRouter); // Supports SRS /api/register and /api/login paths
router.use('/patients', require('./patients'));
router.use('/doctors', require('./doctors'));
router.use('/appointments', require('./appointments'));
router.use('/users', require('./users'));
router.use('/medical-records', require('./medicalRecords'));
router.use('/reports', require('./reports'));
router.use('/notifications', require('./notifications'));

module.exports = router;
