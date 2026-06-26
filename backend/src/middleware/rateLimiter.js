const rateLimit = require('express-rate-limit');
const { error } = require('../utils/response');

// General API rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // raised from 100 — handles normal app usage
  handler: (req, res) => error(res, 'Too many requests. Please try again later.', 429),
  standardHeaders: true,
  legacyHeaders: false,
});

// Tracking poll — generous limit since users poll every 20 s
// 200 req / 15 min = one poll every ~4.5 s — well within 20 s interval
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => req.ip + (req.user?.id || ''),
  handler: (req, res) => error(res, 'Too many tracking requests. Please wait a moment.', 429),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => false,
});

// Rider GPS push — rider pushes every 20 s, allow plenty of headroom
const riderPushLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip + (req.params?.id || ''),
  handler: (req, res) => error(res, 'Too many location updates.', 429),
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for OTP sending
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  keyGenerator: (req) => req.body.phone || req.ip,
  handler: (req, res) => error(res, 'Too many OTP requests. Please wait a minute.', 429),
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: (req, res) => error(res, 'Too many authentication attempts. Please try again later.', 429),
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { generalLimiter, trackingLimiter, riderPushLimiter, otpLimiter, authLimiter };
