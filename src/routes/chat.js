const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createGroup,
  listGroups,
  getGroup,
  listMembers,
  addMembers,
  removeMember,
  getMessages,
  sendMessage,
  deleteMessage,
  listAdmins,
  deleteGroup,
  markGroupRead,
} = require('../controllers/chatController');

// All chat routes require authentication
router.use(authenticate);

// Groups
router.post('/groups', authorize('super_admin'), createGroup);
router.get('/groups', listGroups);
router.get('/groups/:id', getGroup);
router.delete('/groups/:id', authorize('super_admin'), deleteGroup);

// Members
router.get('/groups/:id/members', authorize('super_admin'), listMembers);
router.post('/groups/:id/members', authorize('super_admin'), addMembers);
router.delete('/groups/:id/members/:userId', authorize('super_admin'), removeMember);

// Messages
router.get('/groups/:id/messages', getMessages);
router.post('/groups/:id/messages', sendMessage);
router.delete('/groups/:id/messages/:msgId', deleteMessage);
router.post('/groups/:id/read', markGroupRead);

// Admin list for group creation
router.get('/admins', authorize('super_admin'), listAdmins);

module.exports = router;
