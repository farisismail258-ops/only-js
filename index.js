'use strict';

const express  = require('express');
const router   = express.Router();

router.use('/products',  require('./products'));
router.use('/delivery',  require('./delivery'));
router.use('/auth',      require('./auth'));
router.use('/orders',    require('./orders'));
router.use('/promo',     require('./promo'));
router.use('/mpesa',     require('./mpesa'));

/* Health check */
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
