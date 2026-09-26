const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createReport, myReports, listReports, pendingCount, resolveReport,
} = require('../controllers/reportController');

router.use(authenticate);

// Anyone signed in can report what they can see, and follow their own reports.
router.post('/', createReport);
router.get('/mine', myReports);

// Reviewing is for staff; the controller narrows what each one sees.
router.get('/pending-count', authorize('admin', 'super_admin'), pendingCount);
router.get('/', authorize('admin', 'super_admin'), listReports);
router.patch('/:id', authorize('admin', 'super_admin'), resolveReport);

module.exports = router;
