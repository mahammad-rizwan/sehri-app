const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/**
 * A one-way announcement from an admin to a set of zones.
 *
 * Audience is the resolved list of zones — the sender picks zones directly,
 * there are no channel presets. Membership needs no table: a user's `zone`
 * alone decides what they receive.
 *
 * Readers are never shown the zone list; to them it is simply an announcement.
 * Users can only read — nothing here supports replies, by design.
 */
const BroadcastMessage = sequelize.define('BroadcastMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  channel_key: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'zones',
    comment: 'Legacy column, retained for storage compatibility',
  },
  zones: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Resolved audience: the zone keys that receive this message',
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [1, 2000] },
  },
  links: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'http(s) URLs pulled out of the body, for tappable rendering',
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sender_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sender_role: {
    type: DataTypes.ENUM('admin', 'super_admin'),
    allowNull: false,
  },
}, {
  tableName: 'broadcast_messages',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['channel_key'] }, { fields: ['created_at'] }],
});

module.exports = BroadcastMessage;
