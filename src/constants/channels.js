/**
 * Broadcast audience rules.
 *
 * There are no channel presets — a sender picks zones directly. Audience is
 * therefore just a set of zone keys, and membership needs no table: a user's
 * `zone` alone decides what they receive, so moving zones updates what they
 * see immediately.
 */

const ZONES = ['masjid', 'boys_hostel', 'stanza', 'girls'];

/**
 * Which zones a sender is allowed to address.
 *
 * Super admins reach any zone. A zone admin may only address the single zone
 * they administer.
 */
function allowedZonesFor(role, zone) {
  if (role === 'super_admin') return ZONES;
  if (role === 'admin' && ZONES.includes(zone)) return [zone];
  return [];
}

/**
 * Resolves a send request to the zones it may actually reach, or throws.
 *
 * This is the single enforcement point. Whatever a caller asks for is
 * intersected with what their role permits, so an admin cannot widen their
 * audience by passing extra zones — the request is clamped, never honoured.
 */
function resolveAudience({ role, zone, zones }) {
  const allowed = allowedZonesFor(role, zone);
  if (!allowed.length) {
    throw new Error(
      role === 'admin'
        ? 'Your account has no zone to broadcast to'
        : 'Not allowed to broadcast',
    );
  }

  // An admin has exactly one zone; there is nothing to choose.
  if (role === 'admin') return { zones: allowed };

  if (!Array.isArray(zones) || !zones.length) {
    throw new Error('Pick at least one zone');
  }

  const clean = [...new Set(zones)].filter((z) => allowed.includes(z));
  if (!clean.length) throw new Error('Pick at least one valid zone');

  // Keep a stable order so stored audiences compare predictably.
  return { zones: ZONES.filter((z) => clean.includes(z)) };
}

module.exports = { ZONES, allowedZonesFor, resolveAudience };
