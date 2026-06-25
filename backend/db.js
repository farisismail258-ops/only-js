// ============================================================
// db.js — LUMEVA database using Supabase (PostgreSQL)
// Replaces SQLite / better-sqlite3 entirely.
// Data persists forever across Render redeploys.
// ============================================================
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import ws from 'ws';
dotenv.config();

// Lazy client — initialized on first use so env vars are
// guaranteed to be loaded before createClient() runs.
let _client = null;
function supabase() {
  if (!_client) {
    const url  = process.env.SUPABASE_URL;
    const key  = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error(
      `Supabase credentials missing. SUPABASE_URL=${url?'set':'MISSING'} SUPABASE_SERVICE_KEY=${key?'set':'MISSING'}`
    );
    _client = createClient(url, key, {
      realtime: { transport: ws },
      auth: { persistSession: false },
    });
  }
  return _client;
}

// ─── Helpers ─────────────────────────────────────────────────
function hash(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}
function salt() { return crypto.randomBytes(16).toString('hex'); }
function token() { return crypto.randomBytes(32).toString('hex'); }
function slugify(t) {
  return String(t).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';
}

// ─── Products ─────────────────────────────────────────────────
function rowToProduct(r) {
  if (!r) return null;
  return {
    handle: r.handle, title: r.title, name: r.title,
    price: r.price, compareAt: r.compare_at,
    category: r.category, brand: r.brand, tagline: r.tagline,
    image: r.image, images: r.images || [], tags: r.tags || [], swatch: r.swatch,
    description: r.description, ingredients: r.ingredients, howToUse: r.how_to_use,
    richContent: r.rich_content, metaTitle: r.meta_title, metaDescription: r.meta_description,
    stock: r.stock, featured: r.featured,
  };
}
function productToRow(p) {
  return {
    handle: p.handle || slugify(p.title),
    title: p.title, price: Number(p.price) || 0,
    compare_at: p.compareAt ? Number(p.compareAt) : null,
    category: p.category || null, brand: p.brand || null, tagline: p.tagline || null,
    image: p.image || null, images: p.images || [], tags: p.tags || [], swatch: p.swatch || null,
    description: p.description || null, ingredients: p.ingredients || null,
    how_to_use: p.howToUse || null, rich_content: p.richContent || null,
    meta_title: p.metaTitle || null, meta_description: p.metaDescription || null,
    stock: Number(p.stock) || 0, featured: !!p.featured,
  };
}

export async function allProducts() {
  const { data, error } = await supabase().from('products').select('*').order('title');
  if (error) throw error;
  return data.map(rowToProduct);
}
export async function queryProducts({ search = '', category = '', page = 1, per = 50 } = {}) {
  let q = supabase().from('products').select('*', { count: 'exact' });
  if (search) q = q.ilike('title', `%${search}%`);
  if (category) q = q.eq('category', category);
  const from = (Number(page) - 1) * Number(per);
  q = q.range(from, from + Number(per) - 1).order('title');
  const { data, error, count } = await q;
  if (error) throw error;
  return { products: data.map(rowToProduct), total: count, page: Number(page), per: Number(per) };
}
export async function getProduct(handle) {
  const { data } = await supabase().from('products').select('*').eq('handle', handle).single();
  return rowToProduct(data);
}
export async function createProduct(p) {
  const row = productToRow(p);
  const { data, error } = await supabase().from('products').insert([row]).select().single();
  if (error) throw error;
  return rowToProduct(data);
}
export async function updateProduct(handle, p) {
  const row = productToRow(p); delete row.handle;
  const { data, error } = await supabase().from('products').update(row).eq('handle', handle).select().single();
  if (error) throw error;
  return rowToProduct(data);
}
export async function deleteProduct(handle) {
  const { error } = await supabase().from('products').delete().eq('handle', handle);
  if (error) throw error;
  return true;
}

// Seed products on first boot (only if table is empty)
export async function seedProductsIfEmpty(products) {
  const { count } = await supabase().from('products').select('*', { count: 'exact', head: true });
  if (count > 0) return 0;
  const rows = products.map(productToRow);
  // Insert in batches of 100
  let seeded = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase().from('products').insert(batch);
    if (!error) seeded += batch.length;
  }
  console.log(`Seeded ${seeded} products into Supabase`);
  return seeded;
}

// ─── Categories ───────────────────────────────────────────────
export async function listCategories() {
  const { data, error } = await supabase().from('categories').select('*').order('name');
  if (error) throw error;
  return data || [];
}
export async function createCategory(name) {
  const { data, error } = await supabase().from('categories')
    .insert([{ name, slug: slugify(name) }]).select().single();
  if (error) throw error;
  return data;
}
export async function deleteCategory(id) {
  await supabase().from('categories').delete().eq('id', id);
  return true;
}

// ─── Brands ───────────────────────────────────────────────────
export async function listBrands() {
  const { data, error } = await supabase().from('brands').select('*').order('sort_order').order('name');
  if (error) throw error;
  return data || [];
}
export async function createBrand(name, blurb = '') {
  const { data, error } = await supabase().from('brands').insert([{ name, blurb }]).select().single();
  if (error) throw error;
  return data;
}
export async function deleteBrand(id) {
  await supabase().from('brands').delete().eq('id', id);
  return true;
}

// ─── Admins ───────────────────────────────────────────────────
export async function findAdmin(email) {
  const { data } = await supabase().from('admins').select('*').eq('email', email).single();
  return data || null;
}
export async function createAdminIfNone(email, password) {
  const { count } = await supabase().from('admins').select('*', { count: 'exact', head: true });
  if (count > 0) return;
  const s = salt();
  await supabase().from('admins').insert([{ email, pass_hash: hash(password, s), salt: s }]);
  console.log('Admin account created:', email);
}
export async function verifyAdmin(email, password) {
  const admin = await findAdmin(email);
  if (!admin) return false;
  return hash(password, admin.salt) === admin.pass_hash;
}

// ─── Users ────────────────────────────────────────────────────
export async function findUser(email) {
  const { data } = await supabase().from('users').select('*').eq('email', email.toLowerCase()).single();
  return data || null;
}
export async function createUser({ email, password, name }) {
  if (await findUser(email)) throw new Error('Email already registered');
  const s = salt();
  const { data, error } = await supabase().from('users').insert([{
    email: email.toLowerCase(), pass_hash: hash(password, s), salt: s, name: name || '',
  }]).select().single();
  if (error) throw error;
  return data;
}
export async function verifyUser(email, password) {
  const user = await findUser(email);
  if (!user) return null;
  return hash(password, user.salt) === user.pass_hash ? user : null;
}
export async function getUserById(id) {
  const { data } = await supabase().from('users').select('*').eq('id', id).single();
  return data || null;
}

// ─── Tokens ───────────────────────────────────────────────────
export async function createToken(userId) {
  const tok = token();
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase().from('tokens').insert([{ token: tok, user_id: userId, expires_at }]);
  return tok;
}
export async function findToken(tok) {
  const { data } = await supabase().from('tokens').select('*, users(*)')
    .eq('token', tok).gt('expires_at', new Date().toISOString()).single();
  return data || null;
}
export async function deleteToken(tok) {
  await supabase().from('tokens').delete().eq('token', tok);
}

// ─── Orders ───────────────────────────────────────────────────
export const PROMOS = { LUMEVA10: 0.10, WELCOME15: 0.15 };
export const FREE_SHIP_OVER = 5000;
export const ZONE_FEES = { 1: 150, 2: 250, 3: 350, 4: 500, 5: 700 };

export async function createOrder({ items, userId = null, email, name = '', address = '', city = '', phone = '', promo = '', pm = 'mpesa', deliveryLocation = '', deliveryZone = null }) {
  if (!Array.isArray(items) || !items.length) throw new Error('Cart is empty');
  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    let p = await getProduct(it.handle);
    // If product not in Supabase, use the data sent from the frontend
    if (!p && it.price && (it.title || it.name)) {
      p = {
        handle: it.handle,
        title: it.title || it.name || it.handle,
        price: Number(it.price) || 0
      };
    }
    if (!p) continue;
    const qty = Math.max(1, Math.min(50, Math.round(Number(it.qty) || 1)));
    lines.push({ handle: p.handle, name: p.title, price: p.price, qty });
    subtotal += p.price * qty;
  }
  if (!lines.length) throw new Error('No valid items');
  subtotal = Math.round(subtotal);
  const code = String(promo || '').toUpperCase();
  const discount = PROMOS[code] ? Math.round(subtotal * PROMOS[code]) : 0;
  const zone = ZONE_FEES[deliveryZone] ? Number(deliveryZone) : 3;
  const shipping = subtotal >= FREE_SHIP_OVER ? 0 : ZONE_FEES[zone];
  const total = subtotal + shipping - discount;
  const orderNo = 'LUM' + Date.now().toString().slice(-8);

  const { data: order, error } = await supabase().from('orders').insert([{
    order_no: orderNo, user_id: userId, email, name, address, city, phone,
    delivery_location: deliveryLocation || city, delivery_zone: zone,
    subtotal, shipping, discount, promo: PROMOS[code] ? code : '', total, pm,
  }]).select().single();
  if (error) throw error;

  await supabase().from('order_items').insert(lines.map(l => ({
    order_id: order.id, handle: l.handle, name: l.name, price: l.price, qty: l.qty,
  })));

  return { id: order.id, orderNo, subtotal, shipping, discount, total, deliveryZone: zone };
}
export async function getOrder(id) {
  const { data } = await supabase().from('orders').select('*, order_items(*)').eq('id', id).single();
  return data || null;
}
export async function updateOrder(id, patch) {
  await supabase().from('orders').update(patch).eq('id', id);
}
export async function ordersForUser(userId) {
  const { data } = await supabase().from('orders')
    .select('*, order_items(handle, name, price, qty)')
    .eq('user_id', userId).order('id', { ascending: false }).limit(20);
  return (data || []).map(o => ({
    no: o.order_no, date: o.created_at, status: o.status, total: o.total,
    pm: o.pm, receipt: o.mpesa_receipt, deliveryLocation: o.delivery_location,
    shipping: o.shipping, items: o.order_items || [],
  }));
}
export async function getPendingOrder(checkoutRequestId) {
  const { data } = await supabase().from('orders').select('*')
    .eq('checkout_request_id', checkoutRequestId).single();
  return data || null;
}
export async function setOrderReceipt(id, receipt) {
  await supabase().from('orders').update({ mpesa_receipt: receipt, status: 'paid' }).eq('id', id);
}
export async function setOrderCheckoutId(id, checkoutRequestId) {
  await supabase().from('orders').update({ checkout_request_id: checkoutRequestId }).eq('id', id);
}

// ─── Pages ────────────────────────────────────────────────────
const rowToPage = r => r ? ({
  slug: r.slug, title: r.title,
  metaTitle: r.meta_title || '', metaDescription: r.meta_description || '',
  blocks: r.blocks || [], isCustom: !!r.is_custom, updatedAt: r.updated_at,
}) : null;

export async function listPages() {
  const { data } = await supabase().from('pages').select('*').order('is_custom').order('slug');
  return (data || []).map(rowToPage);
}
export async function getPage(slug) {
  const { data } = await supabase().from('pages').select('*').eq('slug', slug).single();
  return rowToPage(data);
}
export async function upsertPage(slug, p) {
  const row = {
    slug, title: p.title ?? '', meta_title: p.metaTitle ?? '',
    meta_description: p.metaDescription ?? '', updated_at: new Date().toISOString(),
    ...(p.blocks !== undefined ? { blocks: p.blocks } : {}),
    ...(p.isCustom !== undefined ? { is_custom: p.isCustom } : {}),
  };
  const { data, error } = await supabase().from('pages').upsert([row]).select().single();
  if (error) throw error;
  return rowToPage(data);
}
export async function createPage({ title }) {
  const slug = slugify(title || 'New Page') || 'page-' + Date.now();
  const { data, error } = await supabase().from('pages').insert([{
    slug, title: title || 'New Page', meta_title: '', meta_description: '', blocks: [], is_custom: true,
  }]).select().single();
  if (error) throw error;
  return rowToPage(data);
}
export async function deletePage(slug) {
  const { data } = await supabase().from('pages').select('is_custom').eq('slug', slug).single();
  if (!data) return false;
  if (!data.is_custom) throw new Error('Core pages cannot be deleted');
  await supabase().from('pages').delete().eq('slug', slug);
  return true;
}
export async function duplicatePage(slug) {
  const src = await getPage(slug);
  if (!src) return null;
  const newSlug = slugify(src.title + ' copy') || 'page-' + Date.now();
  const { data, error } = await supabase().from('pages').insert([{
    slug: newSlug, title: src.title + ' (Copy)', meta_title: src.metaTitle,
    meta_description: src.metaDescription, blocks: src.blocks, is_custom: true,
  }]).select().single();
  if (error) throw error;
  return rowToPage(data);
}
export async function renamePage(oldSlug, newSlug) {
  const { data: ex } = await supabase().from('pages').select('id').eq('slug', newSlug).single();
  if (ex) throw new Error('That URL is already in use');
  const { data: pg } = await supabase().from('pages').select('is_custom').eq('slug', oldSlug).single();
  if (!pg) throw new Error('Page not found');
  if (!pg.is_custom) throw new Error('Core page URLs cannot be changed');
  await supabase().from('pages').update({ slug: newSlug }).eq('slug', oldSlug);
  return getPage(newSlug);
}

// ─── Settings ─────────────────────────────────────────────────
export async function getSetting(key) {
  const { data } = await supabase().from('settings').select('value').eq('key', key).single();
  return data ? data.value : null;
}
export async function setSetting(key, value) {
  await supabase().from('settings').upsert([{ key, value }]);
  return value;
}

// ─── Admin orders list ─────────────────────────────────────────
export async function listOrders({ page = 1, per = 50 } = {}) {
  const from = (page - 1) * per;
  const { data, count, error } = await supabase().from('orders')
    .select('*, order_items(*)', { count: 'exact' })
    .order('id', { ascending: false }).range(from, from + per - 1);
  if (error) throw error;
  return { orders: data || [], total: count };
}