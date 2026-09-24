const rateLimit = require('express-rate-limit');
const { error } = require('../utils/response');

/**
 * Live tracking is high-frequency by nature, so both tracking routes carry
 * their own limiter and are excluded from the general one below. Without that
 * exclusion a user simply watching the map would burn the whole 200-request
 * budget and start getting 429s on the rest of the app.
 */
const TRACKING_PATHS = /^\/api\/tracking\/(active|[^/]+\/push-location)$/;

// General API rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // raised from 100 — handles normal app usage
  skip: (req) => TRACKING_PATHS.test(req.originalUrl.split('?')[0]),
  handler: (req, res) => error(res, 'Too many requests. Please try again later.', 429),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Tracking poll — users fetch every 10 s, i.e. 90 requests per 15 min.
 * 250 leaves room for a screen being reopened and for the immediate fetch each
 * time the app returns to the foreground.
 */
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  keyGenerator: (req) => req.ip + (req.user?.id || ''),
  handler: (req, res) => error(res, 'Too many tracking requests. Please wait a moment.', 429),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => false,
});

/**
 * Rider GPS push — every 10 s is 90 requests per 15 min.
 *
 * This was 100 while the rider app pushed every 5 s (180 per window), so every
 * run died with a 429 about eight minutes in, taking live tracking and the
 * delivery geofence down with it. 250 holds even if the interval is tightened
 * back to 5 s later.
 */
const riderPushLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
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
