const { sequelize } = require('./connection');
const logger = require('../utils/logger');

/**
 * Idempotent schema top-up, run on every boot.
 *
 * `migrate.js` has to be invoked by hand, which means a deploy can ship code
 * that queries a table or column the database does not have yet — the feature
 * then fails with an opaque "failed to fetch" and nothing explains why. This
 * closes that gap for the small, additive changes that shipped after the
 * original schema.
 *
 * Deliberately additive only: it creates missing tables and adds missing
 * nullable columns. It never drops or alters anything.
 */
async function ensureSchema() {
  const qi = sequelize.getQueryInterface();
  const applied = [];

  // ── sync_state (super admin Sync Data panel) ───────────────────────────────
  try {
    const tables = await qi.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName).toLowerCase());

    if (!names.includes('sync_state')) {
      const SyncState = require('../models/SyncState');
      await SyncState.sync();
      applied.push('created table sync_state');
    }

    // Seed the three known sources so the panel never renders empty.
    for (const key of ['prayers', 'quran', 'dua']) {
      await sequelize.query(
        'INSERT IGNORE INTO sync_state (`key`, version, created_at, updated_at) VALUES (?, 1, NOW(), NOW())',
        { replacements: [key] },
      );
    }
  } catch (err) {
    logger.error(`ensureSchema: sync_state step failed — ${err.message}`);
  }

  // ── profile_edit_requests.previous_values (before → after display) ─────────
  try {
    const cols = await qi.describeTable('profile_edit_requests');
    if (!cols.previous_values) {
      await sequelize.query(
        'ALTER TABLE profile_edit_requests ADD COLUMN previous_values JSON NULL',
      );
      applied.push('added profile_edit_requests.previous_values');
    }
  } catch (err) {
    // Table may not exist yet on a fresh database — sync/seed will create it.
    if (!/doesn't exist|no such table/i.test(err.message)) {
      logger.error(`ensureSchema: previous_values step failed — ${err.message}`);
    }
  }

  // ── users.rejection_reason (remark shown to a rejected applicant) ─────────
  try {
    const cols = await qi.describeTable('users');
    if (!cols.rejection_reason) {
      await sequelize.query('ALTER TABLE users ADD COLUMN rejection_reason TEXT NULL');
      applied.push('added users.rejection_reason');
    }
  } catch (err) {
    logger.error(`ensureSchema: rejection_reason step failed — ${err.message}`);
  }

  // ── donations: allow guest submissions ────────────────────────────────────
  try {
    const cols = await qi.describeTable('donations');

    if (!cols.is_guest) {
      await sequelize.query(
        'ALTER TABLE donations ADD COLUMN is_guest TINYINT(1) NOT NULL DEFAULT 0',
      );
      applied.push('added donations.is_guest');
    }
    // A guest has neither an account nor a delivery zone, so these two stop
    // being required. Existing rows are unaffected.
    if (cols.user_id && cols.user_id.allowNull === false) {
      await sequelize.query('ALTER TABLE donations MODIFY user_id CHAR(36) NULL');
      applied.push('donations.user_id now nullable');
    }
    if (cols.donor_zone && cols.donor_zone.allowNull === false) {
      await sequelize.query(
        "ALTER TABLE donations MODIFY donor_zone ENUM('masjid','boys_hostel','stanza','girls') NULL",
      );
      applied.push('donations.donor_zone now nullable');
    }
  } catch (err) {
    logger.error(`ensureSchema: donations guest step failed — ${err.message}`);
  }

  // ── broadcast_messages ────────────────────────────────────────────────────
  try {
    const tables = await qi.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName).toLowerCase());
    if (!names.includes('broadcast_messages')) {
      await require('../models/BroadcastMessage').sync();
      applied.push('created table broadcast_messages');
    }
  } catch (err) {
    logger.error(`ensureSchema: broadcast_messages step failed — ${err.message}`);
  }

  // ── app_settings (Ramadan mode switch) ────────────────────────────────────
  try {
    const tables = await qi.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName).toLowerCase());
    if (!names.includes('app_settings')) {
      await require('../models/AppSetting').sync();
      applied.push('created table app_settings');
    }
  } catch (err) {
    logger.error(`ensureSchema: app_settings step failed — ${err.message}`);
  }

  // ── zone_addresses + map_markers, seeded from what was hardcoded ─────────
  try {
    const tables = await qi.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName).toLowerCase());

    const ZoneAddress = require('../models/ZoneAddress');
    const MapMarker = require('../models/MapMarker');

    if (!names.includes('zone_addresses')) {
      await ZoneAddress.sync();
      applied.push('created table zone_addresses');
    }
    if (!names.includes('map_markers')) {
      await MapMarker.sync();
      applied.push('created table map_markers');
    }

    // First run only: carry across the addresses and pins that used to live in
    // the app bundle, so nothing disappears the moment this ships.
    const seed = require('./seedPlaces.json');

    if ((await ZoneAddress.count()) === 0) {
      const rows = [];
      for (const [zone, names_] of Object.entries(seed.addresses || {})) {
        for (const name of names_) rows.push({ name, zone });
      }
      if (rows.length) {
        await ZoneAddress.bulkCreate(rows, { ignoreDuplicates: true });
        applied.push(`seeded ${rows.length} zone addresses`);
      }
    }

    if ((await MapMarker.count()) === 0) {
      const rows = (seed.zonePoints || []).map(([key, title, lat, lng]) => ({
        label: title, source: 'zone', zone: key === 'distributor' ? null : key,
        symbol: key, latitude: Number(lat), longitude: Number(lng),
      }));
      (seed.girlsPoints || []).forEach(([lat, lng], i) => rows.push({
        label: `Girls Zone Point ${i + 1}`, source: 'custom',
        symbol: 'girls', latitude: Number(lat), longitude: Number(lng),
      }));
      if (rows.length) {
        await MapMarker.bulkCreate(rows);
        applied.push(`seeded ${rows.length} map markers`);
      }
    }
  } catch (err) {
    logger.error(`ensureSchema: places step failed — ${err.message}`);
  }

  if (applied.length) {
    logger.info(`🔧 Schema updated on boot: ${applied.join('; ')}`);
  } else {
    logger.info('🔧 Schema already up to date');
  }
}

module.exports = { ensureSchema };
