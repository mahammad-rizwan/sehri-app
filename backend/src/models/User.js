const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
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
  gender: {
    type: DataTypes.ENUM('male', 'female'),
    allowNull: false,
  },
  occupation: {
    type: DataTypes.ENUM('student', 'employee', 'others'),
    allowNull: false,
    defaultValue: 'student',
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Bangalore',
  },
  area: {
    type: DataTypes.ENUM('kengeri', 'nayandahalli', 'nagarabavi', 'uttarahalli'),
    allowNull: false,
    defaultValue: 'kengeri',
  },
  zone: {
    type: DataTypes.ENUM('masjid', 'boys_hostel', 'stanza', 'girls'),
    allowNull: false,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  is_phone_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Admin's remark when rejecting; shown to the user at login so they know what to fix",
  },
  fcm_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  profile_picture: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['phone'], unique: true },
    { fields: ['status'] },
    { fields: ['zone'] },
  ],
});

module.exports = User;
