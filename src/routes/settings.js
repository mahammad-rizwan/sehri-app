const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { getSettings, getRamadanStatus, setRamadanActive } = require('../controllers/settingsController');

// Guests need this too — it decides whether Sehri features render at all.
router.get('/', optionalAuth, getSettings);

router.get('/ramadan', authenticate, authorize('super_admin'), getRamadanStatus);
router.patch('/ramadan', authenticate, authorize('super_admin'), setRamadanActive);

module.exports = router;
