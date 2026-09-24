const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/**
 * A PG / building a user can pick during registration.
 *
 * These used to be 52 entries hardcoded in the app's theme file, which meant a
 * new PG needed an app release. They live here now so a super admin can manage
 * them, and the registration screen reads them at runtime.
 */
const ZoneAddress = sequelize.define('ZoneAddress', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  zone: {
    type: DataTypes.ENUM('masjid', 'boys_hostel', 'stanza', 'girls'),
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Hidden from registration when false, without breaking users who already picked it',
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'zone_addresses',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['zone'] }],
});

module.exports = ZoneAddress;
