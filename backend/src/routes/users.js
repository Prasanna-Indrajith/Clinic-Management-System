'use strict';

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
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

const updateUserValidation = [
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['admin', 'doctor', 'receptionist', 'patient'])
        .withMessage('Invalid role specified'),
    validate,
];

// All user endpoints require authentication + admin role
router.use(authMiddleware, requireRole(['admin']));

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, doctor, receptionist, patient]
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Forbidden - admin only
 */
router.get('/', userController.getAllUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Update user role (Admin only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, doctor, receptionist, patient]
 *     responses:
 *       200:
 *         description: User role updated
 *       404:
 *         description: User not found
 */
router.put('/:id', updateUserValidation, userController.updateUserRole);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user (Admin only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 */
router.delete('/:id', userController.deleteUser);

module.exports = router;
