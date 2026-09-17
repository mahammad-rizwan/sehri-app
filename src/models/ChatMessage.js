const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  group_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sender_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sender_type: {
    type: DataTypes.ENUM('super_admin', 'admin', 'user'),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  reply_to_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  reply_to_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reply_to_sender: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'chat_messages',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['group_id'] },
    { fields: ['created_at'] },
  ],
});

module.exports = ChatMessage;
