const { Donation } = require('../models');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmtDonation = (d) => ({
  id:           d.id,
  user_id:      d.user_id,
  donor_name:   d.donor_name,
  donor_phone:  d.donor_phone,
  donor_zone:   d.donor_zone,
  is_anonymous: Boolean(d.is_anonymous),
  amount:       d.amount !== null && d.amount !== undefined ? String(d.amount) : null,
  status:       d.status,
  message:      d.message || null,
  proof_url:    d.proof_url || null,
  created_at:   d.created_at ? new Date(d.created_at).toISOString() : null,
});

// ─── POST /donations/submit ────────────────────────────────────────────────────
const submitDonation = async (req, res) => {
  try {
    if (!req.file) {
      return error(res, 'Payment proof image is required', 400);
    }
    if (!req.user) {
      return error(res, 'Authentication required', 401);
    }

    const {
      donor_name,
      is_anonymous: isAnonRaw = 'false',
      amount: amountRaw,
      message,
    } = req.body;

    logger.info(`[submitDonation] req.body: ${JSON.stringify(req.body)}`);
    logger.info(`[submitDonation] amountRaw: "${amountRaw}" (type: ${typeof amountRaw})`);

    const is_anonymous = isAnonRaw === 'true' || isAnonRaw === true;

    if (!is_anonymous && !donor_name?.trim()) {
      return error(res, 'Donor name is required', 400);
    }

    const declaredAmount = amountRaw ? parseFloat(amountRaw) : null;
    logger.info(`[submitDonation] declaredAmount: ${declaredAmount}`);
    if (declaredAmount !== null && (isNaN(declaredAmount) || declaredAmount <= 0)) {
      return error(res, 'Invalid amount', 400);
    }

    if (!req.user.zone) {
      return error(res, 'User zone is required', 400);
    }

    const { sequelize } = require('../database/connection');
    const donationId = require('uuid').v4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await sequelize.query(`
      INSERT INTO donations
        (id, user_id, donor_name, donor_phone, donor_zone, is_anonymous, amount, status, message, proof_url, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `, {
      replacements: [
        donationId,
        req.user.id,
        is_anonymous ? req.user.name : (donor_name?.trim() || req.user.name),
        req.user.phone,
        req.user.zone,
        is_anonymous ? 1 : 0,
        declaredAmount,
        message?.trim() || null,
        `/uploads/donations/${req.file.filename}`,
        now,
        now,
      ],
    });

    logger.info(`Donation submitted: ${donationId} amount=${declaredAmount || 'null'} by ${req.user.name} (anonymous: ${is_anonymous})`);

    return success(res, { donationId }, 'Donation submitted successfully', 201);
  } catch (err) {
    logger.error('submitDonation error:', err);
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
const getDonationSummary = async (req, res) => {
  try {
    const { sequelize } = require('../database/connection');

    // Totals — only paid donations count
    const [[totals]] = await sequelize.query(`
      SELECT
        COALESCE(SUM(amount), 0)  AS total_amount,
        COUNT(*)                  AS total_donations
      FROM donations
      WHERE status = 'paid'
    `);

    // All donations — raw SQL guarantees correct created_at format
    const [rows] = await sequelize.query(`
      SELECT
        id, user_id, donor_name, donor_phone, donor_zone,
        is_anonymous, amount, status, message, proof_url,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM donations
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const donations = rows.map(d => ({
      id:           d.id,
      user_id:      d.user_id,
      donor_name:   d.donor_name,
      donor_phone:  d.donor_phone,
      donor_zone:   d.donor_zone,
      is_anonymous: Boolean(d.is_anonymous),
      amount:       d.amount !== null ? String(d.amount) : null,
      status:       d.status,
      message:      d.message || null,
      proof_url:    d.proof_url || null,
      created_at:   d.created_at,
    }));

    logger.info(`getDonationSummary: returning ${donations.length} donations. First donation created_at: ${donations[0]?.created_at}, amount: ${donations[0]?.amount}`);

    return success(res, {
      total_amount:    parseFloat(totals.total_amount),
      total_donations: parseInt(totals.total_donations),
      donations,
    });
  } catch (err) {
    logger.error('getDonationSummary error:', err);
    return error(res, 'Failed to fetch donation summary', 500);
  }
};

// ─── GET /donations/:id/proof ─────────────────────────────────────────────────
const getDonationProof = async (req, res) => {
  try {
    const donation = await Donation.findByPk(req.params.id);
    if (!donation || !donation.proof_url) {
      return res.status(404).json({ message: 'Proof not found' });
    }
    const fs   = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../', donation.proof_url);
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
