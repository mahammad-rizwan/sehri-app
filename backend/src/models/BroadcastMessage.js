const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/**
 * A one-way announcement from an admin to a set of zones.
 *
 * Audience is stored as the resolved list of zones rather than a channel id,
 * because that is what actually decides who sees a message. Channels are just
 * named presets over the same four zones (see CHANNELS below), so resolving at
 * send time means a message's reach never silently changes if a preset is
 * later edited.
 *
 * Users can only read. Nothing here supports replies by design.
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
    comment: 'Preset used when sending — for grouping and display only',
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
