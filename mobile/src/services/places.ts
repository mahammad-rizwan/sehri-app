import api from './api';
import { ENDPOINTS } from '../constants/api';

export type ZoneAddress = { id: string; name: string; zone: string; is_active: boolean };

export type MapMarkerRow = {
  id: string;
  label: string;
  source: 'address' | 'zone' | 'custom';
  address_id: string | null;
  zone: string | null;
  symbol: 'masjid' | 'boys_hostel' | 'stanza' | 'girls' | 'distributor';
  /** Delivery order, 1 upwards. Distribution points are 0 — they start the run. */
  sequence: number;
  latitude: number;
  longitude: number;
  is_active: boolean;
};

/**
 * Addresses and map pins are managed by a super admin and read at runtime, so
 * adding a PG or moving a pin no longer needs an app release.
 *
 * Both endpoints are readable without an account: registration needs addresses
 * before a user exists, and the map should draw for guests.
 */
export async function fetchAddresses(zone?: string, includeInactive = false): Promise<ZoneAddress[]> {
  const { data } = await api.get(ENDPOINTS.ADDRESSES, {
    ...(zone ? { zone } : {}),
    ...(includeInactive ? { all: '1' } : {}),
  });
  return data?.data || [];
}

export async function fetchMapMarkers(includeInactive = false): Promise<MapMarkerRow[]> {
  const { data } = await api.get(ENDPOINTS.MAP_MARKERS, includeInactive ? { all: '1' } : undefined);
  return data?.data || [];
}

/* ── Super admin mutations ───────────────────────────────────────────────── */

export async function createAddress(name: string, zone: string) {
  const { data } = await api.post(ENDPOINTS.ADDRESSES, { name, zone });
  return data;
}

export async function updateAddress(id: string, body: Partial<{ name: string; zone: string; is_active: boolean }>) {
  const { data } = await api.patch(ENDPOINTS.ADDRESS_ONE(id), body);
  return data;
}

export async function deleteAddress(id: string) {
  const { data } = await api.delete(ENDPOINTS.ADDRESS_ONE(id));
  return data;
}

export type MarkerInput = {
  source: 'address' | 'zone' | 'custom';
  addressId?: string | null;
  zone?: string | null;
  label?: string;
  symbol: string;
  latitude: number;
  longitude: number;
};

export async function createMarker(body: MarkerInput) {
  const { data } = await api.post(ENDPOINTS.MAP_MARKERS, body);
  return data;
}

export async function updateMarker(id: string, body: Partial<MarkerInput> & { is_active?: boolean }) {
  const { data } = await api.patch(ENDPOINTS.MAP_MARKER_ONE(id), body);
  return data;
}

/** Sends the full ordered id list; the server renumbers 1..n atomically. */
export async function reorderMarkers(order: string[]) {
  const { data } = await api.patch(ENDPOINTS.MAP_MARKERS_REORDER, { order });
  return data;
}

export async function deleteMarker(id: string) {
  const { data } = await api.delete(ENDPOINTS.MAP_MARKER_ONE(id));
  return data;
}

/* ── Delivery path ───────────────────────────────────────────────────────── */

export type DeliveryRoute = {
  encoded_polyline: string;
  /** 'directions' follows the roads; 'straight' joins stops directly. */
  source: 'directions' | 'straight';
  stop_count: number;
  distance_m: number | null;
  duration_s: number | null;
  generated_by: string | null;
  generated_at: string;
  /** True once pins have moved or been reordered since the path was made. */
  stale: boolean;
};

/** The stored path, or null if none has been generated (or the server predates it). */
export async function fetchRoute(): Promise<DeliveryRoute | null> {
  const { data } = await api.get(ENDPOINTS.DELIVERY_ROUTE);
  return data?.data || null;
}

export async function regenerateRoute() {
  // Google can take a few seconds per chunk, so allow longer than the default.
  const { data } = await api.post(ENDPOINTS.DELIVERY_ROUTE_REGENERATE, {}, 45000);
  return data;
}
