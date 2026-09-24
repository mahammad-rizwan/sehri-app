const { ZoneAddress, MapMarker } = require('../models');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const ZONES = ['masjid', 'boys_hostel', 'stanza', 'girls'];
const ZONE_LABELS = {
  masjid: 'Masjid Zone',
  boys_hostel: 'Boys Hostel Zone',
  stanza: 'Stanza Zone',
  girls: 'Girls Zone',
};

/* ────────────────────────────────────────────────────────────────────────────
 * Zone addresses
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * GET /places/addresses
 *
 * Open to guests because the registration screen needs it before anyone has an
 * account. `?all=1` includes deactivated rows, for the management screen.
 */
const listAddresses = async (req, res) => {
  try {
    const where = {};
    if (req.query.zone && ZONES.includes(req.query.zone)) where.zone = req.query.zone;
    // Registration must only offer addresses that are still in use.
    const includeInactive = req.query.all === '1' && req.userRole === 'super_admin';
    if (!includeInactive) where.is_active = true;

    const rows = await ZoneAddress.findAll({ where, order: [['zone', 'ASC'], ['name', 'ASC']] });

    return success(res, rows.map((a) => ({
      id: a.id, name: a.name, zone: a.zone, is_active: a.is_active,
    })));
  } catch (err) {
    logger.error('listAddresses error:', err);
    return error(res, `Failed to load addresses: ${err.message}`, 500);
  }
};

const createAddress = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const { zone } = req.body;

    if (!name) return error(res, 'Address name is required', 400);
    if (!ZONES.includes(zone)) return error(res, 'Pick a valid zone', 400);

    // Same name in the same zone would be indistinguishable in the picker.
    const clash = await ZoneAddress.findOne({ where: { name, zone } });
    if (clash) return error(res, 'That address already exists in this zone', 409);

    const row = await ZoneAddress.create({ name, zone, created_by: req.user.id });
    logger.info(`Address created: ${name} (${zone}) by ${req.user.id}`);

    return success(res, { id: row.id, name: row.name, zone: row.zone, is_active: true },
      'Address added', 201);
  } catch (err) {
    logger.error('createAddress error:', err);
    return error(res, 'Failed to add address', 500);
  }
};

const updateAddress = async (req, res) => {
  try {
    const row = await ZoneAddress.findByPk(req.params.id);
    if (!row) return error(res, 'Address not found', 404);

    const updates = {};
    if (req.body.name !== undefined) {
      const name = (req.body.name || '').trim();
      if (!name) return error(res, 'Address name cannot be empty', 400);
      updates.name = name;
    }
    if (req.body.zone !== undefined) {
      if (!ZONES.includes(req.body.zone)) return error(res, 'Pick a valid zone', 400);
      updates.zone = req.body.zone;
    }
    if (req.body.is_active !== undefined) updates.is_active = !!req.body.is_active;

    if (!Object.keys(updates).length) return error(res, 'Nothing to update', 400);

    await row.update(updates);
    return success(res, { id: row.id, name: row.name, zone: row.zone, is_active: row.is_active },
      'Address updated');
  } catch (err) {
    logger.error('updateAddress error:', err);
    return error(res, 'Failed to update address', 500);
  }
};

/**
 * DELETE /places/addresses/:id
 *
 * Deactivates rather than deletes when the address is in use, so existing users
 * do not end up pointing at a row that no longer exists.
 */
const deleteAddress = async (req, res) => {
  try {
    const row = await ZoneAddress.findByPk(req.params.id);
    if (!row) return error(res, 'Address not found', 404);

    const { User } = require('../models');
    const inUse = await User.count({ where: { address: row.name } });

    if (inUse > 0) {
      await row.update({ is_active: false });
      return success(res, { deactivated: true, users: inUse },
        `${inUse} user${inUse > 1 ? 's are' : ' is'} registered at this address, so it was hidden from new registrations instead of deleted`);
    }

    await row.destroy();
    return success(res, { deactivated: false }, 'Address deleted');
  } catch (err) {
    logger.error('deleteAddress error:', err);
    return error(res, 'Failed to delete address', 500);
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * Map markers
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * GET /places/markers
 *
 * What the delivery map draws. Open to guests for the same reason as addresses
 * — the map should render before anyone signs in.
 */
const listMarkers = async (req, res) => {
  try {
    const includeInactive = req.query.all === '1' && req.userRole === 'super_admin';
    const where = includeInactive ? {} : { is_active: true };

    const rows = await MapMarker.findAll({ where, order: [['created_at', 'ASC']] });

    return success(res, rows.map((m) => ({
      id: m.id,
      label: m.label,
      source: m.source,
      address_id: m.address_id,
      zone: m.zone,
      symbol: m.symbol,
      // Decimals come back as strings from MySQL; the map wants numbers.
      latitude: Number(m.latitude),
      longitude: Number(m.longitude),
      is_active: m.is_active,
    })));
  } catch (err) {
    logger.error('listMarkers error:', err);
    return error(res, `Failed to load map markers: ${err.message}`, 500);
  }
};

/** Works out the label from whichever source the super admin chose. */
async function resolveLabel({ source, addressId, zone, label }) {
  if (source === 'address') {
    if (!addressId) throw new Error('Pick an address');
    const addr = await ZoneAddress.findByPk(addressId);
    if (!addr) throw new Error('That address no longer exists');
    return { label: addr.name, address_id: addr.id, zone: addr.zone };
  }
  if (source === 'zone') {
    if (!ZONES.includes(zone)) throw new Error('Pick a valid zone');
    return { label: ZONE_LABELS[zone], address_id: null, zone };
  }
  const custom = (label || '').trim();
  if (!custom) throw new Error('Enter a name for this marker');
  return { label: custom, address_id: null, zone: null };
}

function validCoord(lat, lng) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

const createMarker = async (req, res) => {
  try {
    const { source = 'custom', addressId, zone, label, symbol, latitude, longitude } = req.body;

    if (!MapMarker.SYMBOLS.includes(symbol)) {
      return error(res, 'Pick a valid symbol', 400);
    }
    // The pin is the whole point of a marker, so it is required.
    if (!validCoord(Number(latitude), Number(longitude))) {
      return error(res, 'Drop a pin on the map to set the location', 400);
    }

    let resolved;
    try {
      resolved = await resolveLabel({ source, addressId, zone, label });
    } catch (e) {
      return error(res, e.message, 400);
    }

    const row = await MapMarker.create({
      ...resolved,
      source,
      symbol,
      latitude: Number(latitude),
      longitude: Number(longitude),
      created_by: req.user.id,
    });

    logger.info(`Map marker created: ${row.label} (${symbol}) by ${req.user.id}`);

    return success(res, {
      id: row.id, label: row.label, symbol: row.symbol,
      latitude: Number(row.latitude), longitude: Number(row.longitude),
    }, 'Marker added', 201);
  } catch (err) {
    logger.error('createMarker error:', err);
    return error(res, 'Failed to add marker', 500);
  }
};

const updateMarker = async (req, res) => {
  try {
    const row = await MapMarker.findByPk(req.params.id);
    if (!row) return error(res, 'Marker not found', 404);

    const updates = {};

    if (req.body.source !== undefined) {
      try {
        Object.assign(updates, await resolveLabel({
          source: req.body.source,
          addressId: req.body.addressId,
          zone: req.body.zone,
          label: req.body.label,
        }));
        updates.source = req.body.source;
      } catch (e) {
        return error(res, e.message, 400);
      }
    }

    if (req.body.symbol !== undefined) {
      if (!MapMarker.SYMBOLS.includes(req.body.symbol)) return error(res, 'Pick a valid symbol', 400);
      updates.symbol = req.body.symbol;
    }

    if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
      const lat = Number(req.body.latitude), lng = Number(req.body.longitude);
      if (!validCoord(lat, lng)) return error(res, 'Drop a pin on the map to set the location', 400);
      updates.latitude = lat;
      updates.longitude = lng;
    }

    if (req.body.is_active !== undefined) updates.is_active = !!req.body.is_active;

    if (!Object.keys(updates).length) return error(res, 'Nothing to update', 400);

    await row.update(updates);
    return success(res, {
      id: row.id, label: row.label, symbol: row.symbol,
      latitude: Number(row.latitude), longitude: Number(row.longitude),
      is_active: row.is_active,
    }, 'Marker updated');
  } catch (err) {
    logger.error('updateMarker error:', err);
    return error(res, 'Failed to update marker', 500);
  }
};

const deleteMarker = async (req, res) => {
  try {
    const row = await MapMarker.findByPk(req.params.id);
    if (!row) return error(res, 'Marker not found', 404);
    await row.destroy();
    logger.info(`Map marker deleted: ${row.label} by ${req.user.id}`);
    return success(res, null, 'Marker deleted');
  } catch (err) {
    logger.error('deleteMarker error:', err);
    return error(res, 'Failed to delete marker', 500);
  }
};

module.exports = {
  listAddresses, createAddress, updateAddress, deleteAddress,
  listMarkers, createMarker, updateMarker, deleteMarker,
  ZONES, ZONE_LABELS,
};
