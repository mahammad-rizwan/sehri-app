const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const PrayerTiming = sequelize.define('PrayerTiming', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    unique: true,
  },
  city: {
    type: DataTypes.STRING(100),
    defaultValue: 'Bangalore',
  },
  country: {
    type: DataTypes.STRING(100),
    defaultValue: 'India',
  },
  timings: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'JSON string of prayer timings from AlAdhan API',
  },
  tahajjud_time: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  date_hijri: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'prayer_timings',
  timestamps: true,
  underscored: true,
});

module.exports = PrayerTiming;
