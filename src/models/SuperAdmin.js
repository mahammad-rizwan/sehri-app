const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const SuperAdmin = sequelize.define('SuperAdmin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  fcm_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'super_admins',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['phone'], unique: true },
  ],
});

module.exports = SuperAdmin;
