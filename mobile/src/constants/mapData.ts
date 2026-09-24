/**
 * Map data and styling, shared by the user tracking screen and the rider's
 * preview of it.
 *
 * This replaced a WebView running the Google Maps *JavaScript* SDK. We now use
 * react-native-maps, which renders the native Google Maps Android SDK — cheaper
 * (native map loads are not a billed SKU), faster, and it lets markers just be
 * React components.
 */

import { COLORS } from './theme';

/** Marker colours come from the app's zone palette — one source of truth. */
export const MARKER_COLORS = {
  masjid: COLORS.zonesMasjid,          // #C9A84C gold
  boys_hostel: COLORS.zonesBoysHostel, // #4FC3F7 blue
  stanza: COLORS.zonesStanza,          // #AB47BC purple
  girls: COLORS.zonesGirls,            // #EC407A pink
  distributor: '#00BFA5',              // teal — not a zone, the kitchen/pickup point
  rider: COLORS.accentGreen,           // #4CAF50 green — the only thing that moves
} as const;

/**
 * The five symbols a super admin can pick from in Zone & Map Management, and
 * how each one draws. The keys match MapMarker.SYMBOLS on the server.
 */
export const SYMBOL_META = {
  masjid:      { label: 'Masjid',            emoji: '🕌', color: MARKER_COLORS.masjid },
  boys_hostel: { label: 'Boys Hostel',       emoji: '🏠', color: MARKER_COLORS.boys_hostel },
  stanza:      { label: 'Stanza',            emoji: '🏡', color: MARKER_COLORS.stanza },
  girls:       { label: 'Girls Zone',        emoji: '🌸', color: MARKER_COLORS.girls },
  distributor: { label: 'Distribution Point', emoji: '📦', color: MARKER_COLORS.distributor },
} as const;

export type MapSymbol = keyof typeof SYMBOL_META;
export const SYMBOL_KEYS = Object.keys(SYMBOL_META) as MapSymbol[];

/** Legend under the map — the symbols, plus the one thing that moves. */
export const MAP_LEGEND = [
  ...SYMBOL_KEYS.map((key) => ({ key, ...SYMBOL_META[key] })),
  { key: 'rider', label: 'Live Rider', emoji: '🛵', color: MARKER_COLORS.rider },
];

export type LatLng = { latitude: number; longitude: number };

/** Fallback view when no rider has reported a position yet. */
export const DEFAULT_REGION = {
  latitude: 12.9227319,
  longitude: 77.4967204,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

/** The same dark style the WebView used, in the form react-native-maps wants. */
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8899aa' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e3248' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#243c56' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060f1a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#111f30' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#111f30' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1a3a55' }] },
];

export type Cluster = LatLng & { count: number; label?: string };

/**
 * Merge points that would visually collide at the given zoom.
 *
 * A fixed lat/lng grid is the wrong tool for this data — a grid coarse enough
 * to merge the 5m-apart pairs also swallows genuinely separate PGs 110m away.
 * Working in screen space means zooming in always separates them again.
 *
 * `latitudeDelta` stands in for zoom: it is the visible latitude span, so
 * degrees-per-pixel falls out of it directly.
 */
export function clusterForRegion(
  points: (LatLng & { label?: string })[],
  latitudeDelta: number,
  mapHeightPx: number,
): Cluster[] {
  if (!points.length) return [];

  // ~34px is about one marker width, so anything closer would overlap.
  const degreesPerPixel = latitudeDelta / Math.max(mapHeightPx, 1);
  const thresholdDeg = 34 * degreesPerPixel;
  const cosLat = Math.cos((points[0].latitude * Math.PI) / 180);

  const out: Cluster[] = [];

  for (const p of points) {
    let merged = false;
    for (const c of out) {
      const dLat = p.latitude - c.latitude;
      const dLng = (p.longitude - c.longitude) * cosLat;
      if (Math.sqrt(dLat * dLat + dLng * dLng) < thresholdDeg) {
        // Running mean keeps the cluster centred on its members.
        c.latitude = (c.latitude * c.count + p.latitude) / (c.count + 1);
        c.longitude = (c.longitude * c.count + p.longitude) / (c.count + 1);
        c.count++;
        merged = true;
        break;
      }
    }
    // A cluster that ends up with one member is just that pin, so keep its name
    // — zooming in far enough must still tell you what you are looking at.
    if (!merged) out.push({ latitude: p.latitude, longitude: p.longitude, count: 1, label: p.label });
  }

  return out;
}

/**
 * Region that fits every marker, plus the rider when there is one.
 *
 * Markers are loaded from the server, so this is called again once they arrive
 * — before that it falls back to the campus view.
 */
export function regionForRows(rows: LatLng[], rider?: LatLng | null) {
  const pts: LatLng[] = [...rows];
  if (rider) pts.push(rider);
  if (!pts.length) return DEFAULT_REGION;

  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // 1.35 leaves breathing room so pins are not glued to the screen edges.
    latitudeDelta: Math.max((maxLat - minLat) * 1.35, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.35, 0.01),
  };
}
