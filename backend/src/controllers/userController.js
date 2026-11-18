'use strict';

const { Op } = require('sequelize');
const { User } = require('../models');
const logger = require('../config/logger');
const audit = require('../utils/auditLog');
const { buildSearchClause } = require('../utils/search');
const {
    RECEPTIONIST_ALLOWED_ROLES,
    createAccountWithProfile,
} = require('../services/userService');

/**
 * List users (Admin sees all; Receptionist sees patient and doctor accounts).
 * Supports pagination, search, and optional role filter.
 */
const getAllUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const offset = (page - 1) * limit;
        const search = req.query.search || req.query.q || '';

        const whereClause = {};
        if (req.user.role === 'receptionist') {
            if (req.query.role) {
                if (!RECEPTIONIST_ALLOWED_ROLES.includes(req.query.role)) {
                    return res.status(403).json({
                        error: 'Forbidden: Receptionists can only view patient and doctor accounts.',
                    });
                }
                whereClause.role = req.query.role;
            } else {
                whereClause.role = { [Op.in]: RECEPTIONIST_ALLOWED_ROLES };
            }
        } else if (req.query.role) {
            whereClause.role = req.query.role;
        }

        const searchClause = buildSearchClause(search, ['name', 'email']);
        if (searchClause) {
            Object.assign(whereClause, searchClause);
        }

        const { count, rows } = await User.findAndCountAll({
            where: whereClause,
            attributes: ['user_id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
            limit,
            offset,
            order: [['createdAt', 'DESC']],
        });

        return res.status(200).json({
            data: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit),
            },
        });
    } catch (err) {
        logger.error('Error fetching users', { message: err.message });
        return res.status(500).json({ error: 'Failed to retrieve users' });
    }
};

/**
 * Create a new user account (Admin: any role; Receptionist: patient or doctor only).
 */
const createUser = async (req, res) => {
    try {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const user = await createAccountWithProfile(req.body, {
            actorId: req.user ? req.user.id : null,
            actorRole: req.user ? req.user.role : null,
            ipAddress,
            auditAction: 'CREATE_USER',
        });

        return res.status(201).json({
            message: 'User created successfully',
            user: user.toJSON(),
        });
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json({ error: err.message });
        }
        logger.error('Error creating user', { message: err.message });
        return res.status(500).json({ error: 'Failed to create user' });
    }
};

/**
 * Update a user's role (Admin only).
 */
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const oldRole = user.role;
        user.role = role;
        await user.save();

        const ipAddress = req.ip || req.socket.remoteAddress;
        await audit.log({
            userId: req.user ? req.user.id : null,
            action: 'UPDATE_USER_ROLE',
            entity: 'User',
            entityId: user.user_id,
            ipAddress,
            details: { email: user.email, oldRole, newRole: role },
        });

        logger.info(`User role updated: ${user.email} (${oldRole} → ${role})`);

        return res.status(200).json({
            message: 'User role updated successfully',
            user: user.toJSON(),
        });
    } catch (err) {
        logger.error('Error updating user role', { message: err.message });
        return res.status(500).json({ error: 'Failed to update user role' });
    }
};

/**
 * Delete a user (Admin only).
 * Prevents self-deletion.
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id, 10) === req.user.id) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await user.destroy();

        const ipAddress = req.ip || req.socket.remoteAddress;
        await audit.log({
            userId: req.user ? req.user.id : null,
            action: 'DELETE_USER',
            entity: 'User',
            entityId: id,
            ipAddress,
            details: { email: user.email, role: user.role },
        });

        logger.info(`User deleted: ${user.email}`);

        return res.status(200).json({
            message: 'User deleted successfully',
        });
    } catch (err) {
        logger.error('Error deleting user', { message: err.message });
        return res.status(500).json({ error: 'Failed to delete user' });
    }
};

module.exports = {
    getAllUsers,
    createUser,
    updateUserRole,
    deleteUser,
};
