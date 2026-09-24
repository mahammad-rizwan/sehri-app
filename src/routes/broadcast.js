const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getChannels, listBroadcasts, createBroadcast, deleteBroadcast,
} = require('../controllers/broadcastController');

// Everyone signed in reads their own zone's feed.
router.get('/', authenticate, listBroadcasts);

// Sending is staff-only. Which channels they may use is decided per role
// inside the controller.
router.get('/channels', authenticate, authorize('admin', 'super_admin'), getChannels);
router.post('/', authenticate, authorize('admin', 'super_admin'), createBroadcast);
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), deleteBroadcast);

module.exports = router;
