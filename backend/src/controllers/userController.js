const { User, Admin, SuperAdmin, ProfileEditRequest } = require('../models');
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
    const allowedFields = ['name', 'gender', 'zone', 'address'];
    const changes = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        changes[field] = req.body[field];
      }
    });

    if (Object.keys(changes).length === 0) {
      return error(res, 'No valid fields to update', 400);
    }

    // Check if there's already a pending request
    const pending = await ProfileEditRequest.findOne({
      where: { user_id: req.user.id, status: 'pending' },
    });
    if (pending) {
      return error(res, 'You already have a pending profile edit request', 409);
    }

    const editRequest = await ProfileEditRequest.create({
      user_id: req.user.id,
      requested_changes: changes,
    });

    return success(res, { requestId: editRequest.id }, 'Profile edit request submitted. Pending admin approval.', 201);
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
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return error(res, 'Invalid status. Use approved, rejected, or pending.', 400);
    }

    const user = await User.findByPk(id);
    if (!user) return error(res, 'User not found', 404);

    if (req.userRole === 'admin' && user.zone !== req.user.zone) {
      return error(res, 'You can only manage users from your zone', 403);
    }

    await user.update({ status });
    return success(res, { id: user.id, status: user.status }, `User status set to ${status}`);
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
const promoteToAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return error(res, 'User not found', 404);

    // Check if phone already exists in admins table
    const existingAdmin = await Admin.findOne({ where: { phone: user.phone } });
    if (existingAdmin) {
      return error(res, 'User already has an admin account', 409);
    }

    // Create admin record with same name/phone, default zone
    const admin = await Admin.create({
      name: user.name,
      phone: user.phone,
      password: user.password, // use same password hash
      zone: user.zone || 'masjid',
      created_by: req.user.id,
    });

    return success(res, {
      id: admin.id,
      name: admin.name,
      phone: admin.phone,
      zone: admin.zone,
      role: 'admin',
    }, 'User promoted to admin successfully');
  } catch (err) {
    logger.error('promoteToAdmin error:', err);
    return error(res, 'Failed to promote user', 500);
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
      include: [{ model: User, attributes: ['id', 'name', 'phone', 'zone'], where: userWhere }],
      order: [['created_at', 'ASC']],
    });
    return success(res, requests);
  } catch (err) {
    logger.error('getProfileEditRequests error:', err);
    return error(res, 'Failed to fetch requests', 500);
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

    if (status === 'approved') {
      await request.User.update(request.requested_changes);
    }

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
    const { sequelize } = require('../models');
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
  listUsers,
  updateUserStatus,
  deleteUser,
  deleteMyAccount,
  promoteToAdmin,
  getProfileEditRequests,
  reviewProfileEditRequest,
};
