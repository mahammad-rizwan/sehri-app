const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/**
 * A stop the rider has ticked off as delivered, for one day's poll.
 *
 * Stored on the server rather than on the rider's phone so the checklist
 * survives the app being closed, and so a second rider (or an admin watching)
 * sees the same progress. The unique index makes a double tap harmless.
 */
const DeliveryStop = sequelize.define('DeliveryStop', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  poll_date: { type: DataTypes.DATEONLY, allowNull: false },
  marker_id: { type: DataTypes.UUID, allowNull: false },
  delivered_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  delivered_by: { type: DataTypes.UUID, allowNull: true },
  delivered_by_name: { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: 'delivery_stops',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['poll_date', 'marker_id'], name: 'delivery_stops_once' },
  ],
});

module.exports = DeliveryStop;
