const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { createOrder, verifyPayment, getDonationHistory, getDonationSummary } = require('../controllers/donationController');

router.post('/create-order', authenticate, createOrder);
router.post('/verify-payment', authenticate, verifyPayment);
router.get('/history', authenticate, getDonationHistory);
router.get('/summary', authenticate, authorize('super_admin'), getDonationSummary);

module.exports = router;
