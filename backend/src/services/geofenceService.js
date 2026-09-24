const { Op } = require('sequelize');
const {
  Poll, PollResponse, User, MapMarker, ZoneAddress, DeliveryAlert,
} = require('../models');
const { sendPushNotification } = require('./expoPushService');
const logger = require('../utils/logger');

/** How close the rider has to be for a geofence to count. */
const RADIUS_M = 200;

/**
 * Where the food is collected from. Normally this comes from the map markers a
 * super admin manages (symbol `distributor`), so moving the kitchen is a pin
 * drag rather than a deploy. The constant is only a fallback for the case where
 * every distributor pin has been deleted.
 */
const SUPPLIER_FALLBACK = { latitude: 12.89678, longitude: 77.49252 };

/** Sound + channel registered in the app, so these do not sound like a poll reminder. */
const ALERT_OPTS = {
  sound: 'sehri_alert.wav',
  channelId: 'sehri-delivery',
  interruptionLevel: 'time-sensitive',
};

/* ────────────────────────────────────────────────────────────────────────── */

function getISTNow() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

/**
 * Which poll the food currently being delivered belongs to: the current IST
 * calendar date, matching the status screen (`getMySehriStatus`).
 *
 * Note this flips at midnight. A run that starts at 11:30 PM and finishes at
 * 1:00 AM would read one poll before midnight and a different one after, so
 * delivery has to sit wholly inside one calendar day.
 */
function deliveryPollDate(now = getISTNow()) {
  return now.toISOString().split('T')[0];
}

/** Great-circle distance in metres. */
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Everyone actually receiving Sehri for this poll: people who voted yes, plus
 * special cases the super admin allotted. Exactly the same rule the status
 * screen uses, so what a user was told at 6 PM matches who gets woken up.
 */
async function sehriRecipients(pollDate) {
  const poll = await Poll.findOne({ where: { date: pollDate } });
  if (!poll) return [];

  const rows = await PollResponse.findAll({
    where: {
      poll_id: poll.id,
      [Op.or]: [
        { response: 'yes', is_special_case: false },
        { is_special_case: true, special_case_type: 'want', sehri_allowed: true },
      ],
    },
    include: [{ model: User, attributes: ['id', 'name', 'zone', 'address', 'fcm_token'] }],
  });

  return rows.map((r) => r.User).filter(Boolean);
}

/**
 * Who a given marker is about, and how they receive the food.
 *
 * The two modes are a deliberate operational split, not a technical one:
 *
 *   `address` markers name one PG. Girls' zones are marked this way because
 *     delivery goes to their own address for safety — they do not walk out to
 *     a shared point. Only people registered at that PG are told, and they are
 *     told the food is at their door.
 *
 *   `zone` markers cover a whole zone. Boys' zones (masjid, boys hostel,
 *     stanza) are marked this way because delivery goes to a collection point,
 *     not to individual doors — so everyone in the zone is told, and told to
 *     come to that point.
 *
 * A `custom` marker falls back to reading its symbol as a zone (every symbol
 * except `distributor` is a zone name). That is a safety net for the seeded
 * pins only; real markers should be `address` or `zone`.
 */
function recipientsForMarker(marker, recipients, addressNameById) {
  if (marker.source === 'address' && marker.address_id) {
    const name = addressNameById.get(marker.address_id);
    if (!name) return { mode: 'doorstep', targets: [] };
    return {
      mode: 'doorstep',
      targets: recipients.filter((u) => u.address === name),
    };
  }

  const zone = marker.zone || (marker.symbol !== 'distributor' ? marker.symbol : null);
  if (!zone) return { mode: 'zone_point', targets: [] };
  return {
    mode: 'zone_point',
    targets: recipients.filter((u) => u.zone === zone),
  };
}

/** Wording depends on whether they wait at home or walk to a point. */
function arrivalMessage(mode, marker) {
  if (mode === 'doorstep') {
    return {
      title: '🍽️ Sehri is at your doorstep',
      body: 'Your Sehri has arrived at your address. Please come down and collect it now.',
    };
  }
  return {
    title: '🍽️ Sehri has reached your zone',
    body: `Your Sehri is at ${marker.label}. Please come and collect it now.`,
  };
}

/**
 * Sends to everyone who has not already had this kind of alert today.
 *
 * `findOrCreate` against the unique index is what makes "only once" true even
 * though the rider's phone re-reports the same position every 5 seconds, and
 * even if two riders trigger the same marker at once.
 */
async function notifyOnce({ recipients, kind, pollDate, markerId, riderId, title, body }) {
  let sent = 0;

  for (const user of recipients) {
    let created;
    try {
      [, created] = await DeliveryAlert.findOrCreate({
        where: { poll_date: pollDate, user_id: user.id, kind },
        defaults: {
          poll_date: pollDate, user_id: user.id, kind,
          marker_id: markerId || null, rider_id: riderId || null, sent_at: new Date(),
        },
      });
    } catch {
      // Unique violation from a simultaneous insert — someone else got there.
      continue;
    }
    if (!created) continue;

    // The row is the record that they were told; a dead token must not make us
    // forget and re-notify on the next GPS ping.
    if (!user.fcm_token) continue;

    sent += 1;
    sendPushNotification(user.fcm_token, title, body, { screen: 'tracking', kind }, ALERT_OPTS)
      .catch((err) => logger.error(`delivery push failed for ${user.id}: ${err.message}`));
  }

  return sent;
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Runs on every rider GPS report.
 *
 * Two things are watched:
 *   1. The supplier point. Arriving arms the run; leaving it sends "on the way"
 *      to everyone getting Sehri. Departure is the signal, not arrival — the
 *      food is only actually moving once the van has left.
 *   2. Every other marker. Coming within 200 m of one sends "at your doorstep"
 *      to the people that marker is about.
 *
 * Called fire-and-forget: a geofence problem must never fail the rider's
 * location update, because that would break live tracking for everyone.
 */
async function onRiderLocation(rider, latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!isFinite(lat) || !isFinite(lng)) return;

  const pollDate = deliveryPollDate();

  const markers = await MapMarker.findAll({ where: { is_active: true } });
  if (!markers.length) return;

  const supplierPins = markers.filter((m) => m.symbol === 'distributor');
  const supplierPoints = supplierPins.length
    ? supplierPins.map((m) => ({ latitude: Number(m.latitude), longitude: Number(m.longitude) }))
    : [SUPPLIER_FALLBACK];

  const nearSupplier = supplierPoints.some(
    (p) => distanceMeters(lat, lng, p.latitude, p.longitude) <= RADIUS_M,
  );

  // A new delivery night starts from a clean slate — yesterday's "already left"
  // must not suppress tonight's alert.
  if (rider.geofence_date !== pollDate) {
    await rider.update({ geofence_date: pollDate, at_supplier: false, left_supplier_at: null });
  }

  /* 1 ─ supplier arrive / depart */
  if (nearSupplier && !rider.at_supplier) {
    await rider.update({ at_supplier: true });
    logger.info(`Rider ${rider.rider_name} reached the supplier point`);
    return; // Sitting at the kitchen — nothing to announce yet.
  }

  if (nearSupplier) return; // Still loading up.

  if (rider.at_supplier) {
    await rider.update({ at_supplier: false, left_supplier_at: new Date() });

    const recipients = await sehriRecipients(pollDate);
    const sent = await notifyOnce({
      recipients, kind: 'on_the_way', pollDate, riderId: rider.id,
      title: '🛵 Sehri is on the way',
      body: 'Your Sehri has left the kitchen and will reach you in a few minutes. Please be available to receive it.',
    });
    logger.info(`Rider ${rider.rider_name} left the supplier point — notified ${sent} user(s)`);
  }

  /* 2 ─ doorstep markers */
  const inRange = markers.filter((m) => m.symbol !== 'distributor'
    && distanceMeters(lat, lng, Number(m.latitude), Number(m.longitude)) <= RADIUS_M);

  if (!inRange.length) return;

  const recipients = await sehriRecipients(pollDate);
  if (!recipients.length) return;

  const addressIds = inRange.map((m) => m.address_id).filter(Boolean);
  const addressNameById = new Map();
  if (addressIds.length) {
    const rows = await ZoneAddress.findAll({ where: { id: { [Op.in]: addressIds } } });
    for (const a of rows) addressNameById.set(a.id, a.name);
  }

  /**
   * Address markers are handled first, so the most specific match wins: someone
   * registered at a marked PG is told the food is at their door rather than
   * being sent walking to a zone point that happens to cover them too. That
   * ordering protects the case it matters for — girls' addresses are marked
   * individually precisely so they do not have to walk out.
   *
   * It only bites if a zone is marked both ways, which should not happen:
   * girls' zones are marked by address, boys' zones by zone point. If it does,
   * say so, because the symptom (a few people told the wrong thing) is
   * otherwise invisible.
   */
  const ordered = [...inRange].sort(
    (a, b) => (a.source === 'address' ? 0 : 1) - (b.source === 'address' ? 0 : 1),
  );

  const zonesByAddress = new Set(ordered.filter((m) => m.source === 'address').map((m) => m.zone));
  for (const m of ordered) {
    const zone = m.zone || m.symbol;
    if (m.source !== 'address' && zonesByAddress.has(zone)) {
      logger.warn(
        `Zone "${zone}" has both an address marker and a zone marker in range `
        + `("${m.label}"). Mark a zone one way or the other — doorstep delivery `
        + `wins, so anyone at a marked address will not be told to collect.`,
      );
    }
  }

  for (const marker of ordered) {
    const { mode, targets } = recipientsForMarker(marker, recipients, addressNameById);
    if (!targets.length) continue;

    const { title, body } = arrivalMessage(mode, marker);
    const sent = await notifyOnce({
      recipients: targets, kind: 'doorstep', pollDate,
      markerId: marker.id, riderId: rider.id, title, body,
    });
    if (sent) logger.info(`Arrival alert (${mode}) at "${marker.label}" — notified ${sent} user(s)`);
  }
}

module.exports = {
  onRiderLocation,
  // Exported for tests.
  distanceMeters, deliveryPollDate, recipientsForMarker, RADIUS_M, SUPPLIER_FALLBACK,
};
