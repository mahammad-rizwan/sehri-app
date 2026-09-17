const { User, Admin, SuperAdmin } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const fs = require('fs');
const path = require('path');
const DEBUG_LOG = path.join(__dirname, '../../expo-debug.log');

function debugLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(DEBUG_LOG, line);
}

async function sendPushNotification(expoPushToken, title, body, data = {}) {
  debugLog(`sendPushNotification called with token=${expoPushToken?.substring(0, 25)}...`);
  const isValidToken = expoPushToken &&
    (expoPushToken.startsWith('ExponentPushToken') || expoPushToken.startsWith('ExpoPushToken'));
  if (!isValidToken) {
    logger.warn(`Skipping invalid token: ${expoPushToken?.substring(0, 20)}`);
    return;
  }

  logger.info(`Sending to ${expoPushToken.substring(0, 20)}...`);
  debugLog(`Passing token check, about to fetch ${EXPO_PUSH_URL}`);

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
    logger.info(`Expo HTTP ${response.status} for ${expoPushToken.substring(0, 20)}`);

    const result = await response.json();
    if (result.errors) {
      logger.error('Expo Push API error:', JSON.stringify(result.errors));
    } else if (result.data?.length) {
      const status = result.data[0];
      logger.info(`Expo push result for ${expoPushToken.substring(0, 20)}: status=${status.status} message=${status.message || ''} details=${JSON.stringify(status.details || {})}`);
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

  const tokens = [
    ...users.map((u) => u.fcm_token),
    ...admins.map((a) => a.fcm_token),
    ...superAdmins.map((sa) => sa.fcm_token),
  ].filter(Boolean);

  logger.info(`Sending push to ${tokens.length} devices`);
  logger.debug('Tokens:', tokens.map(t => t.substring(0, 25) + '...'));

  console.log(`[EXPO] About to call Promise.allSettled with ${tokens.length} tokens`);
  console.log(`[EXPO] typeof sendPushNotification = ${typeof sendPushNotification}`);

  const promises = tokens.map((token) => {
    console.log(`[EXPO] Mapping token: ${token.substring(0, 20)}...`);
    return sendPushNotification(token, title, body);
  });
  console.log(`[EXPO] Created ${promises.length} promises`);

  await Promise.allSettled(promises);
  console.log(`[EXPO] Promise.allSettled completed`);
}

module.exports = { sendPushNotification, sendPollEnabledNotification, sendPollDisabledNotification, notifyAllUsers };
