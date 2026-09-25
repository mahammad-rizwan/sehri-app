const { Op } = require('sequelize');
const { MapMarker, ZoneAddress, DeliveryStop } = require('../models');
const {
  deliveryPollDate, sehriRecipients, recipientsForMarker,
} = require('../services/geofenceService');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Splits tonight's Sehri recipients across the route's stops.
 *
 * Every recipient is counted at exactly one stop, so the per-stop numbers add
 * up to what actually needs loading. Address stops claim people first — a girl
 * registered at a marked PG is delivered to her door, never also counted at a
 * zone point — then zone stops take whoever in their zone is left.
 *
 * Anyone no stop claims is returned as `unrouted`: they are getting Sehri but
 * there is no pin on the route for them, which the rider needs to know before
 * setting off rather than after.
 *
 * Pure (no database) so it can be tested directly.
 */
function allocate(stops, recipients, addressNameById) {
  const claimed = new Set();
  const counts = new Map();

  const pass = (predicate) => {
    for (const stop of stops) {
      if (!predicate(stop)) continue;
      const { mode, targets } = recipientsForMarker(stop, recipients, addressNameById);
      const mine = targets.filter((u) => !claimed.has(u.id));
      mine.forEach((u) => claimed.add(u.id));
      counts.set(stop.id, { mode, count: mine.length });
    }
  };
  pass((s) => s.source === 'address');
  pass((s) => s.source !== 'address');

  const byPlace = new Map();
  for (const u of recipients) {
    if (claimed.has(u.id)) continue;
    const key = `${u.zone || ''}|${u.address || ''}`;
    const row = byPlace.get(key) || { address: u.address || 'No address', zone: u.zone || null, count: 0 };
    row.count += 1;
    byPlace.set(key, row);
  }

  return {
    counts,
    unrouted: [...byPlace.values()].sort((a, b) => b.count - a.count),
  };
}

/**
 * GET /tracking/drop-points
 *
 * Tonight's stops in delivery order, each with how many Sehri go there and
 * whether it has been ticked off. Uses the current date's poll — delivery runs
 * 8–11 PM, inside the same day it was voted for.
 */
const getDropPoints = async (req, res) => {
  try {
    const pollDate = deliveryPollDate();

    const stops = await MapMarker.findAll({
      where: { is_active: true, symbol: { [Op.ne]: 'distributor' } },
      order: [['sequence', 'ASC'], ['created_at', 'ASC']],
    });

    const recipients = await sehriRecipients(pollDate);

    const addressIds = stops.map((s) => s.address_id).filter(Boolean);
    const addressNameById = new Map();
    if (addressIds.length) {
      const rows = await ZoneAddress.findAll({ where: { id: { [Op.in]: addressIds } } });
      rows.forEach((a) => addressNameById.set(a.id, a.name));
    }

    const { counts, unrouted } = allocate(stops, recipients, addressNameById);

    const done = await DeliveryStop.findAll({ where: { poll_date: pollDate } });
    const doneById = new Map(done.map((d) => [d.marker_id, d]));

    const list = stops.map((s, i) => {
      const c = counts.get(s.id) || { mode: 'zone_point', count: 0 };
      const d = doneById.get(s.id);
      return {
        id: s.id,
        position: i + 1,
        label: s.label,
        symbol: s.symbol,
        mode: c.mode,
        count: c.count,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        delivered: !!d,
        delivered_at: d ? d.delivered_at : null,
        delivered_by: d ? d.delivered_by_name : null,
      };
    });

    const active = list.filter((s) => s.count > 0);
    const next = active.find((s) => !s.delivered) || null;

    return success(res, {
      date: pollDate,
      total: recipients.length,
      routed: recipients.length - unrouted.reduce((n, u) => n + u.count, 0),
      stops: list,
      next_stop_id: next ? next.id : null,
      delivered_stops: active.filter((s) => s.delivered).length,
      active_stops: active.length,
      unrouted,
    });
  } catch (err) {
    logger.error('getDropPoints error:', err);
    return error(res, 'Failed to load drop points', 500);
  }
};

/**
 * PATCH /tracking/drop-points/:markerId   { delivered: boolean }
 *
 * Ticks a stop off (or un-ticks it, for a mis-tap). Idempotent both ways.
 */
const setStopDelivered = async (req, res) => {
  try {
    const { markerId } = req.params;
    const delivered = req.body?.delivered !== false;
    const pollDate = deliveryPollDate();

    const marker = await MapMarker.findByPk(markerId);
    if (!marker || marker.symbol === 'distributor') {
      return error(res, 'That drop point no longer exists', 404);
    }

    if (delivered) {
      await DeliveryStop.findOrCreate({
        where: { poll_date: pollDate, marker_id: markerId },
        defaults: {
          poll_date: pollDate,
          marker_id: markerId,
          delivered_at: new Date(),
          delivered_by: req.user?.id || null,
          delivered_by_name: req.user?.rider_name || req.user?.name || null,
        },
      });
    } else {
      await DeliveryStop.destroy({ where: { poll_date: pollDate, marker_id: markerId } });
    }

    return success(res, { id: markerId, delivered },
      delivered ? `${marker.label} marked delivered` : `${marker.label} unmarked`);
  } catch (err) {
    logger.error('setStopDelivered error:', err);
    return error(res, 'Failed to update the drop point', 500);
  }
};

module.exports = { getDropPoints, setStopDelivered, allocate };
