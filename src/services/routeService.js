const crypto = require('crypto');
const { MapMarker, DeliveryRoute } = require('../models');
const polyline = require('../utils/polyline');
const logger = require('../utils/logger');

/**
 * Builds and stores the nightly delivery path.
 *
 * Uses Google's Routes API (computeRoutes), not the Directions API: Directions
 * went "legacy" in March 2025 and cannot be switched on for new Cloud projects.
 *
 * The key is a SERVER key, read from GOOGLE_ROUTES_API_KEY. It must not be the
 * Maps SDK key in the app — that one ships inside the APK and is public by
 * necessity. Restrict this one to the Routes API and to the server's IP.
 *
 * Without a key, or if Google refuses, the path falls back to straight lines
 * between stops so a line always draws.
 */

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/**
 * Routes API allows 25 intermediate waypoints per request. Chunks of 25 points
 * total (origin + 23 + destination) stay safely inside that, and each chunk
 * starts where the last one ended so the pieces join up.
 */
const MAX_POINTS_PER_REQUEST = 25;

const REQUEST_TIMEOUT_MS = 15000;

/** Distribution point first, then every active stop in delivery order. */
async function routePoints() {
  const markers = await MapMarker.findAll({
    where: { is_active: true },
    order: [['sequence', 'ASC'], ['created_at', 'ASC']],
  });

  const start = markers.find((m) => m.symbol === 'distributor');
  const stops = markers.filter((m) => m.symbol !== 'distributor');

  const toPoint = (m) => ({
    id: m.id,
    label: m.label,
    latitude: Number(m.latitude),
    longitude: Number(m.longitude),
  });

  return { start: start ? toPoint(start) : null, stops: stops.map(toPoint) };
}

/**
 * Fingerprint of the ordered pins. Changes whenever a pin is added, removed,
 * moved, hidden or reordered — which is exactly when the stored line is wrong.
 */
function hashPoints(points) {
  const key = points.map((p) => `${p.id}:${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`).join('|');
  return crypto.createHash('sha1').update(key).digest('hex');
}

/** Consecutive slices that share their joining point. */
function chunkPoints(points, size = MAX_POINTS_PER_REQUEST) {
  if (points.length <= size) return [points];
  const chunks = [];
  for (let i = 0; i < points.length - 1; i += size - 1) {
    chunks.push(points.slice(i, i + size));
  }
  return chunks;
}

function haversine(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const latLng = (p) => ({ location: { latLng: { latitude: p.latitude, longitude: p.longitude } } });

/** One Routes API call for one chunk. Throws with Google's own message on failure. */
async function fetchChunk(points, key, travelMode) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // Ask only for what is stored — the field mask is also what Google bills on.
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: latLng(points[0]),
        destination: latLng(points[points.length - 1]),
        intermediates: points.slice(1, -1).map(latLng),
        travelMode,
        polylineQuality: 'HIGH_QUALITY',
        polylineEncoding: 'ENCODED_POLYLINE',
      }),
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `Routes API returned HTTP ${res.status}`);
    }
    const route = body?.routes?.[0];
    if (!route?.polyline?.encodedPolyline) {
      throw new Error('Routes API found no road route between these points');
    }
    return {
      points: polyline.decode(route.polyline.encodedPolyline),
      distance: Number(route.distanceMeters) || 0,
      // Duration comes back as a string like "1234s".
      duration: parseInt(String(route.duration || '0'), 10) || 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Road-following line through every point, stitched from as many calls as it takes. */
async function roadRoute(points, key) {
  const chunks = chunkPoints(points);

  // Two-wheeler routing matches a scooter better and is supported in India;
  // if Google rejects it for these points, car routing is the next best thing.
  for (const travelMode of ['TWO_WHEELER', 'DRIVE']) {
    try {
      const merged = [];
      let distance = 0;
      let duration = 0;

      for (const chunk of chunks) {
        const part = await fetchChunk(chunk, key, travelMode);
        // Each chunk begins where the previous one ended; drop the repeat.
        merged.push(...(merged.length ? part.points.slice(1) : part.points));
        distance += part.distance;
        duration += part.duration;
      }
      return { points: merged, distance, duration, travelMode, calls: chunks.length };
    } catch (err) {
      if (travelMode === 'DRIVE') throw err;
      logger.warn(`Routes API ${travelMode} failed (${err.message}) — retrying with DRIVE`);
    }
  }
  throw new Error('unreachable');
}

/**
 * Rebuilds the stored path from the current pins.
 * Returns what was saved plus a `warning` when it had to fall back.
 */
async function regenerateRoute(generatedBy) {
  const { start, stops } = await routePoints();
  if (!start) {
    const e = new Error('Add a distribution point first — the path starts there.');
    e.status = 400;
    throw e;
  }
  if (!stops.length) {
    const e = new Error('Add at least one delivery stop first.');
    e.status = 400;
    throw e;
  }

  const points = [start, ...stops];
  const hash = hashPoints(points);
  const key = process.env.GOOGLE_ROUTES_API_KEY;

  let saved;
  let warning = null;

  if (key) {
    try {
      const r = await roadRoute(points, key);
      saved = {
        encoded_polyline: polyline.encode(r.points),
        source: 'directions',
        distance_m: Math.round(r.distance),
        duration_s: Math.round(r.duration),
      };
      logger.info(`Delivery route regenerated: ${stops.length} stops, ${r.calls} Routes API call(s), ${r.travelMode}`);
    } catch (err) {
      warning = `Google could not build a road route (${err.message}), so straight lines were drawn instead.`;
      logger.error(`Routes API failed: ${err.message}`);
    }
  } else {
    warning = 'No GOOGLE_ROUTES_API_KEY is set on the server, so straight lines were drawn between stops.';
  }

  if (!saved) {
    let distance = 0;
    for (let i = 1; i < points.length; i += 1) distance += haversine(points[i - 1], points[i]);
    saved = {
      encoded_polyline: polyline.encode(points),
      source: 'straight',
      distance_m: Math.round(distance),
      duration_s: null,
    };
  }

  const row = { ...saved, waypoints_hash: hash, stop_count: stops.length, generated_by: generatedBy };
  const existing = await DeliveryRoute.findOne({ where: { name: 'main' } });
  if (existing) await existing.update(row);
  else await DeliveryRoute.create({ name: 'main', ...row });

  return { ...row, warning };
}

/** The stored path, flagged stale if the pins have changed since it was made. */
async function currentRoute() {
  const row = await DeliveryRoute.findOne({ where: { name: 'main' } });
  if (!row) return null;

  const { start, stops } = await routePoints();
  const hash = start ? hashPoints([start, ...stops]) : null;

  return {
    encoded_polyline: row.encoded_polyline,
    source: row.source,
    stop_count: row.stop_count,
    distance_m: row.distance_m,
    duration_s: row.duration_s,
    generated_by: row.generated_by,
    generated_at: row.updated_at,
    stale: hash !== row.waypoints_hash,
  };
}

module.exports = {
  regenerateRoute, currentRoute,
  // Exported for tests.
  chunkPoints, hashPoints, roadRoute, MAX_POINTS_PER_REQUEST,
};
