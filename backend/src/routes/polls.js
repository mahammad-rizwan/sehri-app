const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getActivePoll, getActivePollStats,
  submitSpecialCase, undoSpecialCase, toggleActivePoll,
  respondToPoll, getPollStats, getPollHistory, getMyPollHistory, getPollStatsByDate, getZoneVoters,
} = require('../controllers/pollController');

// Single active poll
router.get('/active',               authenticate, getActivePoll);
router.get('/active/stats',         authenticate, authorize('admin', 'super_admin'), getActivePollStats);
router.patch('/active/toggle',      authenticate, authorize('super_admin'), toggleActivePoll);

// Keep old routes as aliases so mobile app doesn't break before update
router.get('/today',          authenticate, getActivePoll);
router.get('/tomorrow',       authenticate, getActivePoll);
router.get('/today/stats',    authenticate, authorize('admin', 'super_admin'), getActivePollStats);
router.get('/tomorrow/stats', authenticate, authorize('admin', 'super_admin'), getActivePollStats);

router.post('/:pollId/respond',       authenticate, respondToPoll);
router.post('/:pollId/special-case',       authenticate, submitSpecialCase);
router.post('/:pollId/special-case/undo',  authenticate, undoSpecialCase);
router.get('/my-responses',           authenticate, getMyPollHistory);
router.get('/history',                authenticate, authorize('admin', 'super_admin'), getPollHistory);
router.get('/date/:date/stats',       authenticate, authorize('admin', 'super_admin'), getPollStatsByDate);
router.get('/:pollId/stats',          authenticate, authorize('admin', 'super_admin'), getPollStats);
router.get('/:pollId/zone-voters',    authenticate, getZoneVoters);

module.exports = router;
