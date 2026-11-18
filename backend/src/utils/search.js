'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Build a safe, parameterized, case-insensitive SQL search clause.
 * Splits multi-word queries into tokens so first name, last name, or both
 * match regardless of case or word order. Uses Op.iLike on PostgreSQL.
 *
 * @param {string} searchTerm
 * @param {string[]} fields
 * @returns {object|null}
 */
const buildSearchClause = (searchTerm, fields) => {
  if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) {
    return null;
  }

  const isPostgres = sequelize.getDialect() === 'postgres';
  const likeOp = isPostgres ? Op.iLike : Op.like;
  const tokens = searchTerm.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return null;
  }

  const tokenClauses = tokens.map((token) => {
    const escaped = isPostgres ? token.replace(/[\\%_]/g, '\\$&') : token;
    const pattern = `%${escaped}%`;
    return {
      [Op.or]: fields.map((field) => ({
        [field]: { [likeOp]: pattern },
      })),
    };
  });

  return tokenClauses.length === 1 ? tokenClauses[0] : { [Op.and]: tokenClauses };
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
