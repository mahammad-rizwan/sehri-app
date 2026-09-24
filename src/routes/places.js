const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const {
  listAddresses, createAddress, updateAddress, deleteAddress,
  listMarkers, createMarker, updateMarker, deleteMarker,
} = require('../controllers/placesController');

// Both lists are readable without an account: registration needs the addresses
// before a user exists, and the map should draw for guests.
router.get('/addresses', optionalAuth, listAddresses);
router.get('/markers', optionalAuth, listMarkers);

// Managing them is super admin only.
router.post('/addresses', authenticate, authorize('super_admin'), createAddress);
router.patch('/addresses/:id', authenticate, authorize('super_admin'), updateAddress);
router.delete('/addresses/:id', authenticate, authorize('super_admin'), deleteAddress);

router.post('/markers', authenticate, authorize('super_admin'), createMarker);
router.patch('/markers/:id', authenticate, authorize('super_admin'), updateMarker);
router.delete('/markers/:id', authenticate, authorize('super_admin'), deleteMarker);

module.exports = router;
