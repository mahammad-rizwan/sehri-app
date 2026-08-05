const { Poll, PollResponse, User } = require('../models');
const { sendPollEnabledNotification, sendPollDisabledNotification, sendPushNotification } = require('../services/expoPushService');
const { success, error } = require('../utils/response');
const { sequelize } = require('../database/connection');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// ─── Shared helpers ───────────────────────────────────────────────────────────
//
// Poll window: 10 PM (22:00) → 10 AM (10:00) IST next day
//
// User poll date logic:
//   10 PM on 23rd → voting for 24th's Sehri  (date = 24th)
//   2 AM on 24th  → still voting for 24th's Sehri (date = 24th)
//   10 AM on 24th → window closes
//   10 PM on 24th → voting for 25th's Sehri  (date = 25th)
//
// Admin poll date logic:
//   Always show TODAY's calendar date poll (IST midnight–11:59 PM)
//   If today's date poll exists in DB → use it
//   If not → fall back to the currently active voting poll
//
// Daily phases (IST):
//   voting        : 22:00 → 10:00  (main voting window)
//   special_case  : 10:00 → 17:00  (submit special case: want / dont_want)
//   allotment     : 17:00 → 18:00  (super admin allots Sehri to special cases)
//   status        : 18:00 → 22:00  (users see final Sehri status + zone voters)
//
// ─────────────────────────────────────────────────────────────────────────────

function getISTNow() {
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + istOffset);
}

function dateToIST(d) {
  return d.toISOString().split('T')[0];
}

function displayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

// Returns the poll DATE (YYYY-MM-DD IST) that users are currently voting on.
// Window: 22:00 (10 PM) → 10:00 (10 AM)
// If hour >= 22 → voting for NEXT day's Sehri (date = tomorrow IST)
// If hour < 10  → voting for TODAY's Sehri (date = today IST) — window still open from last night
// If 10 <= hour < 22 → window closed (return today IST, but poll will be closed on UI)
function getActivePollDate() {
  const istNow = getISTNow();
  const istHour = istNow.getUTCHours(); // UTC hours of IST-shifted time = IST hours

  const dateObj = new Date(istNow);
  if (istHour >= 22) {
    // 10 PM or later → poll is for tomorrow
    dateObj.setUTCDate(dateObj.getUTCDate() + 1);
  }
  // istHour < 10: still open from last night, date = today IST (correct as-is)
  // 10 <= istHour < 22: closed, date = today IST (correct as-is)
  return dateToIST(dateObj);
}

// Returns today's calendar date in IST (always 12 AM–11:59 PM)
function getTodayISTDate() {
  return dateToIST(getISTNow());
}

// Returns whether the poll window is currently open
function isPollWindowOpen() {
  const istHour = getISTNow().getUTCHours();
  return istHour >= 22 || istHour < 10;
}

// Current IST hour
function istHour() {
  return getISTNow().getUTCHours();
}

// 10:00 AM – 5:00 PM — special case submission window
function isSpecialCaseWindow() {
  const h = istHour();
  return h >= 10 && h < 17;
}

// 5:00 PM – 6:00 PM — super admin allotment window
function isAllotmentWindow() {
  const h = istHour();
  return h >= 17 && h < 18;
}

// 6:00 PM – 10:00 PM — final Sehri status display window
function isStatusWindow() {
  const h = istHour();
  return h >= 18 && h < 22;
}

// Current phase: 'voting' | 'special_case' | 'allotment' | 'status' | 'closed'
function getPhase() {
  if (isPollWindowOpen()) return 'voting';
  if (isSpecialCaseWindow()) return 'special_case';
  if (isAllotmentWindow()) return 'allotment';
  if (isStatusWindow()) return 'status';
  return 'closed';
}

// Find or create poll by date — uses findOrCreate to prevent race condition
// duplicate entry errors when multiple requests hit simultaneously.
async function findOrCreatePoll(dateStr) {
  const [poll, created] = await Poll.findOrCreate({
    where: { date: dateStr },
    defaults: {
      question: 'Will you be having Sehri food?',
      is_active: isPollWindowOpen(),
    },
  });

  if (!created) {
    // Poll already existed — sync is_active with time window unless manually overridden
    const shouldBeOpen = isPollWindowOpen();

    if (poll.deadline_time) {
      // Manual override exists — check if the time window has transitioned
      const overrideHour = parseInt(poll.deadline_time.split(':')[0], 10);
      const wasWindowOpen = overrideHour >= 22 || overrideHour < 10;

      if (wasWindowOpen !== shouldBeOpen) {
        // Window boundary was crossed — clear override and resync
        const needsUpdate = poll.is_active !== shouldBeOpen;
        const updateFields = needsUpdate
          ? { is_active: shouldBeOpen, deadline_time: null }
          : { deadline_time: null };
        await poll.update(updateFields);
        poll.is_active = shouldBeOpen;
      }
      // else: still in the same window → keep the manual override
    } else {
      // No manual override → always sync with the time window
      if (poll.is_active !== shouldBeOpen) {
        await poll.update({ is_active: shouldBeOpen });
        poll.is_active = shouldBeOpen;
      }
    }
  }

  return poll;
}

/**
 * GET /polls/active
 * User: get the currently active poll they should vote on.
 * Uses getActivePollDate() — 10 PM on 23rd → date = 24th, 2 AM on 24th → date = 24th
 */
const getActivePoll = async (req, res) => {
  try {
    const dateStr = getActivePollDate();
    const poll = await findOrCreatePoll(dateStr);

    const userResponse = await PollResponse.findOne({
      where: { poll_id: poll.id, user_id: req.user.id },
    });

    const zone = req.user.zone;
    const zoneYesCount = await PollResponse.count({
      where: zone ? { poll_id: poll.id, response: 'yes', zone } : { poll_id: poll.id, response: 'yes' },
    });

    return success(res, {
      poll,
      date: dateStr,
      displayLabel: displayLabel(dateStr),
      // isWindowOpen = poll.is_active (auto-synced with time unless super admin overrode it)
      isWindowOpen: poll.is_active,
      isPollActive: poll.is_active,
      phase: getPhase(),
      userResponse: userResponse ? userResponse.response : null,
      isSpecialCase: userResponse ? (userResponse.is_special_case || false) : false,
      specialCaseType: userResponse ? (userResponse.special_case_type || null) : null,
      zoneYesCount,
    });
  } catch (err) {
    logger.error('getActivePoll error:', err);
    return error(res, 'Failed to fetch active poll', 500);
  }
};

/**
 * GET /polls/active/stats
 * Admin/Super_admin:
 *   Always shows TODAY's calendar date poll (IST 12 AM–11:59 PM).
 *   Never shows the next day's poll even if it's the active voting window.
 *   Creates today's poll if it doesn't exist yet.
 */
const getActivePollStats = async (req, res) => {
  try {
    const todayStr = getTodayISTDate();

    // Always show today's calendar date poll — admins never see tomorrow's
    let poll = await Poll.findOne({ where: { date: todayStr } });
    let dateStr = todayStr;

    if (!poll) {
      poll = await findOrCreatePoll(todayStr);
    }

    const isSuperAdmin = req.userRole === 'super_admin';
    // Both admin and super_admin see ALL zones — no zone filter restriction
    const zones = ['masjid', 'boys_hostel', 'stanza', 'girls'];

    // Only count "yes" votes from known zones — excludes stale legacy zone values
    const totalYes = await PollResponse.count({
      where: { poll_id: poll.id, response: 'yes', is_special_case: false, zone: zones },
    });

    // Special cases — people who changed mind after window

    // Helper to build special case list with name + zone + address + time + type
    async function getSpecialCases(extraWhere) {
      const rows = await PollResponse.findAll({
        where: { poll_id: poll.id, is_special_case: true, ...extraWhere },
        include: [{ model: User, attributes: ['id', 'name', 'address', 'zone'] }],
        order: [['special_case_at', 'DESC']],
      });
      return rows.map((r) => ({
        id: r.User?.id,
        name: r.User?.name || 'Unknown',
        zone: r.User?.zone || r.zone,
        address: r.User?.address || '',
        type: r.special_case_type,
        time: r.special_case_at,
      }));
    }

    // Both admin and super_admin get the same full response — all zones, all data
    const zoneData = {};
    for (const zone of zones) {
      const voters = await PollResponse.findAll({
        where: { poll_id: poll.id, response: 'yes', is_special_case: false, zone },
        include: [{ model: User, attributes: ['id', 'name', 'address', 'zone'] }],
        order: [[{ model: User, as: 'User' }, 'address', 'ASC']],
      });
      const specialCases = await getSpecialCases({ zone });
      zoneData[zone] = {
        yesCount: voters.length,
        voters: voters.map((v) => ({
          id: v.User?.id,
          name: v.User?.name || 'Unknown',
          address: v.User?.address || '',
          zone: v.User?.zone || zone,
        })),
        specialCaseCount: specialCases.length,
        specialCases,
      };
    }
    const allSpecialCases = await getSpecialCases({ zone: zones });
    return success(res, {
      poll, date: dateStr, displayLabel: displayLabel(dateStr),
      isPollActive: poll.is_active,
      totalYes, specialCaseCount: allSpecialCases.length,
      zones: zoneData,
    });
  } catch (err) {
    logger.error('getActivePollStats error:', err);
    return error(res, 'Failed to fetch active poll stats', 500);
  }
};

/**
 * POST /polls/:pollId/special-case
 * Submit a special case AFTER the poll window has closed.
 * type = 'dont_want': voted yes, now doesn't want Sehri
 * type = 'want':      voted no or didn't vote, now wants Sehri
 * This does NOT change the main response — just marks a special case flag.
 */
/**
 * POST /polls/:pollId/special-case/undo
 * Undo a special case — clears the special case flags but keeps the original vote.
 */
const undoSpecialCase = async (req, res) => {
  try {
    if (!isSpecialCaseWindow()) {
      return error(res, 'Special case window is open only from 10:00 AM to 5:00 PM', 403);
    }

    const { pollId } = req.params;
    const pollResponse = await PollResponse.findOne({
      where: { poll_id: pollId, user_id: req.user.id, is_special_case: true },
    });
    if (!pollResponse) return error(res, 'No special case found to undo', 404);

    await pollResponse.update({
      is_special_case: false,
      special_case_type: null,
      special_case_at: null,
      sehri_allowed: null,
      sehri_allotted_at: null,
    });

    logger.info(`Special case undone by user ${req.user.id} on poll ${pollId}`);
    return success(res, null, 'Special case undone');
  } catch (err) {
    logger.error('undoSpecialCase error:', err);
    return error(res, 'Failed to undo special case', 500);
  }
};

const submitSpecialCase = async (req, res) => {
  try {
    if (!isSpecialCaseWindow()) {
      return error(res, 'Special case window is open only from 10:00 AM to 5:00 PM', 403);
    }

    const { pollId } = req.params;
    const { type } = req.body; // 'want' | 'dont_want'

    if (!['want', 'dont_want'].includes(type)) {
      return error(res, 'type must be "want" or "dont_want"', 400);
    }

    const poll = await Poll.findByPk(pollId);
    if (!poll) return error(res, 'Poll not found', 404);

    // Find or create the response row for this user
    let pollResponse = await PollResponse.findOne({
      where: { poll_id: pollId, user_id: req.user.id },
    });

    if (pollResponse) {
      // Update existing row with special case info
      await pollResponse.update({
        is_special_case: true,
        special_case_type: type,
        special_case_at: new Date(),
        sehri_allowed: null,
        sehri_allotted_at: null,
      });
    } else {
      // User never voted — create a row (response = 'no' as default base)
      pollResponse = await PollResponse.create({
        poll_id: pollId,
        user_id: req.user.id,
        response: 'no',
        zone: req.user.zone,
        is_special_case: true,
        special_case_type: type,
        special_case_at: new Date(),
      });
    }

    logger.info(`Special case [${type}] by user ${req.user.id} on poll ${pollId}`);
    return success(res, {
      is_special_case: true,
      special_case_type: type,
      special_case_at: pollResponse.special_case_at,
    }, 'Special case recorded');
  } catch (err) {
    logger.error('submitSpecialCase error:', err);
    return error(res, 'Failed to record special case', 500);
  }
};
const respondToPoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { response } = req.body;

    if (!['yes', 'no'].includes(response)) {
      return error(res, 'Response must be yes or no', 400);
    }

    const poll = await Poll.findByPk(pollId);
    if (!poll || !poll.is_active) return error(res, 'Poll not found or inactive', 404);

    const [pollResponse, created] = await PollResponse.upsert({
      poll_id: pollId,
      user_id: req.user.id,
      response,
      zone: req.user.zone,
    });

    return success(
      res,
      { response: pollResponse.response },
      created ? 'Response submitted' : 'Response updated'
    );
  } catch (err) {
    logger.error('respondToPoll error:', err);
    return error(res, 'Failed to submit response', 500);
  }
};

/**
 * GET /polls/date/:date/stats
 * Admin/Super admin: get full stats (zone breakdown + voters) for a specific date.
 * Admin sees only their zone; super admin sees all zones.
 */
const getPollStatsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const poll = await Poll.findOne({ where: { date } });
    if (!poll) return error(res, 'Poll not found for this date', 404);

    const isSuperAdmin = req.userRole === 'super_admin';
    const zones = ['masjid', 'boys_hostel', 'stanza', 'girls'];
    const zoneFilter = isSuperAdmin ? {} : { zone: req.user.zone };

    const totalYes = await PollResponse.count({
      where: { poll_id: poll.id, response: 'yes', is_special_case: false, zone: zones, ...zoneFilter },
    });

    const allSpecialCases = await PollResponse.findAll({
      where: { poll_id: poll.id, is_special_case: true, ...zoneFilter },
      include: [{ model: User, attributes: ['id', 'name', 'address', 'zone'] }],
      order: [['special_case_at', 'DESC']],
    });

    const zoneData = {};
    const targetZones = isSuperAdmin ? zones : [req.user.zone];
    for (const zone of targetZones) {
      const voters = await PollResponse.findAll({
        where: { poll_id: poll.id, response: 'yes', is_special_case: false, zone },
        include: [{ model: User, attributes: ['id', 'name', 'address', 'zone'] }],
        order: [[{ model: User, as: 'User' }, 'address', 'ASC']],
      });
      zoneData[zone] = {
        yesCount: voters.length,
        voters: voters.map((v) => ({
          id: v.User?.id,
          name: v.User?.name || 'Unknown',
          address: v.User?.address || '',
          zone: v.User?.zone || zone,
        })),
      };
    }

    return success(res, {
      poll, date,
      totalYes,
      zones: zoneData,
      specialCases: allSpecialCases.map((r) => ({
        id: r.User?.id,
        name: r.User?.name || 'Unknown',
        zone: r.User?.zone || r.zone,
        address: r.User?.address || '',
        type: r.special_case_type,
        time: r.special_case_at,
      })),
    });
  } catch (err) {
    logger.error('getPollStatsByDate error:', err);
    return error(res, 'Failed to fetch poll stats for date', 500);
  }
};

/**
 * GET /polls/:pollId/stats (Admin only — by specific poll ID)
 */
const getPollStats = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findByPk(pollId);
    if (!poll) return error(res, 'Poll not found', 404);

    const roleWhere = req.userRole === 'admin' ? { zone: req.user.zone } : {};
    const totalYes = await PollResponse.count({ where: { poll_id: pollId, response: 'yes', ...roleWhere } });
    const totalNo  = await PollResponse.count({ where: { poll_id: pollId, response: 'no',  ...roleWhere } });

    const zoneStats = await PollResponse.findAll({
      where: { poll_id: pollId, response: 'yes', ...roleWhere },
      attributes: ['zone', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['zone'],
      raw: true,
    });

    const zones = ['masjid', 'boys_hostel', 'stanza', 'girls'];
    const zoneBreakdown = {};
    zones.forEach((z) => { zoneBreakdown[z] = 0; });
    zoneStats.forEach((row) => { zoneBreakdown[row.zone] = parseInt(row.count); });

    return success(res, {
      poll,
      stats: { total_yes: totalYes, total_no: totalNo, total_responses: totalYes + totalNo, zone_breakdown: zoneBreakdown },
    });
  } catch (err) {
    logger.error('getPollStats error:', err);
    return error(res, 'Failed to fetch stats', 500);
  }
};

/**
 * GET /polls/history (Admin)
 */
/**
 * GET /polls/my-responses
 * User: get their own poll response history with dates.
 */
const getMyPollHistory = async (req, res) => {
  try {
    const responses = await PollResponse.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Poll, attributes: ['date', 'question', 'is_active'] }],
      attributes: ['id', 'response', 'is_special_case', 'special_case_type', 'createdAt'],
      order: [[Poll, 'date', 'DESC']],
    });

    const allPolls = await Poll.findAll({
      attributes: ['date'],
      order: [['date', 'DESC']],
    });

    return success(res, {
      responses: responses.map((r) => ({
        id: r.id,
        response: r.response,
        is_special_case: r.is_special_case,
        special_case_type: r.special_case_type,
        date: r.Poll?.date,
        question: r.Poll?.question,
        createdAt: r.createdAt,
      })),
      pollDates: allPolls.map((p) => p.date),
    });
  } catch (err) {
    logger.error('getMyPollHistory error:', err);
    return error(res, 'Failed to fetch poll history', 500);
  }
};

const getPollHistory = async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const polls = await Poll.findAll({ order: [['date', 'DESC']], limit: parseInt(limit) });
    return success(res, polls);
  } catch (err) {
    logger.error('getPollHistory error:', err);
    return error(res, 'Failed to fetch poll history', 500);
  }
};

/**
 * GET /polls/:pollId/zone-voters
 */
const getZoneVoters = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findByPk(pollId);
    if (!poll) return error(res, 'Poll not found', 404);

    const voters = await PollResponse.findAll({
      where: { poll_id: pollId, response: 'yes', is_special_case: false, zone: req.user.zone },
      include: [{ model: User, attributes: ['id', 'name', 'address', 'zone'] }],
      order: [[{ model: User, as: 'User' }, 'address', 'ASC']],
    });

    const voterList = voters.map((v) => ({
      id: v.User?.id,
      name: v.User?.name || 'Unknown',
      address: v.User?.address || '',
      zone: v.User?.zone || v.zone,
    }));
    return success(res, { voters: voterList, count: voterList.length });
  } catch (err) {
    logger.error('getZoneVoters error:', err);
    return error(res, 'Failed to fetch zone voters', 500);
  }
};

/**
 * PATCH /polls/active/toggle
 * Super admin: toggle poll open/closed, overriding the time window.
 * Stores the IST hour of override in deadline_time so findOrCreatePoll
 * can auto-resync when the window flips (10 AM or 10 PM).
 * - Toggle ON:  sets is_active=true,  deadline_time=current IST hour
 * - Toggle OFF: sets is_active=false, deadline_time=current IST hour
 */
const toggleActivePoll = async (req, res) => {
  try {
    const dateStr = getActivePollDate();
    const poll = await Poll.findOne({ where: { date: dateStr } });
    const currentPoll = poll || await Poll.create({
      date: dateStr,
      question: 'Will you be having Sehri food?',
      is_active: isPollWindowOpen(),
    });

    const newState = !currentPoll.is_active;
    // Store the IST hour of override in deadline_time so findOrCreatePoll
    // can detect when the time window transitions and resume auto-sync.
    const now = getISTNow();
    const overrideHour = String(now.getUTCHours()).padStart(2, '0');
    await currentPoll.update({ is_active: newState, deadline_time: `${overrideHour}:00:00` });

    logger.info(`Poll ${dateStr} manually set to is_active=${newState} by super admin ${req.user.id}`);

    try {
      if (newState) {
        await sendPollEnabledNotification(dateStr);
      } else {
        await sendPollDisabledNotification(dateStr);
      }
    } catch (err) {
      logger.error('sendPollNotification error:', err.message);
    }

    return success(res, {
      date: dateStr,
      displayLabel: displayLabel(dateStr),
      is_active: newState,
      isWindowOpen: newState,
    }, `Poll ${newState ? 'opened' : 'closed'} successfully`);
  } catch (err) {
    logger.error('toggleActivePoll error:', err);
    return error(res, 'Failed to toggle poll', 500);
  }
};

/**
 * GET /polls/special-cases  (super_admin only)
 * Dedicated special-case page data for today's calendar poll.
 * - dontWant: opted out (no Sehri) — shown first
 * - want:     requested Sehri — sorted by request time (who asked first)
 */
const getSpecialCases = async (req, res) => {
  try {
    const todayStr = getTodayISTDate();
    const poll = await Poll.findOne({ where: { date: todayStr } });
    if (!poll) {
      return success(res, {
        poll: null, date: todayStr, displayLabel: displayLabel(todayStr),
        phase: getPhase(), allotmentOpen: isAllotmentWindow(),
        specialWindow: { from: '10:00', to: '17:00' },
        allotmentWindow: { from: '17:00', to: '18:00' },
        dontWant: [], want: [],
      });
    }

    const specials = await PollResponse.findAll({
      where: { poll_id: poll.id, is_special_case: true },
      include: [{ model: User, attributes: ['id', 'name', 'phone', 'address', 'zone'] }],
    });

    const dontWant = [];
    const want = [];
    for (const r of specials) {
      const item = {
        userId: r.User?.id,
        name: r.User?.name || 'Unknown',
        phone: r.User?.phone || '',
        zone: r.User?.zone || r.zone,
        address: r.User?.address || '',
        time: r.special_case_at,
        sehriAllowed: r.sehri_allowed,
        allottedAt: r.sehri_allotted_at,
      };
      if (r.special_case_type === 'dont_want') dontWant.push(item);
      else want.push(item);
    }
    dontWant.sort((a, b) => new Date(a.time) - new Date(b.time));
    want.sort((a, b) => new Date(a.time) - new Date(b.time));

    return success(res, {
      poll, date: todayStr, displayLabel: displayLabel(todayStr),
      phase: getPhase(), allotmentOpen: isAllotmentWindow(),
      specialWindow: { from: '10:00', to: '17:00' },
      allotmentWindow: { from: '17:00', to: '18:00' },
      dontWant, want,
    });
  } catch (err) {
    logger.error('getSpecialCases error:', err);
    return error(res, 'Failed to fetch special cases', 500);
  }
};

/**
 * POST /polls/special-cases/allot  (super_admin only, 5:00 PM – 6:00 PM strict)
 * Body: { userIds: [uuid, ...] } — special-case 'want' users to allot Sehri.
 * - want users in the list  → Sehri allotted (confirmed)
 * - want users not in list  → not allotted (no Sehri)
 * - dont_want users         → always no Sehri
 * Sends a push notification to every special-case user afterwards.
 */
const allotSpecialCases = async (req, res) => {
  try {
    if (!isAllotmentWindow()) {
      return error(res, 'Sehri allotment is allowed only between 5:00 PM and 6:00 PM', 403);
    }

    const { userIds } = req.body;
    if (!Array.isArray(userIds)) return error(res, 'userIds array is required', 400);
    const allowedSet = new Set(userIds);

    const todayStr = getTodayISTDate();
    const poll = await Poll.findOne({ where: { date: todayStr } });
    if (!poll) return error(res, 'No poll found for today', 404);

    const specials = await PollResponse.findAll({
      where: { poll_id: poll.id, is_special_case: true },
    });
    if (specials.length === 0) return error(res, 'No special cases for today', 404);

    const now = new Date();
    let allotted = 0;
    let notAllotted = 0;

    for (const r of specials) {
      if (r.special_case_type !== 'want') {
        await r.update({ sehri_allowed: false, sehri_allotted_at: now });
        continue;
      }
      const allowed = allowedSet.has(r.user_id);
      await r.update({ sehri_allowed: allowed, sehri_allotted_at: now });
      if (allowed) allotted += 1;
      else notAllotted += 1;
    }

    // Notify every special-case user: allotted → confirmed, others → no Sehri
    const users = await User.findAll({
      where: { id: { [Op.in]: specials.map((s) => s.user_id) } },
      attributes: ['id', 'name', 'fcm_token'],
    });
    const decisionMap = {};
    specials.forEach((s) => { decisionMap[s.user_id] = s.special_case_type === 'want' && allowedSet.has(s.user_id); });

    const pushPromises = [];
    for (const u of users) {
      if (!decisionMap[u.id] || !u.fcm_token) continue;
      const confirmed = decisionMap[u.id];
      pushPromises.push(sendPushNotification(
        u.fcm_token,
        confirmed ? '✅ Sehri Confirmed' : '❌ No Sehri',
        confirmed
          ? 'Good news! Your Sehri is confirmed for today.'
          : 'Sorry, Sehri is not allotted for you today.'
      ));
    }
    await Promise.allSettled(pushPromises);

    logger.info(`Special cases allotted: ${allotted} confirmed, ${notAllotted} rejected (poll ${todayStr})`);
    return success(res, { allotted, notAllotted, notified: pushPromises.length }, 'Special cases allotted & notifications sent');
  } catch (err) {
    logger.error('allotSpecialCases error:', err);
    return error(res, 'Failed to allot special cases', 500);
  }
};

/**
 * GET /polls/active/status  (any authenticated user)
 * Final Sehri status for the current day's poll, plus zone voter breakdown.
 * Available any time; the app shows it during the 6:00 PM – 9:59 PM status window.
 */
const getMySehriStatus = async (req, res) => {
  try {
    const phase = getPhase();
    const todayStr = getTodayISTDate();
    const poll = await Poll.findOne({ where: { date: todayStr } });

    if (!poll) {
      return success(res, {
        phase, date: todayStr, displayLabel: displayLabel(todayStr),
        status: null, reason: 'No poll for today',
        zoneCounts: {}, zoneVoters: [],
        windows: { statusStart: '18:00', statusEnd: '21:59', nextPoll: '22:00' },
      });
    }

    const myResponse = await PollResponse.findOne({
      where: { poll_id: poll.id, user_id: req.user.id },
    });

    let status = null;
    let reason = null;
    if (!myResponse) {
      status = 'no';
      reason = 'You did not vote — no Sehri';
    } else if (myResponse.is_special_case && myResponse.special_case_type === 'dont_want') {
      status = 'no';
      reason = 'You opted out';
    } else if (myResponse.is_special_case && myResponse.special_case_type === 'want') {
      if (myResponse.sehri_allowed === null) {
        status = 'pending';
        reason = 'Awaiting confirmation (5–6 PM)';
      } else {
        status = myResponse.sehri_allowed ? 'confirmed' : 'no';
        reason = myResponse.sehri_allowed ? 'Special case — allotted by admin' : 'Special case — not allotted';
      }
    } else {
      status = myResponse.response === 'yes' ? 'confirmed' : 'no';
      reason = myResponse.response === 'yes' ? 'Voted yes' : 'Voted no';
    }

    const zones = ['masjid', 'boys_hostel', 'stanza', 'girls'];
    const zoneCounts = {};
    for (const zone of zones) {
      zoneCounts[zone] = await PollResponse.count({
        where: { poll_id: poll.id, response: 'yes', is_special_case: false, zone },
      });
    }

    const zone = req.user.zone;
    const voters = await PollResponse.findAll({
      where: zone ? { poll_id: poll.id, response: 'yes', is_special_case: false, zone } : { poll_id: poll.id, response: 'yes', is_special_case: false },
      include: [{ model: User, attributes: ['id', 'name', 'address', 'zone'] }],
      order: [[{ model: User, as: 'User' }, 'address', 'ASC']],
    });

    return success(res, {
      phase, date: todayStr, displayLabel: displayLabel(todayStr),
      status, reason,
      zoneCounts,
      zoneVoters: voters.map((v) => ({
        id: v.User?.id,
        name: v.User?.name || 'Unknown',
        address: v.User?.address || '',
        zone: v.User?.zone || v.zone,
      })),
      windows: { statusStart: '18:00', statusEnd: '21:59', nextPoll: '22:00' },
    });
  } catch (err) {
    logger.error('getMySehriStatus error:', err);
    return error(res, 'Failed to fetch Sehri status', 500);
  }
};

module.exports = {
  getActivePoll,
  getActivePollStats,
  submitSpecialCase,
  undoSpecialCase,
  toggleActivePoll,
  respondToPoll,
  getPollStats,
  getPollStatsByDate,
  getPollHistory,
  getMyPollHistory,
  getZoneVoters,
  getSpecialCases,
  allotSpecialCases,
  getMySehriStatus,
  getTodayPoll: getActivePoll,
  getTomorrowPoll: getActivePoll,
  getTomorrowPollStats: getActivePollStats,
  getTodayPollStats: getActivePollStats,
};
