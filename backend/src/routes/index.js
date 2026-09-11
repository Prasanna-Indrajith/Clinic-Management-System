'use strict';

const { Router } = require('express');
const healthRouter = require('./health');
const authRouter = require('./auth');

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/', authRouter); // Supports SRS /api/register and /api/login paths
router.use('/patients', require('./patients'));

module.exports = router;
