// ============================================================
// LUMEVA Email Service — powered by Resend (resend.com)
// Free tier: 3,000 emails/month. Get API key in 2 min.
// ============================================================

const RESEND_API = 'https://api.resend.com/emails';

const FROM = process.env.FROM_EMAIL || 'LUMEVA <hello@lumeva.co.ke>';
const RESEND_KEY = process.env.RESEND_API_KEY;

async function send({ to, subject, html }) {
  if (!RESEND_KEY) {
    console.log(`[EMAIL SKIPPED — no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[EMAIL FAILED]', data?.message || res.status);
    } else {
      console.log(`[EMAIL SENT] ${subject} → ${to}`);
    }
  } catch (e) {
    console.error('[EMAIL ERROR]', e.message);
  }
}

// ============================================================
// WELCOME EMAIL — sent on first registration
// ============================================================
export async function sendWelcome({ name, email }) {
  const firstName = String(name || '').split(' ')[0] || 'there';
  await send({
    to: email,
    subject: `Welcome to LUMEVA, ${firstName} ✦`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f1ea;font-family:'Georgia',serif}
  .wrap{max-width:560px;margin:40px auto;background:#f4f1ea}
  .header{background:#1f1f1c;padding:36px 40px;text-align:center}
  .logo{color:#f4f1ea;font-size:26px;letter-spacing:.12em;font-style:italic;font-weight:400}
  .hero{background:linear-gradient(160deg,#cbcab7,#9aa38b);padding:52px 40px;text-align:center}
  .hero h1{margin:0;font-size:28px;color:#1f1f1c;font-weight:400;line-height:1.3;letter-spacing:.02em}
  .hero p{margin:12px 0 0;font-size:13px;color:#505949;letter-spacing:.08em;text-transform:uppercase}
  .body{padding:40px;background:#f4f1ea}
  .body p{margin:0 0 16px;font-size:15px;color:#1f1f1c;line-height:1.7}
  .divider{border:none;border-top:1px solid #dedacb;margin:28px 0}
  .perks{display:table;width:100%;border-collapse:collapse}
  .perk{display:table-cell;width:33%;text-align:center;padding:16px 8px;vertical-align:top}
  .perk-icon{font-size:22px;margin-bottom:8px}
  .perk-title{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#505949;margin-bottom:4px}
  .perk-desc{font-size:12px;color:#6b685f;line-height:1.5}
  .cta-wrap{text-align:center;margin:32px 0}
  .cta{display:inline-block;background:#1f1f1c;color:#f4f1ea;text-decoration:none;padding:14px 36px;font-size:11px;letter-spacing:.2em;text-transform:uppercase}
  .footer{background:#1f1f1c;padding:28px 40px;text-align:center}
  .footer p{margin:0;font-size:11px;color:#6b685f;letter-spacing:.06em;line-height:1.8}
  .footer a{color:#9aa38b;text-decoration:none}
  .promo-box{background:#fff;border:1px solid #dedacb;padding:20px 24px;margin:24px 0;text-align:center}
  .promo-code{font-size:22px;letter-spacing:.18em;color:#505949;font-style:normal}
  .promo-label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b685f;margin-top:6px}
</style>
</head>
<body>
<div class="wrap">

  <div class="header">
    <div class="logo">LUMEVA</div>
  </div>

  <div class="hero">
    <h1>Welcome to the ritual, ${firstName}.</h1>
    <p>Kenya's premium beauty destination</p>
  </div>

  <div class="body">
    <p>Your LUMEVA account is ready. You now have access to our full collection of authentic skincare, fragrance, and beauty — curated from the world's finest brands and delivered across Kenya.</p>

    <p>As a welcome gift, use the code below for <strong>15% off your first order:</strong></p>

    <div class="promo-box">
      <div class="promo-code">WELCOME15</div>
      <div class="promo-label">Enter at checkout · One use only</div>
    </div>

    <hr class="divider"/>

    <table class="perks" width="100%">
      <tr>
        <td class="perk">
          <div class="perk-icon">✦</div>
          <div class="perk-title">Free delivery</div>
          <div class="perk-desc">On orders over KES 5,000 nationwide</div>
        </td>
        <td class="perk">
          <div class="perk-icon">◎</div>
          <div class="perk-title">M-Pesa</div>
          <div class="perk-desc">Pay easily with M-Pesa at checkout</div>
        </td>
        <td class="perk">
          <div class="perk-icon">❋</div>
          <div class="perk-title">Authentic</div>
          <div class="perk-desc">100% genuine brands, always</div>
        </td>
      </tr>
    </table>

    <div class="cta-wrap">
      <a class="cta" href="${process.env.SITE_URL || 'https://www.lumeva.co.ke'}">Start shopping</a>
    </div>

    <hr class="divider"/>
    <p style="font-size:13px;color:#6b685f">Questions? Reply to this email or reach us on WhatsApp — we're here.</p>
  </div>

  <div class="footer">
    <p>
      LUMEVA · Premium Skincare & Beauty, Kenya<br>
      <a href="${process.env.SITE_URL || 'https://www.lumeva.co.ke'}">lumeva.co.ke</a>
      &nbsp;·&nbsp;
      <a href="${process.env.SITE_URL || 'https://www.lumeva.co.ke'}#/account">My account</a>
    </p>
    <p style="margin-top:10px;font-size:10px;color:#3a3a38">You received this email because you created a LUMEVA account.</p>
  </div>

</div>
</body>
</html>`,
  });
}

// ============================================================
// LOGIN EMAIL — sent every time they sign in
// ============================================================
export async function sendLoginNotification({ name, email }) {
  const firstName = String(name || '').split(' ')[0] || 'there';
  const now = new Date();
  const time = now.toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });

  await send({
    to: email,
    subject: `Welcome back to LUMEVA, ${firstName}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f1ea;font-family:'Georgia',serif}
  .wrap{max-width:560px;margin:40px auto;background:#f4f1ea}
  .header{background:#1f1f1c;padding:36px 40px;text-align:center}
  .logo{color:#f4f1ea;font-size:26px;letter-spacing:.12em;font-style:italic;font-weight:400}
  .body{padding:40px;background:#f4f1ea}
  .body p{margin:0 0 16px;font-size:15px;color:#1f1f1c;line-height:1.7}
  .info-box{background:#fff;border:1px solid #dedacb;padding:20px 24px;margin:24px 0}
  .info-row{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #f0ece1}
  .info-row:last-child{border:none}
  .info-label{color:#6b685f;letter-spacing:.05em}
  .info-val{color:#1f1f1c;font-style:italic}
  .cta-wrap{text-align:center;margin:28px 0}
  .cta{display:inline-block;background:#1f1f1c;color:#f4f1ea;text-decoration:none;padding:13px 32px;font-size:11px;letter-spacing:.2em;text-transform:uppercase}
  .divider{border:none;border-top:1px solid #dedacb;margin:24px 0}
  .footer{background:#1f1f1c;padding:28px 40px;text-align:center}
  .footer p{margin:0;font-size:11px;color:#6b685f;letter-spacing:.06em;line-height:1.8}
  .footer a{color:#9aa38b;text-decoration:none}
  .alert{background:#f6e3df;border-left:3px solid #b3402e;padding:14px 18px;font-size:13px;color:#7a2e22;line-height:1.6;margin-top:20px}
</style>
</head>
<body>
<div class="wrap">

  <div class="header">
    <div class="logo">LUMEVA</div>
  </div>

  <div class="body">
    <p>Welcome back, ${firstName}. You just signed in to your LUMEVA account.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Account</span>
        <span class="info-val">${email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Time</span>
        <span class="info-val">${time} (EAT)</span>
      </div>
    </div>

    <div class="alert">
      <strong>Not you?</strong> If you did not sign in, someone else may have access to your account. Contact us immediately so we can secure it.
    </div>

    <hr class="divider"/>
    <p>Ready to continue your skincare ritual? Your wishlist and order history are waiting.</p>

    <div class="cta-wrap">
      <a class="cta" href="${process.env.SITE_URL || 'https://www.lumeva.co.ke'}#/account">Go to my account</a>
    </div>
  </div>

  <div class="footer">
    <p>
      LUMEVA · Premium Skincare & Beauty, Kenya<br>
      <a href="${process.env.SITE_URL || 'https://www.lumeva.co.ke'}">lumeva.co.ke</a>
    </p>
  </div>

</div>
</body>
</html>`,
  });
}