const { Donation } = require('../models');
const { success, error } = require('../utils/response');
const { saveDonationProof, streamRemoteProof, localUploadDir } = require('../services/storageService');
const logger = require('../utils/logger');

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmtDonation = (d) => ({
  id:           d.id,
  user_id:      d.user_id,
  donor_name:   d.donor_name,
  donor_phone:  d.donor_phone,
  donor_zone:   d.donor_zone,
  is_guest:     Boolean(d.is_guest),
  is_anonymous: Boolean(d.is_anonymous),
  amount:       d.amount !== null && d.amount !== undefined ? String(d.amount) : null,
  status:       d.status,
  message:      d.message || null,
  proof_url:    d.proof_url || null,
  created_at:   d.created_at ? new Date(d.created_at).toISOString() : null,
});

// ─── POST /donations/submit ────────────────────────────────────────────────────
const PHONE_RE = /^[6-9]\d{9}$/;

/**
 * Accepts a donation from a signed-in user or a guest.
 *
 * A signed-in user's identity comes off the token. A guest supplies their own
 * name and phone, and has no delivery zone — `donor_zone` is genuinely unknown
 * for them rather than something to guess, so it is stored as NULL and shown
 * as "Guest" in the admin panel.
 */
const submitDonation = async (req, res) => {
  try {
    if (!req.file) {
      return error(res, 'Payment proof image is required', 400);
    }

    const {
      donor_name,
      donor_phone: guestPhone,
      is_anonymous: isAnonRaw = 'false',
      amount: amountRaw,
      message,
    } = req.body;

    const isGuest = !req.user;
    const is_anonymous = isAnonRaw === 'true' || isAnonRaw === true;

    let name, phone, zone, userId;

    if (isGuest) {
      // Anonymity hides the name in the UI, but we still need something to
      // put against the record, and a phone number is the only way to reach a
      // guest about their donation.
      const trimmedName = (donor_name || '').trim();
      if (!is_anonymous && !trimmedName) {
        return error(res, 'Please enter your name, or choose to donate anonymously', 400);
      }
      const trimmedPhone = (guestPhone || '').trim();
      if (!PHONE_RE.test(trimmedPhone)) {
        return error(res, 'Please enter a valid 10-digit mobile number', 400);
      }

      name   = trimmedName || 'Guest Donor';
      phone  = trimmedPhone;
      zone   = null;
      userId = null;
    } else {
      if (!req.user.zone) {
        return error(res, 'User zone is required', 400);
      }
      name   = is_anonymous ? req.user.name : ((donor_name || '').trim() || req.user.name);
      phone  = req.user.phone;
      zone   = req.user.zone;
      userId = req.user.id;
    }

    const declaredAmount = amountRaw ? parseFloat(amountRaw) : null;
    if (declaredAmount !== null && (isNaN(declaredAmount) || declaredAmount <= 0)) {
      return error(res, 'Invalid amount', 400);
    }

    const { sequelize } = require('../database/connection');
    const donationId = require('uuid').v4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Cloudinary when configured, local disk otherwise. Throws
    // PROOF_UPLOAD_FAILED rather than silently losing the proof.
    const proofUrl = await saveDonationProof(req.file);

    await sequelize.query(`
      INSERT INTO donations
        (id, user_id, donor_name, donor_phone, donor_zone, is_guest, is_anonymous, amount, status, message, proof_url, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `, {
      replacements: [
        donationId,
        userId,
        name,
        phone,
        zone,
        isGuest ? 1 : 0,
        is_anonymous ? 1 : 0,
        declaredAmount,
        message?.trim() || null,
        proofUrl,
        now,
        now,
      ],
    });

    logger.info(`Donation submitted: ${donationId} by ${isGuest ? `guest ${phone}` : req.user.name}`);

    return success(res, { donationId, isGuest }, 'Donation submitted successfully', 201);
  } catch (err) {
    logger.error('submitDonation error:', err);
    if (err.message === 'PROOF_UPLOAD_FAILED') {
      return error(
        res,
        'We could not save your payment proof just now, so the donation was not recorded. Please try again in a moment.',
        503,
      );
    }
    return error(res, 'Failed to submit donation', 500);
  }
};

// ─── PATCH /donations/:id/status ──────────────────────────────────────────────
const updateDonationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, amount } = req.body;

    if (!['paid', 'rejected'].includes(status)) {
      return error(res, 'Status must be "paid" or "rejected"', 400);
    }

    if (status === 'paid') {
      const parsed = parseFloat(amount);
      if (!amount || isNaN(parsed) || parsed <= 0) {
        return error(res, 'A valid amount is required to accept a donation', 400);
      }
    }

    const { sequelize } = require('../database/connection');

    // Check exists
    const [[existing]] = await sequelize.query(
      'SELECT id, status, amount FROM donations WHERE id = ? LIMIT 1',
      { replacements: [id] }
    );
    if (!existing) return error(res, 'Donation not found', 404);

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (status === 'paid') {
      const parsed = parseFloat(amount);
      await sequelize.query(
        'UPDATE donations SET status = ?, amount = ?, updated_at = ? WHERE id = ?',
        { replacements: ['paid', parsed, now, id] }
      );
      logger.info(`Donation ${id} → paid ₹${parsed}`);
      return success(res, { id, status: 'paid', amount: String(parsed) }, 'Donation accepted');
    } else {
      await sequelize.query(
        'UPDATE donations SET status = ?, updated_at = ? WHERE id = ?',
        { replacements: ['rejected', now, id] }
      );
      logger.info(`Donation ${id} → rejected`);
      return success(res, { id, status: 'rejected' }, 'Donation rejected');
    }
  } catch (err) {
    logger.error('updateDonationStatus error:', err);
    return error(res, 'Failed to update donation status', 500);
  }
};

// ─── GET /donations/history (user's own) ──────────────────────────────────────
const getDonationHistory = async (req, res) => {
  try {
    const donations = await Donation.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    return success(res, donations.map(fmtDonation));
  } catch (err) {
    logger.error('getDonationHistory error:', err);
    return error(res, 'Failed to fetch donation history', 500);
  }
};

// ─── GET /donations/summary (super admin) ─────────────────────────────────────
const ZONES = ['masjid', 'boys_hostel', 'stanza', 'girls'];
const STATUSES = ['pending', 'paid', 'rejected'];
const LIMITS = [20, 30, 40, 50];

/**
 * Filtered donation list plus the totals the admin panel needs.
 *
 * Query params (all optional):
 *   zone   masjid | boys_hostel | stanza | girls | all   (default all)
 *   status pending | paid | rejected | all               (default all)
 *   limit  20 | 30 | 40 | 50 | all                        (default 20)
 *
 * Filtering runs in SQL rather than the client so a long donation history does
 * not get shipped to the phone just to be thrown away.
 */
const getDonationSummary = async (req, res) => {
  try {
    const { sequelize } = require('../database/connection');

    // Guests have no zone, so they are their own bucket rather than being
    // lumped in with a real one.
    const guestOnly = req.query.zone === 'guest';
    const zone = guestOnly ? null : (ZONES.includes(req.query.zone) ? req.query.zone : null);
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;

    const rawLimit = req.query.limit;
    const limit = rawLimit === 'all'
      ? null
      : (LIMITS.includes(parseInt(rawLimit, 10)) ? parseInt(rawLimit, 10) : 20);

    // ── Filtered list ────────────────────────────────────────────────────────
    const where = [];
    const params = [];
    if (guestOnly) { where.push('is_guest = 1'); }
    else if (zone) { where.push('donor_zone = ?'); params.push(zone); }
    if (status)    { where.push('status = ?');     params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await sequelize.query(`
      SELECT
        id, user_id, donor_name, donor_phone, donor_zone, is_guest,
        is_anonymous, amount, status, message, proof_url,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM donations
      ${whereSql}
      ORDER BY created_at DESC
      ${limit ? 'LIMIT ?' : ''}
    `, { replacements: limit ? [...params, limit] : params });

    // How many match the filter in total, so the UI can say "20 of 87".
    const [[matching]] = await sequelize.query(
      `SELECT COUNT(*) AS n FROM donations ${whereSql}`,
      { replacements: params },
    );

    // ── Totals: always all-time and verified-only, never filtered ───────────
    const [[totals]] = await sequelize.query(`
      SELECT
        COALESCE(SUM(amount), 0)  AS total_amount,
        COUNT(*)                  AS total_donations
      FROM donations
      WHERE status = 'paid'
    `);

    // ── Counts per status within the selected zone, for the filter chips ────
    const zoneOnly = guestOnly ? 'WHERE is_guest = 1' : (zone ? 'WHERE donor_zone = ?' : '');
    const [[counts]] = await sequelize.query(`
      SELECT
        SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'paid'     THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        COUNT(*) AS all_count
      FROM donations ${zoneOnly}
    `, { replacements: (!guestOnly && zone) ? [zone] : [] });

    const donations = rows.map(d => ({
      id:           d.id,
      user_id:      d.user_id,
      donor_name:   d.donor_name,
      donor_phone:  d.donor_phone,
      donor_zone:   d.donor_zone,
      is_guest:     Boolean(d.is_guest),
      is_anonymous: Boolean(d.is_anonymous),
      amount:       d.amount !== null ? String(d.amount) : null,
      status:       d.status,
      message:      d.message || null,
      proof_url:    d.proof_url || null,
      created_at:   d.created_at,
    }));

    return success(res, {
      total_amount:    parseFloat(totals.total_amount),
      total_donations: parseInt(totals.total_donations),
      status_counts: {
        pending:  parseInt(counts.pending  || 0),
        paid:     parseInt(counts.paid     || 0),
        rejected: parseInt(counts.rejected || 0),
        all:      parseInt(counts.all_count || 0),
      },
      applied: { zone: guestOnly ? 'guest' : (zone || 'all'), status: status || 'all', limit: limit || 'all' },
      total_matching: parseInt(matching.n),
      donations,
    });
  } catch (err) {
    logger.error('getDonationSummary error:', err);
    return error(res, `Failed to fetch donation summary: ${err.message}`, 500);
  }
};

// ─── GET /donations/:id/proof ─────────────────────────────────────────────────
const getDonationProof = async (req, res) => {
  try {
    const donation = await Donation.findByPk(req.params.id);
    if (!donation || !donation.proof_url) {
      return res.status(404).json({ message: 'Proof not found' });
    }

    // Remote (Cloudinary) proofs are streamed through this authenticated route
    // so the underlying URL is never handed to a client.
    if (/^https?:\/\//i.test(donation.proof_url)) {
      try {
        return await streamRemoteProof(donation.proof_url, res);
      } catch (streamErr) {
        logger.error('getDonationProof remote fetch error:', streamErr.message);
        if (res.headersSent) return res.end();
        return res.status(502).json({ message: 'Could not retrieve proof from storage' });
      }
    }

    // Legacy rows written before Cloudinary was configured still live on disk.
    const fs   = require('fs');
    const path = require('path');
    const safeName = path.basename(donation.proof_url);
    const filePath = path.join(localUploadDir, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Proof file not found on disk' });
    }
    return res.sendFile(filePath);
  } catch (err) {
    logger.error('getDonationProof error:', err);
    return res.status(500).json({ message: 'Failed to retrieve proof' });
  }
};

module.exports = {
  submitDonation,
  updateDonationStatus,
  getDonationHistory,
  getDonationSummary,
  getDonationProof,
};
