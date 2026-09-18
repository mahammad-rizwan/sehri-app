const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getMe,
  requestProfileEdit,
  listUsers,
  updateUserStatus,
  deleteUser,
  deleteMyAccount,
  promoteToAdmin,
  getProfileEditRequests,
  reviewProfileEditRequest,
} = require('../controllers/userController');

// User routes
router.get('/me', authenticate, getMe);
router.delete('/me', authenticate, deleteMyAccount);
router.post('/request-profile-edit', authenticate, requestProfileEdit);

// Admin routes
router.get('/', authenticate, authorize('admin', 'super_admin'), listUsers);
router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), updateUserStatus);
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), deleteUser);
router.post('/promote/:id', authenticate, authorize('super_admin'), promoteToAdmin);

// Profile edit request management (Admin)
router.get('/profile-edit-requests', authenticate, authorize('admin', 'super_admin'), getProfileEditRequests);
router.patch('/profile-edit-requests/:id', authenticate, authorize('admin', 'super_admin'), reviewProfileEditRequest);

module.exports = router;
