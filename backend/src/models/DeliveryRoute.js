const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/**
 * The drawn delivery path: distribution point → every stop, in delivery order.
 *
 * The route is the same every night, so the road-following line is fetched from
 * Google once, stored here, and served to every map from then on. It is only
 * fetched again when a super admin presses "Regenerate map path" — which they do
 * after moving pins or changing the order. `waypoints_hash` is how the app knows
 * the stored line no longer matches the pins and says so.
 *
 * One row, keyed by `name` = 'main'.
 */
const DeliveryRoute = sequelize.define('DeliveryRoute', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
    defaultValue: 'main',
  },
  encoded_polyline: {
    // A road-following line through 30-odd stops runs to tens of kilobytes,
    // past what a plain TEXT column holds comfortably.
    type: DataTypes.TEXT('medium'),
    allowNull: false,
  },
  /** 'directions' = follows the roads; 'straight' = stop-to-stop fallback. */
  source: {
    type: DataTypes.ENUM('directions', 'straight'),
    allowNull: false,
  },
  waypoints_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  stop_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  distance_m: { type: DataTypes.INTEGER, allowNull: true },
  duration_s: { type: DataTypes.INTEGER, allowNull: true },
  generated_by: { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: 'delivery_routes',
  timestamps: true,
  underscored: true,
});

module.exports = DeliveryRoute;
