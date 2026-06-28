const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ChatGroup = sequelize.define('ChatGroup', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Super admin who created this group',
  },
}, {
  tableName: 'chat_groups',
  timestamps: true,
  underscored: true,
});

module.exports = ChatGroup;
