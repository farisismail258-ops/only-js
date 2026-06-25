'use strict';

const { mpesa } = require('../config/config');

/* ── Generate OAuth access token ─────────────────────────────────────── */
async function getAccessToken() {
  const creds  = Buffer.from(`${mpesa.consumerKey}:${mpesa.consumerSecret}`).toString('base64');
  const url    = `${mpesa.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;

  const res    = await fetch(url, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) throw new Error(`M-Pesa auth failed: ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

/* ── Build timestamp (YYYYMMDDHHmmss) ───────────────────────────────── */
function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14);
}

/* ── Build password (Base64 of shortcode + passkey + timestamp) ──────── */
function password(ts) {
  return Buffer.from(`${mpesa.shortCode}${mpesa.passkey}${ts}`).toString('base64');
}

/* ─────────────────────────────────────────────────────────────────────
   STK Push — sends a payment prompt to the customer's phone.
   phone  : Kenyan number, any format (07XX, 2547XX, +2547XX)
   amount : integer, KES
   orderId: reference to display on the phone
   ───────────────────────────────────────────────────────────────────── */
async function stkPush(phone, amount, orderId) {
  // Normalise to 2547XXXXXXXX
  const normalised = phone
    .replace(/\s+/g, '')
    .replace(/^\+/, '')
    .replace(/^07/, '2547')
    .replace(/^7/,  '2547');

  const token = await getAccessToken();
  const ts    = timestamp();
  const pwd   = password(ts);

  const body = {
    BusinessShortCode: mpesa.shortCode,
    Password:          pwd,
    Timestamp:         ts,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            Math.ceil(amount),
    PartyA:            normalised,
    PartyB:            mpesa.shortCode,
    PhoneNumber:       normalised,
    CallBackURL:       mpesa.callbackUrl,
    AccountReference:  `LUMEVA-${orderId}`,
    TransactionDesc:   `LUMEVA Order ${orderId}`,
  };

  const res = await fetch(`${mpesa.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`STK Push failed: ${err}`);
  }
  return res.json();
}

/* ─────────────────────────────────────────────────────────────────────
   Query STK Push status
   ───────────────────────────────────────────────────────────────────── */
async function stkQuery(checkoutRequestId) {
  const token = await getAccessToken();
  const ts    = timestamp();
  const pwd   = password(ts);

  const body = {
    BusinessShortCode: mpesa.shortCode,
    Password:          pwd,
    Timestamp:         ts,
    CheckoutRequestID: checkoutRequestId,
  };

  const res = await fetch(`${mpesa.baseUrl}/mpesa/stkpushquery/v1/query`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

module.exports = { stkPush, stkQuery };
