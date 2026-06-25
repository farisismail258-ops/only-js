// ============================================================
// LUMEVA Backend — Supabase edition
// All DB calls are now async (Supabase vs SQLite)
// ============================================================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as DB from './db.js';
import crypto from 'crypto';
import { sendWelcome, sendLoginNotification } from './email.js';
import multer from 'multer';
import fs from 'fs';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  MPESA_ENV = 'sandbox',
  MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE = '174379', MPESA_PASSKEY,
  CALLBACK_URL, ADMIN_EMAIL, ADMIN_PASSWORD,
  ANTHROPIC_API_KEY, PORT = 3000,
} = process.env;

const BASE = MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));
app.get('/', (_, res) => res.redirect('/lumeva-v2.html'));

// File uploads
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('Images only'));
  },
});

// Admin tokens (in-memory — survive while server is running)
const adminTokens = new Set();
function isAdmin(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  return t && adminTokens.has(t);
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Admin login required' });
  next();
}

// Rate limiter
const hits = new Map();
function limit(group, max, windowMs) {
  return (req, res, next) => {
    const key = group + ':' + (req.headers['x-forwarded-for'] || req.ip);
    const now = Date.now();
    const rec = hits.get(key) || { n: 0, t: now };
    if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
    if (++rec.n > max) { hits.set(key, rec); return res.status(429).json({ error: 'Too many requests' }); }
    hits.set(key, rec);
    next();
  };
}

// Current user from token
async function currentUser(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return null;
  const row = await DB.findToken(t);
  return row?.users || null;
}

// Seed admin on first boot
(async () => {
  try {
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      await DB.createAdminIfNone(ADMIN_EMAIL, ADMIN_PASSWORD);
    }
  } catch (e) { console.error('Admin seed:', e.message); }
})();

// ============================================================
// PUBLIC ENDPOINTS
// ============================================================
app.get('/api/products', async (req, res) => {
  try {
    if (req.query.all === '1') return res.json({ products: await DB.allProducts() });
    res.json(await DB.queryProducts(req.query));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/products/:handle', async (req, res) => {
  try {
    const p = await DB.getProduct(req.params.handle);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/categories', async (_, res) => {
  try { res.json({ categories: await DB.listCategories() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/brands', async (_, res) => {
  try { res.json({ brands: await DB.listBrands() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/pages', async (_, res) => {
  try { res.json({ pages: await DB.listPages() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/pages/:slug', async (req, res) => {
  try {
    const page = await DB.getPage(req.params.slug);
    if (!page) return res.status(404).json({ error: 'Not found' });
    res.json(page);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/our-story', async (_, res) => {
  try {
    const [ceoLetter, team, stores, delivery] = await Promise.all([
      DB.getSetting('ceo_letter'),
      DB.getSetting('team_members'),
      DB.getSetting('stores'),
      DB.getSetting('delivery_team'),
    ]);
    res.json({ ceoLetter: ceoLetter || {}, team: team || [], stores: stores || [], delivery: delivery || [], reviews: {}, driverReviews: {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/reviews', limit('reviews', 20, 10 * 60 * 1000), async (req, res) => {
  try {
    const { storeId, customerName, rating, title, message } = req.body || {};
    if (!storeId || !rating || !message) return res.status(400).json({ error: 'Missing fields' });
    // Store review in settings as JSON array per store (simple approach without extra table)
    const key = `reviews_${storeId}`;
    const existing = await DB.getSetting(key) || [];
    existing.unshift({ customer_name: customerName || 'Anonymous', rating: Number(rating), title, message, created_at: new Date().toISOString(), approved: false });
    await DB.setSetting(key, existing.slice(0, 100));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/health', (_, res) => res.json({ ok: true, env: MPESA_ENV, db: 'supabase' }));

// ============================================================
// AUTH
// ============================================================
app.post('/api/auth/register', limit('auth', 20, 15 * 60 * 1000), async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    const user = await DB.createUser({ name: String(name).slice(0, 80), email, password });
    const token = await DB.createToken(user.id);
    sendWelcome({ name: user.name, email: user.email }).catch(() => {});
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (e) {
    if (e.message?.includes('already registered')) return res.status(409).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Could not create account' });
  }
});
app.post('/api/auth/login', limit('auth', 20, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = email && password ? await DB.verifyUser(email, password) : null;
    if (!user) return res.status(401).json({ error: 'Wrong email or password' });
    const token = await DB.createToken(user.id);
    sendLoginNotification({ name: user.name, email: user.email }).catch(() => {});
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/auth/me', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json({ user: { name: user.name, email: user.email } });
});
app.post('/api/auth/logout', async (req, res) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) await DB.deleteToken(h.slice(7));
  res.json({ ok: true });
});

// ============================================================
// ORDERS
// ============================================================
app.post('/api/orders', limit('orders', 30, 15 * 60 * 1000), async (req, res) => {
  try {
    const user = await currentUser(req);
    const { items, email, name, address, city, phone, promo, pm, deliveryLocation, deliveryZone } = req.body || {};
    if (!email && !user) return res.status(400).json({ error: 'Email required' });
    const order = await DB.createOrder({
      items, userId: user?.id || null, email: email || user.email,
      name, address, city, phone, promo, pm, deliveryLocation, deliveryZone,
    });
    res.json({ ok: true, ...order });
  } catch (e) { res.status(400).json({ error: e.message || 'Could not create order' }); }
});
app.get('/api/orders', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view orders' });
  try { res.json({ orders: await DB.ordersForUser(user.id) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/orders/:id/confirm-demo', async (req, res) => {
  try {
    await DB.updateOrder(Number(req.params.id), { status: 'paid', mpesa_receipt: 'DEMO' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// M-PESA STK
// ============================================================
let tokenCache = { token: null, expires: 0 };
async function getDarajaToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const r = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!r.ok) throw new Error(`OAuth failed: ${r.status}`);
  const d = await r.json();
  tokenCache = { token: d.access_token, expires: Date.now() + (Number(d.expires_in) - 60) * 1000 };
  return tokenCache.token;
}
const ts = () => {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
function normalizePhone(raw) {
  let s = String(raw || '').replace(/[\s\-+]/g, '');
  if (/^0[17]\d{8}$/.test(s)) s = '254' + s.slice(1);
  if (/^[17]\d{8}$/.test(s)) s = '254' + s;
  return /^254[17]\d{8}$/.test(s) ? s : null;
}

app.post('/api/stk', limit('stk', 10, 10 * 60 * 1000), async (req, res) => {
  try {
    if (!MPESA_CONSUMER_KEY || !MPESA_PASSKEY)
      return res.status(500).json({ error: 'Daraja credentials not configured' });
    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'Invalid phone — use 07XXXXXXXX' });
    const order = await DB.getOrder(Number(req.body.orderId));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') return res.status(400).json({ error: 'Order already paid' });

    const tok = await getDarajaToken();
    const t = ts();
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${t}`).toString('base64');
    const r = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE, Password: password, Timestamp: t,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.max(1, Math.round(order.total)),
        PartyA: phone, PartyB: MPESA_SHORTCODE, PhoneNumber: phone,
        CallBackURL: CALLBACK_URL, AccountReference: order.order_no,
        TransactionDesc: `LUMEVA ${order.order_no}`,
      }),
    });
    const d = await r.json();
    if (d.ResponseCode === '0') {
      await DB.setOrderCheckoutId(order.id, d.CheckoutRequestID);
      return res.json({ ok: true, checkoutRequestId: d.CheckoutRequestID });
    }
    res.status(400).json({ error: d.errorMessage || d.ResponseDescription || 'STK push failed' });
  } catch (e) { console.error('STK error:', e.message); res.status(500).json({ error: 'Payment unavailable' }); }
});

app.post('/api/mpesa/callback', async (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback;
    if (cb) {
      if (cb.ResultCode === 0) {
        const items = cb.CallbackMetadata?.Item || [];
        const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value || '';
        const order = await DB.getPendingOrder(cb.CheckoutRequestID);
        if (order) await DB.setOrderReceipt(order.id, receipt);
        console.log(`✓ PAID ${cb.CheckoutRequestID} receipt=${receipt}`);
      } else {
        const order = await DB.getPendingOrder(cb.CheckoutRequestID);
        if (order) await DB.updateOrder(order.id, { status: 'payment_failed' });
        console.log(`✗ FAILED ${cb.CheckoutRequestID}: ${cb.ResultDesc}`);
      }
    }
  } catch (e) { console.error('Callback error:', e.message); }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/api/stk/status/:cri', async (req, res) => {
  try {
    const o = await DB.getPendingOrder(req.params.cri);
    if (!o) return res.status(404).json({ status: 'UNKNOWN' });
    let status = 'PENDING';
    if (o.status === 'paid') status = 'SUCCESS';
    else if (o.status === 'payment_failed') status = 'FAILED';
    else if (Date.now() - new Date(o.created_at).getTime() > 180000) status = 'FAILED';
    res.json({ status, receipt: o.mpesa_receipt || null, orderNo: o.order_no });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ADMIN
// ============================================================
app.post('/api/admin/login', limit('adminlogin', 15, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ok = email && password ? await DB.verifyAdmin(email, password) : false;
    if (!ok) return res.status(401).json({ error: 'Wrong email or password' });
    const token = crypto.randomBytes(32).toString('hex');
    adminTokens.add(token);
    res.json({ token, email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/logout', (req, res) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) adminTokens.delete(h.slice(7));
  res.json({ ok: true });
});
app.get('/api/admin/me', requireAdmin, (_, res) => res.json({ ok: true }));

// Products
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  try { res.json(await DB.queryProducts(req.query)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try { res.json({ ok: true, product: await DB.createProduct(req.body || {}) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/products/:handle', requireAdmin, async (req, res) => {
  try {
    const p = await DB.updateProduct(req.params.handle, req.body || {});
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true, product: p });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/products/:handle', requireAdmin, async (req, res) => {
  try { res.json({ ok: await DB.deleteProduct(req.params.handle) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Brands
app.get('/api/admin/brands', requireAdmin, async (_, res) => {
  try { res.json({ brands: await DB.listBrands() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/brands', requireAdmin, async (req, res) => {
  try {
    const { name, blurb } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Brand name required' });
    res.json({ ok: true, brand: await DB.createBrand(name, blurb || '') });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/brands/:id', requireAdmin, async (req, res) => {
  try { res.json({ ok: await DB.deleteBrand(+req.params.id) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Categories
app.get('/api/admin/categories', requireAdmin, async (_, res) => {
  try { res.json({ categories: await DB.listCategories() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/categories', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name required' });
    res.json({ ok: true, category: await DB.createCategory(name) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  try { res.json({ ok: await DB.deleteCategory(+req.params.id) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Pages
app.get('/api/admin/pages', requireAdmin, async (_, res) => {
  try { res.json({ pages: await DB.listPages() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/pages', requireAdmin, async (req, res) => {
  try {
    if (!req.body?.title) return res.status(400).json({ error: 'Title required' });
    res.json({ ok: true, page: await DB.createPage(req.body) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/pages/:slug', requireAdmin, async (req, res) => {
  try { res.json({ ok: true, page: await DB.upsertPage(req.params.slug, req.body || {}) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/pages/:slug', requireAdmin, async (req, res) => {
  try { res.json({ ok: await DB.deletePage(req.params.slug) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/admin/pages/:slug/duplicate', requireAdmin, async (req, res) => {
  try {
    const page = await DB.duplicatePage(req.params.slug);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json({ ok: true, page });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/admin/pages/:slug/rename', requireAdmin, async (req, res) => {
  const newSlug = String(req.body?.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60);
  if (!newSlug) return res.status(400).json({ error: 'Invalid slug' });
  try { res.json({ ok: true, slug: (await DB.renamePage(req.params.slug, newSlug))?.slug }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Settings (Our Story, theme, etc.)
app.get('/api/admin/site/:key', requireAdmin, async (req, res) => {
  try { res.json({ value: await DB.getSetting(req.params.key) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/site/:key', requireAdmin, async (req, res) => {
  try { res.json({ ok: true, value: await DB.setSetting(req.params.key, req.body) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// File upload
app.post('/api/admin/upload', requireAdmin, limit('upload', 60, 15 * 60 * 1000), (req, res) => {
  upload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const ext = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}[req.file.mimetype]||'';
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), req.file.buffer);
    res.json({ ok: true, url: `/uploads/${name}`, bytes: req.file.buffer.length });
  });
});

// AI generate
app.post('/api/admin/ai-generate', requireAdmin, limit('ai', 40, 10 * 60 * 1000), async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
  const { title, brand, category, field } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Product title required' });
  const prompts = {
    description: `Write a 2-3 sentence premium product description for a Kenya skincare store. No hype. Product: "${title}"${brand?`, brand: ${brand}`:''}. Return ONLY the description.`,
    ingredients: `List 5-8 typical key ingredients for this beauty product as comma-separated text. Product: "${title}". Return ONLY the list.`,
    howToUse: `Write 2-3 step how-to-use directions (35 words max) for: "${title}". Return ONLY the directions.`,
  };
  const prompt = prompts[field];
  if (!prompt) return res.status(400).json({ error: 'Invalid field' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'AI failed' });
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    res.json({ ok: true, text });
  } catch (e) { res.status(500).json({ error: 'AI unavailable' }); }
});

app.listen(PORT, () => {
  console.log(`LUMEVA running on port ${PORT} [${MPESA_ENV}] — database: Supabase`);
});
can you just copy this and make sure it matches my website