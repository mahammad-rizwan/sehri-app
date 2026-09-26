const { Feedback, User } = require('../models');
const { success, error, paginated } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * POST /feedback
 * User submits feedback
 */
const submitFeedback = async (req, res) => {
  try {
    const { message, category = 'general', rating } = req.body;

    const feedback = await Feedback.create({
      user_id: req.user.id,
      message,
      category,
      rating: rating || null,
    });

    return success(res, { id: feedback.id }, 'Feedback submitted. JazakAllahu Khayran!', 201);
  } catch (err) {
    logger.error('submitFeedback error:', err);
    return error(res, 'Failed to submit feedback', 500);
  }
};

/**
 * GET /feedback (Admin)
 * Get all feedback with filters
 */
const getAllFeedback = async (req, res) => {
  try {
    const { is_read, category, page = 1, limit = 20 } = req.query;
    const where = {};

    if (is_read !== undefined) where.is_read = is_read === 'true';
    if (category) where.category = category;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    // The form tells users it goes to *their zone admin*. Without this every
    // zone admin read every zone's feedback, with name, phone and address.
    const userWhere = req.userRole === 'admin' ? { zone: req.user.zone } : undefined;

    const { count, rows } = await Feedback.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['id', 'name', 'phone', 'zone', 'address'],
        ...(userWhere ? { where: userWhere, required: true } : {}),
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return paginated(
      res,
      rows,
      { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
    );
  } catch (err) {
    logger.error('getAllFeedback error:', err);
    return error(res, 'Failed to fetch feedback', 500);
  }
};

/**
 * PATCH /feedback/:id/read (Admin)
 */
const markFeedbackRead = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findByPk(id, {
      include: [{ model: User, attributes: ['zone'] }],
    });
    if (!feedback) return error(res, 'Feedback not found', 404);
    if (req.userRole === 'admin' && feedback.User?.zone !== req.user.zone) {
      return error(res, 'That feedback is from another zone', 403);
    }

    await feedback.update({ is_read: !feedback.is_read });
    return success(res, {}, feedback.is_read ? 'Feedback marked as read' : 'Feedback marked as unread');
  } catch (err) {
    logger.error('markFeedbackRead error:', err);
    return error(res, 'Failed to mark feedback', 500);
  }
};

/**
 * GET /feedback/my (User)
 */
const getMyFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
    });
    return success(res, feedback);
  } catch (err) {
    logger.error('getMyFeedback error:', err);
    return error(res, 'Failed to fetch feedback', 500);
  }
};

module.exports = { submitFeedback, getAllFeedback, markFeedbackRead, getMyFeedback };
