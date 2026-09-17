const { Op } = require('sequelize');
const { ChatGroup, ChatGroupMember, ChatMessage, Admin, User, SuperAdmin } = require('../models');
const { success, error, paginated } = require('../utils/response');
const logger = require('../utils/logger');
const { sendPushNotification } = require('../services/expoPushService');
const { getIO } = require('../services/socketService');

/**
 * POST /chat/groups — Create a chat group (super_admin only)
 */
const createGroup = async (req, res) => {
  try {
    const { name, member_ids } = req.body;
    if (!name || !member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return error(res, 'Group name and at least one member are required', 400);
    }

    const group = await ChatGroup.create({
      name,
      created_by: req.user.id,
    });

    const members = [{ user_id: req.user.id, user_type: 'super_admin', name: req.user.name }];

    for (const m of member_ids) {
      let person = null;
      if (m.user_type === 'admin') person = await Admin.findByPk(m.user_id);
      else if (m.user_type === 'super_admin') person = await SuperAdmin.findByPk(m.user_id);
      else if (m.user_type === 'user') person = await User.findByPk(m.user_id);
      if (person) {
        members.push({ user_id: person.id, user_type: m.user_type, name: person.name });
      } else {
        logger.warn(`createGroup: person not found for type=${m.user_type} id=${m.user_id}`);
      }
    }

    await ChatGroupMember.bulkCreate(
      members.map((m) => ({ ...m, group_id: group.id })),
      { ignoreDuplicates: true },
    );

    return success(res, { group }, 'Group created successfully', 201);
  } catch (err) {
    logger.error('createGroup error:', err);
    return error(res, 'Failed to create group', 500);
  }
};

/**
 * GET /chat/groups — List groups for current user
 */
const listGroups = async (req, res) => {
  try {
    const groups = await ChatGroup.findAll({
      include: [
        {
          model: ChatGroupMember,
          where: { user_id: req.user.id, user_type: req.userRole },
          required: true,
        },
        {
          model: ChatMessage,
          limit: 1,
          order: [['createdAt', 'DESC']],
          attributes: ['message', 'sender_name', 'createdAt'],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });

    const result = await Promise.all(groups.map(async (g) => {
      const memberCount = await ChatGroupMember.count({ where: { group_id: g.id } });
      const lastMessage = g.ChatMessages?.[0] || null;
      const membership = g.ChatGroupMembers?.[0];
      let unread_count = 0;
      const notMine = { sender_id: { [Op.ne]: req.user.id } };
      if (membership && membership.last_read_at) {
        unread_count = await ChatMessage.count({
          where: { group_id: g.id, createdAt: { [Op.gt]: membership.last_read_at }, ...notMine },
        });
      } else if (membership && !membership.last_read_at) {
        unread_count = await ChatMessage.count({ where: { group_id: g.id, ...notMine } });
      }
      return {
        id: g.id,
        name: g.name,
        created_by: g.created_by,
        member_count: memberCount,
        unread_count,
        last_message: lastMessage ? {
          message: lastMessage.message,
          sender_name: lastMessage.sender_name,
          createdAt: lastMessage.createdAt,
        } : null,
        createdAt: g.createdAt,
      };
    }));

    return success(res, result);
  } catch (err) {
    logger.error('listGroups error:', err);
    return error(res, 'Failed to list groups', 500);
  }
};

/**
 * GET /chat/groups/:id — Get group details with members (incl zone info)
 */
const getGroup = async (req, res) => {
  try {
    const group = await ChatGroup.findByPk(req.params.id);
    if (!group) return error(res, 'Group not found', 404);

    const members = await ChatGroupMember.findAll({
      where: { group_id: req.params.id },
      attributes: ['id', 'user_id', 'user_type', 'name', 'createdAt'],
    });

    // Enrich admin members with zone info
    const enriched = await Promise.all(members.map(async (m) => {
      const member = { id: m.id, user_id: m.user_id, user_type: m.user_type, name: m.name };
      if (m.user_type === 'admin') {
        const admin = await Admin.findByPk(m.user_id, { attributes: ['zone'] });
        if (admin) member.zone = admin.zone;
      }
      if (m.user_type === 'super_admin') {
        member.zone = 'all';
      }
      return member;
    }));

    return success(res, { id: group.id, name: group.name, created_by: group.created_by, members: enriched });
  } catch (err) {
    logger.error('getGroup error:', err);
    return error(res, 'Failed to get group', 500);
  }
};

/**
 * GET /chat/groups/:id/members — List group members (super_admin only)
 */
const listMembers = async (req, res) => {
  try {
    const members = await ChatGroupMember.findAll({
      where: { group_id: req.params.id },
      attributes: ['user_id', 'user_type', 'name', 'created_at'],
    });
    return success(res, members);
  } catch (err) {
    logger.error('listMembers error:', err);
    return error(res, 'Failed to list members', 500);
  }
};

/**
 * POST /chat/groups/:id/members — Add members (super_admin only)
 */
const addMembers = async (req, res) => {
  try {
    const { member_ids } = req.body;
    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return error(res, 'At least one member is required', 400);
    }

    const newMembers = [];
    for (const m of member_ids) {
      let person = null;
      if (m.user_type === 'admin') person = await Admin.findByPk(m.user_id);
      else if (m.user_type === 'super_admin') person = await SuperAdmin.findByPk(m.user_id);
      else if (m.user_type === 'user') person = await User.findByPk(m.user_id);
      if (person) {
        newMembers.push({ group_id: req.params.id, user_id: person.id, user_type: m.user_type, name: person.name });
      }
    }

    await ChatGroupMember.bulkCreate(newMembers, { ignoreDuplicates: true });

    const count = await ChatGroupMember.count({ where: { group_id: req.params.id } });
    return success(res, { member_count: count }, 'Members added successfully');
  } catch (err) {
    logger.error('addMembers error:', err);
    return error(res, 'Failed to add members', 500);
  }
};

/**
 * DELETE /chat/groups/:id/members/:userId — Remove a member (super_admin only)
 */
const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const member = await ChatGroupMember.findOne({
      where: { group_id: id, user_id: userId },
    });
    if (!member) return error(res, 'Member not found', 404);

    // Cannot remove self (the super_admin who created)
    if (member.user_type === 'super_admin') {
      return error(res, 'Cannot remove the group creator', 400);
    }

    await member.destroy();

    const count = await ChatGroupMember.count({ where: { group_id: id } });
    return success(res, { member_count: count }, 'Member removed');
  } catch (err) {
    logger.error('removeMember error:', err);
    return error(res, 'Failed to remove member', 500);
  }
};

/**
 * GET /chat/groups/:id/messages — Get messages (paginated)
 */
const getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const membership = await ChatGroupMember.findOne({
      where: { group_id: req.params.id, user_id: req.user.id, user_type: req.userRole },
    });
    if (!membership) return error(res, 'You are not a member of this group', 403);

    const { count, rows } = await ChatMessage.findAndCountAll({
      where: { group_id: req.params.id },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return paginated(res, rows.reverse(), {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    logger.error('getMessages error:', err);
    return error(res, 'Failed to fetch messages', 500);
  }
};

/**
 * POST /chat/groups/:id/messages — Send a message
 */
const sendMessage = async (req, res) => {
  try {
    const { message, reply_to_id, reply_to_message, reply_to_sender } = req.body;
    if (!message || !message.trim()) {
      return error(res, 'Message is required', 400);
    }

    const membership = await ChatGroupMember.findOne({
      where: { group_id: req.params.id, user_id: req.user.id, user_type: req.userRole },
    });
    if (!membership) return error(res, 'You are not a member of this group', 403);

    const msg = await ChatMessage.create({
      group_id: req.params.id,
      sender_id: req.user.id,
      sender_name: req.user.name,
      sender_type: req.userRole,
      message: message.trim(),
      reply_to_id: reply_to_id || null,
      reply_to_message: reply_to_message || null,
      reply_to_sender: reply_to_sender || null,
    });

    await ChatGroup.update({ updatedAt: new Date() }, { where: { id: req.params.id } });

    // Emit via Socket.IO for live delivery
    try {
      getIO().to(`group:${req.params.id}`).emit('new-message', msg);
    } catch (e) {
      logger.warn('Socket emit failed for new-message:', e.message);
    }

    // Notify all group members except the sender
    const allMembers = await ChatGroupMember.findAll({
      where: {
        group_id: req.params.id,
        [Op.not]: [{ user_id: req.user.id, user_type: req.userRole }],
      },
    });

    const group = await ChatGroup.findByPk(req.params.id, { attributes: ['name'] });
    const notifTitle = `💬 ${group?.name || 'Chat'}`;
    const notifBody = `${req.user.name}: ${message.trim().substring(0, 80)}`;

    for (const member of allMembers) {
      let person = null;
      if (member.user_type === 'admin') person = await Admin.findByPk(member.user_id, { attributes: ['fcm_token'] });
      else if (member.user_type === 'super_admin') person = await SuperAdmin.findByPk(member.user_id, { attributes: ['fcm_token'] });
      else if (member.user_type === 'user') person = await User.findByPk(member.user_id, { attributes: ['fcm_token'] });

      if (person?.fcm_token) {
        sendPushNotification(person.fcm_token, notifTitle, notifBody, { screen: 'chat', groupId: req.params.id })
          .catch((e) => logger.warn(`Chat push failed for ${member.user_id}: ${e.message}`));
      }
    }

    return success(res, msg, 'Message sent', 201);
  } catch (err) {
    logger.error('sendMessage error:', err);
    return error(res, 'Failed to send message', 500);
  }
};

/**
 * DELETE /chat/groups/:id/messages/:msgId — Delete a message
 * - Super admin can delete any message
 * - Others can only delete their own
 */
const deleteMessage = async (req, res) => {
  try {
    const { id, msgId } = req.params;

    const msg = await ChatMessage.findByPk(msgId);
    if (!msg) return error(res, 'Message not found', 404);
    if (msg.group_id !== id) return error(res, 'Message does not belong to this group', 400);

    if (req.userRole !== 'super_admin' && msg.sender_id !== req.user.id) {
      return error(res, 'You can only delete your own messages', 403);
    }

    await msg.destroy();

    try {
      getIO().to(`group:${req.params.id}`).emit('delete-message', { msgId: req.params.msgId, groupId: req.params.id });
    } catch (e) {
      logger.warn('Socket emit failed for delete-message:', e.message);
    }

    return success(res, null, 'Message deleted');
  } catch (err) {
    logger.error('deleteMessage error:', err);
    return error(res, 'Failed to delete message', 500);
  }
};

/**
 * GET /chat/admins — List all zone admins (for super_admin group creation)
 */
const listAdmins = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: ['id', 'name', 'phone', 'zone'],
      order: [['name', 'ASC']],
    });
    const superAdmins = await SuperAdmin.findAll({
      attributes: ['id', 'name', 'phone'],
      order: [['name', 'ASC']],
    });
    const all = [
      ...admins.map((a) => ({ ...a.toJSON(), user_type: 'admin' })),
      ...superAdmins.map((s) => ({ ...s.toJSON(), zone: 'all', user_type: 'super_admin' })),
    ];
    return success(res, all);
  } catch (err) {
    logger.error('listAdmins error:', err);
    return error(res, 'Failed to list users', 500);
  }
};

/**
 * DELETE /chat/groups/:id — Delete a group (super_admin only)
 */
const deleteGroup = async (req, res) => {
  try {
    const group = await ChatGroup.findByPk(req.params.id);
    if (!group) return error(res, 'Group not found', 404);
    await group.destroy();
    return success(res, null, 'Group deleted');
  } catch (err) {
    logger.error('deleteGroup error:', err);
    return error(res, 'Failed to delete group', 500);
  }
};

/**
 * POST /chat/groups/:id/read — Mark group as read for current user
 */
const markGroupRead = async (req, res) => {
  try {
    const membership = await ChatGroupMember.findOne({
      where: { group_id: req.params.id, user_id: req.user.id, user_type: req.userRole },
    });
    if (!membership) return error(res, 'You are not a member of this group', 403);
    await membership.update({ last_read_at: new Date() });
    return success(res, null, 'Marked as read');
  } catch (err) {
    logger.error('markGroupRead error:', err);
    return error(res, 'Failed to mark as read', 500);
  }
};

module.exports = { createGroup, listGroups, getGroup, listMembers, addMembers, removeMember, getMessages, sendMessage, deleteMessage, listAdmins, deleteGroup, markGroupRead };
