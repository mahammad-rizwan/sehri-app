const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getSyncStatus, getSyncVersions, syncPrayers, syncQuran, syncDua,
} = require('../controllers/syncController');

// Read by every client so it knows when to rebuild its cached Quran/Dua copy.
router.get('/versions', authenticate, getSyncVersions);

// The super admin sync panel
router.get('/status', authenticate, authorize('super_admin'), getSyncStatus);
router.post('/prayers', authenticate, authorize('super_admin'), syncPrayers);
router.post('/quran', authenticate, authorize('super_admin'), syncQuran);
router.post('/dua', authenticate, authorize('super_admin'), syncDua);

module.exports = router;
