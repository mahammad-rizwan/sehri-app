const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Tracking = sequelize.define('Tracking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  rider_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  rider_phone: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  map_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Google Maps URL link for live tracking',
  },
  rider_password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Hashed password for rider app login',
  },
  track_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: DataTypes.NOW,
    comment: 'Date this rider is active for',
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  zone: {
    type: DataTypes.ENUM('masjid', 'boys_hostel', 'stanza', 'girls', 'all'),
    defaultValue: 'all',
  },
  status: {
    type: DataTypes.ENUM('idle', 'delivering', 'completed'),
    defaultValue: 'idle',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  eta_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  current_address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'tracking',
  indexes: [
    { fields: ['zone'] },
    { fields: ['is_active'] },
    { fields: ['track_date'] },
  ],
});

module.exports = Tracking;
