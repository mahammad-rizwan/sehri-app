const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { otpLimiter, authLimiter } = require('../middleware/rateLimiter');
const { authenticate, authorize } = require('../middleware/auth');
const {
  sendOtp, register, updatePendingRegistration, login, createAdmin, createSuperAdmin,
  listAdmins, deleteAdmin, deleteSuperAdmin, switchRole,
  getZoneAdmin, refreshToken, updateFcmToken,
  forgotPasswordSendOtp, forgotPasswordVerifyOtp, forgotPasswordReset,
} = require('../controllers/authController');

// Send OTP (for registration only - users table)
router.post(
  '/send-otp',
  otpLimiter,
  [
    body('phone').isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
    body('purpose').isIn(['register']).withMessage('Purpose must be "register"'),
  ],
  validate,
  sendOtp
);

// ── Forgot Password (users only) ──────────────────────────────────────────────

// Step 1: Send OTP — only works if user account exists with this phone
router.post(
  '/forgot-password/send-otp',
  otpLimiter,
  [
    body('phone').isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
  ],
  validate,
  forgotPasswordSendOtp
);

// Step 2: Verify OTP — must be called before reset; marks OTP as used
router.post(
  '/forgot-password/verify-otp',
  authLimiter,
  [
    body('phone').isMobilePhone('en-IN').withMessage('Valid phone number required'),
    body('otp').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP'),
  ],
  validate,
  forgotPasswordVerifyOtp
);

// Step 3: Reset password — only after OTP verified
router.post(
  '/forgot-password/reset',
  authLimiter,
  [
    body('phone').isMobilePhone('en-IN').withMessage('Valid phone number required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  ],
  validate,
  forgotPasswordReset
);

// Edit a still-pending registration — no OTP, the edit token proves identity
router.patch(
  '/pending-registration',
  authLimiter,
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('gender').optional().isIn(['male', 'female']).withMessage('Invalid gender'),
    body('occupation').optional().isIn(['student', 'employee', 'others']).withMessage('Invalid occupation'),
    body('area').optional().isIn(['kengeri', 'nayandahalli', 'nagarabavi', 'uttarahalli']).withMessage('Invalid area'),
    body('zone').optional().isIn(['masjid', 'boys_hostel', 'stanza', 'girls']).withMessage('Invalid zone'),
    body('address').optional().trim().isLength({ min: 1 }).withMessage('Address cannot be empty'),
    body('password').optional()
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  ],
  validate,
  updatePendingRegistration
);

// Register new user (with OTP verification + password - creates in users table)
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('phone').isMobilePhone('en-IN').withMessage('Valid phone number required'),
    body('gender').isIn(['male', 'female']).withMessage('Gender must be male or female'),
    body('zone').isIn(['masjid', 'boys_hostel', 'stanza', 'girls']).withMessage('Invalid zone'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('area').isIn(['kengeri', 'nayandahalli', 'nagarabavi', 'uttarahalli']).withMessage('Invalid area'),
    body('occupation').isIn(['student', 'employee', 'others']).withMessage('Invalid occupation'),
    body('otp').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP'),
  ],
  validate,
  register
);

// Login (password-based for all roles - checks correct table based on role)
router.post(
  '/login',
  authLimiter,
  [
    body('phone').isMobilePhone('en-IN').withMessage('Valid phone number required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').isIn(['user', 'admin', 'super_admin']).withMessage('Role must be user, admin, or super_admin'),
  ],
  validate,
  login
);

// Super admin creates a zone admin (user must exist and be approved)
router.post(
  '/create-admin',
  authenticate,
  authorize('super_admin'),
  [
    body('phone').isMobilePhone('en-IN').withMessage('Valid phone number required'),
    body('zone').isIn(['masjid', 'boys_hostel', 'stanza', 'girls']).withMessage('Invalid zone'),
  ],
  validate,
  createAdmin
);

// Super admin creates another super admin (user must exist and be approved)
router.post(
  '/create-super-admin',
  authenticate,
  authorize('super_admin'),
  [
    body('phone').isMobilePhone('en-IN').withMessage('Valid phone number required'),
  ],
  validate,
  createSuperAdmin
);

// List all admins (super_admin only)
router.get(
  '/list-admins',
  authenticate,
  authorize('super_admin'),
  listAdmins
);

// Super admin deletes a zone admin
router.delete(
  '/admins/:id',
  authenticate,
  authorize('super_admin'),
  deleteAdmin
);

// Super admin deletes a super admin
router.delete(
  '/super-admins/:id',
  authenticate,
  authorize('super_admin'),
  deleteSuperAdmin
);

// Switch between user/admin/super_admin roles
router.post(
  '/switch-role',
  authenticate,
  [
    body('targetRole').isIn(['user', 'admin', 'super_admin']).withMessage('Target role must be user, admin, or super_admin'),
  ],
  validate,
  switchRole
);

// Refresh token
router.post('/refresh', refreshToken);

// Update FCM token (authenticated)
router.post('/fcm-token', authenticate, updateFcmToken);

// Get zone admin for current user's zone (authenticated)
router.get('/zone-admin', authenticate, getZoneAdmin);

module.exports = router;
