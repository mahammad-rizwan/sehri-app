const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Donation = sequelize.define('Donation', {
  id: {
    type: DataTypes.CHAR(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  user_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
  },
  donor_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  donor_phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  donor_zone: {
    type: DataTypes.ENUM('masjid', 'boys_hostel', 'stanza', 'girls'),
    allowNull: false,
  },
  is_anonymous: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: null,
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },
  proof_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: 'donations',
  underscored: true,   // maps createdAt → created_at, updatedAt → updated_at
  timestamps: true,
});

module.exports = Donation;
