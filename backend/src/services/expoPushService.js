const { User, Admin, SuperAdmin } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushNotification(expoPushToken, title, body, data = {}) {
  const isValidToken = expoPushToken &&
    (expoPushToken.startsWith('ExponentPushToken') || expoPushToken.startsWith('ExpoPushToken'));
  if (!isValidToken) {
    logger.warn(`Skipping invalid token: ${expoPushToken?.substring(0, 20)}`);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data: { ...data, screen: 'poll' },
        priority: 'high',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const result = await response.json();
    if (result.errors) {
      logger.error('Expo Push API error:', JSON.stringify(result.errors));
    } else if (result.data?.length) {
      const status = result.data[0];
      if (status.status === 'error') {
        logger.error(`Expo push failed for ${expoPushToken.substring(0, 20)}:`, JSON.stringify(status));
      }
    }
  } catch (err) {
    clearTimeout(timeout);
    logger.error('Expo push send failed:', err.name, err.message);
  }
}

async function sendPollEnabledNotification(dateStr) {
  logger.info(`Sending poll enabled notification for ${dateStr}`);
  await notifyAllUsers('🌙 Sehri Poll is Now Open', `The poll for ${dateStr} is now open! Cast your vote now.`);
}

async function sendPollDisabledNotification(dateStr) {
  logger.info(`Sending poll disabled notification for ${dateStr}`);
  await notifyAllUsers('🌙 Sehri Poll is Now Closed', `The poll for ${dateStr} has been closed. Thank you for voting!`);
}

async function notifyAllUsers(title, body) {
  const [users, admins, superAdmins] = await Promise.all([
    User.findAll({ attributes: ['fcm_token'], where: { fcm_token: { [Op.ne]: null } } }),
    Admin.findAll({ attributes: ['fcm_token'], where: { fcm_token: { [Op.ne]: null } } }),
    SuperAdmin.findAll({ attributes: ['fcm_token'], where: { fcm_token: { [Op.ne]: null } } }),
  ]);

  // Dedupe — one phone can hold several roles, and each role row stores its own
  // copy of the same Expo token. Without this they get one push per role.
  const tokens = [...new Set([
    ...users.map((u) => u.fcm_token),
    ...admins.map((a) => a.fcm_token),
    ...superAdmins.map((sa) => sa.fcm_token),
  ].filter(Boolean))];

  logger.info(`Sending push to ${tokens.length} devices`);

  await Promise.allSettled(tokens.map((token) => sendPushNotification(token, title, body)));
}

/**
 * Notify the admin(s) responsible for a zone plus every super admin.
 * Used when something needs review — e.g. a profile edit request.
 */
async function notifyReviewers(zone, title, body, data = {}) {
  const [admins, superAdmins] = await Promise.all([
    Admin.findAll({ attributes: ['fcm_token'], where: { zone, fcm_token: { [Op.ne]: null } } }),
    SuperAdmin.findAll({ attributes: ['fcm_token'], where: { fcm_token: { [Op.ne]: null } } }),
  ]);

  const tokens = [...new Set([
    ...admins.map((a) => a.fcm_token),
    ...superAdmins.map((sa) => sa.fcm_token),
  ].filter(Boolean))];

  logger.info(`Notifying ${tokens.length} reviewer device(s) for zone ${zone}`);
  await Promise.allSettled(tokens.map((t) => sendPushNotification(t, title, body, data)));
}

/**
 * Notify every approved user in the given zones.
 *
 * Used by broadcasts. Admins and super admins are deliberately not included —
 * they see what they sent in the feed and do not need a push for their own
 * announcement.
 */
async function notifyZones(zones, title, body, data = {}) {
  if (!Array.isArray(zones) || !zones.length) return;

  const users = await User.findAll({
    attributes: ['fcm_token'],
    where: {
      zone: { [Op.in]: zones },
      status: 'approved',
      fcm_token: { [Op.ne]: null },
    },
  });

  const tokens = [...new Set(users.map((u) => u.fcm_token).filter(Boolean))];
  logger.info(`Broadcast push → ${tokens.length} device(s) across ${zones.join(', ')}`);

  await Promise.allSettled(tokens.map((t) => sendPushNotification(t, title, body, data)));
}

/** Notify one specific account (any role) by its stored Expo token. */
async function notifyOne(fcmToken, title, body, data = {}) {
  if (!fcmToken) return;
  await sendPushNotification(fcmToken, title, body, data);
}

module.exports = {
  sendPushNotification, sendPollEnabledNotification, sendPollDisabledNotification,
  notifyAllUsers, notifyReviewers, notifyOne, notifyZones,
};
