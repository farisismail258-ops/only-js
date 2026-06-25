'use strict';

const path    = require('path');
const fs      = require('fs');
const express = require('express');
const { ok, notFound, serverError } = require('../utils/apiResponse');
const { productsPath } = require('../config/config');

const router = express.Router();

/* ── Load & normalise products once ──────────────────────────────────── */
let _cache = null;

function getProducts() {
  if (_cache) return _cache;
  try {
    const abs  = path.resolve(__dirname, '..', productsPath);
    const raw  = JSON.parse(fs.readFileSync(abs, 'utf8'));
    _cache = (Array.isArray(raw) ? raw : []).map(p => ({
      ...p,
      id:            p.handle || p.id || '',
      originalPrice: p.compareAt  || p.originalPrice || null,
      brand:         p.brand      || p.tagline       || '',
    }));
  } catch (e) {
    console.error('Failed to load products.json:', e.message);
    _cache = [];
  }
  return _cache;
}

/* ── GET /api/products ───────────────────────────────────────────────── */
router.get('/', (req, res) => {
  try {
    let list = getProducts();
    const { q, category, sort, page = 1, limit = 24, tag } = req.query;

    /* Search */
    if (q) {
      const term = q.toLowerCase();
      list = list.filter(p =>
        (p.name     || '').toLowerCase().includes(term) ||
        (p.brand    || '').toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term) ||
        (p.tags     || []).some(t => t.toLowerCase().includes(term))
      );
    }

    /* Category filter */
    if (category) {
      const cat = category.toLowerCase();
      list = list.filter(p => (p.category || '').toLowerCase() === cat);
    }

    /* Tag filter */
    if (tag) {
      const t = tag.toLowerCase();
      list = list.filter(p => (p.tags || []).map(x => x.toLowerCase()).includes(t));
    }

    /* Sort */
    if (sort === 'asc')  list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === 'desc') list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sort === 'sale') list = list.filter(p => p.originalPrice && p.originalPrice > p.price);

    /* Pagination */
    const perPage = Math.min(parseInt(limit, 10) || 24, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const total   = list.length;
    const pages   = Math.ceil(total / perPage);
    const slice   = list.slice((pageNum - 1) * perPage, pageNum * perPage);

    ok(res, slice, { total, page: pageNum, pages, perPage });
  } catch (e) {
    serverError(res, e.message);
  }
});

/* ── GET /api/products/:id ───────────────────────────────────────────── */
router.get('/:id', (req, res) => {
  try {
    const product = getProducts().find(p => p.id === req.params.id);
    if (!product) return notFound(res, 'Product not found');
    ok(res, product);
  } catch (e) {
    serverError(res, e.message);
  }
});

module.exports = router;
