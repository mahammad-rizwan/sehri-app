const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Donation = sequelize.define('Donation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true, // Allow anonymous donations
  },
  razorpay_order_id: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: true,
  },
  razorpay_payment_id: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  razorpay_signature: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR',
  },
  status: {
    type: DataTypes.ENUM('created', 'paid', 'failed', 'refunded'),
    defaultValue: 'created',
  },
  donor_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  donor_phone: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'donations',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['razorpay_order_id'] },
  ],
});

module.exports = Donation;
