const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getMe,
  requestProfileEdit,
  changePassword,
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

// Self-service password change — any signed-in role, no approval needed
router.post(
  '/change-password',
  authenticate,
  // Riders authenticate against `tracking.rider_password`, not `users.password`,
  // so they are not covered by this route.
  authorize('user', 'admin', 'super_admin'),
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  ],
  validate,
  changePassword
);

// Admin routes
router.get('/', authenticate, authorize('admin', 'super_admin'), listUsers);
router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), updateUserStatus);
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), deleteUser);
router.post('/promote/:id', authenticate, authorize('super_admin'), promoteToAdmin);

// Profile edit request management (Admin)
router.get('/profile-edit-requests', authenticate, authorize('admin', 'super_admin'), getProfileEditRequests);
router.patch('/profile-edit-requests/:id', authenticate, authorize('admin', 'super_admin'), reviewProfileEditRequest);

module.exports = router;
