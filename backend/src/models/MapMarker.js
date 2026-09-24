const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/** The pin styles a marker can use. */
const SYMBOLS = ['masjid', 'boys_hostel', 'stanza', 'girls', 'distributor'];

/**
 * A pin shown on the delivery map.
 *
 * Replaces the coordinates that were hardcoded in the app. A marker's label can
 * come from a zone address, from a zone, or be typed by hand — whichever it is,
 * the resolved text is stored in `label` so the map never has to join anything
 * at render time, and renaming an address later cannot silently move a pin.
 *
 * The map shows nothing but these: a symbol at a point, and the label on tap.
 */
const MapMarker = sequelize.define('MapMarker', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  label: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  /** How the label was chosen — kept so the edit form can reopen as it was. */
  source: {
    type: DataTypes.ENUM('address', 'zone', 'custom'),
    allowNull: false,
    defaultValue: 'custom',
  },
  address_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  zone: {
    type: DataTypes.ENUM('masjid', 'boys_hostel', 'stanza', 'girls'),
    allowNull: true,
  },
  symbol: {
    type: DataTypes.ENUM(...SYMBOLS),
    allowNull: false,
    defaultValue: 'distributor',
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'map_markers',
  timestamps: true,
  underscored: true,
});

MapMarker.SYMBOLS = SYMBOLS;

module.exports = MapMarker;
