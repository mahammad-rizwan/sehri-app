const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getPrayerTimings, refreshPrayerTimings } = require('../controllers/prayerController');

router.get('/', getPrayerTimings);

router.post('/refresh', authenticate, authorize('super_admin'), refreshPrayerTimings);

module.exports = router;
