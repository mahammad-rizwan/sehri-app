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

export const MAP_LEGEND = [
  { key: 'masjid', label: 'Masjid Zone', emoji: '🕌', color: MARKER_COLORS.masjid },
  { key: 'boys_hostel', label: 'Boys Hostel', emoji: '🏠', color: MARKER_COLORS.boys_hostel },
  { key: 'stanza', label: 'Stanza', emoji: '🏡', color: MARKER_COLORS.stanza },
  { key: 'girls', label: 'Girls Zone', emoji: '🌸', color: MARKER_COLORS.girls },
  { key: 'distributor', label: 'Distribution Point', emoji: '📦', color: MARKER_COLORS.distributor },
  { key: 'rider', label: 'Live Rider', emoji: '🛵', color: MARKER_COLORS.rider },
] as const;

export type LatLng = { latitude: number; longitude: number };

export type ZonePoint = LatLng & {
  key: string;
  title: string;
  emoji: string;
  color: string;
};

export const ZONE_POINTS: ZonePoint[] = [
  { key: 'masjid', title: 'Masjid Zone', emoji: '🕌', color: MARKER_COLORS.masjid, latitude: 12.9227319, longitude: 77.4967204 },
  { key: 'boys_hostel', title: 'Boys Hostel Zone', emoji: '🏠', color: MARKER_COLORS.boys_hostel, latitude: 12.9248564, longitude: 77.4984980 },
  { key: 'stanza', title: 'Stanza Zone', emoji: '🏡', color: MARKER_COLORS.stanza, latitude: 12.9241783, longitude: 77.5027661 },
  { key: 'distributor', title: 'Distribution Point', emoji: '📦', color: MARKER_COLORS.distributor, latitude: 12.896781, longitude: 77.492520 },
];

/**
 * Girls-zone drop points. These range from ~5m to ~110m apart, so they are
 * clustered by on-screen distance at the current zoom rather than on a fixed
 * grid — see clusterForZoom below.
 */
export const GIRLS_POINTS: LatLng[] = [
  { latitude: 12.915364144815069, longitude: 77.49335017975658 },
  { latitude: 12.91419897255419, longitude: 77.4970712624044 },
  { latitude: 12.91570659098925, longitude: 77.50097029509902 },
  { latitude: 12.92380582790466, longitude: 77.50373602588688 },
  { latitude: 12.915201817076271, longitude: 77.50574491044165 },
  { latitude: 12.92328917158393, longitude: 77.5067395085923 },
  { latitude: 12.924111557207349, longitude: 77.5059035085923 },
  { latitude: 12.924099399535349, longitude: 77.5058613085923 },
  { latitude: 12.923876557374848, longitude: 77.50586402393485 },
  { latitude: 12.923720485760734, longitude: 77.50579030859228 },
  { latitude: 12.9235149005565, longitude: 77.50469629694862 },
  { latitude: 12.92376968571744, longitude: 77.50265715277057 },
  { latitude: 12.923668492451107, longitude: 77.50267850549456 },
  { latitude: 12.924408039697022, longitude: 77.50268363108191 },
  { latitude: 12.924348454134918, longitude: 77.50285152258107 },
  { latitude: 12.924592698187322, longitude: 77.50216465549661 },
  { latitude: 12.923720967533537, longitude: 77.50495457595349 },
  { latitude: 12.922765307379874, longitude: 77.50478405498131 },
  { latitude: 12.92292208094766, longitude: 77.50566864866036 },
  { latitude: 12.922738866847084, longitude: 77.50588426715788 },
  { latitude: 12.923428332652984, longitude: 77.50565654271148 },
  { latitude: 12.923442057560338, longitude: 77.50597773722843 },
  { latitude: 12.923727666180895, longitude: 77.50573164456233 },
  { latitude: 12.923877332821611, longitude: 77.50592409304934 },
  { latitude: 12.92392504313272, longitude: 77.50580473473313 },
  { latitude: 12.923808708383447, longitude: 77.50609240169052 },
  { latitude: 12.923469684258185, longitude: 77.50674837557953 },
];

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

export type Cluster = LatLng & { count: number };

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
  points: LatLng[],
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
    if (!merged) out.push({ latitude: p.latitude, longitude: p.longitude, count: 1 });
  }

  return out;
}

/** Region that fits every fixed point, plus the rider when there is one. */
export function regionForAll(rider?: LatLng | null) {
  const pts: LatLng[] = [...ZONE_POINTS, ...GIRLS_POINTS];
  if (rider) pts.push(rider);

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
