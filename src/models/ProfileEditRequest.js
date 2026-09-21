const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ProfileEditRequest = sequelize.define('ProfileEditRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  requested_changes: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'JSON of fields user wants to change',
  },
  previous_values: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Snapshot of the same fields before the request, so reviewers can see before -> after',
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  reviewed_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'profile_edit_requests',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
  ],
});

module.exports = ProfileEditRequest;
