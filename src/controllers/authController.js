const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Admin, SuperAdmin, OTP, Tracking } = require('../models');
const { saveOTP, verifyOTP, sendOTP } = require('../utils/otp');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const DISTRIBUTOR_PHONE = process.env.DISTRIBUTOR_PHONE || '9483384972';

/**
 * POST /auth/send-otp
 * Send OTP via MessageCentral for new user registration
 */
const sendOtp = async (req, res) => {
  try {
    const { phone, purpose = 'register' } = req.body;

    if (purpose === 'register') {
      const [existingUser, existingAdmin] = await Promise.all([
        User.findOne({ where: { phone } }),
        Admin.findOne({ where: { phone } }),
      ]);
      if (existingAdmin) {
        return error(res, 'This phone number is already registered. Please login.', 400);
      }
      if (existingUser && existingUser.status === 'approved') {
        return error(res, 'This phone number is already registered. Please login.', 400);
      }
      // Pending users can re-send OTP to edit their registration details
    }

    // MessageCentral handles OTP generation + SMS delivery in one call
    await sendOTP(phone, purpose);

    return success(res, { message: 'OTP sent to your phone number.' }, 'OTP sent successfully');
  } catch (err) {
    logger.error('sendOtp error:', err);
    return error(res, err.message || 'Failed to send OTP', 500);
  }
};

/**
 * POST /auth/register
 * Register new regular user with OTP verification + password
 */
const register = async (req, res) => {
  try {
    const {
      name, phone, gender, occupation, city, area, zone, address,
      password, otp,
    } = req.body;

    // Verify OTP first
    const { valid, reason } = await verifyOTP(phone, otp, 'register');
    if (!valid) return error(res, reason, 400);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if there's an existing pending registration for this phone
    let user = await User.findOne({ where: { phone } });

    if (user && user.status === 'pending') {
      // Update existing pending user's details
      await user.update({
        name,
        password: hashedPassword,
        gender,
        occupation: occupation || 'student',
        city: city || 'Bangalore',
        area: area || 'kengeri',
        zone,
        address,
        is_phone_verified: true,
      });
      logger.info(`Pending user updated: ${phone} (${name}) - zone: ${zone}`);
    } else if (user) {
      return error(res, 'This phone number is already registered. Please login.', 400);
    } else {
      // Create new user
      user = await User.create({
        name,
        phone,
        password: hashedPassword,
        gender,
        occupation: occupation || 'student',
        city: city || 'Bangalore',
        area: area || 'kengeri',
        zone,
        address,
        status: 'pending',
        is_phone_verified: true,
      });
      logger.info(`New user registered: ${phone} (${name}) - zone: ${zone}`);
    }

    return success(res, {
      userId: user.id,
      name: user.name,
      phone: user.phone,
      distributorContact: DISTRIBUTOR_PHONE,
    }, 'Registration successful! Contact the Sehri distributor at ' + DISTRIBUTOR_PHONE + ' for approval.', 201);
  } catch (err) {
    logger.error('register error:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return error(res, 'This phone number is already registered.', 400);
    }
    return error(res, 'Registration failed. Please try again.', 500);
  }
};

/**
 * POST /auth/login
 * Role-based login checking the correct table
 */
const login = async (req, res) => {
  try {
    const { phone, password, role } = req.body;

    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      return error(res, 'Please specify a valid role: user, admin, or super_admin', 400);
    }

    let user = null;

    // Query the correct table based on role
    if (role === 'super_admin') {
      user = await SuperAdmin.findOne({ where: { phone } });
    } else if (role === 'admin') {
      user = await Admin.findOne({ where: { phone } });
    } else {
      user = await User.findOne({ where: { phone } });
    }

    if (!user) {
      return error(res, 'Account not found. Please check your role selection or register first.', 404);
    }

    // Check password
    if (!user.password) {
      return error(res, 'No password set for this account. Please contact support.', 400);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return error(res, 'Invalid password. Please try again.', 401);
    }

    // Only check status for regular users
    if (role === 'user' && user.status !== 'approved') {
      if (user.status === 'pending') {
        return error(res, 'Your account is pending approval. Please contact your zone admin for approval.', 403, { status: 'pending', phone: user.phone, zone: user.zone, name: user.name, address: user.address, gender: user.gender, occupation: user.occupation, area: user.area });
      }
      if (user.status === 'rejected') {
        return error(res, 'Your account has been rejected. Please contact admin.', 403);
      }
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate tokens with the role
    const { accessToken, refreshToken } = generateTokens(user.id, role);

    // Check if user also has other roles (for mode switching)
    const [existingAdmin, existingSuperAdmin] = await Promise.all([
      Admin.findOne({ where: { phone } }),
      SuperAdmin.findOne({ where: { phone } }),
    ]);

    // Build response - different fields for different roles
    const userResponse = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role,
      zone: user.zone || null,
      hasAdminRole: !!existingAdmin,
      hasSuperAdminRole: !!existingSuperAdmin,
    };

    // Add user-specific fields
    if (role === 'user') {
      Object.assign(userResponse, {
        gender: user.gender,
        city: user.city,
        area: user.area,
        status: user.status,
        profile_picture: user.profile_picture,
      });
    }

    return success(res, {
      accessToken,
      refreshToken,
      user: userResponse,
    }, 'Login successful');
  } catch (err) {
    logger.error('login error:', err);
    return error(res, 'Login failed', 500);
  }
};

/**
 * POST /auth/create-admin
 * Super admin creates a zone admin (stored in admins table)
 */
const createAdmin = async (req, res) => {
  try {
    const { phone: adminPhone, zone } = req.body;

    // User must exist and be approved
    const existingUser = await User.findOne({ where: { phone: adminPhone } });
    if (!existingUser) {
      return error(res, 'No user found with this phone number. User must register first.', 404);
    }
    if (existingUser.status !== 'approved') {
      return error(res, 'User must be approved before being made an admin.', 400);
    }

    // Check not already admin
    const existingAdmin = await Admin.findOne({ where: { phone: adminPhone } });
    if (existingAdmin) {
      return error(res, 'This user is already an admin.', 400);
    }

    // Check not already super admin
    const existingSuperAdmin = await SuperAdmin.findOne({ where: { phone: adminPhone } });
    if (existingSuperAdmin) {
      return error(res, 'This user is already a super admin.', 400);
    }

    const admin = await Admin.create({
      name: existingUser.name,
      phone: adminPhone,
      password: existingUser.password,
      zone,
    });

    logger.info(`New admin created: ${adminPhone} (${existingUser.name}) - zone: ${zone} by super admin ${req.user.id}`);

    return success(res, {
      id: admin.id,
      name: admin.name,
      phone: admin.phone,
      role: 'admin',
      zone: admin.zone,
    }, 'Admin created successfully', 201);
  } catch (err) {
    logger.error('createAdmin error:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return error(res, 'This phone number is already registered.', 400);
    }
    return error(res, 'Failed to create admin', 500);
  }
};

/**
 * POST /auth/create-super-admin
 * Super admin creates another super admin (stored in super_admins table)
 */
const createSuperAdmin = async (req, res) => {
  try {
    const { phone: saPhone } = req.body;

    // User must exist and be approved
    const existingUser = await User.findOne({ where: { phone: saPhone } });
    if (!existingUser) {
      return error(res, 'No user found with this phone number. User must register first.', 404);
    }
    if (existingUser.status !== 'approved') {
      return error(res, 'User must be approved before being made a super admin.', 400);
    }

    // Check not already super admin
    const existingSA = await SuperAdmin.findOne({ where: { phone: saPhone } });
    if (existingSA) {
      return error(res, 'This user is already a super admin.', 400);
    }

    const superAdmin = await SuperAdmin.create({
      name: existingUser.name,
      phone: saPhone,
      password: existingUser.password,
    });

    logger.info(`New super admin created: ${saPhone} (${existingUser.name}) by super admin ${req.user.id}`);

    return success(res, {
      id: superAdmin.id,
      name: superAdmin.name,
      phone: superAdmin.phone,
      role: 'super_admin',
    }, 'Super admin created successfully', 201);
  } catch (err) {
    logger.error('createSuperAdmin error:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return error(res, 'This phone number is already registered.', 400);
    }
    return error(res, 'Failed to create super admin', 500);
  }
};

/**
 * GET /auth/list-admins
 * Super admin lists all admins and super admins from both tables
 */
const listAdmins = async (req, res) => {
  try {
    const [admins, superAdmins] = await Promise.all([
      Admin.findAll({
        attributes: ['id', 'name', 'phone', 'zone', 'created_at'],
        order: [['created_at', 'DESC']],
      }),
      SuperAdmin.findAll({
        attributes: ['id', 'name', 'phone', 'created_at'],
        order: [['created_at', 'DESC']],
      }),
    ]);

    const allAdmins = [
      ...admins.map(a => ({
        id: a.id,
        name: a.name,
        phone: a.phone,
        role: 'admin',
        zone: a.zone,
        created_at: a.created_at,
      })),
      ...superAdmins.map(sa => ({
        id: sa.id,
        name: sa.name,
        phone: sa.phone,
        role: 'super_admin',
        zone: null,
        created_at: sa.created_at,
      })),
    ];

    allAdmins.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return success(res, allAdmins);
  } catch (err) {
    logger.error('listAdmins error:', err);
    return error(res, 'Failed to fetch admins', 500);
  }
};

/**
 * POST /auth/refresh-token
 * Refresh access token - looks up user in correct table based on decoded role
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return error(res, 'Refresh token required', 400);

    const decoded = verifyRefreshToken(token);
    if (!decoded) return error(res, 'Invalid or expired refresh token', 401);

    let user = null;
    if (decoded.role === 'super_admin') {
      user = await SuperAdmin.findByPk(decoded.userId);
    } else if (decoded.role === 'admin') {
      user = await Admin.findByPk(decoded.userId);
    } else if (decoded.role === 'rider') {
      // Riders live in `tracking`, not `users` — without this branch every
      // rider token refresh 404s and the app logs them straight back out.
      user = await Tracking.findByPk(decoded.userId);
    } else {
      user = await User.findByPk(decoded.userId);
    }

    if (!user) return error(res, 'User not found', 404);

    const tokens = generateTokens(user.id, decoded.role);
    return success(res, tokens, 'Token refreshed');
  } catch (err) {
    logger.error('refreshToken error:', err);
    return error(res, 'Failed to refresh token', 500);
  }
};

/**
 * POST /auth/update-fcm
 * Update FCM token for push notifications (works with any table)
 */
const updateFcmToken = async (req, res) => {
  try {
    const { fcm_token } = req.body;
    await req.user.update({ fcm_token });
    return success(res, {}, 'FCM token updated');
  } catch (err) {
    logger.error('updateFcmToken error:', err);
    return error(res, 'Failed to update FCM token', 500);
  }
};

/**
 * POST /auth/forgot-password/send-otp
 * Send OTP for password reset — only for existing USERS (not admins/super_admins)
 */
const forgotPasswordSendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    // Forgot password is only for regular users — admins contact super admin
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return error(res, 'No user account found with this phone number.', 404);
    }

    // Send OTP via MessageCentral
    await sendOTP(phone, 'forgot_password');

    logger.info(`Forgot-password OTP sent to ${phone}`);
    return success(res, { message: 'OTP sent to your phone number.' }, 'OTP sent successfully');
  } catch (err) {
    logger.error('forgotPasswordSendOtp error:', err);
    return error(res, err.message || 'Failed to send OTP', 500);
  }
};

/**
 * POST /auth/forgot-password/verify-otp
 * Verify the OTP before allowing password reset — returns a one-time reset token
 */
const forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Only for users
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return error(res, 'No user account found with this phone number.', 404);
    }

    // Verify OTP — this marks it as used on success
    const { valid, reason } = await verifyOTP(phone, otp, 'forgot_password');
    if (!valid) return error(res, reason, 400);

    logger.info(`Forgot-password OTP verified for ${phone}`);
    return success(res, { verified: true }, 'OTP verified. You may now reset your password.');
  } catch (err) {
    logger.error('forgotPasswordVerifyOtp error:', err);
    return error(res, 'OTP verification failed', 500);
  }
};

/**
 * POST /auth/forgot-password/reset
 * Reset password — only allowed after OTP has been verified via verify-otp
 */
const OTP_RESET_WINDOW_MINUTES = 10;

const forgotPasswordReset = async (req, res) => {
  try {
    const { phone, newPassword } = req.body;

    // Only for regular users
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return error(res, 'Account not found.', 404);
    }

    // Require a successfully verified OTP within the last 10 minutes
    const verifiedOtp = await OTP.findOne({
      where: { phone, purpose: 'forgot_password', verified_at: { [Op.ne]: null } },
      order: [['verified_at', 'DESC']],
    });
    if (!verifiedOtp) {
      return error(res, 'OTP verification required before resetting your password.', 400);
    }
    const verifiedAt = new Date(verifiedOtp.verified_at);
    if (Date.now() - verifiedAt.getTime() > OTP_RESET_WINDOW_MINUTES * 60 * 1000) {
      return error(res, 'OTP has expired. Please request a new OTP.', 400);
    }

    // Hash new password and save
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await user.update({ password: hashedPassword });

    // Invalidate the verification so it cannot be reused
    await verifiedOtp.update({ verified_at: null, is_used: true });

    logger.info(`Password reset successful for ${phone}`);
    return success(res, {}, 'Password reset successfully. Please login with your new password.');
  } catch (err) {
    logger.error('forgotPasswordReset error:', err);
    return error(res, 'Failed to reset password', 500);
  }
};

/**
 * DELETE /auth/admins/:id
 * Super admin deletes a zone admin.
 */
const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findByPk(id);
    if (!admin) return error(res, 'Admin not found', 404);

    await admin.destroy();
    logger.info(`Admin deleted: ${admin.phone} (${admin.name}) by super admin ${req.user.id}`);
    return success(res, null, 'Admin deleted successfully');
  } catch (err) {
    logger.error('deleteAdmin error:', err);
    return error(res, 'Failed to delete admin', 500);
  }
};

/**
 * DELETE /auth/super-admins/:id
 * Super admin deletes another super admin.
 */
const deleteSuperAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.id) {
      return error(res, 'You cannot delete yourself.', 400);
    }

    const sa = await SuperAdmin.findByPk(id);
    if (!sa) return error(res, 'Super admin not found', 404);

    await sa.destroy();
    logger.info(`Super admin deleted: ${sa.phone} (${sa.name}) by super admin ${req.user.id}`);
    return success(res, null, 'Super admin deleted successfully');
  } catch (err) {
    logger.error('deleteSuperAdmin error:', err);
    return error(res, 'Failed to delete super admin', 500);
  }
};

/**
 * POST /auth/switch-role
 * Switch between user and admin/super_admin roles without re-entering password.
 * Requires a valid JWT for either role. Issues a new JWT for the target role.
 */
const switchRole = async (req, res) => {
  try {
    const { targetRole } = req.body; // 'user', 'admin', or 'super_admin'
    const currentRole = req.userRole;
    const phone = req.user.phone;

    if (!targetRole || !['user', 'admin', 'super_admin'].includes(targetRole)) {
      return error(res, 'Target role must be user, admin, or super_admin', 400);
    }

    if (targetRole === currentRole) {
      return error(res, `Already in ${targetRole} mode`, 400);
    }

    // Verify the user has the target role
    const [existingAdmin, existingSuperAdmin] = await Promise.all([
      Admin.findOne({ where: { phone } }),
      SuperAdmin.findOne({ where: { phone } }),
    ]);

    if (targetRole === 'user') {
      const user = await User.findOne({ where: { phone } });
      if (!user) return error(res, 'No user account found for this phone', 404);
      if (user.status !== 'approved') return error(res, 'User account is not approved', 403);

      const { accessToken, refreshToken } = generateTokens(user.id, 'user');
      return success(res, {
        accessToken, refreshToken,
        user: {
          id: user.id, name: user.name, phone: user.phone, role: 'user',
          gender: user.gender, zone: user.zone, address: user.address,
          status: user.status,
          hasAdminRole: !!existingAdmin,
          hasSuperAdminRole: !!existingSuperAdmin,
        },
      }, `Switched to user mode`);
    }

    if (targetRole === 'admin') {
      const admin = await Admin.findOne({ where: { phone } });
      if (!admin) return error(res, 'No admin account found for this phone', 404);

      const { accessToken, refreshToken } = generateTokens(admin.id, 'admin');
      return success(res, {
        accessToken, refreshToken,
        user: {
          id: admin.id, name: admin.name, phone: admin.phone, role: 'admin', zone: admin.zone,
          hasAdminRole: true,
          hasSuperAdminRole: !!existingSuperAdmin,
        },
      }, `Switched to admin mode`);
    }

    if (targetRole === 'super_admin') {
      const sa = await SuperAdmin.findOne({ where: { phone } });
      if (!sa) return error(res, 'No super admin account found for this phone', 404);

      const { accessToken, refreshToken } = generateTokens(sa.id, 'super_admin');
      return success(res, {
        accessToken, refreshToken,
        user: {
          id: sa.id, name: sa.name, phone: sa.phone, role: 'super_admin',
          hasAdminRole: !!existingSuperAdmin,
          hasSuperAdminRole: true,
        },
      }, `Switched to super admin mode`);
    }
  } catch (err) {
    logger.error('switchRole error:', err);
    return error(res, 'Failed to switch role', 500);
  }
};

/**
 * GET /auth/zone-admin
 * Returns the admin for the authenticated user's zone (name + phone).
 */
const getZoneAdmin = async (req, res) => {
  try {
    const zone = req.user.zone;
    if (!zone) return error(res, 'User has no zone assigned', 400);

    const admin = await Admin.findOne({
      where: { zone },
      attributes: ['name', 'phone'],
    });

    if (!admin) return error(res, 'No admin found for your zone', 404);

    return success(res, { name: admin.name, phone: admin.phone, zone });
  } catch (err) {
    logger.error('getZoneAdmin error:', err);
    return error(res, 'Failed to fetch zone admin', 500);
  }
};

module.exports = {
  sendOtp,
  register,
  login,
  createAdmin,
  createSuperAdmin,
  listAdmins,
  deleteAdmin,
  deleteSuperAdmin,
  switchRole,
  getZoneAdmin,
  refreshToken,
  updateFcmToken,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
};
