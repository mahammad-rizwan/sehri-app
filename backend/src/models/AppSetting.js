const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

/**
 * Small key/value store for app-wide switches.
 *
 * Currently holds one thing: whether Ramadan is running. Everything Sehri —
 * the daily poll, live delivery tracking, poll history and the scheduled
 * reminders — only makes sense during Ramadan, so it all hangs off this single
 * flag rather than each feature guessing from the date.
 */
const AppSetting = sequelize.define('AppSetting', {
  key: {
    type: DataTypes.STRING(48),
    primaryKey: true,
  },
  value: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Name of the super admin who last changed it',
  },
}, {
  tableName: 'app_settings',
  timestamps: true,
  underscored: true,
});

const RAMADAN_KEY = 'ramadan_active';

/**
 * Reads a boolean setting.
 *
 * Defaults are chosen so a missing row never breaks the app — Ramadan defaults
 * to off, which hides Sehri features rather than showing a broken poll.
 */
AppSetting.getBool = async function getBool(key, fallback = false) {
  try {
    const row = await AppSetting.findByPk(key);
    if (!row) return fallback;
    return row.value === '1' || row.value === 'true';
  } catch {
    return fallback;
  }
};

AppSetting.setBool = async function setBool(key, value, by) {
  const [row] = await AppSetting.findOrCreate({
    where: { key },
    defaults: { key, value: value ? '1' : '0', updated_by: by },
  });
  await row.update({ value: value ? '1' : '0', updated_by: by });
  return row;
};

AppSetting.RAMADAN_KEY = RAMADAN_KEY;

/** Convenience used by the poll guard and the scheduled reminders. */
AppSetting.isRamadanActive = () => AppSetting.getBool(RAMADAN_KEY, false);

module.exports = AppSetting;
