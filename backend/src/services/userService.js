'use strict';

const { sequelize, User, Patient, Doctor } = require('../models');
const audit = require('../utils/auditLog');
const logger = require('../config/logger');

const ALL_ROLES = ['admin', 'doctor', 'receptionist', 'patient'];
const RECEPTIONIST_ALLOWED_ROLES = ['patient', 'doctor'];

/**
 * Determine whether an actor with `actorRole` is permitted to create a user with `targetRole`.
 */
const canCreateRole = (actorRole, targetRole) => {
  if (!ALL_ROLES.includes(targetRole)) return false;
  if (actorRole === 'admin') return true;
  if (actorRole === 'receptionist') return RECEPTIONIST_ALLOWED_ROLES.includes(targetRole);
  return false;
};

/**
 * Create a user account and any linked clinical profile (Patient or Doctor) atomically.
 * Enforces role-creation permissions based on the acting user's role.
 */
const createAccountWithProfile = async (payload, context = {}) => {
  const { name, email, password, role, specialization, contact, dob, address, notes } = payload;
  const { actorId = null, actorRole = null, ipAddress = null, auditAction = 'USER_REGISTERED' } = context;

  const targetRole = role || 'patient';

  if (!canCreateRole(actorRole, targetRole)) {
    const err = new Error(
      actorRole === 'receptionist'
        ? 'Forbidden: Receptionists can only add patient or doctor accounts.'
        : 'Forbidden: Insufficient permissions to create this user role.'
    );
    err.status = 403;
    throw err;
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const user = await sequelize.transaction(async (t) => {
    const createdUser = await User.create(
      {
        name,
        email,
        password_hash: password,
        role: targetRole,
      },
      { transaction: t }
    );

    if (targetRole === 'patient') {
      await Patient.create(
        {
          user_id: createdUser.user_id,
          name: createdUser.name,
          dob: dob || '2000-01-01',
          contact: contact || 'Pending update',
          address: address || null,
          notes: notes || null,
        },
        { transaction: t }
      );
    } else if (targetRole === 'doctor') {
      const existingDoctor = await Doctor.findOne({ where: { email }, transaction: t });
      if (existingDoctor) {
        if (!existingDoctor.user_id) {
          await existingDoctor.update({ user_id: createdUser.user_id }, { transaction: t });
        }
      } else {
        await Doctor.create(
          {
            user_id: createdUser.user_id,
            name: createdUser.name,
            specialization: specialization || 'General Medicine',
            contact: contact || 'Pending update',
            email: createdUser.email,
          },
          { transaction: t }
        );
      }
    }

    return createdUser;
  });

  await audit.log({
    userId: actorId,
    action: auditAction,
    entity: 'User',
    entityId: user.user_id,
    ipAddress,
    details: { createdEmail: user.email, role: user.role, createdByRole: actorRole },
  });

  logger.info(`New user created: ${user.email} (${user.role}) by user #${actorId} (${actorRole})`);

  return user;
};

module.exports = {
  ALL_ROLES,
  RECEPTIONIST_ALLOWED_ROLES,
  canCreateRole,
  createAccountWithProfile,
};
