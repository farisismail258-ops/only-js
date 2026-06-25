'use strict';

const jwt         = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');
const { unauthorized } = require('../utils/apiResponse');

/**
 * Protects routes — expects: Authorization: Bearer <token>
 */
module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return unauthorized(res, 'No token provided');

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }
};
