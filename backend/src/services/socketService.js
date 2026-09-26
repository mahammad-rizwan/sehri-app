const jwt = require('jsonwebtoken');
const { User, Admin, SuperAdmin, ChatGroupMember } = require('../models');
const logger = require('../utils/logger');

let io = null;

function setupSocket(httpServer) {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      let user = null;
      if (decoded.role === 'user') user = await User.findByPk(decoded.userId);
      else if (decoded.role === 'admin') user = await Admin.findByPk(decoded.userId);
      else if (decoded.role === 'super_admin') user = await SuperAdmin.findByPk(decoded.userId);

      if (!user) return next(new Error('User not found'));

      socket.user = { id: user.id, name: user.name, role: decoded.role };
      // Mirrored on socket.data, which is what fetchSockets() exposes — used to
      // evict a member's live connection when they are removed from a group.
      socket.data.user = socket.user;

      const memberships = await ChatGroupMember.findAll({
        where: { user_id: user.id, user_type: decoded.role },
        attributes: ['group_id'],
      });
      memberships.forEach((m) => socket.join(`group:${m.group_id}`));

      next();
    } catch (err) {
      logger.error('Socket auth error:', err.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.user.name} (${socket.user.role})`);

    /**
     * Only members may join a group's room. Without this check any signed-in
     * account — a regular user included — could emit join-group with a group
     * id and receive that chat's messages live, bypassing the membership rule
     * every REST chat route enforces.
     */
    socket.on('join-group', async (groupId) => {
      try {
        if (typeof groupId !== 'string' || !groupId) return;
        const member = await ChatGroupMember.findOne({
          where: { group_id: groupId, user_id: socket.user.id, user_type: socket.user.role },
          attributes: ['id'],
        });
        if (member) socket.join(`group:${groupId}`);
        else logger.warn(`Refused join-group ${groupId} for non-member ${socket.user.role} ${socket.user.id}`);
      } catch (err) {
        logger.error('join-group check failed:', err.message);
      }
    });

    socket.on('leave-group', (groupId) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.user.name}`);
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Drops a user's live connections out of a group's room — called when they
 * are removed, so they stop receiving its messages immediately rather than at
 * their next reconnect.
 */
async function evictFromGroup(groupId, userId) {
  if (!io) return;
  const room = `group:${groupId}`;
  const sockets = await io.in(room).fetchSockets();
  sockets
    .filter((s) => s.data?.user?.id === userId)
    .forEach((s) => s.leave(room));
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

module.exports = { setupSocket, getIO, evictFromGroup };
