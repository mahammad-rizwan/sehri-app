const path = require('path');
const { Op } = require('sequelize');
const { Donation } = require('../models');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * POST /donations/submit
 * Submit a donation with proof of payment (UPI transfer)
 */
const submitDonation = async (req, res) => {
  try {
    const { donor_name, message, is_anonymous: isAnonymousRaw = false } = req.body;
    const is_anonymous = isAnonymousRaw === 'true' || isAnonymousRaw === true;

    if (!req.file) {
      return error(res, 'Payment proof image is required', 400);
    }

    const name = is_anonymous
      ? 'Anonymous'
      : (donor_name || (req.user ? req.user.name : 'Anonymous'));

    const proofPath = `/uploads/donations/${req.file.filename}`;

    const donation = await Donation.create({
      user_id: is_anonymous ? null : (req.user ? req.user.id : null),
      status: 'pending',
      donor_name: name,
      donor_phone: is_anonymous ? null : (req.user ? req.user.phone : null),
      message,
      proof_url: proofPath,
    });

    logger.info(`Donation submitted: ${donation.id} by ${name}`);

    return success(res, { donationId: donation.id }, 'Donation submitted successfully', 201);
  } catch (err) {
    logger.error('submitDonation error:', err);
    return error(res, 'Failed to submit donation', 500);
  }
};

/**
 * PATCH /donations/:id/status (Super Admin)
 * Approve or reject a donation based on the submitted proof
 */
const updateDonationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['paid', 'rejected'].includes(status)) {
      return error(res, 'Invalid status. Use "paid" or "rejected"', 400);
    }

    const donation = await Donation.findByPk(id);
    if (!donation) return error(res, 'Donation not found', 404);

    donation.status = status;
    await donation.save();

    return success(res, donation, 'Donation status updated');
  } catch (err) {
    logger.error('updateDonationStatus error:', err);
    return error(res, 'Failed to update donation status', 500);
  }
};

/**
 * GET /donations/history
 * User's donation history
 */
const getDonationHistory = async (req, res) => {
  try {
    const donations = await Donation.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 20,
    });
    return success(res, donations);
  } catch (err) {
    logger.error('getDonationHistory error:', err);
    return error(res, 'Failed to fetch donation history', 500);
  }
};

/**
 * GET /donations/summary (Super Admin)
 */
const getDonationSummary = async (req, res) => {
  try {
    const { sequelize } = require('../database/connection');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const summary = await Donation.findAll({
      where: { status: 'paid' },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      raw: true,
    });

    const todaySummary = await Donation.findAll({
      where: {
        status: 'paid',
        created_at: { [Op.gte]: today, [Op.lt]: tomorrow },
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      raw: true,
    });

    const recentDonations = await Donation.findAll({
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    return success(res, {
      total_amount: summary[0].total || 0,
      total_donations: summary[0].count || 0,
      today_amount: todaySummary[0].total || 0,
      today_donations: todaySummary[0].count || 0,
      history: recentDonations,
      recent: recentDonations.slice(0, 10),
    });
  } catch (err) {
    logger.error('getDonationSummary error:', err);
    return error(res, 'Failed to fetch donation summary', 500);
  }
};

module.exports = { submitDonation, updateDonationStatus, getDonationHistory, getDonationSummary };
