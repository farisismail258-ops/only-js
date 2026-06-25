'use strict';

const { Resend } = require('resend');
const { email: cfg } = require('../config/config');

const resend = new Resend(cfg.resendApiKey);

/* ── Shared email template wrapper ──────────────────────────────────── */
function layout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin:0; padding:0; background:#f4f1ea; font-family:'Inter',Arial,sans-serif; color:#1a1a18; }
    .wrap { max-width:560px; margin:2rem auto; background:#fff; border-radius:4px; overflow:hidden; }
    .header { background:#1a1a18; padding:2rem; text-align:center; }
    .header h1 { color:#f4f1ea; font-size:1.6rem; font-weight:400; letter-spacing:.2em; margin:0; }
    .body { padding:2rem 2.5rem; }
    .body p { line-height:1.8; font-size:.9rem; color:#3a3a38; }
    .order-box { background:#f4f1ea; border-radius:4px; padding:1.25rem 1.5rem; margin:1.5rem 0; }
    .order-box p { margin:.35rem 0; font-size:.85rem; }
    .order-box strong { color:#1a1a18; }
    .item-row { display:flex; justify-content:space-between; padding:.5rem 0; border-bottom:1px solid rgba(0,0,0,.06); font-size:.82rem; }
    .total-row { display:flex; justify-content:space-between; padding:.75rem 0; font-weight:600; font-size:.9rem; }
    .btn { display:inline-block; background:#1a1a18; color:#f4f1ea; text-decoration:none; padding:.75rem 1.75rem; border-radius:2px; font-size:.82rem; letter-spacing:.05em; margin:1.25rem 0; }
    .footer { background:#f4f1ea; padding:1.25rem 2.5rem; text-align:center; font-size:.72rem; color:#888; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1>LUMEVA</h1></div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>LUMEVA — Kenya's Premium Beauty Destination</p>
      <p>© ${new Date().getFullYear()} LUMEVA. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────────────
   Order confirmation email
   order = { id, firstName, email, items[], deliveryArea,
             subtotal, shippingFee, discount, total, paymentMethod }
   ───────────────────────────────────────────────────────────────────── */
async function sendOrderConfirmation(order) {
  const itemRows = (order.items || []).map(it =>
    `<div class="item-row">
       <span>${it.name || it.id} × ${it.qty}</span>
       <span>KES ${((it.price || 0) * it.qty).toLocaleString()}</span>
     </div>`
  ).join('');

  const html = layout(`
    <p>Hi ${order.firstName},</p>
    <p>Thank you for your order! We've received it and will begin processing it shortly.</p>

    <div class="order-box">
      <p><strong>Order ID:</strong> ${order.id}</p>
      <p><strong>Delivery to:</strong> ${order.deliveryArea}</p>
      <p><strong>Payment:</strong> ${order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Card'}</p>
    </div>

    <p><strong>Order summary</strong></p>
    ${itemRows}
    <div class="item-row"><span>Shipping</span><span>KES ${(order.shippingFee || 0).toLocaleString()}</span></div>
    ${order.discount ? `<div class="item-row"><span>Discount</span><span>−KES ${order.discount.toLocaleString()}</span></div>` : ''}
    <div class="total-row"><span>Total</span><span>KES ${(order.total || 0).toLocaleString()}</span></div>

    <p style="margin-top:1.5rem">We'll send you another email once your order has been dispatched.
    If you have any questions, reply to this email.</p>

    <a class="btn" href="https://lumeva.co.ke/account.html">View My Account</a>

    <p>With care,<br/>The LUMEVA Team</p>
  `);

  return resend.emails.send({
    from:    cfg.from,
    to:      [order.email],
    subject: `Your LUMEVA order ${order.id} is confirmed ✦`,
    html,
  });
}

/* ─────────────────────────────────────────────────────────────────────
   Welcome email (sent on registration)
   ───────────────────────────────────────────────────────────────────── */
async function sendWelcomeEmail({ name, email }) {
  const html = layout(`
    <p>Hi ${name},</p>
    <p>Welcome to <strong>LUMEVA</strong> — Kenya's premium beauty destination.</p>
    <p>Your account is ready. Start exploring 480+ curated skincare, fragrance, and beauty products
    — with nationwide delivery and M-Pesa accepted.</p>

    <a class="btn" href="https://lumeva.co.ke/shop.html">Shop the Collection</a>

    <p>Not sure where to start? Take our 90-second skin quiz and we'll build your perfect ritual.</p>
    <a href="https://lumeva.co.ke/quiz.html" style="font-size:.82rem;color:#7a8a6f">Take the skin quiz →</a>

    <p style="margin-top:2rem">With care,<br/>The LUMEVA Team</p>
  `);

  return resend.emails.send({
    from:    cfg.from,
    to:      [email],
    subject: 'Welcome to LUMEVA ✦',
    html,
  });
}

/* ─────────────────────────────────────────────────────────────────────
   M-Pesa payment confirmation email
   ───────────────────────────────────────────────────────────────────── */
async function sendPaymentConfirmation({ email, firstName, orderId, amount, mpesaRef }) {
  const html = layout(`
    <p>Hi ${firstName},</p>
    <p>Great news — your M-Pesa payment has been received!</p>

    <div class="order-box">
      <p><strong>Order:</strong> ${orderId}</p>
      <p><strong>Amount paid:</strong> KES ${amount.toLocaleString()}</p>
      <p><strong>M-Pesa reference:</strong> ${mpesaRef}</p>
    </div>

    <p>Your order is now being prepared for dispatch. You will receive a shipping update shortly.</p>

    <a class="btn" href="https://lumeva.co.ke/account.html">View My Orders</a>

    <p>With care,<br/>The LUMEVA Team</p>
  `);

  return resend.emails.send({
    from:    cfg.from,
    to:      [email],
    subject: `Payment confirmed — LUMEVA Order ${orderId} ✦`,
    html,
  });
}

module.exports = { sendOrderConfirmation, sendWelcomeEmail, sendPaymentConfirmation };
