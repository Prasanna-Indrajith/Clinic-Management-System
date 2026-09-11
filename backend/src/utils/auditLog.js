'use strict';

/**
 * Audit logger stub — Phase 1 replaces this with a real DB write.
 *
 * Usage:
 *   const audit = require('../utils/auditLog');
 *   await audit.log({ userId, action: 'CREATE_PATIENT', entityId: patient.id });
 */

const logger = require('../config/logger');

/**
 * @param {object} entry
 * @param {string|number} entry.userId
 * @param {string} entry.action   - e.g. 'CREATE_PATIENT', 'UPDATE_APPOINTMENT'
 * @param {string} [entry.entity] - Table name affected
 * @param {string|number} [entry.entityId]
 * @param {string} [entry.status] - 'success' | 'failure'
 * @param {string} [entry.message]
 */
const log = async (entry) => {
  // TODO (Phase 1): INSERT into audit_logs table via Sequelize
  logger.info('AUDIT', {
    timestamp: new Date().toISOString(),
    ...entry,
  });
};

module.exports = { log };
