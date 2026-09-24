const { User, Admin, SuperAdmin, ProfileEditRequest } = require('../models');
const { notifyReviewers, notifyOne } = require('../services/expoPushService');
const { success, error, paginated } = require('../utils/response');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

/**
 * GET /users/me
 * Get current user profile
 */
const getMe = async (req, res) => {
  try {
    const [existingAdmin, existingSuperAdmin] = await Promise.all([
      Admin.findOne({ where: { phone: req.user.phone } }),
      SuperAdmin.findOne({ where: { phone: req.user.phone } }),
    ]);

    return success(res, {
      id: req.user.id,
      name: req.user.name,
      phone: req.user.phone,
      gender: req.user.gender,
      zone: req.user.zone,
      address: req.user.address,
      role: req.userRole,
      status: req.user.status,
      profile_picture: req.user.profile_picture,
      last_login_at: req.user.last_login_at,
      hasAdminRole: !!existingAdmin,
      hasSuperAdminRole: !!existingSuperAdmin,
    });
  } catch (err) {
    logger.error('getMe error:', err);
    return error(res, 'Failed to fetch profile', 500);
  }
};

/**
 * POST /users/request-profile-edit
 * User requests a profile edit (admin must approve)
 */
const requestProfileEdit = async (req, res) => {
  try {
    const allowedFields = ['name', 'gender', 'zone', 'address', 'occupation', 'area'];
    const changes = {};
    const previous = {};

    allowedFields.forEach((field) => {
      if (req.body[field] === undefined) return;
      const next = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      // Ignore no-op fields so reviewers only ever see genuine changes.
      if (next === req.user[field]) return;
      changes[field] = next;
      previous[field] = req.user[field] ?? null;
    });

    if (Object.keys(changes).length === 0) {
      return error(res, 'Nothing has changed', 400);
    }

    const pending = await ProfileEditRequest.findOne({
      where: { user_id: req.user.id, status: 'pending' },
    });
    if (pending) {
      return error(res, 'You already have a pending profile edit request', 409);
    }

    const editRequest = await ProfileEditRequest.create({
      user_id: req.user.id,
      requested_changes: changes,
      previous_values: previous,
    });

    // The profile is under review, so the account goes back to pending and the
    // app signs the user out. They get back in once a reviewer approves.
    await req.user.update({ status: 'pending' });

    // Route to the admin of the zone they are currently in (not the requested
    // one) plus every super admin.
    notifyReviewers(
      req.user.zone,
      '📝 Profile Edit Request',
      `${req.user.name} requested changes to ${Object.keys(changes).join(', ')}.`,
      { screen: 'profile-edit-requests' },
    ).catch((e) => logger.warn('notifyReviewers failed:', e.message));

    logger.info(`Profile edit requested by ${req.user.phone}: ${Object.keys(changes).join(', ')}`);

    return success(res, {
      requestId: editRequest.id,
      changedFields: Object.keys(changes),
      // Tells the app to warn and then sign out.
      requiresLogout: true,
    }, 'Edit request submitted. Your account is pending approval again — you will be signed out.', 201);
  } catch (err) {
    logger.error('requestProfileEdit error:', err);
    return error(res, 'Failed to submit edit request', 500);
  }
};

/**
 * GET /users (Admin/Super Admin)
 * List all users with filters
 */
const listUsers = async (req, res) => {
  try {
    const { zone, status, search, page = 1, limit = 20 } = req.query;
    const where = {};

    if (req.userRole === 'admin') {
      where.zone = req.user.zone;
    } else if (zone) {
      where.zone = zone;
    }
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['fcm_token'] },
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
    });

    return paginated(
      res,
      rows,
      { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
    );
  } catch (err) {
    logger.error('listUsers error:', err);
    return error(res, 'Failed to fetch users', 500);
  }
};

/**
 * PATCH /users/:id/status (Admin/Super Admin)
 * Approve, reject, or set back to pending
 */
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return error(res, 'Invalid status. Use approved, rejected, or pending.', 400);
    }

    const user = await User.findByPk(id);
    if (!user) return error(res, 'User not found', 404);

    if (req.userRole === 'admin' && user.zone !== req.user.zone) {
      return error(res, 'You can only manage users from your zone', 403);
    }

    const updates = { status };
    if (status === 'rejected') {
      // The remark is the whole point of a rejection — it tells the applicant
      // what to correct before resubmitting.
      updates.rejection_reason = (rejection_reason || '').trim() || null;
    } else {
      // Approving or reverting to pending clears the old remark so a stale
      // reason is never shown again.
      updates.rejection_reason = null;
    }

    await user.update(updates);

    notifyOne(
      user.fcm_token,
      status === 'approved' ? '✅ Account Approved'
        : status === 'rejected' ? '❌ Registration Needs Changes'
        : 'ℹ️ Account Status Updated',
      status === 'approved'
        ? 'Your account has been approved. You can log in now.'
        : status === 'rejected'
          ? `${updates.rejection_reason || 'Your registration was not accepted.'} Open the app to correct your details and resubmit.`
          : 'Your account is pending review again.',
    ).catch((e) => logger.warn('notifyOne failed:', e.message));

    logger.info(`User ${user.phone} set to ${status} by ${req.userRole} ${req.user.id}`);

    return success(res, {
      id: user.id,
      status: user.status,
      rejection_reason: user.rejection_reason,
    }, `User status set to ${status}`);
  } catch (err) {
    logger.error('updateUserStatus error:', err);
    return error(res, 'Failed to update status', 500);
  }
};

/**
 * DELETE /users/:id (Admin/Super Admin)
 * Permanently delete a user account
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return error(res, 'User not found', 404);

    if (req.userRole === 'admin' && user.zone !== req.user.zone) {
      return error(res, 'You can only delete users from your zone', 403);
    }

    await user.destroy();
    logger.info(`User ${id} (${user.phone}) deleted by ${req.userRole} ${req.user.id}`);
    return success(res, {}, 'User deleted successfully');
  } catch (err) {
    logger.error('deleteUser error:', err);
    return error(res, 'Failed to delete user', 500);
  }
};

/**
 * POST /users/promote/:id (Super Admin only)
 * Promote a regular user to admin (creates record in admins table)
 */
/**
 * POST /users/promote/:id  (super_admin)
 * Promotes an existing, approved user to zone admin.
 *
 * The zone comes from the user's own account rather than being chosen — an
 * admin administers the zone they already belong to. Their existing password
 * hash carries over, so they keep signing in with the credentials they know.
 */
const promoteToAdmin = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'User not found', 404);

    if (user.status !== 'approved') {
      return error(res, 'Only an approved user can be made an admin', 400);
    }
    // Previously this silently fell back to 'masjid', which could hand someone
    // authority over a zone they have nothing to do with.
    if (!user.zone) {
      return error(res, 'This user has no zone, so there is nothing to administer', 400);
    }

    const existingAdmin = await Admin.findOne({ where: { phone: user.phone } });
    if (existingAdmin) return error(res, 'This user is already an admin', 409);

    const admin = await Admin.create({
      name: user.name,
      phone: user.phone,
      password: user.password,
      zone: user.zone,
      created_by: req.user.id,
    });

    logger.info(`${user.phone} promoted to admin of ${user.zone} by ${req.user.id}`);

    return success(res, {
      id: admin.id, name: admin.name, phone: admin.phone,
      zone: admin.zone, role: 'admin',
    }, `${user.name} is now the admin for ${user.zone.replace(/_/g, ' ')}`);
  } catch (err) {
    logger.error('promoteToAdmin error:', err);
    return error(res, 'Failed to promote user', 500);
  }
};

/**
 * POST /users/promote-super/:id  (super_admin)
 * Promotes an existing, approved user to super admin.
 *
 * Super admins are not scoped to a zone, so nothing is copied across but the
 * identity and password hash.
 */
const promoteToSuperAdmin = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'User not found', 404);

    if (user.status !== 'approved') {
      return error(res, 'Only an approved user can be made a super admin', 400);
    }

    const existing = await SuperAdmin.findOne({ where: { phone: user.phone } });
    if (existing) return error(res, 'This user is already a super admin', 409);

    const sa = await SuperAdmin.create({
      name: user.name,
      phone: user.phone,
      password: user.password,
      is_phone_verified: true,
    });

    logger.info(`${user.phone} promoted to super admin by ${req.user.id}`);

    return success(res, {
      id: sa.id, name: sa.name, phone: sa.phone, role: 'super_admin',
    }, `${user.name} is now a super admin`);
  } catch (err) {
    logger.error('promoteToSuperAdmin error:', err);
    return error(res, 'Failed to promote user', 500);
  }
};

/**
 * POST /users/change-password
 * Self-service password change for the signed-in account. No approval, no OTP —
 * knowing the current password is the proof, and the phone number is unchanged.
 * Works for users, admins and super admins alike.
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return error(res, 'Current and new password are both required', 400);
    }
    if (currentPassword === newPassword) {
      return error(res, 'Your new password must be different from your current one', 400);
    }
    if (!req.user.password) {
      return error(res, 'No password set for this account. Please contact support.', 400);
    }

    const ok = await bcrypt.compare(currentPassword, req.user.password);
    if (!ok) return error(res, 'Your current password is incorrect', 401);

    const salt = await bcrypt.genSalt(10);
    await req.user.update({ password: await bcrypt.hash(newPassword, salt) });

    logger.info(`Password changed by ${req.userRole} ${req.user.phone}`);

    return success(res, {}, 'Password changed successfully');
  } catch (err) {
    logger.error('changePassword error:', err);
    return error(res, 'Failed to change password', 500);
  }
};

/**
 * GET /users/profile-edit-requests (Admin)
 */
const getProfileEditRequests = async (req, res) => {
  try {
    const requestsWhere = { status: 'pending' };
    const userWhere = req.userRole === 'admin' ? { zone: req.user.zone } : undefined;

    const requests = await ProfileEditRequest.findAll({
      where: requestsWhere,
      include: [{ model: User, attributes: ['id', 'name', 'phone', 'zone', 'address', 'gender', 'occupation', 'area', 'status'], where: userWhere }],
      order: [['created_at', 'ASC']],
    });

    // Pre-compute the diff so every client renders the same "changed" tags.
    const shaped = requests.map((r) => {
      const changes = r.requested_changes || {};
      const previous = r.previous_values || {};
      return {
        id: r.id,
        user: r.User,
        status: r.status,
        created_at: r.createdAt,
        requested_changes: changes,
        previous_values: previous,
        // [{ field, from, to }] — drives the CHANGED tag in the admin UI.
        diff: Object.keys(changes).map((field) => ({
          field,
          from: previous[field] ?? (r.User ? r.User[field] : null) ?? null,
          to: changes[field],
        })),
      };
    });

    return success(res, shaped);
  } catch (err) {
    logger.error('getProfileEditRequests error:', err);
    const missingCol = /unknown column|doesn't exist|no such column/i.test(err.message || '');
    return error(
      res,
      missingCol
        ? 'Edit request table is out of date — restart the backend so it can update itself, or run `npm run migrate`.'
        : `Failed to fetch requests: ${err.message}`,
      500,
    );
  }
};

/**
 * PATCH /users/profile-edit-requests/:id (Admin)
 */
const reviewProfileEditRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return error(res, 'Invalid status', 400);
    }

    const request = await ProfileEditRequest.findByPk(id, {
      include: [{ model: User }],
    });
    if (!request) return error(res, 'Request not found', 404);

    if (req.userRole === 'admin' && request.User.zone !== req.user.zone) {
      return error(res, 'You can review profile edits from your zone only', 403);
    }

    await request.update({ status, reviewed_by: req.user.id, rejection_reason });

    // Submitting the request pushed the account to `pending`. Either outcome
    // has to lift that again, otherwise the user can never log back in.
    if (status === 'approved') {
      await request.User.update({ ...request.requested_changes, status: 'approved' });
    } else {
      await request.User.update({ status: 'approved' });
    }

    notifyOne(
      request.User.fcm_token,
      status === 'approved' ? '✅ Profile Changes Approved' : '❌ Profile Changes Rejected',
      status === 'approved'
        ? 'Your profile changes were approved. You can log in again.'
        : `Your profile changes were not approved${rejection_reason ? `: ${rejection_reason}` : ''}. Your previous details are unchanged and you can log in again.`,
    ).catch((e) => logger.warn('notifyOne failed:', e.message));

    logger.info(`Profile edit request ${id} ${status} by ${req.userRole} ${req.user.id}`);

    return success(res, {}, `Profile edit request ${status}`);
  } catch (err) {
    logger.error('reviewProfileEditRequest error:', err);
    return error(res, 'Failed to review request', 500);
  }
};

/**
 * DELETE /users/me
 * Delete current user's account (self-deletion)
 * Only deletes from User, Admin, and SuperAdmin tables
 * Preserves foreign key records (donations, poll responses, etc.)
 */
const deleteMyAccount = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    const userId = req.user.id;
    
    // Use transaction to ensure all deletions happen together
    const { sequelize } = require('../database/connection');
    const transaction = await sequelize.transaction();
    
    try {
      // Delete from SuperAdmin table if exists
      await SuperAdmin.destroy({ 
        where: { phone: userPhone }, 
        transaction 
      });
      
      // Delete from Admin table if exists
      await Admin.destroy({ 
        where: { phone: userPhone }, 
        transaction 
      });
      
      // Delete from User table
      await User.destroy({ 
        where: { id: userId }, 
        transaction 
      });
      
      await transaction.commit();
      
      logger.info(`User ${userId} (${userPhone}) deleted their own account`);
      return success(res, {}, 'Account deleted successfully');
    } catch (transactionErr) {
      await transaction.rollback();
      throw transactionErr;
    }
  } catch (err) {
    logger.error('deleteMyAccount error:', err);
    return error(res, 'Failed to delete account', 500);
  }
};

module.exports = {
  getMe,
  requestProfileEdit,
  changePassword,
  listUsers,
  updateUserStatus,
  deleteUser,
  deleteMyAccount,
  promoteToAdmin,
  promoteToSuperAdmin,
  getProfileEditRequests,
  reviewProfileEditRequest,
};
