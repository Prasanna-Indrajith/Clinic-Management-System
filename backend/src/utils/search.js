'use strict';

const { Op } = require('sequelize');

/**
 * Build a safe, parameterized SQL LIKE search clause.
 * Sanitizes input and wraps with Sequelize Op.like.
 *
 * @param {string} searchTerm
 * @param {string[]} fields
 * @returns {object|null}
 */
const buildSearchClause = (searchTerm, fields) => {
  if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) {
    return null;
  }

  const sanitized = searchTerm.trim();
  const conditions = fields.map((field) => ({
    [field]: { [Op.like]: `%${sanitized}%` },
  }));

  return { [Op.or]: conditions };
};

/**
 * Extract safe pagination parameters
 * @param {object} query
 * @param {number} [defaultLimit=10]
 * @param {number} [maxLimit=100]
 * @returns {{ page: number, limit: number, offset: number }}
 */
const getPagination = (query, defaultLimit = 10, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

module.exports = {
  buildSearchClause,
  getPagination,
};
