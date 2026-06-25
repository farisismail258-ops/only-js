'use strict';

require('dotenv').config();

module.exports = {
  port:           parseInt(process.env.PORT, 10) || 5000,
  nodeEnv:        process.env.NODE_ENV || 'development',

  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:5500')
                    .split(',').map(s => s.trim()),

  jwtSecret:      process.env.JWT_SECRET || 'lumeva_dev_secret',
  jwtExpiresIn:   process.env.JWT_EXPIRES_IN || '7d',

  productsPath:   process.env.PRODUCTS_PATH || '../products.json',

  mpesa: {
    env:            process.env.MPESA_ENV || 'sandbox',
    baseUrl:        process.env.MPESA_ENV === 'production'
                      ? 'https://api.safaricom.co.ke'
                      : 'https://sandbox.safaricom.co.ke',
    consumerKey:    process.env.MPESA_CONSUMER_KEY    || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    shortCode:      process.env.MPESA_SHORTCODE       || '174379',
    passkey:        process.env.MPESA_PASSKEY         || '',
    callbackUrl:    process.env.MPESA_CALLBACK_URL    || 'https://yourdomain.com/api/mpesa/callback',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from:         process.env.EMAIL_FROM     || 'LUMEVA <noreply@lumeva.co.ke>',
  },
};
