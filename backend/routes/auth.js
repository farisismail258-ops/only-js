'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { jwtSecret, jwtExpiresIn } = require('../config/config');
const requireAuth = require('../middleware/auth');
const { ok, created, badRequest, unauthorized, serverError } = require('../utils/apiResponse');

const router = express.Router();

/**
 * In-memory user store.
 * Replace with a real database (MongoDB, PostgreSQL, etc.) in production.
 */
const users = [];

/* ── POST /api/auth/register ─────────────────────────────────────────── */
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, 'Validation failed', errors.array());

    try {
      const { name, email, password } = req.body;

      if (users.find(u => u.email === email))
        return badRequest(res, 'An account with this email already exists');

      const hash = await bcrypt.hash(password, 12);
      const user = { id: uuidv4(), name, email, passwordHash: hash, createdAt: new Date().toISOString() };
      users.push(user);

      const token = jwt.sign({ id: user.id, name, email }, jwtSecret, { expiresIn: jwtExpiresIn });
      created(res, { token, user: { id: user.id, name, email } });
    } catch (e) {
      serverError(res, e.message);
    }
  }
);

/* ── POST /api/auth/login ────────────────────────────────────────────── */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, 'Validation failed', errors.array());

    try {
      const { email, password } = req.body;
      const user = users.find(u => u.email === email);
      if (!user) return unauthorized(res, 'Invalid email or password');

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return unauthorized(res, 'Invalid email or password');

      const token = jwt.sign({ id: user.id, name: user.name, email }, jwtSecret, { expiresIn: jwtExpiresIn });
      ok(res, { token, user: { id: user.id, name: user.name, email } });
    } catch (e) {
      serverError(res, e.message);
    }
  }
);

/* ── GET /api/auth/me — returns current user ─────────────────────────── */
router.get('/me', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return unauthorized(res, 'User not found');
  ok(res, { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt });
});

module.exports = router;
