const bcrypt = require('bcryptjs');
const { Tracking } = require('../models');
const { generateTokens } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { onRiderLocation } = require('../services/geofenceService');

/**
 * GET /tracking/active
 * Get active rider(s) for user's zone
 */
const getActiveTracking = async (req, res) => {
  try {
    const { zone } = req.user;

    const riders = await Tracking.findAll({
      where: { is_active: true, status: ['delivering', 'idle'] },
      attributes: [
        'id', 'rider_name', 'map_url', 'track_date', 'latitude', 'longitude',
        'zone', 'status', 'eta_minutes', 'current_address', 'updated_at',
      ],
      order: [['updated_at', 'DESC']],
    });

    const filtered = riders.filter((r) => r.zone === zone || r.zone === 'all');

    return success(res, {
      riders: filtered,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
    });
  } catch (err) {
    logger.error('getActiveTracking error:', err);
    return error(res, 'Failed to fetch tracking', 500);
  }
};

/**
 * POST /tracking/rider-login
 * Rider logs in with phone + password (set by super admin)
 */
const riderLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return error(res, 'Phone and password are required', 400);
    }

    const rider = await Tracking.findOne({ where: { rider_phone: phone, is_active: true } });
    if (!rider) {
      return error(res, 'Rider account not found or inactive', 404);
    }
    if (!rider.rider_password) {
      return error(res, 'No password set for this rider. Contact super admin.', 400);
    }

    const valid = await bcrypt.compare(password, rider.rider_password);
    if (!valid) {
      return error(res, 'Invalid password', 401);
    }

    // Generate token with role = 'rider' so we can identify them
    const { accessToken, refreshToken } = generateTokens(rider.id, 'rider');

    return success(res, {
      accessToken,
      refreshToken,
      rider: {
        id: rider.id,
        name: rider.rider_name,
        phone: rider.rider_phone,
        zone: rider.zone,
        status: rider.status,
        role: 'rider',
      },
    }, 'Rider login successful');
  } catch (err) {
    logger.error('riderLogin error:', err);
    return error(res, 'Login failed', 500);
  }
};

/**
 * POST /tracking (Super Admin)
 * Create a rider with name, phone, password, zone, date
 */
const createRider = async (req, res) => {
  try {
    const { rider_name, rider_phone, rider_password, map_url, track_date, latitude, longitude, zone = 'all' } = req.body;

    if (!rider_name) return error(res, 'Rider name is required', 400);
    if (!rider_phone) return error(res, 'Rider phone is required', 400);
    if (!rider_password) return error(res, 'Rider password is required', 400);

    // Check phone not already a rider
    const existing = await Tracking.findOne({ where: { rider_phone } });
    if (existing) return error(res, 'A rider with this phone already exists', 400);

    const hashedPassword = await bcrypt.hash(rider_password, 10);
    // IST calendar date — plain toISOString() gives yesterday before 5:30 AM IST.
    const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const rider = await Tracking.create({
      rider_name,
      rider_phone,
      rider_password: hashedPassword,
      map_url: map_url || null,
      track_date: track_date || today,
      latitude: latitude || null,
      longitude: longitude || null,
      zone,
      status: 'idle',
    });

    return success(res, {
      id: rider.id,
      rider_name: rider.rider_name,
      rider_phone: rider.rider_phone,
      zone: rider.zone,
      track_date: rider.track_date,
      is_active: rider.is_active,
    }, 'Rider created', 201);
  } catch (err) {
    logger.error('createRider error:', err);
    return error(res, 'Failed to create rider', 500);
  }
};

/**
 * PATCH /tracking/:id/location (Super Admin)
 */
const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, map_url, track_date, status, eta_minutes, current_address } = req.body;

    const rider = await Tracking.findByPk(id);
    if (!rider) return error(res, 'Rider not found', 404);

    await rider.update({
      latitude:        latitude        !== undefined ? latitude        : rider.latitude,
      longitude:       longitude       !== undefined ? longitude       : rider.longitude,
      map_url:         map_url         !== undefined ? map_url         : rider.map_url,
      track_date:      track_date      || rider.track_date,
      status:          status          || rider.status,
      eta_minutes:     eta_minutes     !== undefined ? eta_minutes     : rider.eta_minutes,
      current_address: current_address || rider.current_address,
    });

    return success(res, {
      id: rider.id, latitude: rider.latitude, longitude: rider.longitude,
      map_url: rider.map_url, status: rider.status,
      eta_minutes: rider.eta_minutes, current_address: rider.current_address,
    }, 'Tracking updated');
  } catch (err) {
    logger.error('updateLocation error:', err);
    return error(res, 'Failed to update location', 500);
  }
};

/**
 * PATCH /tracking/:id/push-location
 * Rider pushes live GPS every 5 seconds from their phone
 */
const pushLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, current_address, status, eta_minutes } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return error(res, 'latitude and longitude are required', 400);
    }

    /**
     * Only the rider themselves may move their pin (a super admin may too).
     * Every signed-in user can see rider ids through /tracking/active, so
     * without this anyone could post fake coordinates — moving the live pin on
     * everyone's map and firing "on the way" / "at your doorstep" alerts to
     * every Sehri recipient.
     */
    const isSelf = req.userRole === 'rider' && req.user?.id === id;
    if (!isSelf && req.userRole !== 'super_admin') {
      return error(res, 'You can only update your own location', 403);
    }

    const rider = await Tracking.findByPk(id);
    if (!rider) return error(res, 'Rider not found', 404);
    if (!rider.is_active) return error(res, 'This rider is not active', 400);

    await rider.update({
      latitude, longitude,
      ...(current_address !== undefined && { current_address }),
      ...(status          !== undefined && { status }),
      ...(eta_minutes     !== undefined && { eta_minutes }),
    });

    // Geofencing runs fire-and-forget. The rider pushes every 5 seconds and
    // live tracking depends on this endpoint staying fast, so a slow lookup or
    // a failing push must never hold up — or fail — the location update.
    onRiderLocation(rider, latitude, longitude)
      .catch((err) => logger.error('geofence error:', err.message));

    return success(res, {
      id: rider.id,
      latitude: rider.latitude,
      longitude: rider.longitude,
      updated_at: rider.updated_at,
    }, 'Location updated');
  } catch (err) {
    logger.error('pushLocation error:', err);
    return error(res, 'Failed to update location', 500);
  }
};

/**
 * PATCH /tracking/:id/toggle (Super Admin)
 */
const toggleRider = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Tracking.findByPk(id);
    if (!rider) return error(res, 'Rider not found', 404);
    await rider.update({ is_active: !rider.is_active });
    return success(res, { is_active: rider.is_active }, 'Rider status toggled');
  } catch (err) {
    logger.error('toggleRider error:', err);
    return error(res, 'Failed to toggle rider', 500);
  }
};

/**
 * GET /tracking/all (Super Admin)
 */
const getAllRiders = async (req, res) => {
  try {
    const riders = await Tracking.findAll({
      attributes: { exclude: ['rider_password'] },
      order: [['created_at', 'DESC']],
    });
    return success(res, riders);
  } catch (err) {
    logger.error('getAllRiders error:', err);
    return error(res, 'Failed to fetch riders', 500);
  }
};

/**
 * DELETE /tracking/:id (Super Admin)
 */
const deleteRider = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Tracking.findByPk(id);
    if (!rider) return error(res, 'Rider not found', 404);
    await rider.destroy();
    return success(res, null, 'Rider deleted successfully');
  } catch (err) {
    logger.error('deleteRider error:', err);
    return error(res, 'Failed to delete rider', 500);
  }
};

module.exports = {
  getActiveTracking, riderLogin, createRider,
  updateLocation, pushLocation, toggleRider, getAllRiders, deleteRider,
};
