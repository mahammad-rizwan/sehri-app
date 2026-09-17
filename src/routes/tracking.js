const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { trackingLimiter, riderPushLimiter } = require('../middleware/rateLimiter');
const {
  getActiveTracking, riderLogin, createRider,
  updateLocation, pushLocation, toggleRider, getAllRiders, deleteRider,
} = require('../controllers/trackingController');

// Public — rider login
router.post('/rider-login', riderLogin);

// User — get active riders (dedicated generous limiter, NOT the tight general one)
router.get('/active', authenticate, trackingLimiter, getActiveTracking);

// Rider — push live GPS every 20 s
router.patch('/:id/push-location', authenticate, riderPushLimiter, pushLocation);

// Super Admin only
router.get('/all', authenticate, authorize('super_admin'), getAllRiders);
router.post('/', authenticate, authorize('super_admin'), createRider);
router.patch('/:id/location', authenticate, authorize('super_admin'), updateLocation);
router.patch('/:id/toggle', authenticate, authorize('super_admin'), toggleRider);
router.delete('/:id', authenticate, authorize('super_admin'), deleteRider);

module.exports = router;
