const { Op } = require('sequelize');
const {
  ContentReport, BroadcastMessage, ChatMessage, ChatGroup, ChatGroupMember,
  User, Admin, SuperAdmin,
} = require('../models');
const { notifyOne } = require('../services/expoPushService');
const { getIO } = require('../services/socketService');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const REASON_LABELS = {
  inappropriate: 'Inappropriate content',
  violence: 'Violence or threats',
  hate: 'Hate speech',
  harassment: 'Harassment or bullying',
  spam: 'Spam or misleading',
  misinformation: 'False information',
  other: 'Something else',
};

const DESC_MIN = 10;
const DESC_MAX = 1000;

/* ────────────────────────────────────────────────────────────────────────────
 * Who reviews what — pure, so it can be tested without a database.
 *
 *   super admin  → every report, announcements and chats alike.
 *   zone admin   → announcement reports filed by users of their own zone,
 *                  except reports about their own announcements: nobody
 *                  judges a complaint about themselves. Those go to the super
 *                  admin alone. Chat reports are never shown to admins — chat
 *                  members are admins, so they would be judging their peers.
 * ──────────────────────────────────────────────────────────────────────────── */

function canReview(report, role, user) {
  if (role === 'super_admin') return true;
  if (role !== 'admin') return false;
  return report.target_type === 'broadcast'
    && report.reporter_role === 'user'
    && report.reporter_zone === user.zone
    && report.content_author_id !== user.id;
}

/** Removing content is the super admin's call, matching who may delete it. */
function canRemove(report, role) {
  return role === 'super_admin';
}

function reviewerWhere(role, user) {
  if (role === 'super_admin') return {};
  return {
    target_type: 'broadcast',
    reporter_role: 'user',
    reporter_zone: user.zone,
    [Op.or]: [
      { content_author_id: null },
      { content_author_id: { [Op.ne]: user.id } },
    ],
  };
}

function statusWhere(status) {
  if (status === 'resolved') return { status: { [Op.in]: ['action_taken', 'dismissed'] } };
  if (status === 'all') return {};
  return { status: 'pending' };
}

/* ────────────────────────────────────────────────────────────────────────────
 * POST /reports   { target_type, target_id, reason, description }
 * ──────────────────────────────────────────────────────────────────────────── */
const createReport = async (req, res) => {
  try {
    const { target_type: type, target_id: targetId, reason } = req.body || {};
    const description = String(req.body?.description || '').trim();
    const role = req.userRole;
    const me = req.user;

    if (!['broadcast', 'chat_message'].includes(type) || !targetId) {
      return error(res, 'Say what you are reporting', 400);
    }
    if (!ContentReport.REASONS.includes(reason)) {
      return error(res, 'Pick a reason for the report', 400);
    }
    if (description.length < DESC_MIN) {
      return error(res, `Describe the problem in at least ${DESC_MIN} characters`, 400);
    }
    if (description.length > DESC_MAX) {
      return error(res, `Keep the description under ${DESC_MAX} characters`, 400);
    }

    let snapshot;
    let author = {};
    let group = {};

    if (type === 'broadcast') {
      const msg = await BroadcastMessage.findByPk(targetId);
      if (!msg) return error(res, 'That announcement no longer exists', 404);

      // You can only report what you were actually shown.
      const zones = Array.isArray(msg.zones) ? msg.zones : [];
      if (role !== 'super_admin' && !zones.includes(me.zone)) {
        return error(res, 'You cannot report this announcement', 403);
      }
      if (msg.sender_id === me.id && msg.sender_role === role) {
        return error(res, 'You cannot report your own announcement', 400);
      }

      const links = Array.isArray(msg.links) && msg.links.length ? `\n\n${msg.links.join('\n')}` : '';
      snapshot = `${msg.body}${links}`;
      author = { id: msg.sender_id, name: msg.sender_name, role: msg.sender_role };
    } else {
      const msg = await ChatMessage.findByPk(targetId);
      if (!msg) return error(res, 'That message no longer exists', 404);

      // Same rule as reading the chat: members only.
      const member = await ChatGroupMember.findOne({
        where: { group_id: msg.group_id, user_id: me.id, user_type: role },
      });
      if (!member) return error(res, 'You are not a member of this chat', 403);
      if (msg.sender_id === me.id) {
        return error(res, 'You cannot report your own message', 400);
      }

      const g = await ChatGroup.findByPk(msg.group_id);
      snapshot = msg.message;
      author = { id: msg.sender_id, name: msg.sender_name, role: msg.sender_type };
      group = { id: msg.group_id, name: g ? g.name : null };
    }

    let report;
    try {
      report = await ContentReport.create({
        target_type: type,
        target_id: targetId,
        group_id: group.id || null,
        group_name: group.name || null,
        content_snapshot: snapshot,
        content_author_id: author.id || null,
        content_author_name: author.name || null,
        content_author_role: author.role || null,
        reason,
        description,
        reporter_id: me.id,
        reporter_role: role,
        reporter_name: me.name || null,
        reporter_zone: me.zone || null,
      });
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        return error(res, 'You have already reported this. We will let you know the outcome.', 409);
      }
      throw e;
    }

    // Tell whoever will review it. Best effort — a failed push must not fail
    // the report, which is already safely stored.
    const title = '🚩 New report';
    const body = `${REASON_LABELS[reason]} — ${type === 'broadcast' ? 'an announcement' : 'a chat message'}`;
    const data = { screen: 'reports', reportId: report.id };
    notifyNewReport({ type, reporterRole: role, zone: me.zone, authorId: author.id }, title, body, data)
      .catch((e) => logger.warn(`report notify failed: ${e.message}`));

    logger.info(`Report ${report.id}: ${type} ${targetId} (${reason}) by ${role} ${me.id}`);
    return success(res, { id: report.id, status: report.status },
      'Report submitted. Thank you — it will be reviewed.', 201);
  } catch (err) {
    logger.error('createReport error:', err);
    return error(res, 'Failed to submit the report', 500);
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * GET /reports/mine — the reporter's own reports and their outcomes.
 * ──────────────────────────────────────────────────────────────────────────── */
const myReports = async (req, res) => {
  try {
    const rows = await ContentReport.findAll({
      where: { reporter_id: req.user.id, reporter_role: req.userRole },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return success(res, rows.map((r) => ({
      id: r.id,
      target_type: r.target_type,
      reason: r.reason,
      reason_label: REASON_LABELS[r.reason],
      description: r.description,
      content_snapshot: r.content_snapshot,
      status: r.status,
      content_removed: r.content_removed,
      reviewer_note: r.reviewer_note,
      reviewed_at: r.reviewed_at,
      created_at: r.createdAt,
    })));
  } catch (err) {
    logger.error('myReports error:', err);
    return error(res, 'Failed to load your reports', 500);
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * GET /reports?type=broadcast|chat_message&status=pending|resolved|all
 * ──────────────────────────────────────────────────────────────────────────── */
const listReports = async (req, res) => {
  try {
    const role = req.userRole;
    const type = req.query.type === 'chat_message' ? 'chat_message' : 'broadcast';

    // Admins never see chat reports; answer with an empty list rather than an
    // error so the screen can simply not show that section.
    if (role === 'admin' && type === 'chat_message') return success(res, []);

    const rows = await ContentReport.findAll({
      where: { ...reviewerWhere(role, req.user), ...statusWhere(req.query.status), target_type: type },
      order: [['created_at', 'DESC']],
      limit: 200,
    });

    // Is the reported item still there? Decides whether "Remove" is offered.
    const ids = [...new Set(rows.map((r) => r.target_id))];
    const Model = type === 'broadcast' ? BroadcastMessage : ChatMessage;
    const alive = ids.length
      ? new Set((await Model.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id'] })).map((m) => m.id))
      : new Set();

    // How many people reported the same item — a strong signal for triage.
    const counts = {};
    rows.forEach((r) => { counts[r.target_id] = (counts[r.target_id] || 0) + 1; });

    return success(res, rows.map((r) => ({
      id: r.id,
      target_type: r.target_type,
      target_id: r.target_id,
      group_name: r.group_name,
      content_snapshot: r.content_snapshot,
      content_author_name: r.content_author_name,
      content_author_role: r.content_author_role,
      content_exists: alive.has(r.target_id),
      reason: r.reason,
      reason_label: REASON_LABELS[r.reason],
      description: r.description,
      reporter_name: r.reporter_name,
      reporter_role: r.reporter_role,
      reporter_zone: r.reporter_zone,
      same_item_reports: counts[r.target_id],
      status: r.status,
      content_removed: r.content_removed,
      reviewer_note: r.reviewer_note,
      reviewed_by_name: r.reviewed_by_name,
      reviewed_at: r.reviewed_at,
      created_at: r.createdAt,
      can_remove: canRemove(r, role) && alive.has(r.target_id),
    })));
  } catch (err) {
    logger.error('listReports error:', err);
    return error(res, 'Failed to load reports', 500);
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * GET /reports/pending-count — badge numbers for the dashboard tile.
 * ──────────────────────────────────────────────────────────────────────────── */
const pendingCount = async (req, res) => {
  try {
    const base = { ...reviewerWhere(req.userRole, req.user), status: 'pending' };
    const broadcast = await ContentReport.count({ where: { ...base, target_type: 'broadcast' } });
    const chat = req.userRole === 'super_admin'
      ? await ContentReport.count({ where: { ...base, target_type: 'chat_message' } })
      : 0;
    return success(res, { broadcast, chat_message: chat, total: broadcast + chat });
  } catch (err) {
    logger.error('pendingCount error:', err);
    return error(res, 'Failed to count reports', 500);
  }
};

/**
 * Pushes a new-report alert to everyone who can act on it: every super admin,
 * plus — for a user's announcement report — the zone's admins other than the
 * one who wrote it, since they are not allowed to judge their own post.
 */
async function notifyNewReport({ type, reporterRole, zone, authorId }, title, body, data) {
  const tokens = new Set();
  (await SuperAdmin.findAll({ attributes: ['fcm_token'], where: { fcm_token: { [Op.ne]: null } } }))
    .forEach((a) => tokens.add(a.fcm_token));
  if (type === 'broadcast' && reporterRole === 'user' && zone) {
    (await Admin.findAll({
      attributes: ['id', 'fcm_token'],
      where: { zone, fcm_token: { [Op.ne]: null } },
    }))
      .filter((a) => a.id !== authorId)
      .forEach((a) => tokens.add(a.fcm_token));
  }
  await Promise.allSettled([...tokens].map((t) => notifyOne(t, title, body, data)));
}

/** Finds a reporter's push token whichever table their account lives in. */
async function reporterToken(r) {
  const Model = r.reporter_role === 'super_admin' ? SuperAdmin : r.reporter_role === 'admin' ? Admin : User;
  const acc = await Model.findByPk(r.reporter_id, { attributes: ['fcm_token'] });
  return acc?.fcm_token || null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PATCH /reports/:id   { decision: 'action_taken'|'dismissed', remove_content?, note? }
 * ──────────────────────────────────────────────────────────────────────────── */
const resolveReport = async (req, res) => {
  try {
    const role = req.userRole;
    const { decision } = req.body || {};
    const removeContent = !!req.body?.remove_content;
    const note = String(req.body?.note || '').trim().slice(0, 1000) || null;

    if (!['action_taken', 'dismissed'].includes(decision)) {
      return error(res, 'Choose to dismiss the report or mark action taken', 400);
    }
    if (removeContent && decision !== 'action_taken') {
      return error(res, 'Removing the content counts as action taken', 400);
    }

    const report = await ContentReport.findByPk(req.params.id);
    if (!report) return error(res, 'Report not found', 404);
    if (!canReview(report, role, req.user)) return error(res, 'You cannot review this report', 403);
    if (report.status !== 'pending') return error(res, 'This report has already been reviewed', 409);
    if (removeContent && !canRemove(report, role)) {
      return error(res, 'Only the super admin can remove content', 403);
    }

    let removed = false;
    if (removeContent) {
      if (report.target_type === 'broadcast') {
        removed = (await BroadcastMessage.destroy({ where: { id: report.target_id } })) > 0;
      } else {
        const msg = await ChatMessage.findByPk(report.target_id);
        if (msg) {
          const groupId = msg.group_id;
          const { createdAt } = msg;
          await msg.destroy();
          removed = true;
          // Same event the chat's own delete sends, so open chats drop it live.
          try {
            getIO()
              .to(`group:${groupId}`)
              .emit('delete-message', { msgId: report.target_id, groupId, createdAt });
          } catch (e) {
            logger.warn(`socket emit after report removal failed: ${e.message}`);
          }
        }
      }
    }

    const fields = {
      status: decision,
      content_removed: removeContent,
      reviewer_note: note,
      reviewed_by_name: req.user.name || null,
      reviewed_by_role: role,
      reviewed_at: new Date(),
    };

    // Once content is gone, every other pending report about it is answered
    // too — otherwise those reporters wait forever on something already dealt with.
    const affected = removeContent
      ? await ContentReport.findAll({
        where: { target_type: report.target_type, target_id: report.target_id, status: 'pending' },
      })
      : [report];

    for (const r of affected) await r.update(fields);

    // Let each reporter know, without naming who reviewed it.
    for (const r of affected) {
      reporterToken(r)
        .then((token) => token && notifyOne(token,
          '🚩 Your report was reviewed',
          decision === 'action_taken'
            ? (removeContent ? 'Action was taken and the content has been removed.' : 'Action was taken on what you reported.')
            : 'It was reviewed and no violation was found.',
          { screen: 'my-reports' }))
        .catch(() => {});
    }

    logger.info(`Report ${report.id} → ${decision}${removeContent ? ' + content removed' : ''} by ${role} ${req.user.id}`);
    return success(res, { resolved: affected.length, content_removed: removeContent, removed_now: removed },
      removeContent
        ? `Content removed and ${affected.length} report${affected.length > 1 ? 's' : ''} closed`
        : decision === 'dismissed' ? 'Report dismissed' : 'Marked as action taken');
  } catch (err) {
    logger.error('resolveReport error:', err);
    return error(res, 'Failed to update the report', 500);
  }
};

module.exports = {
  createReport, myReports, listReports, pendingCount, resolveReport,
  // Exported for tests.
  canReview, canRemove, reviewerWhere, statusWhere, REASON_LABELS,
};
