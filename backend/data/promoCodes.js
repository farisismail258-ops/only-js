'use strict';

/**
 * Promo codes: { CODE: percentageDiscount }
 * In production swap this for a database table.
 */
const PROMO_CODES = {
  LUMEVA10:  { pct: 10,  desc: '10% off your order' },
  BEAUTY15:  { pct: 15,  desc: '15% off your order' },
  WELCOME20: { pct: 20,  desc: '20% welcome discount' },
  GLOW25:    { pct: 25,  desc: '25% glow discount'   },
  VIP30:     { pct: 30,  desc: '30% VIP discount'    },
};

module.exports = PROMO_CODES;
