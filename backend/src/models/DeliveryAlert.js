const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/**
 * One row per delivery notification actually sent to one person.
 *
 * This table exists for exactly one reason: the unique index below. The rider's
 * phone pushes its GPS every 5 seconds, so a rider sitting inside a 200 m
 * radius would re-trigger the same geofence ~12 times a minute. The index makes
 * a second insert for the same (day, person, kind) fail, so `findOrCreate`
 * tells us whether we are the first — and only then do we push.
 *
 * It doubles as an audit trail: who was told what, when, and from which marker.
 */
const DeliveryAlert = sequelize.define('DeliveryAlert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  poll_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date of the poll this delivery belongs to, not the calendar date of the run',
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  kind: {
    type: DataTypes.ENUM('on_the_way', 'doorstep'),
    allowNull: false,
  },
  marker_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Which map marker triggered it — null for the on_the_way broadcast',
  },
  rider_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'delivery_alerts',
  timestamps: true,
  underscored: true,
  indexes: [
    // The whole point of the table — one alert of each kind per person per day.
    { unique: true, fields: ['poll_date', 'user_id', 'kind'], name: 'delivery_alerts_once' },
    { fields: ['poll_date'] },
  ],
});

module.exports = DeliveryAlert;
