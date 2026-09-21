const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/**
 * One row per syncable data source ('prayers' | 'quran' | 'dua').
 *
 * `version` is what makes a super admin's sync reach other people's phones:
 * Quran and Dua content lives in each device's AsyncStorage cache, so the
 * server cannot clear it directly. Instead the super admin bumps the version
 * here, every client compares it against the version it last cached under, and
 * rebuilds its own cache when they differ.
 */
const SyncState = sequelize.define('SyncState', {
  key: {
    type: DataTypes.STRING(32),
    primaryKey: true,
    comment: 'prayers | quran | dua',
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Bumped on every successful sync; clients bust their cache when it changes',
  },
  last_synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_synced_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Super admin name, or "system (scheduled)" for the nightly cron',
  },
  last_status: {
    type: DataTypes.ENUM('success', 'failed'),
    allowNull: true,
  },
  last_detail: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'e.g. which source the prayer timings actually came from',
  },
}, {
  tableName: 'sync_state',
  timestamps: true,
  underscored: true,
});

/** Never let a missing row break the panel — create it lazily. */
SyncState.ensure = async function ensure(key) {
  const [row] = await SyncState.findOrCreate({
    where: { key },
    defaults: { key, version: 1 },
  });
  return row;
};

SyncState.record = async function record(key, { by, status, detail, bumpVersion = false }) {
  const row = await SyncState.ensure(key);
  await row.update({
    last_synced_at: new Date(),
    last_synced_by: by,
    last_status: status,
    last_detail: detail || null,
    ...(bumpVersion && status === 'success' ? { version: row.version + 1 } : {}),
  });
  return row;
};

module.exports = SyncState;
