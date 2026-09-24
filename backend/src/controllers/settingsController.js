const { AppSetting } = require('../models');
const { notifyAllUsers } = require('../services/expoPushService');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * GET /settings
 * The app-wide switches every client needs. Deliberately readable by anyone
 * signed in — the app has to know whether to show Sehri features before it
 * knows anything else.
 */
const getSettings = async (req, res) => {
  try {
    const ramadanActive = await AppSetting.isRamadanActive();
    return success(res, { ramadanActive });
  } catch (err) {
    logger.error('getSettings error:', err);
    // Falling back to "off" hides Sehri features rather than showing a poll
    // that cannot work.
    return success(res, { ramadanActive: false });
  }
};

/**
 * GET /settings/ramadan  (super_admin)
 * Status plus who last changed it, for the control screen.
 */
const getRamadanStatus = async (req, res) => {
  try {
    const row = await AppSetting.findByPk(AppSetting.RAMADAN_KEY);
    return success(res, {
      ramadanActive: row ? (row.value === '1' || row.value === 'true') : false,
      updated_by: row?.updated_by || null,
      updated_at: row?.updatedAt || null,
    });
  } catch (err) {
    logger.error('getRamadanStatus error:', err);
    return error(res, `Failed to read Ramadan status: ${err.message}`, 500);
  }
};

/**
 * PATCH /settings/ramadan  (super_admin)
 * Starts or ends Ramadan mode across the whole app.
 */
const setRamadanActive = async (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return error(res, 'Pass active: true or false', 400);
    }

    const current = await AppSetting.isRamadanActive();
    if (current === active) {
      return error(res, `Ramadan mode is already ${active ? 'on' : 'off'}`, 409);
    }

    const by = req.user?.name || 'super admin';
    await AppSetting.setBool(AppSetting.RAMADAN_KEY, active, by);

    logger.info(`Ramadan mode turned ${active ? 'ON' : 'OFF'} by ${by}`);

    // Everyone's app changes shape, so tell them why rather than letting
    // features silently appear or vanish.
    notifyAllUsers(
      active ? '🌙 Ramadan Mubarak!' : '🌙 Ramadan has ended',
      active
        ? 'Sehri polls and live delivery tracking are now open. Cast your vote each night.'
        : 'Sehri polls and tracking are closed until next Ramadan. Prayer timings, Quran and Duas stay available.',
    ).catch((e) => logger.warn('Ramadan broadcast failed:', e.message));

    return success(res, { ramadanActive: active }, active
      ? 'Ramadan mode is on — Sehri features are now live'
      : 'Ramadan mode is off — Sehri features are hidden');
  } catch (err) {
    logger.error('setRamadanActive error:', err);
    return error(res, 'Failed to update Ramadan mode', 500);
  }
};

module.exports = { getSettings, getRamadanStatus, setRamadanActive };
