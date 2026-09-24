/**
 * Broadcast channel presets.
 *
 * A channel is nothing more than a named set of zones. Keeping them as presets
 * rather than rows means there is no membership table to drift out of sync — a
 * user's zone alone decides what they receive, so moving zones updates their
 * channels immediately.
 */

const ZONES = ['masjid', 'boys_hostel', 'stanza', 'girls'];

/** Everything except the girls zone. */
const BOYS_ZONES = ['masjid', 'boys_hostel', 'stanza'];

const CHANNELS = {
  all: {
    key: 'all',
    name: 'All Zones',
    emoji: '📢',
    description: 'Everyone, across every zone',
    zones: ZONES,
  },
  boys: {
    key: 'boys',
    name: 'Boys Channel',
    emoji: '👨',
    description: 'Masjid, Boys Hostel and Stanza zones',
    zones: BOYS_ZONES,
  },
  girls: {
    key: 'girls',
    name: 'Girls Channel',
    emoji: '🌸',
    description: 'Girls zone only',
    zones: ['girls'],
  },
  masjid: {
    key: 'masjid', name: 'Masjid Zone', emoji: '🕌',
    description: 'Masjid zone only', zones: ['masjid'],
  },
  boys_hostel: {
    key: 'boys_hostel', name: 'Boys Hostel Zone', emoji: '🏠',
    description: 'Boys Hostel zone only', zones: ['boys_hostel'],
  },
  stanza: {
    key: 'stanza', name: 'Stanza Zone', emoji: '🏡',
    description: 'Stanza zone only', zones: ['stanza'],
  },
  /** Super admin picking zones by hand rather than using a preset. */
  custom: {
    key: 'custom',
    name: 'Selected Zones',
    emoji: '🎯',
    description: 'A hand-picked set of zones',
    zones: [],
  },
};

/**
 * Which channels a given role may post to.
 *
 * Super admins reach anyone. A zone admin may only address their own zone —
 * they get exactly one channel, the one matching the zone they administer.
 */
function channelsForSender(role, zone) {
  if (role === 'super_admin') {
    return Object.values(CHANNELS).filter((c) => c.key !== 'custom');
  }
  if (role === 'admin' && CHANNELS[zone]) {
    return [CHANNELS[zone]];
  }
  return [];
}

/**
 * Resolves a send request to the zones it may actually reach, or throws.
 *
 * This is the single enforcement point: an admin cannot widen their audience
 * by passing a different channel key or an explicit zone list, because both
 * are intersected against what their role allows.
 */
function resolveAudience({ role, zone, channelKey, zones }) {
  if (role === 'admin') {
    if (!CHANNELS[zone]) throw new Error('Your account has no zone to broadcast to');
    // Whatever they asked for, an admin only ever reaches their own zone.
    if (channelKey && channelKey !== zone) {
      throw new Error('You can only broadcast to your own zone');
    }
    return { channelKey: zone, zones: [zone] };
  }

  if (role !== 'super_admin') throw new Error('Not allowed to broadcast');

  // Super admin: an explicit zone list wins, otherwise use the preset.
  if (Array.isArray(zones) && zones.length) {
    const clean = [...new Set(zones)].filter((z) => ZONES.includes(z));
    if (!clean.length) throw new Error('Pick at least one valid zone');
    // Collapse to a preset when the selection happens to match one, so the
    // feed shows "Boys Channel" rather than a generic custom label.
    const preset = Object.values(CHANNELS).find(
      (c) => c.key !== 'custom' && c.zones.length === clean.length && c.zones.every((z) => clean.includes(z)),
    );
    return { channelKey: preset ? preset.key : 'custom', zones: clean };
  }

  const ch = CHANNELS[channelKey];
  if (!ch || ch.key === 'custom') throw new Error('Unknown channel');
  return { channelKey: ch.key, zones: ch.zones };
}

module.exports = { ZONES, BOYS_ZONES, CHANNELS, channelsForSender, resolveAudience };
