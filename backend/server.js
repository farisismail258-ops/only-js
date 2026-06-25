'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const config       = require('./config/config');
const routes       = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');

const app = express();

/* ── Security ────────────────────────────────────────────────────────── */
app.use(helmet());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

/* ── Rate limiting ───────────────────────────────────────────────────── */
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
}));

/* ── Parsing & logging ───────────────────────────────────────────────── */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

/* ── API Routes ──────────────────────────────────────────────────────── */
app.use('/api', routes);

/* ── 404 fallback ────────────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

/* ── Global error handler ────────────────────────────────────────────── */
app.use(errorHandler);

/* ── Start server ────────────────────────────────────────────────────── */
app.listen(config.port, () => {
  console.log(`\n  ✦ LUMEVA API running on http://localhost:${config.port}`);
  console.log(`  ✦ Environment: ${config.nodeEnv}`);
  console.log(`  ✦ Health:      http://localhost:${config.port}/api/health\n`);
});

module.exports = app;
