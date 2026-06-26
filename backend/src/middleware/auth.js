const { verifyToken } = require('../utils/jwt');
const { User, Admin, SuperAdmin, Tracking } = require('../models');
const { error } = require('../utils/response');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    let user = null;
    if (decoded.role === 'super_admin') {
      user = await SuperAdmin.findByPk(decoded.userId);
    } else if (decoded.role === 'admin') {
      user = await Admin.findByPk(decoded.userId);
    } else if (decoded.role === 'rider') {
      user = await Tracking.findByPk(decoded.userId);
      if (user) {
        // Normalise so the rest of the code can read user.zone etc.
        user.role = 'rider';
      }
    } else {
      user = await User.findByPk(decoded.userId);
    }

    if (!user) return error(res, 'Account not found', 401);

    if (decoded.role === 'user' && user.status !== 'approved') {
      return error(res, 'Your account is pending approval or has been rejected', 403);
    }

    req.user     = user;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired. Please login again.', 401);
    }
    return error(res, 'Invalid token', 401);
  }
};

/**
 * Role-based access control
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return error(res, 'Authentication required', 401);
    // Check against the role stored in JWT
    if (!roles.includes(req.userRole)) {
      return error(res, 'You do not have permission to perform this action', 403);
    }
    next();
  };
};

module.exports = { authenticate, authorize };
