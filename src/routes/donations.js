const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { error } = require('../utils/response');
const {
  submitDonation,
  updateDonationStatus,
  getDonationHistory,
  getDonationSummary,
  getDonationProof,
} = require('../controllers/donationController');

// Buffer the upload in memory — storageService decides whether it ends up on
// Cloudinary or on local disk. Keeps the 10MB cap below well within reach.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    return cb(new Error('Only image files are allowed (JPG, PNG, WEBP, GIF, HEIC, BMP)'));
  },
});

// Guests can donate too — optionalAuth attaches req.user when a token is
// present and otherwise lets the request through as a guest.
router.post('/submit', optionalAuth, upload.single('proof'), submitDonation);
router.patch('/:id/status', authenticate, authorize('super_admin'), updateDonationStatus);
router.get('/history', authenticate, getDonationHistory);
router.get('/summary', authenticate, authorize('admin', 'super_admin'), getDonationSummary);
router.get('/:id/proof', authenticate, authorize('admin', 'super_admin'), getDonationProof);

// Multer error handler (file too large / wrong type)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return error(res, err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : err.message, 400);
  }
  if (err && err.message && err.message.includes('allowed')) {
    return error(res, err.message, 400);
  }
  return next(err);
});

module.exports = router;
