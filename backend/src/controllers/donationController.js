const { Op } = require('sequelize');
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

    const is_anonymous = isAnonRaw === 'true' || isAnonRaw === true;

    if (!is_anonymous && !donor_name?.trim()) {
      return error(res, 'Donor name is required', 400);
    }

    const declaredAmount = amountRaw ? parseFloat(amountRaw) : null;
    if (declaredAmount !== null && (isNaN(declaredAmount) || declaredAmount <= 0)) {
      return error(res, 'Invalid amount', 400);
    }

    if (!req.user.zone) {
      return error(res, 'User zone is required', 400);
    }

    const donation = await Donation.create({
      id:           require('uuid').v4(),
      user_id:      req.user.id,
      donor_name:   is_anonymous ? req.user.name : (donor_name?.trim() || req.user.name),
      donor_phone:  req.user.phone,
      donor_zone:   req.user.zone,
      is_anonymous: is_anonymous ? 1 : 0,
      amount:       declaredAmount,
      status:       'pending',
      message:      message?.trim() || null,
      proof_url:    `/uploads/donations/${req.file.filename}`,
    });

    logger.info(`Donation submitted: ${donation.id} ₹${declaredAmount} by ${donation.donor_name}`);

    return success(res, {
      donationId: donation.id,
    }, 'Donation submitted successfully', 201);
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

    const donation = await Donation.findByPk(id);
    if (!donation) return error(res, 'Donation not found', 404);

    const updates = { status };

    if (status === 'paid') {
      const parsed = parseFloat(amount);
      if (!amount || isNaN(parsed) || parsed <= 0) {
        return error(res, 'A valid amount is required to accept a donation', 400);
      }
      updates.amount = parsed;
    }

    await donation.update(updates);

    logger.info(`Donation ${id} → ${status}${updates.amount ? ` ₹${updates.amount}` : ''}`);

    return success(res, fmtDonation(donation), 'Donation status updated');
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
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
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
