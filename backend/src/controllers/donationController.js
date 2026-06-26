const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Donation } = require('../models');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * POST /donations/create-order
 * Create a Razorpay order for donation
 */
const createOrder = async (req, res) => {
  try {
    const { amount, donor_name, donor_phone, message, is_anonymous = false } = req.body;

    if (!amount || amount < 1) return error(res, 'Amount must be at least ₹1', 400);

    const amountInPaise = Math.round(parseFloat(amount) * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `sehri_${Date.now()}`,
      notes: {
        donor_name: donor_name || 'Anonymous',
        purpose: 'Sehri Food Distribution',
      },
    });

    // Store in DB
    const donation = await Donation.create({
      user_id: is_anonymous ? null : (req.user ? req.user.id : null),
      razorpay_order_id: order.id,
      amount: parseFloat(amount),
      currency: 'INR',
      status: 'created',
      donor_name: is_anonymous ? 'Anonymous' : (donor_name || req.user?.name || 'Anonymous'),
      donor_phone: is_anonymous ? null : (donor_phone || req.user?.phone),
      message,
    });

    return success(res, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      donationId: donation.id,
      key: process.env.RAZORPAY_KEY_ID,
    }, 'Order created successfully', 201);
  } catch (err) {
    logger.error('createOrder error:', err);
    return error(res, 'Failed to create payment order', 500);
  }
};

/**
 * POST /donations/verify-payment
 * Verify Razorpay payment signature
 */
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await Donation.update(
        { status: 'failed' },
        { where: { razorpay_order_id } }
      );
      return error(res, 'Payment verification failed', 400);
    }

    const donation = await Donation.update(
      {
        razorpay_payment_id,
        razorpay_signature,
        status: 'paid',
      },
      { where: { razorpay_order_id }, returning: true }
    );

    return success(res, {
      razorpay_payment_id,
      message: 'JazakAllahu Khayran! Your donation has been received.',
    }, 'Payment verified successfully');
  } catch (err) {
    logger.error('verifyPayment error:', err);
    return error(res, 'Failed to verify payment', 500);
  }
};

/**
 * GET /donations/history
 * User's donation history
 */
const getDonationHistory = async (req, res) => {
  try {
    const donations = await Donation.findAll({
      where: { user_id: req.user.id, status: 'paid' },
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
      where: { status: 'paid' },
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

module.exports = { createOrder, verifyPayment, getDonationHistory, getDonationSummary };
