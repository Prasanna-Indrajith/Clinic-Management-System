'use strict';

const { AuditLog } = require('../models');
const logger = require('../config/logger');

/**
 * Record an audit log entry in the database and Winston logger.
 * @param {object} entry
 * @param {number|null} [entry.userId]
 * @param {string} entry.action
 * @param {string} entry.entity
 * @param {string|number|null} [entry.entityId]
 * @param {string|null} [entry.ipAddress]
 * @param {string|object|null} [entry.details]
 */
const log = async (entry) => {
  try {
    const detailsStr =
      typeof entry.details === 'object' ? JSON.stringify(entry.details) : entry.details;

    await AuditLog.create({
      user_id: entry.userId || null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ? String(entry.entityId) : null,
      ip_address: entry.ipAddress || null,
      details: detailsStr || null,
    });
  } catch (err) {
    logger.error('Failed to write audit log to database', { message: err.message, entry });
  }

  logger.info('AUDIT', {
    timestamp: new Date().toISOString(),
    ...entry,
  });
};

module.exports = { log };
