const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { error } = require('../utils/response');
const {
  submitDonation,
  updateDonationStatus,
  getDonationHistory,
  getDonationSummary,
} = require('../controllers/donationController');

const uploadDir = path.join(__dirname, '../../uploads/donations');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

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

router.post('/submit', authenticate, upload.single('proof'), submitDonation);
router.patch('/:id/status', authenticate, authorize('super_admin'), updateDonationStatus);
router.get('/history', authenticate, getDonationHistory);
router.get('/summary', authenticate, authorize('super_admin'), getDonationSummary);

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
