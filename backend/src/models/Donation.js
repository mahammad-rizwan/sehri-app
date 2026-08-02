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
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true, // Amount is manually verified after proof review
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR',
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'rejected'),
    defaultValue: 'pending',
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
  proof_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'donations',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
  ],
});

module.exports = Donation;
