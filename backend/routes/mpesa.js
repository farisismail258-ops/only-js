'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { stkPush, stkQuery } = require('../services/mpesa');
const { sendPaymentConfirmation } = require('../services/email');
const { ok, created, badRequest, serverError } = require('../utils/apiResponse');

const router = express.Router();

/*
 * In-memory payment store — maps CheckoutRequestID → payment info.
 * Replace with a database in production.
 */
const payments = {};

/* ── POST /api/mpesa/stkpush ─────────────────────────────────────────── */
router.post(
  '/stkpush',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('email').isEmail().withMessage('Email is required'),
    body('firstName').notEmpty().withMessage('First name is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, 'Validation failed', errors.array());

    const { phone, amount, orderId, email, firstName } = req.body;

    try {
      const result = await stkPush(phone, amount, orderId);

      if (result.ResponseCode !== '0') {
        return badRequest(res, result.CustomerMessage || 'STK push failed');
      }

      // Store payment info so the callback can look it up
      payments[result.CheckoutRequestID] = {
        orderId, email, firstName,
        amount: Number(amount),
        status: 'pending',
      };

      created(res, {
        checkoutRequestId: result.CheckoutRequestID,
        merchantRequestId: result.MerchantRequestID,
        message: result.CustomerMessage || 'STK push sent. Check your phone.',
      });
    } catch (e) {
      serverError(res, e.message);
    }
  }
);

/* ── POST /api/mpesa/callback — Safaricom calls this automatically ────── */
router.post('/callback', async (req, res) => {
  // Always respond 200 immediately so Safaricom doesn't retry
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return;

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = body;
    const payment = payments[CheckoutRequestID];
    if (!payment) return;

    if (ResultCode !== 0) {
      payment.status = 'failed';
      return;
    }

    payment.status = 'paid';

    // Extract M-Pesa receipt number from callback metadata
    const items  = CallbackMetadata?.Item || [];
    const getVal = name => items.find(i => i.Name === name)?.Value || '';
    const mpesaRef = getVal('MpesaReceiptNumber');

    // Send payment confirmation email
    if (payment.email) {
      await sendPaymentConfirmation({
        email:     payment.email,
        firstName: payment.firstName,
        orderId:   payment.orderId,
        amount:    payment.amount,
        mpesaRef,
      }).catch(err => console.error('Email send failed:', err.message));
    }
  } catch (e) {
    console.error('M-Pesa callback error:', e.message);
  }
});

/* ── GET /api/mpesa/status/:checkoutRequestId ────────────────────────── */
router.get('/status/:checkoutRequestId', async (req, res) => {
  const { checkoutRequestId } = req.params;

  // Check local store first
  const local = payments[checkoutRequestId];
  if (local?.status === 'paid')   return ok(res, { status: 'paid',    checkoutRequestId });
  if (local?.status === 'failed') return ok(res, { status: 'failed',  checkoutRequestId });

  // Query Daraja for live status
  try {
    const result = await stkQuery(checkoutRequestId);
    const paid   = result.ResultCode === '0' || result.ResultCode === 0;
    ok(res, {
      status:           paid ? 'paid' : 'pending',
      checkoutRequestId,
      daraja:           result,
    });
  } catch (e) {
    serverError(res, e.message);
  }
});

module.exports = router;
module.exports.payments = payments; // export so orders.js can read status
