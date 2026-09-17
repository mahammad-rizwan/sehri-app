const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ChatGroupMember = sequelize.define('ChatGroupMember', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  group_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_type: {
    type: DataTypes.ENUM('super_admin', 'admin', 'user'),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  last_read_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'chat_group_members',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['group_id', 'user_id', 'user_type'] },
    { fields: ['user_id'] },
  ],
});

module.exports = ChatGroupMember;
