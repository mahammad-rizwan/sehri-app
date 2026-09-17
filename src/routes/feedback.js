const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { submitFeedback, getAllFeedback, markFeedbackRead, getMyFeedback } = require('../controllers/feedbackController');

router.post(
  '/',
  authenticate,
  [
    body('message').trim().isLength({ min: 5, max: 1000 }).withMessage('Message must be 5-1000 characters'),
    body('category').optional().isIn(['general', 'food_quality', 'distribution', 'suggestion', 'complaint']),
    body('rating').optional().isInt({ min: 1, max: 5 }),
  ],
  validate,
  submitFeedback
);

router.get('/my', authenticate, getMyFeedback);
router.get('/', authenticate, authorize('admin', 'super_admin'), getAllFeedback);
router.patch('/:id/read', authenticate, authorize('admin', 'super_admin'), markFeedbackRead);

module.exports = router;
