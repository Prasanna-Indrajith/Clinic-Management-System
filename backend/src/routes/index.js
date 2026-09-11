'use strict';

const { Router } = require('express');
const healthRouter = require('./health');

const router = Router();

/**
 * Mount all application routes here.
 * Auth, patients, doctors, appointments, reports added in Phase 1+.
 */
router.use('/health', healthRouter);

// Phase 1 placeholder — routes added per phase
// router.use('/auth',         require('./auth'));
// router.use('/patients',     require('./patients'));
// router.use('/doctors',      require('./doctors'));
// router.use('/appointments', require('./appointments'));
// router.use('/reports',      require('./reports'));

module.exports = router;
