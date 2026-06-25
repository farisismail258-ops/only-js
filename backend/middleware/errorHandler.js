'use strict';

const { nodeEnv } = require('../config/config');

module.exports = function errorHandler(err, req, res, _next) {
  const status  = err.status || 500;
  const message = err.message || 'Unexpected server error';

  const payload = { success: false, error: message };
  if (nodeEnv === 'development') payload.stack = err.stack;

  res.status(status).json(payload);
};
