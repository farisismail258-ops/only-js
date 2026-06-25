'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/auth');
const { sendOrderConfirmation } = require('../services/email');
const { ok, created, badRequest, serverError } = require('../utils/apiResponse');

const router = express.Router();

/**
 * In-memory order store.
 * Replace with a real database in production.
 */
const orders = [];

/* ── POST /api/orders — place an order ───────────────────────────────── */
router.post(
  '/',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('deliveryArea').trim().notEmpty().withMessage('Delivery area is required'),
    body('items').isArray({ min: 1 }).withMessage('Cart must not be empty'),
    body('items.*.id').notEmpty().withMessage('Each item must have an id'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod').isIn(['mpesa', 'card']).withMessage('Payment method must be mpesa or card'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, 'Validation failed', errors.array());

    try {
      const {
        email, firstName, lastName, address, deliveryArea,
        items, paymentMethod, mpesaPhone, promoCode,
        subtotal, shippingFee, discount, total,
      } = req.body;

      const order = {
        id:            `LMV-${uuidv4().slice(0, 8).toUpperCase()}`,
        status:        'pending',
        email,
        firstName,
        lastName:      lastName || '',
        address,
        deliveryArea,
        items,
        paymentMethod,
        mpesaPhone:    paymentMethod === 'mpesa' ? (mpesaPhone || '') : null,
        promoCode:     promoCode || null,
        subtotal:      subtotal  || 0,
        shippingFee:   shippingFee || 0,
        discount:      discount    || 0,
        total:         total       || 0,
        placedAt:      new Date().toISOString(),
        userId:        req.user?.id || null,
      };

      orders.push(order);

      // Send confirmation email (non-blocking — don't fail the order if email fails)
      sendOrderConfirmation(order).catch(err =>
        console.error('Order confirmation email failed:', err.message)
      );

      created(res, {
        orderId:  order.id,
        status:   order.status,
        placedAt: order.placedAt,
        message:  `Order ${order.id} placed successfully! You will receive a confirmation email shortly.`,
      });
    } catch (e) {
      serverError(res, e.message);
    }
  }
);

/* ── GET /api/orders — list orders for authenticated user ────────────── */
router.get('/', requireAuth, (req, res) => {
  const userOrders = orders
    .filter(o => o.userId === req.user.id || o.email === req.user.email)
    .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  ok(res, userOrders);
});

/* ── GET /api/orders/:id ─────────────────────────────────────────────── */
router.get('/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return ok(res, null);
  ok(res, order);
});

module.exports = router;
