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
    allowNull: false,
    comment: 'Always store real user ID — is_anonymous only controls display',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Amount is manually entered by super admin after proof verification',
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
    allowNull: false,
    comment: 'Always store real name — is_anonymous only controls display',
  },
  donor_phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: 'Always store real phone — is_anonymous only controls display',
  },
  donor_zone: {
    type: DataTypes.ENUM('masjid', 'boys_hostel', 'stanza', 'girls'),
    allowNull: false,
    comment: 'Donor zone for admin filtering',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_anonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'UI display flag only — real donor info always stored in DB',
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
    { fields: ['donor_zone'] },
    { fields: ['is_anonymous'] },
  ],
});

module.exports = Donation;
