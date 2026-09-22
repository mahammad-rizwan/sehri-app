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

  if (applied.length) {
    logger.info(`🔧 Schema updated on boot: ${applied.join('; ')}`);
  } else {
    logger.info('🔧 Schema already up to date');
  }
}

module.exports = { ensureSchema };
