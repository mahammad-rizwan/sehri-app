const path = require('path');
const { Op } = require('sequelize');
const { Donation } = require('../models');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * POST /donations/submit
 * Submit a donation with proof of payment (UPI transfer)
 * IMPORTANT: Always stores real donor info (name, phone, user_id, zone)
 * is_anonymous is just a UI display flag — DB always keeps real records
 */
const submitDonation = async (req, res) => {
  try {
    const { donor_name, message, is_anonymous: isAnonymousRaw = false } = req.body;
    const is_anonymous = isAnonymousRaw === 'true' || isAnonymousRaw === true;

    if (!req.file) {
      return error(res, 'Payment proof image is required', 400);
    }

    if (!req.user) {
      return error(res, 'Authentication required', 401);
    }

    // Always require real donor name if not anonymous
    if (!is_anonymous && !donor_name?.trim()) {
      return error(res, 'Donor name is required', 400);
    }

    // Always store REAL information regardless of is_anonymous flag
    const actualName = is_anonymous ? req.user.name : (donor_name?.trim() || req.user.name);
    const actualPhone = req.user.phone;
    const actualUserId = req.user.id;
    const actualZone = req.user.zone;

    if (!actualZone) {
      return error(res, 'User zone is required for donation tracking', 400);
    }

    const proofPath = `/uploads/donations/${req.file.filename}`;

    const donation = await Donation.create({
      user_id: actualUserId,           // Always store real user ID
      status: 'pending',
      donor_name: actualName,          // Always store real name
      donor_phone: actualPhone,        // Always store real phone
      donor_zone: actualZone,          // Always store real zone
      message: message?.trim() || null,
      is_anonymous,                    // UI display flag only
      proof_url: proofPath,
    });

    logger.info(`Donation submitted: ${donation.id} by ${actualName} (anonymous: ${is_anonymous})`);

    return success(res, { 
      donationId: donation.id,
      message: 'Donation submitted successfully. Admin will verify your payment proof.',
    }, 'Donation submitted successfully', 201);
  } catch (err) {
    logger.error('submitDonation error:', err);
    return error(res, 'Failed to submit donation', 500);
  }
};

/**
 * PATCH /donations/:id/status (Super Admin)
 * Approve or reject a donation based on the submitted proof
 * Also allows updating the amount field after verification
 */
const updateDonationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, amount } = req.body;

    if (!['paid', 'rejected'].includes(status)) {
      return error(res, 'Invalid status. Use "paid" or "rejected"', 400);
    }

    const donation = await Donation.findByPk(id);
    if (!donation) return error(res, 'Donation not found', 404);

    donation.status = status;
    
    // Update amount if provided and status is paid
    if (status === 'paid' && amount) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return error(res, 'Invalid amount', 400);
      }
      donation.amount = parsedAmount;
    }
    
    await donation.save();

    logger.info(`Donation ${id} status updated to ${status}${amount ? ` with amount ${amount}` : ''}`);

    return success(res, donation, 'Donation status updated');
  } catch (err) {
    logger.error('updateDonationStatus error:', err);
    return error(res, 'Failed to update donation status', 500);
  }
};

/**
 * GET /donations/:id/proof (Admin/Super Admin)
 * Serve the donation proof image securely
 */
const getDonationProof = async (req, res) => {
  try {
    const { id } = req.params;
    const donation = await Donation.findByPk(id);
    
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    if (!donation.proof_url) {
      return res.status(404).json({ message: 'Proof not found' });
    }

    const proofPath = path.join(__dirname, '../../', donation.proof_url);
    const fs = require('fs');
    
    if (!fs.existsSync(proofPath)) {
      return res.status(404).json({ message: 'Proof file not found' });
    }

    return res.sendFile(proofPath);
  } catch (err) {
    logger.error('getDonationProof error:', err);
    return res.status(500).json({ message: 'Failed to retrieve proof' });
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
 * Returns total stats + full donation history with all details
 */
const getDonationSummary = async (req, res) => {
  try {
    const { sequelize } = require('../database/connection');
    const { User } = require('../models');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total summary (only paid donations count toward totals)
    const summary = await Donation.findAll({
      where: { status: 'paid' },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      raw: true,
    });

    // Today's summary
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

    // All donations with full details (for super admin view)
    const allDonations = await Donation.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'phone', 'zone'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    // Format donations for response
    const formattedDonations = allDonations.map(d => ({
      id: d.id,
      amount: d.amount,
      status: d.status,
      donor_name: d.donor_name,
      donor_phone: d.donor_phone,
      donor_zone: d.donor_zone,
      is_anonymous: d.is_anonymous,
      message: d.message,
      proof_url: d.proof_url,
      created_at: d.created_at,
      user_id: d.user_id,
    }));

    return success(res, {
      total_amount: parseFloat(summary[0]?.total || 0),
      total_donations: parseInt(summary[0]?.count || 0),
      today_amount: parseFloat(todaySummary[0]?.total || 0),
      today_donations: parseInt(todaySummary[0]?.count || 0),
      donations: formattedDonations,
    });
  } catch (err) {
    logger.error('getDonationSummary error:', err);
    return error(res, 'Failed to fetch donation summary', 500);
  }
};

module.exports = { submitDonation, updateDonationStatus, getDonationHistory, getDonationSummary, getDonationProof };
