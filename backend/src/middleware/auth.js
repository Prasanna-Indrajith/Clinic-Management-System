'use strict';

/**
 * Middleware stubs — populated in Phase 1.
 *
 * authMiddleware:   Verifies the JWT Bearer token in the Authorization header.
 * roleMiddleware:   Checks the user's role against an allowed list.
 *
 * Both are exported as thin stubs here so Phase 0 routes can be structured
 * correctly without breaking imports once Phase 1 fills them in.
 */

const authMiddleware = (_req, _res, next) => {
  // TODO (Phase 1): verify JWT, attach req.user
  next();
};

/**
 * @param {...string} allowedRoles - Roles permitted to access the route.
 * @returns {Function} Express middleware
 */
const roleMiddleware =
  (..._allowedRoles) =>
  (_req, _res, next) => {
    // TODO (Phase 1): check req.user.role against allowedRoles
    next();
  };

module.exports = { authMiddleware, roleMiddleware };
