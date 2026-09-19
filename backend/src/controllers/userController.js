'use strict';

const { User } = require('../models');
const logger = require('../config/logger');
const audit = require('../utils/auditLog');

/**
 * List all users (Admin only).
 * Supports pagination and optional role filter.
 */
const getAllUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (req.query.role) {
            whereClause.role = req.query.role;
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
    updateUserRole,
    deleteUser,
};
