'use strict';

const express = require('express');
const ZONES   = require('../data/deliveryZones');
const { ok }  = require('../utils/apiResponse');

const router = express.Router();

/* ── GET /api/delivery/zones ─────────────────────────────────────────── */
router.get('/zones', (req, res) => {
  ok(res, ZONES);
});

/* ── GET /api/delivery/search?q=east ────────────────────────────────── */
router.get('/search', (req, res) => {
  const q       = ((req.query.q || '')).trim().toLowerCase();
  const limit   = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  if (!q) return ok(res, []);

  const matches = ZONES.filter(z => z.name.toLowerCase().includes(q)).slice(0, limit);
  ok(res, matches);
});

/* ── GET /api/delivery/zone/:name ────────────────────────────────────── */
router.get('/zone/:name', (req, res) => {
  const name  = decodeURIComponent(req.params.name).toLowerCase();
  const match = ZONES.find(z => z.name.toLowerCase() === name);
  if (!match) {
    // Partial fallback
    const fuzzy = ZONES.find(z => z.name.toLowerCase().includes(name));
    return ok(res, fuzzy || null);
  }
  ok(res, match);
});

module.exports = router;
