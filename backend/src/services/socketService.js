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

    socket.on('join-group', (groupId) => {
      socket.join(`group:${groupId}`);
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

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

module.exports = { setupSocket, getIO };
