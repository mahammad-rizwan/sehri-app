const { Op } = require('sequelize');
const { BroadcastMessage, User } = require('../models');
const { ZONES, allowedZonesFor, resolveAudience } = require('../constants/channels');
const { notifyZones } = require('../services/expoPushService');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/** Only plain web links are allowed — no data:, javascript: or file: URIs. */
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;

/**
 * Pulls web links out of the message body.
 *
 * Media is intentionally unsupported: there is no upload path, and a link that
 * points directly at an image or video file is dropped so a broadcast cannot be
 * used to push media indirectly.
 */
const MEDIA_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|mp4|mov|avi|mkv|webm|mp3|wav|m4a)(\?|#|$)/i;

function extractLinks(body) {
  const found = body.match(URL_RE) || [];
  const clean = [];

  for (let raw of found) {
    // Trailing punctuation usually belongs to the sentence, not the URL.
    raw = raw.replace(/[).,;!?]+$/, '');
    if (MEDIA_EXT.test(raw)) continue;
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (!clean.includes(raw)) clean.push(raw);
    } catch { /* not a usable URL */ }
  }

  return clean.slice(0, 10);
}

/**
 * GET /broadcasts/channels
 * The zones this sender may address. A zone admin gets exactly one.
 */
const getChannels = async (req, res) => {
  try {
    const zones = allowedZonesFor(req.userRole, req.user.zone);
    return success(res, {
      zones,
      // Only a super admin has a choice to make; an admin's single zone is
      // fixed, so the app shows it rather than offering a picker.
      canPickZones: req.userRole === 'super_admin',
    });
  } catch (err) {
    logger.error('getChannels error:', err);
    return error(res, 'Failed to load zones', 500);
  }
};

/**
 * GET /broadcasts
 * The feed. A user sees messages addressed to their zone; admins and super
 * admins see what they can send, so they can check what went out.
 */
const listBroadcasts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    let rows = await BroadcastMessage.findAll({
      order: [['created_at', 'DESC']],
      limit: 200,
    });

    // zones is JSON, so filter in JS rather than relying on JSON_CONTAINS —
    // it keeps this working the same on older MySQL versions.
    if (req.userRole === 'user') {
      const zone = req.user.zone;
      rows = rows.filter((m) => Array.isArray(m.zones) && m.zones.includes(zone));
    } else if (req.userRole === 'admin') {
      const zone = req.user.zone;
      rows = rows.filter((m) => Array.isArray(m.zones) && m.zones.includes(zone));
    }
    // super_admin sees everything

    // A reader has no business knowing which other zones were addressed, or
    // that zones exist at all — it is just an announcement to them. Staff do
    // see the audience, since they need to check what went where.
    const isStaff = req.userRole === 'admin' || req.userRole === 'super_admin';

    const shaped = rows.slice(0, limit).map((m) => ({
      id: m.id,
      body: m.body,
      links: m.links || [],
      sender_name: m.sender_name,
      sender_role: m.sender_role,
      created_at: m.createdAt,
      ...(isStaff ? {
        zones: m.zones,
        // Let the app hide the delete control rather than offer one that
        // would 403. A super admin may remove anything, including a zone
        // admin's announcement; an admin only their own.
        can_delete: req.userRole === 'super_admin' || m.sender_id === req.user.id,
      } : {}),
    }));

    return success(res, shaped);
  } catch (err) {
    logger.error('listBroadcasts error:', err);
    return error(res, `Failed to load announcements: ${err.message}`, 500);
  }
};

/**
 * POST /broadcasts  (admin | super_admin)
 * Sends an announcement and pushes it to everyone in the target zones.
 */
const createBroadcast = async (req, res) => {
  try {
    const { body, zones } = req.body;

    const text = (body || '').trim();
    if (text.length < 2) return error(res, 'Write a message first', 400);
    if (text.length > 2000) return error(res, 'Message is too long (max 2000 characters)', 400);

    let audience;
    try {
      audience = resolveAudience({ role: req.userRole, zone: req.user.zone, zones });
    } catch (permErr) {
      return error(res, permErr.message, 403);
    }

    const links = extractLinks(text);

    const msg = await BroadcastMessage.create({
      // Retained for storage compatibility; the audience is the zone list.
      channel_key: 'zones',
      zones: audience.zones,
      body: text,
      links,
      sender_id: req.user.id,
      sender_name: req.user.name,
      sender_role: req.userRole,
    });

    // The title stays generic — a reader should not be told which zone bucket
    // they fell into.
    notifyZones(
      audience.zones,
      '📢 Announcement',
      text.length > 140 ? `${text.slice(0, 137)}...` : text,
      { screen: 'broadcast' },
    ).catch((e) => logger.warn('notifyZones failed:', e.message));

    logger.info(
      `Broadcast by ${req.userRole} ${req.user.name} → ${audience.zones.join(', ')} (${links.length} link(s))`,
    );

    return success(res, {
      id: msg.id,
      zones: audience.zones,
      links,
    }, `Sent to ${audience.zones.length} zone${audience.zones.length > 1 ? 's' : ''}`, 201);
  } catch (err) {
    logger.error('createBroadcast error:', err);
    return error(res, 'Failed to send announcement', 500);
  }
};

/**
 * DELETE /broadcasts/:id
 * Super admins can remove anything; an admin only their own messages.
 */
const deleteBroadcast = async (req, res) => {
  try {
    const msg = await BroadcastMessage.findByPk(req.params.id);
    if (!msg) return error(res, 'Announcement not found', 404);

    if (req.userRole !== 'super_admin' && msg.sender_id !== req.user.id) {
      return error(res, 'You can only delete your own announcements', 403);
    }

    await msg.destroy();
    logger.info(`Broadcast ${req.params.id} deleted by ${req.userRole} ${req.user.id}`);
    return success(res, null, 'Announcement deleted');
  } catch (err) {
    logger.error('deleteBroadcast error:', err);
    return error(res, 'Failed to delete announcement', 500);
  }
};

module.exports = { getChannels, listBroadcasts, createBroadcast, deleteBroadcast, extractLinks };
