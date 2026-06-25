'use strict';

const express    = require('express');
const { body, validationResult } = require('express-validator');
const PROMO_CODES = require('../data/promoCodes');
const { ok, badRequest } = require('../utils/apiResponse');

const router = express.Router();

/* ── POST /api/promo/validate ────────────────────────────────────────── */
router.post(
  '/validate',
  [body('code').trim().notEmpty().withMessage('Promo code is required')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, 'Validation failed', errors.array());

    const code  = req.body.code.toUpperCase();
    const promo = PROMO_CODES[code];

    if (!promo)
      return badRequest(res, 'Invalid promo code');

    ok(res, { code, pct: promo.pct, desc: promo.desc });
  }
);

module.exports = router;
