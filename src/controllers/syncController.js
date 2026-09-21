const { SyncState, PrayerTiming } = require('../models');
const { fetchAndSavePrayerTimings } = require('./prayerController');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const KEYS = ['prayers', 'quran', 'dua'];

/**
 * GET /sync/status  (super_admin)
 * Everything the three sync tabs need to render.
 */
const getSyncStatus = async (req, res) => {
  try {
    const rows = await Promise.all(KEYS.map((k) => SyncState.ensure(k)));
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

    // How many days of prayer timings we actually hold, and whether today's
    // row exists at all — the most useful signal on the namaz tab.
    const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [todayRow, total] = await Promise.all([
      PrayerTiming.findOne({ where: { date: todayIST } }),
      PrayerTiming.count(),
    ]);

    const shape = (key, extra = {}) => {
      const r = byKey[key];
      return {
        key,
        version: r.version,
        last_synced_at: r.last_synced_at,
        last_synced_by: r.last_synced_by,
        last_status: r.last_status,
        last_detail: r.last_detail,
        ...extra,
      };
    };

    return success(res, {
      prayers: shape('prayers', {
        auto: true,
        schedule: 'Daily at 00:05 IST',
        today_date: todayIST,
        today_present: !!todayRow,
        stored_days: total,
      }),
      quran: shape('quran', {
        auto: false,
        note: 'Content is static. Syncing rebuilds every device\'s cached copy.',
      }),
      dua: shape('dua', {
        auto: false,
        note: 'Content is static. Syncing rebuilds every device\'s cached copy.',
      }),
    });
  } catch (err) {
    logger.error('getSyncStatus error:', err);
    const missingTable = /doesn't exist|no such table/i.test(err.message || '');
    return error(
      res,
      missingTable
        ? 'Sync table missing — restart the backend so it can create it, or run `npm run migrate`.'
        : `Failed to load sync status: ${err.message}`,
      500,
    );
  }
};

/**
 * POST /sync/prayers  (super_admin)
 * Force a re-fetch from AlAdhan, overwriting today's stored timings.
 */
const syncPrayers = async (req, res) => {
  const by = req.user?.name || 'super admin';
  try {
    const record = await fetchAndSavePrayerTimings(true);
    const source = record?.dataValues?.__source || 'unknown';

    // Falling back to local calculation is not a failure, but the admin should
    // see it — the figures are approximations until AlAdhan is reachable again.
    const viaApi = source === 'AlAdhan API';
    await SyncState.record('prayers', {
      by,
      status: 'success',
      detail: viaApi
        ? 'Fetched from AlAdhan API'
        : 'AlAdhan unreachable — used local calculation (approximate)',
    });

    return success(res, {
      source,
      via_api: viaApi,
      date: record.date,
    }, viaApi
      ? 'Prayer timings synced from AlAdhan'
      : 'AlAdhan was unreachable — saved locally calculated timings instead');
  } catch (err) {
    logger.error('syncPrayers error:', err);
    await SyncState.record('prayers', { by, status: 'failed', detail: err.message })
      .catch(() => {});
    return error(res, 'Prayer timing sync failed', 500);
  }
};

/** Shared by the Quran and Dua tabs — both are pure cache-version bumps. */
const bumpContentVersion = (key, label) => async (req, res) => {
  const by = req.user?.name || 'super admin';
  try {
    const row = await SyncState.record(key, {
      by,
      status: 'success',
      detail: 'Cache version bumped — clients will rebuild on next open',
      bumpVersion: true,
    });

    logger.info(`${label} cache version bumped to ${row.version} by ${by}`);

    return success(res, { version: row.version }, `${label} sync triggered. Devices will refresh their cached copy next time they open it.`);
  } catch (err) {
    logger.error(`sync ${key} error:`, err);
    await SyncState.record(key, { by, status: 'failed', detail: err.message }).catch(() => {});
    return error(res, `${label} sync failed`, 500);
  }
};

/**
 * GET /sync/versions  (any signed-in account)
 * Tiny payload the app polls so it knows when to discard its cached content.
 */
const getSyncVersions = async (req, res) => {
  try {
    const [quran, dua] = await Promise.all([
      SyncState.ensure('quran'),
      SyncState.ensure('dua'),
    ]);
    return success(res, { quran: quran.version, dua: dua.version });
  } catch (err) {
    logger.error('getSyncVersions error:', err);
    // A failure here must never block the Quran or Dua screens from rendering.
    return success(res, { quran: 0, dua: 0 });
  }
};

module.exports = {
  getSyncStatus,
  getSyncVersions,
  syncPrayers,
  syncQuran: bumpContentVersion('quran', 'Quran'),
  syncDua: bumpContentVersion('dua', 'Dua'),
};
