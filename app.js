/* ===================================================================
   LUMEVA — app.js
   Single script powering all pages of the LUMEVA storefront.
   Pages: home, shop, collection, product, cart, checkout, wishlist,
          login, register, account, quiz, quiz-results, skin-hub,
          skin-dry, skin-acne, skin-barrier, skin-sensitive,
          skin-redness, skin-finelines, skin-hyperpigmentation,
          brand, brand-guide, philosophy, ingredients, guides, wtb,
          step-shop, privacy, returns, terms, custom
   =================================================================== */

'use strict';

/* ─── API CONFIG ─────────────────────────────────────────────────────── */
const API_BASE = 'http://localhost:5000/api';

async function _api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = Auth.token();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res  = await fetch(`${API_BASE}${path}`, opts);
  return res.json();
}

/* ─── CART ──────────────────────────────────────────────────────────── */
const Cart = (() => {
  const KEY = 'lumeva_cart';
  const _get  = ()      => JSON.parse(localStorage.getItem(KEY) || '[]');
  const _save = items   => { localStorage.setItem(KEY, JSON.stringify(items)); _syncBadges(); };

  return {
    get: _get,
    add(id, qty = 1) {
      const items = _get();
      const i = items.findIndex(x => x.id === id);
      i > -1 ? (items[i].qty += qty) : items.push({ id, qty });
      _save(items);
    },
    remove(id)       { _save(_get().filter(x => x.id !== id)); },
    update(id, qty)  {
      if (qty < 1) return this.remove(id);
      const items = _get();
      const i = items.findIndex(x => x.id === id);
      if (i > -1) items[i].qty = qty;
      _save(items);
    },
    count()          { return _get().reduce((s, x) => s + x.qty, 0); },
    total(prods)     {
      return _get().reduce((s, x) => {
        const p = prods.find(pr => pr.id === x.id);
        return s + (p ? (p.price || 0) * x.qty : 0);
      }, 0);
    },
    clear()          { _save([]); }
  };
})();

/* ─── WISHLIST ──────────────────────────────────────────────────────── */
const Wishlist = (() => {
  const KEY  = 'lumeva_wish';
  const _get  = ()  => JSON.parse(localStorage.getItem(KEY) || '[]');
  const _save = ids => { localStorage.setItem(KEY, JSON.stringify(ids)); _syncBadges(); };

  return {
    get:    _get,
    has:    id => _get().includes(id),
    count:  ()  => _get().length,
    toggle(id) {
      const ids = _get();
      _save(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
    },
    remove: id => _save(_get().filter(x => x !== id))
  };
})();

/* ─── AUTH ──────────────────────────────────────────────────────────── */
const Auth = (() => {
  const KEY_USER  = 'lumeva_user';
  const KEY_TOKEN = 'lumeva_token';
  return {
    get:     () => JSON.parse(localStorage.getItem(KEY_USER) || 'null'),
    token:   () => localStorage.getItem(KEY_TOKEN) || '',
    login(name, email, token) {
      localStorage.setItem(KEY_USER,  JSON.stringify({ name, email }));
      if (token) localStorage.setItem(KEY_TOKEN, token);
    },
    logout() {
      localStorage.removeItem(KEY_USER);
      localStorage.removeItem(KEY_TOKEN);
    }
  };
})();

/* ─── BADGE SYNC ────────────────────────────────────────────────────── */
function _syncBadges() {
  const cc = Cart.count();
  const wc = Wishlist.count();

  document.querySelectorAll('#cart-badge, #cart-badge-mob').forEach(el => {
    el.textContent   = cc;
    el.style.display = cc ? '' : 'none';
  });
  document.querySelectorAll('#wish-badge').forEach(el => {
    el.textContent   = wc;
    el.style.display = wc ? '' : 'none';
  });
  document.querySelectorAll('[data-wish]').forEach(btn => {
    btn.classList.toggle('active', Wishlist.has(btn.dataset.wish));
  });
}

function updateBadges() { _syncBadges(); }

/* ─── NAVIGATION ────────────────────────────────────────────────────── */
function goTo(page, param) {
  let url = page === 'home' ? 'index.html' : `${page}.html`;
  if (param) url += `?id=${encodeURIComponent(param)}`;
  window.location.href = url;
}

function _param(key = 'id') {
  return new URLSearchParams(window.location.search).get(key) || '';
}

/* ─── MOBILE MENU ───────────────────────────────────────────────────── */
function openMob() {
  const overlay = document.getElementById('mob-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMob() {
  const overlay = document.getElementById('mob-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function switchMobTab(tab, btn) {
  document.querySelectorAll('.mob-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mob-panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const panel = document.getElementById(`mob-${tab}`);
  if (panel) panel.classList.add('active');
}

/* ─── MEGA MENU ─────────────────────────────────────────────────────── */
function closeMega() {
  document.activeElement?.blur();
}

/* ─── SEARCH OVERLAY ────────────────────────────────────────────────── */
let _allProds = [];

function openSearch() {
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('search-input')?.focus(), 60);
}

function closeSearch() {
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  const results = document.getElementById('search-results');
  if (results) results.innerHTML = '';
  const meta = document.getElementById('search-meta');
  if (meta) meta.textContent = '';
  const sugg = document.getElementById('search-sugg');
  if (sugg) sugg.style.display = '';
}

function seedSearch(term) {
  const inp = document.getElementById('search-input');
  if (inp) { inp.value = term; doSearch(term); }
}

function doSearch(q) {
  const results = document.getElementById('search-results');
  const meta    = document.getElementById('search-meta');
  const sugg    = document.getElementById('search-sugg');
  if (!results) return;

  q = (q || '').trim().toLowerCase();

  if (!q) {
    results.innerHTML = '';
    if (meta) meta.textContent = '';
    if (sugg) sugg.style.display = '';
    return;
  }
  if (sugg) sugg.style.display = 'none';

  if (!_allProds.length) {
    fetch('products.json')
      .then(r => r.json())
      .then(data => { _allProds = Array.isArray(data) ? data : []; doSearch(q); })
      .catch(() => { if (meta) meta.textContent = 'Search unavailable.'; });
    return;
  }

  const hits = _allProds.filter(p =>
    (p.name   || '').toLowerCase().includes(q) ||
    (p.brand  || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q) ||
    (p.tags   || []).some(t => t.toLowerCase().includes(q))
  ).slice(0, 20);

  if (meta) meta.textContent = hits.length
    ? `${hits.length} result${hits.length !== 1 ? 's' : ''} for "${q}"`
    : '';

  if (!hits.length) {
    results.innerHTML = `<p style="padding:2rem;text-align:center;color:var(--muted-fg)">No results for "${q}"</p>`;
    return;
  }

  results.innerHTML = hits.map(p => {
    const img = p.image
      ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="width:100%;height:100%;background:linear-gradient(160deg,#cbcab7,#9aa38b)"></div>`;
    return `
    <div class="search-item" onclick="closeSearch();goTo('product','${p.id}')">
      <div class="si-img">${img}</div>
      <div class="si-info">
        <span class="si-name">${p.name}</span>
        <span class="si-cat">${p.brand || p.category || ''}</span>
        <span class="si-price">KES ${(p.price || 0).toLocaleString()}</span>
      </div>
    </div>`;
  }).join('');
}

/* ─── PRODUCT TILE HTML ─────────────────────────────────────────────── */
function productTileHTML(p) {
  const wished  = Wishlist.has(p.id);
  const isSale  = p.originalPrice && p.originalPrice > p.price;
  const img     = p.image
    ? `<img src="${p.image}" alt="${p.name}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
    : `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#cbcab7,#9aa38b)"></div>`;
  const badge   = isSale
    ? `<span class="pt-badge" style="left:auto;right:.75rem;background:#c0392b">SALE</span>`
    : p.badge ? `<span class="pt-badge">${p.badge}</span>` : '';
  const oldPrice = isSale
    ? `<span style="font-size:.72rem;color:var(--muted-fg);text-decoration:line-through">KES ${p.originalPrice.toLocaleString()}</span>` : '';

  return `
  <div class="product-tile" onclick="goTo('product','${p.id}')">
    <div class="pt-img">
      ${img}
      <button class="pt-wish${wished ? ' active' : ''}" data-wish="${p.id}"
        onclick="event.stopPropagation();toggleWish(this,'${p.id}')" aria-label="Save to wishlist">
        <svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"></path></svg>
      </button>
      ${badge}
    </div>
    <div class="pt-body">
      <span class="pt-name">${p.name}</span>
      <span class="pt-tagline">${p.brand || p.category || ''}</span>
      <div style="display:flex;align-items:center;gap:.5rem;justify-content:center;margin-top:.25rem">
        <span class="pt-price">KES ${(p.price || 0).toLocaleString()}</span>
        ${oldPrice}
      </div>
      <button class="pt-atb" onclick="event.stopPropagation();Cart.add('${p.id}',1);showAdded(this)">Add to bag</button>
    </div>
  </div>`;
}

function showAdded(btn) {
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = 'Added ✓';
  btn.disabled    = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
  _syncBadges();
}

function toggleWish(btn, id) {
  Wishlist.toggle(id);
  document.querySelectorAll(`[data-wish="${id}"]`).forEach(b =>
    b.classList.toggle('active', Wishlist.has(id))
  );
  _syncBadges();
}

/* ─── PRODUCTS DATA ─────────────────────────────────────────────────── */
function _normalise(p) {
  return {
    ...p,
    id:            p.handle || p.id || '',
    originalPrice: p.compareAt  || p.originalPrice || null,
    brand:         p.brand      || p.tagline       || '',
  };
}

async function _loadProducts() {
  if (_allProds.length) return _allProds;
  try {
    // Try backend first; fallback to local products.json
    const res = await fetch(`${API_BASE}/products?limit=500`).catch(() => null);
    if (res && res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        _allProds = json.data.map(_normalise);
        return _allProds;
      }
    }
    const r   = await fetch('products.json');
    const raw = await r.json();
    _allProds = (Array.isArray(raw) ? raw : []).map(_normalise);
  } catch {
    _allProds = [];
  }
  return _allProds;
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: HOME
   ═══════════════════════════════════════════════════════════════════════ */
async function initHome() {
  _syncBadges();
  const prods = await _loadProducts();

  // Bestsellers section — single products-grid inside .bs-sec
  const bsSec = document.querySelector('.bs-sec .products-grid');
  if (bsSec) bsSec.innerHTML = prods.slice(0, 8).map(productTileHTML).join('');

  // Fallback: any other named grids that may exist
  const featGrid = document.getElementById('feat-grid');
  if (featGrid) featGrid.innerHTML = prods.slice(0, 8).map(productTileHTML).join('');
  const newGrid  = document.getElementById('new-grid');
  if (newGrid)  newGrid.innerHTML  = prods.slice(0, 4).map(productTileHTML).join('');
  const bestGrid = document.getElementById('best-grid');
  if (bestGrid) bestGrid.innerHTML = prods.slice(0, 4).map(productTileHTML).join('');
}

/* Start quiz — called from homepage quiz banner */
function startQuiz() { goTo('quiz'); }

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: SHOP
   ═══════════════════════════════════════════════════════════════════════ */
const _shopState = { filter: '', sort: 'featured', page: 1, perPage: 24 };

async function initShop() {
  const prods = await _loadProducts();
  const cat   = _param('cat');
  if (cat) {
    _shopState.filter = cat.toLowerCase();
    document.querySelectorAll('#cat-links a').forEach(a => {
      const match = !cat
        ? (a.getAttribute('onclick') || '').includes("''")
        : (a.getAttribute('onclick') || '').toLowerCase().includes(`'${cat.toLowerCase()}'`);
      a.classList.toggle('active', match);
    });
  }
  _renderShop(prods);
  _syncBadges();
}

function filterShop(el, cat) {
  _shopState.filter = cat;
  _shopState.page   = 1;
  document.querySelectorAll('#cat-links a').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
  _loadProducts().then(_renderShop);
}

function sortShop() {
  const sel = document.getElementById('sort-sel');
  _shopState.sort = sel ? sel.value : 'featured';
  _shopState.page = 1;
  _loadProducts().then(_renderShop);
}

function changePage(n) {
  _shopState.page = n;
  _loadProducts().then(_renderShop);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function _renderShop(prods) {
  let list = [...prods];

  if (_shopState.filter) {
    const f = _shopState.filter.toLowerCase();
    list = list.filter(p =>
      (p.category || '').toLowerCase() === f ||
      (p.tags || []).map(t => t.toLowerCase()).includes(f)
    );
  }
  if (_shopState.sort === 'asc')  list.sort((a, b) => (a.price || 0) - (b.price || 0));
  if (_shopState.sort === 'desc') list.sort((a, b) => (b.price || 0) - (a.price || 0));
  if (_shopState.sort === 'sale') list = list.filter(p => p.originalPrice && p.originalPrice > p.price);

  const total  = list.length;
  const { page, perPage } = _shopState;
  const start  = (page - 1) * perPage;
  const slice  = list.slice(start, start + perPage);

  const countEl = document.getElementById('shop-count');
  if (countEl) countEl.textContent =
    `Showing ${total ? start + 1 : 0}–${Math.min(start + perPage, total)} of ${total} products`;

  const grid = document.getElementById('shop-grid');
  if (grid) grid.innerHTML = slice.length
    ? slice.map(productTileHTML).join('')
    : `<p style="padding:3rem;color:var(--muted-fg);grid-column:1/-1;text-align:center">No products found.</p>`;

  const pages = Math.ceil(total / perPage);
  const pag   = document.getElementById('shop-pagination');
  if (pag) pag.innerHTML = _paginationHTML(pages, page, 'changePage');

  _syncBadges();
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: COLLECTION
   ═══════════════════════════════════════════════════════════════════════ */
const _colState = { filter: '', page: 1, perPage: 24 };

const renders = {
  async collection(cat) {
    _colState.filter = cat || '';
    _colState.page   = 1;
    document.querySelectorAll('.col-nav a').forEach(a => {
      const onclick = a.getAttribute('onclick') || '';
      const isAll   = !cat && (onclick.includes("''") || onclick.includes('""'));
      const isCat   = cat && onclick.toLowerCase().includes(`'${cat.toLowerCase()}'`);
      a.classList.toggle('active', isAll || isCat);
    });
    const prods = await _loadProducts();
    _renderCollection(prods);
  }
};

async function initCollection() {
  const cat   = _param('cat') || '';
  _colState.filter = cat;
  const prods = await _loadProducts();

  const h1 = document.querySelector('.col-hero h1');
  if (h1 && cat) h1.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);

  document.querySelectorAll('.col-nav a').forEach(a => {
    const onclick = a.getAttribute('onclick') || '';
    const isAll   = !cat && (onclick.includes("''") || onclick.includes('""'));
    const isCat   = cat && onclick.toLowerCase().includes(`'${cat.toLowerCase()}'`);
    a.classList.toggle('active', isAll || isCat);
  });

  _renderCollection(prods);
  _syncBadges();
}

function _renderCollection(prods) {
  let list = [...prods];
  if (_colState.filter) {
    const f = _colState.filter.toLowerCase();
    list = list.filter(p => (p.category || '').toLowerCase() === f);
  }

  const total  = list.length;
  const { page, perPage } = _colState;
  const start  = (page - 1) * perPage;
  const slice  = list.slice(start, start + perPage);

  const countEl = document.getElementById('col-count');
  if (countEl) countEl.textContent =
    `Showing ${total ? start + 1 : 0}–${Math.min(start + perPage, total)} of ${total} products`;

  const grid = document.getElementById('col-grid');
  if (grid) grid.innerHTML = slice.length
    ? slice.map(productTileHTML).join('')
    : `<p style="padding:3rem;color:var(--muted-fg);grid-column:1/-1;text-align:center">No products found.</p>`;

  const pag = document.getElementById('col-pag');
  if (pag) pag.innerHTML = _paginationHTML(Math.ceil(total / perPage), page, 'colPage');

  _syncBadges();
}

function colPage(n) {
  _colState.page = n;
  _loadProducts().then(_renderCollection);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: PRODUCT
   ═══════════════════════════════════════════════════════════════════════ */
let _pQty  = 1;
let _curProd = null;

async function initProduct() {
  const id    = _param();
  if (!id) return;
  const prods = await _loadProducts();
  _curProd    = prods.find(p => p.id === id) || null;
  if (!_curProd) return;

  const p = _curProd;
  document.title = `${p.name} — LUMEVA`;

  const bc = document.querySelector('.breadcrumb');
  if (bc) bc.innerHTML = `
    <span onclick="goTo('shop')" style="cursor:pointer">Shop</span> /
    <span onclick="goTo('collection','${(p.category||'').toLowerCase()}')" style="cursor:pointer">${p.category || ''}</span> /
    ${p.name}`;

  const mainWrap = document.getElementById('main-wrap');
  if (mainWrap) {
    if (p.images && p.images.length) {
      mainWrap.innerHTML = `<img src="${p.images[0]}" alt="${p.name}"
        style="width:100%;height:100%;object-fit:cover" onclick="openLb()">`;
    }
    mainWrap.onclick = openLb;
  }

  const thumbs = document.getElementById('thumbs');
  if (thumbs && p.images && p.images.length > 1) {
    thumbs.innerHTML = p.images.map((img, i) => `
      <div class="thumb${i === 0 ? ' active' : ''}" onclick="switchThumb(this,'${img}')">
        <img src="${img}" alt="${p.name} view ${i + 1}">
      </div>`).join('');
  }

  const pCat  = document.querySelector('.p-cat');
  if (pCat)  pCat.textContent = p.category || '';

  const pName = document.querySelector('.p-name');
  if (pName) pName.textContent = p.name;

  const priceEl = document.querySelector('.price-row .price');
  if (priceEl) priceEl.textContent = `KES ${(p.price || 0).toLocaleString()}`;

  const atbBtn = document.getElementById('p-atb');
  if (atbBtn) atbBtn.textContent = `Add to bag — KES ${(p.price || 0).toLocaleString()}`;

  const wishBtn = document.querySelector('.p-wish-btn');
  if (wishBtn) {
    wishBtn.dataset.wish = p.id;
    wishBtn.onclick = () => toggleWish(wishBtn, p.id);
    wishBtn.classList.toggle('active', Wishlist.has(p.id));
  }

  _pQty = 1;
  const qtyEl = document.getElementById('p-qty');
  if (qtyEl) qtyEl.textContent = _pQty;

  _addRecentlyViewed(p.id);
  _renderRC(prods, p.id);
  _syncBadges();
}

function chQty(d) {
  _pQty = Math.max(1, _pQty + d);
  const el = document.getElementById('p-qty');
  if (el) el.textContent = _pQty;
  if (_curProd) {
    const atb = document.getElementById('p-atb');
    if (atb) atb.textContent = `Add to bag — KES ${(_curProd.price * _pQty).toLocaleString()}`;
  }
}

function addP() {
  if (!_curProd) return;
  Cart.add(_curProd.id, _pQty);
  showAdded(document.getElementById('p-atb'));
}

function openLb() {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (!lb) return;
  const src = document.querySelector('#main-wrap img')?.src || '';
  if (img && src) img.src = src;
  lb.classList.add('open');
}

function switchThumb(el, src) {
  document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const mainWrap = document.getElementById('main-wrap');
  if (mainWrap) mainWrap.innerHTML =
    `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover" onclick="openLb()">`;
}

function _addRecentlyViewed(id) {
  const rv = JSON.parse(sessionStorage.getItem('lumeva_rv') || '[]');
  sessionStorage.setItem('lumeva_rv', JSON.stringify([id, ...rv.filter(x => x !== id)].slice(0, 8)));
}

function _renderRC(prods, currentId) {
  const container = document.getElementById('rc-container');
  if (!container) return;
  const rv      = JSON.parse(sessionStorage.getItem('lumeva_rv') || '[]');
  const rcProds = prods.filter(p => rv.includes(p.id) && p.id !== currentId).slice(0, 4);
  if (!rcProds.length) return;
  container.innerHTML = `
    <div class="container-tatcha" style="padding:3rem 0 1rem;border-top:1px solid rgba(0,0,0,.08);margin-top:3rem">
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.75rem;font-weight:400;margin-bottom:1.5rem">Recently viewed</h3>
      <div class="products-grid">${rcProds.map(productTileHTML).join('')}</div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: CART
   ═══════════════════════════════════════════════════════════════════════ */
async function initCartPage() {
  const prods = await _loadProducts();
  _renderCart(prods);
  _syncBadges();
}

function _renderCart(prods) {
  const wrap  = document.querySelector('.cart-wrap');
  if (!wrap) return;
  const items = Cart.get();

  if (!items.length) {
    wrap.innerHTML = `
      <h1>Your bag</h1>
      <div class="cart-empty">
        <p>Your bag is empty.</p>
        <button class="btn-primary" onclick="goTo('shop')">Start shopping</button>
      </div>`;
    return;
  }

  const subtotal = Cart.total(prods);

  wrap.innerHTML = `
    <h1>Your bag (${Cart.count()})</h1>
    <div class="cart-layout">
      <div class="cart-items">
        ${items.map(item => {
          const p = prods.find(pr => pr.id === item.id);
          if (!p) return '';
          const img = p.image
            ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover">`
            : `<div style="width:100%;height:100%;background:linear-gradient(160deg,#cbcab7,#9aa38b)"></div>`;
          return `
          <div class="cart-item">
            <div class="ci-img">${img}</div>
            <div class="ci-details">
              <p class="ci-name">${p.name}</p>
              <p class="ci-cat">${p.brand || p.category || ''}</p>
              <div class="ci-actions">
                <div class="qty-ctrl">
                  <button class="qty-btn" onclick="cartUpdate('${p.id}',${item.qty - 1})">−</button>
                  <span class="qty-num">${item.qty}</span>
                  <button class="qty-btn" onclick="cartUpdate('${p.id}',${item.qty + 1})">+</button>
                </div>
                <button class="ci-remove" onclick="cartRemove('${p.id}')">Remove</button>
              </div>
            </div>
            <span class="ci-price">KES ${((p.price || 0) * item.qty).toLocaleString()}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="cart-summary">
        <h2>Order summary</h2>
        <div class="sum-row"><span>Subtotal</span><span>KES ${subtotal.toLocaleString()}</span></div>
        <div class="sum-row"><span>Shipping</span><span style="color:#888;font-size:.8rem">Calculated at checkout</span></div>
        <div class="sum-row" style="font-size:.72rem;color:var(--muted-fg)"><span>VAT (16%)</span><span>Included</span></div>
        <div class="sum-total"><span>Total</span><span>KES ${subtotal.toLocaleString()}+</span></div>
        <button class="btn-primary" style="width:100%;text-align:center;margin-top:1.5rem" onclick="goTo('checkout')">
          Proceed to checkout
        </button>
        <button class="btn-outline" style="width:100%;text-align:center;margin-top:.75rem" onclick="goTo('shop')">
          Continue shopping
        </button>
      </div>
    </div>`;
}

function cartUpdate(id, qty) {
  Cart.update(id, qty);
  _loadProducts().then(_renderCart);
}

function cartRemove(id) {
  Cart.remove(id);
  _loadProducts().then(_renderCart);
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: CHECKOUT
   ═══════════════════════════════════════════════════════════════════════ */
const DELIVERY_ZONES = [
  /* CBD Express — KES 150 */
  { name: 'Nairobi CBD',        zone: 'CBD Express',     fee: 150 },
  { name: 'Westlands',          zone: 'CBD Express',     fee: 150 },
  { name: 'Parklands',          zone: 'CBD Express',     fee: 150 },
  { name: 'Upper Hill',         zone: 'CBD Express',     fee: 150 },
  { name: 'Hurlingham',         zone: 'CBD Express',     fee: 150 },
  { name: 'Ngara',              zone: 'CBD Express',     fee: 150 },
  { name: 'Milimani',           zone: 'CBD Express',     fee: 150 },
  { name: 'Hospital Hill',      zone: 'CBD Express',     fee: 150 },
  /* Nairobi Metro — KES 250 */
  { name: 'Eastleigh',          zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Kilimani',           zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Kileleshwa',         zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Lavington',          zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Karen',              zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Runda',              zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Gigiri',             zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Muthaiga',           zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Ridgeways',          zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Spring Valley',      zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Loresho',            zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Riverside',          zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Adams Arcade',       zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Ngong Road',         zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Buru Buru',          zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Umoja',              zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Donholm',            zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Komarock',           zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Fedha',              zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Nairobi West',       zone: 'Nairobi Metro',   fee: 250 },
  { name: 'South B',            zone: 'Nairobi Metro',   fee: 250 },
  { name: 'South C',            zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Langata',            zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Madaraka',           zone: 'Nairobi Metro',   fee: 250 },
  { name: 'Woodley',            zone: 'Nairobi Metro',   fee: 250 },
  /* Greater Nairobi — KES 350 */
  { name: 'Embakasi',           zone: 'Greater Nairobi', fee: 350 },
  { name: 'Embakasi East',      zone: 'Greater Nairobi', fee: 350 },
  { name: 'Embakasi West',      zone: 'Greater Nairobi', fee: 350 },
  { name: 'Embakasi North',     zone: 'Greater Nairobi', fee: 350 },
  { name: 'Embakasi South',     zone: 'Greater Nairobi', fee: 350 },
  { name: 'Kasarani',           zone: 'Greater Nairobi', fee: 350 },
  { name: 'Thika Road',         zone: 'Greater Nairobi', fee: 350 },
  { name: 'Ruaka',              zone: 'Greater Nairobi', fee: 350 },
  { name: 'Kikuyu',             zone: 'Greater Nairobi', fee: 350 },
  { name: 'Rongai',             zone: 'Greater Nairobi', fee: 350 },
  { name: 'Syokimau',           zone: 'Greater Nairobi', fee: 350 },
  { name: 'Imara Daima',        zone: 'Greater Nairobi', fee: 350 },
  { name: 'Utawala',            zone: 'Greater Nairobi', fee: 350 },
  { name: 'Mihango',            zone: 'Greater Nairobi', fee: 350 },
  { name: 'Pipeline',           zone: 'Greater Nairobi', fee: 350 },
  { name: 'Roysambu',           zone: 'Greater Nairobi', fee: 350 },
  { name: 'Zimmerman',          zone: 'Greater Nairobi', fee: 350 },
  { name: 'Githurai',           zone: 'Greater Nairobi', fee: 350 },
  { name: 'Githurai 44',        zone: 'Greater Nairobi', fee: 350 },
  { name: 'Kahawa',             zone: 'Greater Nairobi', fee: 350 },
  { name: 'Kahawa West',        zone: 'Greater Nairobi', fee: 350 },
  { name: 'Kahawa Sukari',      zone: 'Greater Nairobi', fee: 350 },
  { name: 'Ruiru',              zone: 'Greater Nairobi', fee: 350 },
  { name: 'Juja',               zone: 'Greater Nairobi', fee: 350 },
  { name: 'Limuru',             zone: 'Greater Nairobi', fee: 350 },
  { name: 'Ngong',              zone: 'Greater Nairobi', fee: 350 },
  { name: 'Athi River',         zone: 'Greater Nairobi', fee: 350 },
  { name: 'Kitengela',          zone: 'Greater Nairobi', fee: 350 },
  { name: 'Mlolongo',           zone: 'Greater Nairobi', fee: 350 },
  { name: 'Mavoko',             zone: 'Greater Nairobi', fee: 350 },
  { name: 'Thindigua',          zone: 'Greater Nairobi', fee: 350 },
  { name: 'Membley',            zone: 'Greater Nairobi', fee: 350 },
  { name: 'Wangige',            zone: 'Greater Nairobi', fee: 350 },
  { name: 'Dagoretti',          zone: 'Greater Nairobi', fee: 350 },
  /* Major Towns — KES 500 */
  { name: 'Mombasa',            zone: 'Major Towns',     fee: 500 },
  { name: 'Nakuru',             zone: 'Major Towns',     fee: 500 },
  { name: 'Kisumu',             zone: 'Major Towns',     fee: 500 },
  { name: 'Eldoret',            zone: 'Major Towns',     fee: 500 },
  { name: 'Thika',              zone: 'Major Towns',     fee: 500 },
  { name: 'Nyeri',              zone: 'Major Towns',     fee: 500 },
  { name: 'Meru',               zone: 'Major Towns',     fee: 500 },
  { name: 'Machakos',           zone: 'Major Towns',     fee: 500 },
  { name: 'Naivasha',           zone: 'Major Towns',     fee: 500 },
  { name: 'Kericho',            zone: 'Major Towns',     fee: 500 },
  { name: 'Embu',               zone: 'Major Towns',     fee: 500 },
  { name: "Murang'a",           zone: 'Major Towns',     fee: 500 },
  { name: 'Karatina',           zone: 'Major Towns',     fee: 500 },
  { name: 'Kisii',              zone: 'Major Towns',     fee: 500 },
  { name: 'Kakamega',           zone: 'Major Towns',     fee: 500 },
  { name: 'Bungoma',            zone: 'Major Towns',     fee: 500 },
  { name: 'Kitale',             zone: 'Major Towns',     fee: 500 },
  { name: 'Nanyuki',            zone: 'Major Towns',     fee: 500 },
  { name: 'Nyahururu',          zone: 'Major Towns',     fee: 500 },
  { name: 'Isiolo',             zone: 'Major Towns',     fee: 500 },
  { name: 'Voi',                zone: 'Major Towns',     fee: 500 },
  /* Countrywide — KES 700 */
  { name: 'Malindi',            zone: 'Countrywide',     fee: 700 },
  { name: 'Lamu',               zone: 'Countrywide',     fee: 700 },
  { name: 'Garissa',            zone: 'Countrywide',     fee: 700 },
  { name: 'Wajir',              zone: 'Countrywide',     fee: 700 },
  { name: 'Mandera',            zone: 'Countrywide',     fee: 700 },
  { name: 'Marsabit',           zone: 'Countrywide',     fee: 700 },
  { name: 'Lodwar',             zone: 'Countrywide',     fee: 700 },
  { name: 'Homa Bay',           zone: 'Countrywide',     fee: 700 },
  { name: 'Migori',             zone: 'Countrywide',     fee: 700 },
  { name: 'Siaya',              zone: 'Countrywide',     fee: 700 },
  { name: 'Bomet',              zone: 'Countrywide',     fee: 700 },
  { name: 'Narok',              zone: 'Countrywide',     fee: 700 },
  { name: 'Kajiado',            zone: 'Countrywide',     fee: 700 },
  { name: 'Kwale',              zone: 'Countrywide',     fee: 700 },
  { name: 'Kilifi',             zone: 'Countrywide',     fee: 700 },
  { name: 'Tana River',         zone: 'Countrywide',     fee: 700 },
  { name: 'Taita Taveta',       zone: 'Countrywide',     fee: 700 },
  { name: 'Makueni',            zone: 'Countrywide',     fee: 700 },
  { name: 'Kitui',              zone: 'Countrywide',     fee: 700 },
  { name: 'Mwingi',             zone: 'Countrywide',     fee: 700 },
  { name: 'Laikipia',           zone: 'Countrywide',     fee: 700 },
  { name: 'Samburu',            zone: 'Countrywide',     fee: 700 },
  { name: 'Turkana',            zone: 'Countrywide',     fee: 700 },
  { name: 'West Pokot',         zone: 'Countrywide',     fee: 700 },
  { name: 'Baringo',            zone: 'Countrywide',     fee: 700 },
  { name: 'Nandi',              zone: 'Countrywide',     fee: 700 },
  { name: 'Uasin Gishu',        zone: 'Countrywide',     fee: 700 },
  { name: 'Trans Nzoia',        zone: 'Countrywide',     fee: 700 },
  { name: 'Elgeyo Marakwet',    zone: 'Countrywide',     fee: 700 },
  { name: 'Busia',              zone: 'Countrywide',     fee: 700 },
  { name: 'Vihiga',             zone: 'Countrywide',     fee: 700 },
  { name: 'Kirinyaga',          zone: 'Countrywide',     fee: 700 },
  { name: 'Nyandarua',          zone: 'Countrywide',     fee: 700 },
];

const PROMO_CODES = {
  LUMEVA10:  { pct: 10,  desc: '10% off your order'     },
  BEAUTY15:  { pct: 15,  desc: '15% off your order'     },
  WELCOME20: { pct: 20,  desc: '20% welcome discount'   },
  GLOW25:    { pct: 25,  desc: '25% glow discount'      },
  VIP30:     { pct: 30,  desc: '30% VIP discount'       },
};

let _coShipping    = 0;
let _coPromo       = 0;
let _dzMapInst     = null;
let _dzMapOpen     = false;
let _dzAreaSelected = false;

const ZONE_DOT = {
  'CBD Express':     '#9aa38b',
  'Nairobi Metro':   '#7a8a6f',
  'Greater Nairobi': '#6f7d62',
  'Major Towns':     '#505949',
  'Countrywide':     '#3a4238',
};

async function initCheckout() {
  _coShipping     = 0;
  _coPromo        = 0;
  _dzAreaSelected = false;

  const prods = await _loadProducts();
  _renderCoItems(prods);

  const form = document.getElementById('co-form');
  if (form) {
    form.addEventListener('submit', e => { e.preventDefault(); _placeOrder(); });
    form.addEventListener('input',  _validateCoForm);
  }

  setPM('mpesa');
  _validateCoForm();
  _syncBadges();
}

function _renderCoItems(prods) {
  const container = document.querySelector('.co-items');
  if (!container) return;
  const items = Cart.get();
  if (!items.length) {
    container.innerHTML = `<p style="font-size:.85rem;color:var(--muted-fg)">Empty.</p>`;
    _updateCoSummary(prods);
    return;
  }
  container.innerHTML = items.map(item => {
    const p = prods.find(pr => pr.id === item.id);
    if (!p) return '';
    return `
    <div style="display:flex;gap:.75rem;align-items:flex-start;padding:.75rem 0;border-bottom:1px solid rgba(0,0,0,.06)">
      <div style="width:52px;height:52px;flex-shrink:0;border-radius:4px;overflow:hidden;background:linear-gradient(160deg,#cbcab7,#9aa38b)">
        ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover">` : ''}
      </div>
      <div style="flex:1;min-width:0">
        <p style="font-size:.8rem;font-weight:500;margin:0 0 .15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</p>
        <p style="font-size:.72rem;color:var(--muted-fg);margin:0">Qty ${item.qty}</p>
      </div>
      <span style="font-size:.82rem;font-weight:500;white-space:nowrap">KES ${((p.price||0) * item.qty).toLocaleString()}</span>
    </div>`;
  }).join('');
  _updateCoSummary(prods);
}

function _updateCoSummary(prods) {
  if (!prods) { _loadProducts().then(_updateCoSummary); return; }
  const subtotal = Cart.total(prods);

  const rows = document.querySelectorAll('.co-sum .sum-row');
  if (rows[0]) rows[0].querySelector('span:last-child').textContent = `KES ${subtotal.toLocaleString()}`;
  if (rows[1]) rows[1].querySelector('span:last-child').textContent =
    _dzAreaSelected ? `KES ${_coShipping.toLocaleString()}` : 'Select your area';

  const totalEl = document.querySelector('.sum-total span:last-child');
  if (!_dzAreaSelected) {
    if (totalEl) totalEl.textContent = '—';
  } else {
    const total = Math.max(0, subtotal + _coShipping - _coPromo);
    if (totalEl) totalEl.textContent = `KES ${total.toLocaleString()}`;
  }

  // Submit button text
  const submitBtn = document.querySelector('#co-form button[type="submit"]');
  if (submitBtn && !submitBtn.disabled) {
    submitBtn.textContent = _dzAreaSelected ? 'Place order' : 'Select delivery area first';
  }
}

function setPM(method) {
  ['mpesa','card'].forEach(m => {
    const btn = document.getElementById(`pm-${m}`);
    if (btn) {
      btn.style.background = m === method ? 'var(--charcoal)' : '';
      btn.style.color      = m === method ? 'var(--cream)'    : '';
    }
    const panel = document.getElementById(`pay-${m}`);
    if (panel) panel.style.display = m === method ? 'block' : 'none';
  });
}

async function applyPromo() {
  const input = document.getElementById('promo-in');
  const msg   = document.getElementById('promo-msg');
  const code  = (input?.value || '').trim().toUpperCase();
  if (!code) return;

  let pct = 0;
  let desc = '';

  try {
    const res = await _api('POST', '/promo/validate', { code });
    if (res.success) { pct = res.data.pct; desc = res.data.desc; }
    else {
      if (msg) { msg.textContent = res.error || 'Invalid promo code.'; msg.style.color = '#c0392b'; }
      return;
    }
  } catch {
    // Fallback to local codes
    const local = PROMO_CODES[code];
    if (!local) {
      if (msg) { msg.textContent = 'Invalid promo code.'; msg.style.color = '#c0392b'; }
      return;
    }
    pct  = local.pct  || local;
    desc = local.desc || `${pct}% off`;
  }

  const prods = await _loadProducts();
  _coPromo = Math.round(Cart.total(prods) * pct / 100);
  if (msg) {
    msg.textContent = `${desc} — KES ${_coPromo.toLocaleString()} off!`;
    msg.style.color = 'var(--sage-deep)';
  }
  _updateCoSummary(prods);
}

function _dzRenderMatches(matches) {
  const list    = document.getElementById('dz-suggest-list');
  const wrapper = list && list.closest('.dz-suggestions');
  if (!list) return;

  if (!matches.length) {
    list.innerHTML = '<div style="padding:.75rem 1rem;font-size:.8rem;color:#888">No areas found</div>';
    if (wrapper) { wrapper.style.display = 'block'; }
    return;
  }

  if (wrapper) {
    wrapper.style.display    = 'block';
    wrapper.style.position   = 'relative';
    wrapper.style.zIndex     = '200';
  }
  list.style.background    = '#fff';
  list.style.border        = '1px solid rgba(0,0,0,.13)';
  list.style.borderTop     = 'none';
  list.style.borderRadius  = '0 0 4px 4px';
  list.style.boxShadow     = '0 6px 20px rgba(0,0,0,.09)';
  list.style.maxHeight     = '220px';
  list.style.overflowY     = 'auto';

  list.innerHTML = matches.map(z => {
    const dot = ZONE_DOT[z.zone] || '#9aa38b';
    return `<div class="dz-suggest-item"
      onmousedown="dzSelect('${z.name.replace(/'/g,"\\'")}',${z.fee},'${z.zone.replace(/'/g,"\\'")}')"
      style="display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;cursor:pointer;border-bottom:1px solid rgba(0,0,0,.05);transition:background .12s"
      onmouseover="this.style.background='rgba(154,163,139,.12)'"
      onmouseout="this.style.background=''">
      <span style="display:flex;align-items:center;gap:.55rem;font-size:.83rem;color:#1a1a18">
        <span style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0;display:inline-block"></span>
        ${z.name}
      </span>
      <span style="font-size:.78rem;color:#666;white-space:nowrap;margin-left:.5rem">KES ${z.fee.toLocaleString()}</span>
    </div>`;
  }).join('');
}

async function dzSearch(q) {
  const list    = document.getElementById('dz-suggest-list');
  const wrapper = list && list.closest('.dz-suggestions');
  if (!list) return;
  q = (q || '').trim().toLowerCase();
  if (!q) {
    list.innerHTML = '';
    if (wrapper) wrapper.style.display = 'none';
    return;
  }

  // Try backend API first for live search, fallback to local array
  try {
    const res = await fetch(`${API_BASE}/delivery/search?q=${encodeURIComponent(q)}&limit=10`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        _dzRenderMatches(json.data);
        return;
      }
    }
  } catch { /* backend not running — use local */ }

  const matches = DELIVERY_ZONES.filter(z => z.name.toLowerCase().includes(q)).slice(0, 10);
  _dzRenderMatches(matches);
}

function dzSelect(name, fee, zone) {
  const inp = document.getElementById('dz-search');
  if (inp) {
    inp.value = name;
    inp.style.borderColor = 'var(--charcoal, #1a1a18)';
  }
  const list    = document.getElementById('dz-suggest-list');
  const wrapper = list && list.closest('.dz-suggestions');
  if (list)    list.innerHTML = '';
  if (wrapper) wrapper.style.display = 'none';

  const dot    = ZONE_DOT[zone] || '#9aa38b';
  const status = document.getElementById('dz-locate-status');
  if (status) {
    status.innerHTML = `<span style="display:inline-flex;align-items:center;gap:.4rem">
      <span style="width:7px;height:7px;border-radius:50%;background:${dot};display:inline-block"></span>
      ${zone} — KES ${fee.toLocaleString()} delivery to <strong>${name}</strong>
    </span>`;
    status.style.display = 'block';
  }

  _coShipping     = fee;
  _dzAreaSelected = true;
  _loadProducts().then(_updateCoSummary);
  _validateCoForm();
}

function dzLocate() {
  const status = document.getElementById('dz-locate-status');
  if (!navigator.geolocation) {
    if (status) { status.textContent = 'Geolocation not supported.'; status.style.display = 'block'; }
    return;
  }
  if (status) { status.textContent = 'Locating…'; status.style.display = 'block'; }
  navigator.geolocation.getCurrentPosition(
    () => dzSelect('Nairobi (Auto-detected)', 250, 'Nairobi Metro'),
    () => {
      if (status) { status.textContent = 'Could not detect location. Please search manually.'; status.style.display = 'block'; }
    }
  );
}

function dzToggleMap() {
  const map = document.getElementById('dz-map');
  const btn = document.getElementById('dz-map-toggle-btn');
  if (!map) return;
  _dzMapOpen = !_dzMapOpen;
  map.style.display = _dzMapOpen ? 'block' : 'none';
  if (btn) btn.textContent = _dzMapOpen ? 'Hide delivery zone map ↑' : 'View delivery zone map ↓';

  if (_dzMapOpen && !_dzMapInst && typeof L !== 'undefined') {
    map.style.height = '300px';
    _dzMapInst = L.map('dz-map').setView([-1.2864, 36.8172], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(_dzMapInst);
    [
      { r: 3500,  color: '#9aa38b', label: 'CBD Express — KES 150'      },
      { r: 9000,  color: '#7a8a6f', label: 'Nairobi Metro — KES 250'    },
      { r: 22000, color: '#6f7d62', label: 'Greater Nairobi — KES 350'  },
    ].forEach(z => L.circle([-1.2864, 36.8172], {
      radius: z.r, color: z.color, fillColor: z.color, fillOpacity: 0.15, weight: 1.5
    }).addTo(_dzMapInst).bindPopup(z.label));
  }
}

function _validateCoForm() {
  const btn = document.querySelector('#co-form button[type="submit"]');
  if (!btn) return;

  const filled = document.getElementById('co-email')?.value    &&
                 document.getElementById('co-fname')?.value    &&
                 document.getElementById('co-address')?.value  &&
                 Cart.count() > 0;

  const ready = filled && _dzAreaSelected;
  btn.disabled    = !ready;
  btn.textContent = _dzAreaSelected
    ? 'Place order'
    : 'Select delivery area first';
  btn.style.opacity = ready ? '1' : '.6';
}

async function _placeOrder() {
  const btn = document.querySelector('#co-form button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing order…'; }

  const prods       = await _loadProducts();
  const email       = document.getElementById('co-email')?.value   || '';
  const firstName   = document.getElementById('co-fname')?.value   || '';
  const mpesaPhone  = document.getElementById('mpesa-phone')?.value || '';
  const isMpesa     = !!document.getElementById('pay-mpesa') &&
                      document.getElementById('pay-mpesa').style.display !== 'none';
  const total       = Math.max(0, Cart.total(prods) + _coShipping - _coPromo);

  const payload = {
    email,
    firstName,
    lastName:      document.getElementById('co-lname')?.value    || '',
    address:       document.getElementById('co-address')?.value  || '',
    deliveryArea:  document.getElementById('dz-search')?.value   || '',
    paymentMethod: isMpesa ? 'mpesa' : 'card',
    mpesaPhone,
    promoCode:     document.getElementById('promo-in')?.value    || '',
    items:         Cart.get(),
    subtotal:      Cart.total(prods),
    shippingFee:   _coShipping,
    discount:      _coPromo,
    total,
  };

  try {
    // 1 — Place the order in the backend
    const orderRes = await _api('POST', '/orders', payload);
    const orderId  = orderRes?.data?.orderId || 'LMV-DEMO';

    // 2 — If M-Pesa, trigger STK push
    if (isMpesa && mpesaPhone) {
      if (btn) btn.textContent = 'Sending M-Pesa prompt…';
      try {
        const mpesaRes = await _api('POST', '/mpesa/stkpush', {
          phone: mpesaPhone, amount: total, orderId, email, firstName,
        });
        if (mpesaRes.success) {
          // Poll for payment status (up to 30 s)
          _pollMpesa(mpesaRes.data.checkoutRequestId, orderId);
        }
      } catch { /* STK push failed — order still placed */ }
    }

    Cart.clear();
    _syncBadges();
    const msg = isMpesa
      ? `Order ${orderId} placed!\n\nCheck your phone for the M-Pesa payment prompt.\nA confirmation email will be sent once payment is received.`
      : `Order ${orderId} placed! Thank you for shopping with LUMEVA.\nA confirmation email is on its way.`;
    alert(msg);
  } catch {
    Cart.clear();
    _syncBadges();
    alert('Order placed! Thank you for shopping with LUMEVA.\nYou will receive a confirmation shortly.');
  }

  goTo('home');
}

async function _pollMpesa(checkoutRequestId, orderId) {
  let tries = 0;
  const interval = setInterval(async () => {
    tries++;
    if (tries > 10) { clearInterval(interval); return; }
    try {
      const res = await fetch(`${API_BASE}/mpesa/status/${checkoutRequestId}`);
      const json = await res.json();
      if (json?.data?.status === 'paid') {
        clearInterval(interval);
        console.log(`M-Pesa payment confirmed for order ${orderId}`);
      }
    } catch { clearInterval(interval); }
  }, 3000); // check every 3 seconds
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: WISHLIST
   ═══════════════════════════════════════════════════════════════════════ */
async function renderWishlist() {
  const wrap = document.querySelector('.cart-wrap');
  if (!wrap) return;
  const ids = Wishlist.get();

  if (!ids.length) {
    wrap.innerHTML = `
      <h1>Saved items</h1>
      <div class="cart-empty">
        <p>Nothing saved yet. Tap the heart on any product to keep it here.</p>
        <button class="btn-primary" onclick="goTo('shop')">Browse products</button>
      </div>`;
    _syncBadges();
    return;
  }

  const prods  = await _loadProducts();
  const wished = prods.filter(p => ids.includes(p.id));
  wrap.innerHTML = `
    <h1>Saved items (${wished.length})</h1>
    <div class="products-grid">${wished.map(productTileHTML).join('')}</div>`;
  _syncBadges();
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: LOGIN
   ═══════════════════════════════════════════════════════════════════════ */
function initLogin() {
  const form = document.getElementById('lf');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err  = document.getElementById('l-err');
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    if (err) err.textContent = '';

    try {
      const res = await _api('POST', '/auth/login', {
        email:    form.email.value.trim(),
        password: form.password.value,
      });
      if (res.success) {
        Auth.login(res.data.user.name, res.data.user.email, res.data.token);
        goTo('account');
      } else {
        if (err) err.textContent = res.error || 'Invalid email or password.';
      }
    } catch {
      // Fallback: local-only login (no backend running)
      const email = form.email.value.trim();
      if (!email) { if (err) err.textContent = 'Please enter your email.'; return; }
      Auth.login(email.split('@')[0], email, '');
      goTo('account');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
  _syncBadges();
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: REGISTER
   ═══════════════════════════════════════════════════════════════════════ */
function initRegister() {
  const form = document.getElementById('rf');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err  = document.getElementById('r-err');
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn ? btn.textContent : '';
    if (err) err.textContent = '';

    const pass = form.password.value;
    if (pass.length < 6) {
      if (err) err.textContent = 'Password must be at least 6 characters.';
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }

    try {
      const res = await _api('POST', '/auth/register', {
        name:     form.name.value.trim(),
        email:    form.email.value.trim(),
        password: pass,
      });
      if (res.success) {
        Auth.login(res.data.user.name, res.data.user.email, res.data.token);
        goTo('account');
      } else {
        if (err) err.textContent = res.error || 'Could not create account.';
      }
    } catch {
      // Fallback: local-only
      Auth.login(form.name.value.trim(), form.email.value.trim(), '');
      goTo('account');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
  _syncBadges();
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: ACCOUNT
   ═══════════════════════════════════════════════════════════════════════ */
function renderAccount() {
  const wrap = document.querySelector('.acc-wrap');
  if (!wrap) return;
  const user = Auth.get();

  if (!user) {
    wrap.innerHTML = `
      <div class="acc-guest">
        <h1>My Account</h1>
        <p>Sign in to view your orders and ritual.</p>
        <div class="acc-btns">
          <button class="btn-primary" onclick="goTo('login')">Sign in</button>
          <button class="btn-outline" onclick="goTo('register')">Create account</button>
        </div>
      </div>`;
    _syncBadges();
    return;
  }

  wrap.innerHTML = `
    <div style="padding:2.5rem 0 1rem">
      <p class="eyebrow">Welcome back</p>
      <h1>${user.name}</h1>
      <p style="color:var(--muted-fg);margin-top:.25rem">${user.email}</p>
    </div>
    <div class="acc-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin:2rem 0">
      <div class="acc-card" onclick="goTo('wishlist')"
        style="border:1px solid rgba(0,0,0,.1);padding:1.5rem;cursor:pointer;transition:border-color .2s"
        onmouseover="this.style.borderColor='var(--charcoal)'" onmouseout="this.style.borderColor='rgba(0,0,0,.1)'">
        <div style="font-size:1.4rem;margin-bottom:.5rem">♡</div>
        <h3 style="font-size:.9rem;font-weight:500;margin:0 0 .25rem">Saved Items</h3>
        <p style="font-size:.78rem;color:var(--muted-fg);margin:0">${Wishlist.count()} item${Wishlist.count() !== 1 ? 's' : ''}</p>
      </div>
      <div class="acc-card" onclick="goTo('cart')"
        style="border:1px solid rgba(0,0,0,.1);padding:1.5rem;cursor:pointer;transition:border-color .2s"
        onmouseover="this.style.borderColor='var(--charcoal)'" onmouseout="this.style.borderColor='rgba(0,0,0,.1)'">
        <div style="font-size:1.4rem;margin-bottom:.5rem">◻</div>
        <h3 style="font-size:.9rem;font-weight:500;margin:0 0 .25rem">My Bag</h3>
        <p style="font-size:.78rem;color:var(--muted-fg);margin:0">${Cart.count()} item${Cart.count() !== 1 ? 's' : ''}</p>
      </div>
      <div class="acc-card" onclick="goTo('quiz')"
        style="border:1px solid rgba(0,0,0,.1);padding:1.5rem;cursor:pointer;transition:border-color .2s"
        onmouseover="this.style.borderColor='var(--charcoal)'" onmouseout="this.style.borderColor='rgba(0,0,0,.1)'">
        <div style="font-size:1.4rem;margin-bottom:.5rem">✦</div>
        <h3 style="font-size:.9rem;font-weight:500;margin:0 0 .25rem">Skin Quiz</h3>
        <p style="font-size:.78rem;color:var(--muted-fg);margin:0">Find your ritual</p>
      </div>
    </div>
    <button class="btn-outline" style="margin-top:1rem" onclick="accLogout()">Sign out</button>`;
  _syncBadges();
}

function accLogout() {
  Auth.logout();
  renderAccount();
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: QUIZ
   ═══════════════════════════════════════════════════════════════════════ */
const QUIZ_QUESTIONS = [
  {
    key: 'skinType', label: 'How would you describe your skin type?', multi: false,
    options: [
      { value: 'dry',         label: 'Dry',         desc: 'Often feels tight, rough, or flaky' },
      { value: 'oily',        label: 'Oily',        desc: 'Becomes shiny throughout the day' },
      { value: 'combination', label: 'Combination', desc: 'Oily in some areas, dry in others' },
      { value: 'normal',      label: 'Normal',      desc: 'Balanced with few concerns' },
      { value: 'sensitive',   label: 'Sensitive',   desc: 'Easily irritated by products or weather' },
    ]
  },
  {
    key: 'concerns', label: 'What are your primary skin concerns?', multi: true,
    options: [
      { value: 'acne',          label: 'Acne & Blemishes',      desc: 'Breakouts, blackheads, congestion' },
      { value: 'pigmentation',  label: 'Dark Spots',            desc: 'Hyperpigmentation, uneven tone' },
      { value: 'dryness',       label: 'Dryness & Dehydration', desc: 'Lack of moisture, dullness' },
      { value: 'aging',         label: 'Fine Lines & Aging',    desc: 'Wrinkles, loss of firmness' },
      { value: 'redness',       label: 'Redness & Irritation',  desc: 'Flushing, reactive skin' },
      { value: 'sensitivity',   label: 'Sensitivity',           desc: 'Stinging, easily triggered skin' },
    ]
  },
  {
    key: 'routine', label: 'How would you describe your current routine?', multi: false,
    options: [
      { value: 'minimal',  label: 'Minimal',      desc: '1–2 steps, keep it simple' },
      { value: 'moderate', label: 'Moderate',     desc: '3–5 steps, balanced approach' },
      { value: 'full',     label: 'Full ritual',  desc: '6+ steps, love layering products' },
    ]
  },
  {
    key: 'budget', label: 'What is your typical budget per product?', multi: false,
    options: [
      { value: 'economy', label: 'Under KES 1,500', desc: 'Value-focused picks' },
      { value: 'mid',     label: 'KES 1,500–3,000', desc: 'Mid-range quality' },
      { value: 'premium', label: 'KES 3,000–6,000', desc: 'Premium formulas' },
      { value: 'luxury',  label: 'KES 6,000+',      desc: 'Only the finest' },
    ]
  },
  {
    key: 'texture', label: 'What textures do you prefer?', multi: false,
    options: [
      { value: 'lightweight', label: 'Lightweight',   desc: 'Gels, serums, water-based' },
      { value: 'medium',      label: 'Medium',        desc: 'Lotions, fluid creams' },
      { value: 'rich',        label: 'Rich',          desc: 'Balms, thick creams, oils' },
      { value: 'any',         label: 'No preference', desc: 'Whatever works best' },
    ]
  },
  {
    key: 'time', label: 'When do you prefer to apply skincare?', multi: false,
    options: [
      { value: 'morning', label: 'Morning only',       desc: 'Quick AM routine' },
      { value: 'evening', label: 'Evening only',       desc: 'Wind-down PM ritual' },
      { value: 'both',    label: 'Morning & Evening',  desc: 'Full AM + PM ritual' },
    ]
  },
  {
    key: 'fragrance', label: 'How do you feel about fragrance in skincare?', multi: false,
    options: [
      { value: 'none',     label: 'Fragrance-free', desc: 'Sensitive or prefer neutral' },
      { value: 'light',    label: 'Light & natural', desc: 'Subtle botanical notes' },
      { value: 'moderate', label: 'Moderate',        desc: 'Noticeable but balanced' },
      { value: 'bold',     label: 'Love it',         desc: 'Fragrance is part of the ritual' },
    ]
  },
];

const _quizState = { step: 0, answers: {} };

function initQuiz() {
  _quizState.step    = 0;
  _quizState.answers = {};
  _renderQuizStep();
  _syncBadges();
}

function _renderQuizStep() {
  const q      = QUIZ_QUESTIONS[_quizState.step];
  if (!q) return;
  const total  = QUIZ_QUESTIONS.length;
  const step   = _quizState.step + 1;
  const pct    = Math.round((_quizState.step / total) * 100);

  const fill = document.querySelector('.quiz-progress-fill');
  if (fill) fill.style.width = `${pct}%`;

  const labelEl = document.querySelector('.quiz-step-label');
  if (labelEl) labelEl.textContent = `Question ${step} of ${total}`;

  const questionEl = document.querySelector('.quiz-question');
  if (questionEl) questionEl.textContent = q.label;

  const cur    = _quizState.answers[q.key];
  const optsEl = document.querySelector('.quiz-options');
  if (optsEl) {
    optsEl.innerHTML = q.options.map(opt => {
      const selected = q.multi
        ? (Array.isArray(cur) && cur.includes(opt.value))
        : cur === opt.value;
      return `
      <button type="button" class="quiz-opt${selected ? ' selected' : ''}"
        onclick="selectQuizOption('${q.key}','${opt.value}',${q.multi})">
        <span class="quiz-opt-check"></span>
        <span class="quiz-opt-text">
          <span class="quiz-opt-label">${opt.label}</span>
          <span class="quiz-opt-desc">${opt.desc}</span>
        </span>
      </button>`;
    }).join('');
  }

  const nextBtn = document.querySelector('.quiz-next');
  if (nextBtn) {
    const ans      = _quizState.answers[q.key];
    const hasAns   = q.multi ? (Array.isArray(ans) && ans.length > 0) : !!ans;
    nextBtn.disabled  = !hasAns;
    nextBtn.textContent = _quizState.step === total - 1 ? 'See my results →' : 'Next →';
  }

  const backSlot = document.querySelector('.quiz-nav span:first-child');
  if (backSlot) {
    backSlot.innerHTML = _quizState.step > 0
      ? `<button class="quiz-back" onclick="quizBack()"
           style="background:none;border:none;cursor:pointer;font-size:.82rem;color:var(--muted-fg);padding:0">← Back</button>`
      : '';
  }
}

function selectQuizOption(key, value, multi) {
  if (multi) {
    const arr = _quizState.answers[key] || [];
    _quizState.answers[key] = arr.includes(value)
      ? arr.filter(v => v !== value)
      : [...arr, value];
  } else {
    _quizState.answers[key] = value;
  }
  _renderQuizStep();
}

function quizNext() {
  if (_quizState.step < QUIZ_QUESTIONS.length - 1) {
    _quizState.step++;
    _renderQuizStep();
  } else {
    sessionStorage.setItem('lumeva_quiz', JSON.stringify(_quizState.answers));
    goTo('quiz-results');
  }
}

function quizBack() {
  if (_quizState.step > 0) {
    _quizState.step--;
    _renderQuizStep();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE: QUIZ RESULTS
   ═══════════════════════════════════════════════════════════════════════ */
async function initQuizResults() {
  const answers = JSON.parse(sessionStorage.getItem('lumeva_quiz') || 'null');
  const wrap    = document.getElementById('page-quiz-results');
  if (!wrap) return;

  if (!answers) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:5rem 1rem">
        <h1>No results yet</h1>
        <p style="color:var(--muted-fg);margin-top:.75rem">Take the skin quiz to get your personalised ritual.</p>
        <button class="btn-primary" onclick="goTo('quiz')" style="margin-top:1.5rem">Take the quiz</button>
      </div>`;
    return;
  }

  const prods    = await _loadProducts();
  const skinType = answers.skinType || 'normal';
  const concerns = Array.isArray(answers.concerns) ? answers.concerns : [];

  const recommended = prods.filter(p => {
    const tags = (p.tags || []).map(t => t.toLowerCase());
    return tags.includes(skinType) ||
      concerns.some(c => tags.includes(c)) ||
      (p.category || '').toLowerCase() === 'skincare';
  }).slice(0, 8);

  const skinLabel = {
    dry: 'Dry Skin', oily: 'Oily Skin', combination: 'Combination Skin',
    normal: 'Normal Skin', sensitive: 'Sensitive Skin'
  }[skinType] || 'Your Skin';

  wrap.innerHTML = `
    <div class="container-tatcha" style="padding:3rem 0 5rem">
      <div style="text-align:center;margin-bottom:3rem">
        <p class="eyebrow">Your ritual</p>
        <h1 style="font-family:'Cormorant Garamond',serif;font-size:2.5rem;font-weight:400">
          Curated for ${skinLabel}
        </h1>
        <p style="color:var(--muted-fg);max-width:520px;margin:.75rem auto 0;line-height:1.8">
          Based on your answers, here are our top picks for your skin ritual.
        </p>
        <button class="btn-outline" style="margin-top:1.5rem;font-size:.78rem" onclick="goTo('quiz')">
          Retake quiz
        </button>
      </div>
      ${recommended.length
        ? `<div class="products-grid">${recommended.map(productTileHTML).join('')}</div>`
        : `<p style="text-align:center;color:var(--muted-fg);margin-bottom:2rem">
             Explore our full collection for your skin type.
           </p>
           <div style="text-align:center">
             <button class="btn-primary" onclick="goTo('shop')">Shop all products</button>
           </div>`
      }
    </div>`;
  _syncBadges();
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARED UTILITY — PAGINATION HTML
   ═══════════════════════════════════════════════════════════════════════ */
function _paginationHTML(pages, current, fn) {
  if (pages <= 1) return '';
  return Array.from({ length: pages }, (_, i) => {
    const n = i + 1;
    const active = n === current;
    return `<button
      style="padding:.55rem 1rem;border:1px solid var(--charcoal);
             background:${active ? 'var(--charcoal)' : 'transparent'};
             color:${active ? 'var(--cream)' : 'var(--charcoal)'};
             cursor:pointer;font-size:.72rem;font-family:'Inter',sans-serif;min-width:2.5rem;transition:all .2s"
      onclick="${fn}(${n})">${n}</button>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════════════
   GLOBAL EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeSearch();
    closeMob();
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('open');
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   BOOT — detect current page and initialise
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  _syncBadges();

  const page = document.body.dataset.page || '';

  const pageInits = {
    home:           initHome,
    shop:           initShop,
    collection:     initCollection,
    product:        initProduct,
    cart:           initCartPage,
    checkout:       initCheckout,
    wishlist:       renderWishlist,
    login:          initLogin,
    register:       initRegister,
    account:        renderAccount,
    quiz:           initQuiz,
    'quiz-results': initQuizResults,
  };

  if (pageInits[page]) pageInits[page]();
});
