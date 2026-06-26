const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const OTP = sequelize.define('OTP', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  otp: {
    type: DataTypes.STRING(512),
    allowNull: false,
  },
  purpose: {
    type: DataTypes.ENUM('login', 'register', 'forgot_password'),
    allowNull: false,
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'otps',
  indexes: [{ fields: ['phone', 'purpose'] }],
});

module.exports = OTP;
