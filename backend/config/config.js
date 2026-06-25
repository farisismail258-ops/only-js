'use strict';

require('dotenv').config();

module.exports = {
  port:           parseInt(process.env.PORT, 10) || 5000,
  nodeEnv:        process.env.NODE_ENV || 'development',
  jwtSecret:      process.env.JWT_SECRET || 'lumeva_dev_secret',
  jwtExpiresIn:   process.env.JWT_EXPIRES_IN || '7d',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:5500')
                    .split(',').map(s => s.trim()),
  productsPath:   process.env.PRODUCTS_PATH || '../products.json',
};
