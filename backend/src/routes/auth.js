'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerValidation, loginValidation } = require('../validators/authValidator');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/me', authMiddleware, authController.getMe);
router.get('/admin-check', authMiddleware, requireRole(['admin']), (req, res) => {
  res.status(200).json({ message: 'Admin access verified', user: req.user });
});

module.exports = router;
