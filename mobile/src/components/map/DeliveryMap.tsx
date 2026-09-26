import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Platform } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { COLORS } from '../../constants/theme';
import { isExpoGo } from '../../utils/runtime';
import {
  MAP_STYLE, MARKER_COLORS, SYMBOL_META,
  DEFAULT_REGION, clusterForRegion, regionForRows, LatLng,
} from '../../constants/mapData';
import { fetchMapMarkers, fetchRoute, type MapMarkerRow, type DeliveryRoute } from '../../services/places';
import { decodePolyline } from '../../utils/polyline';
import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MapPin, PIN_ANCHOR } from './MapPin';
import { RIDER_EMOJI } from '../../constants/mapData';

/**
 * Android has no non-Google map provider, so PROVIDER_DEFAULT (undefined)
 * already renders Google Maps there — no need to force it, and no API key
 * dependency either way.
 *
 * iOS is the platform that actually needs `PROVIDER_GOOGLE` requested, but
 * only in a real build. Expo Go's iOS binary does not have the Google Maps
 * iOS SDK compiled in (that only happens through the config plugin in a real
 * build), so requesting it there makes react-native-maps fail to initialize
 * and MapKit silently falls back to its hardcoded default region — Apple's
 * old Cupertino HQ, California. That is the "map shows America" bug: it was
 * never a data problem, every coordinate here is Bangalore.
 *
 * So: Google on iOS only outside Expo Go; Android always gets its one and
 * only provider; iOS Expo Go falls back to plain Apple Maps, correctly
 * centred on Bangalore even though it won't carry the dark styling (MapKit
 * ignores customMapStyle regardless of provider).
 */
const MAP_PROVIDER = Platform.OS === 'ios' && !isExpoGo ? PROVIDER_GOOGLE : undefined;

/**
 * Native Google Maps view for live delivery tracking.
 *
 * Replaces the old WebView + Maps JavaScript SDK. Markers are plain components
 * now, so there is no injected JS, no postMessage protocol, and no risk of the
 * page reloading on every position update.
 */
export default function DeliveryMap({
  rider,
  style,
}: {
  /** Current rider position, or null when nobody is delivering. */
  rider: LatLng | null;
  style?: any;
}) {
  const mapRef = useRef<MapView>(null);
  const [mapHeight, setMapHeight] = useState(400);
  const [latitudeDelta, setLatitudeDelta] = useState(DEFAULT_REGION.latitudeDelta);
  const [followRider, setFollowRider] = useState(true);

  /**
   * Metres of the attention ring drawn around the rider. A native map Circle,
   * not part of the marker image, so it can never be clipped and it grows as
   * the map is zoomed in — like Google's own location circle.
   */
  const RIDER_RING_M = 90;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setMapHeight(e.nativeEvent.layout.height || 400);
  }, []);

  // Only the visible span matters for clustering, and it changes on every pan,
  // so round it hard to avoid re-clustering on tiny movements.
  const onRegionChangeComplete = useCallback((r: Region) => {
    const rounded = Number(r.latitudeDelta.toFixed(4));
    setLatitudeDelta((prev) => (Math.abs(prev - rounded) > prev * 0.15 ? rounded : prev));
  }, []);

  /**
   * Pins are managed by a super admin and read at runtime, so moving one no
   * longer needs an app release. Nothing else is drawn on the map — a symbol
   * at a point, and the label when you tap it.
   */
  const [markers, setMarkers] = useState<MapMarkerRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchMapMarkers()
      .then((rows) => { if (!cancelled) setMarkers(rows); })
      .catch(() => { /* map still renders, just without pins */ });
    return () => { cancelled = true; };
  }, []);

  /**
   * The delivery path. The road-following line is generated once by a super
   * admin and stored server-side, so drawing it costs no Google call at all.
   */
  const [route, setRoute] = useState<DeliveryRoute | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRoute()
      .then((r) => { if (!cancelled) setRoute(r); })
      .catch(() => { /* older server or no path yet — the straight fallback draws */ });
    return () => { cancelled = true; };
  }, []);

  /**
   * Which line to draw:
   *   - the stored road line, when it still matches the pins;
   *   - otherwise straight segments distribution point → stop 1 → stop 2 …,
   *     built from the pins themselves, so the line always matches what is on
   *     the map. A stale road line could still run to a stop that moved.
   */
  const path = useMemo(() => {
    if (route && !route.stale && route.encoded_polyline) {
      return { points: decodePolyline(route.encoded_polyline), road: route.source === 'directions' };
    }
    const start = markers.find((m) => m.symbol === 'distributor');
    const stops = markers
      .filter((m) => m.symbol !== 'distributor')
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const pts = [...(start ? [start] : []), ...stops]
      .map((m) => ({ latitude: m.latitude, longitude: m.longitude }));
    return { points: pts, road: false };
  }, [route, markers]);

  // Cluster only the dense symbol groups; a handful of pins never collide.
  const clustered = useMemo(() => {
    const bySymbol: Record<string, MapMarkerRow[]> = {};
    for (const m of markers) (bySymbol[m.symbol] ||= []).push(m);

    return Object.entries(bySymbol).flatMap(([symbol, rows]) => {
      if (rows.length < 4) {
        return rows.map((r) => ({ ...r, count: 1 as number, key: r.id }));
      }
      return clusterForRegion(rows, latitudeDelta, mapHeight).map((c, i) => ({
        ...c,
        symbol: symbol as MapMarkerRow['symbol'],
        key: `${symbol}-${i}-${c.count}`,
      }));
    });
  }, [markers, latitudeDelta, mapHeight]);

  // Recentre when the rider moves, unless the user has panned away.
  useEffect(() => {
    if (!rider || !followRider) return;
    mapRef.current?.animateCamera({ center: rider }, { duration: 1200 });
  }, [rider?.latitude, rider?.longitude, followRider]);

  /**
   * Markers here use custom child views (the coloured pin with an emoji).
   * Android renders those by snapshotting the view, and with
   * `tracksViewChanges={false}` set from the start it snapshots before layout
   * has happened — giving blank, invisible markers.
   *
   * So: leave tracking on long enough for the first capture, then switch it
   * off, because leaving it on permanently re-renders every marker each frame
   * and tanks the frame rate. Clustering changes the marker set on zoom, so
   * each new set needs its own capture window.
   */
  /**
   * Pins are drawn with an icon font. Android snapshots each pin into a bitmap,
   * so a snapshot taken before the font arrives is a blank circle forever. Load
   * it up front and restart the capture window once it is in.
   */
  const [iconsReady] = useFonts(MaterialCommunityIcons.font);

  const [tracksChanges, setTracksChanges] = useState(true);
  const clusterKey = clustered.length;

  useEffect(() => {
    setTracksChanges(true);
    const t = setTimeout(() => setTracksChanges(false), 1200);
    return () => clearTimeout(t);
  }, [clusterKey, iconsReady]);

  /**
   * `initialRegion` is read once at mount, and the markers arrive after that,
   * so the first fit has to be animated in rather than passed as a prop.
   * Skipped when a rider is already being followed — that camera wins.
   */
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !markers.length) return;
    fitted.current = true;
    if (rider && followRider) return;
    mapRef.current?.animateToRegion(regionForRows(markers), 600);
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[st.wrap, style]} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        // See MAP_PROVIDER above — Google everywhere except iOS Expo Go, where
        // the SDK isn't available and Apple Maps takes over instead. Keys for
        // the Google path come from app.json: android.config.googleMaps.apiKey
        // and ios.config.googleMapsApiKey (both only apply to real builds).
        provider={MAP_PROVIDER}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        customMapStyle={MAP_STYLE}
        onRegionChangeComplete={onRegionChangeComplete}
        onPanDrag={() => setFollowRider(false)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        loadingEnabled
        loadingBackgroundColor={COLORS.background}
        loadingIndicatorColor={COLORS.primary}
      >
        {/* Delivery path in Google Maps navigation blue: a darker blue casing
            under a bright blue line, solid either way — road-following or not. */}
        {path.points.length > 1 && (
          <>
            <Polyline
              coordinates={path.points}
              strokeColor="#1A5DC8"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
            <Polyline
              coordinates={path.points}
              strokeColor="#4A8CFF"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
              zIndex={2}
            />
          </>
        )}

        {clustered.map((m: any) => {
          const meta = SYMBOL_META[m.symbol as keyof typeof SYMBOL_META] || SYMBOL_META.distributor;
          const grouped = (m.count || 1) > 1;
          return (
            <Marker
              key={m.key}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              // Tapping shows the name and nothing else — no zone, no address,
              // no coordinates.
              title={grouped ? `${m.count} ${meta.label} points` : m.label}
              tracksViewChanges={tracksChanges}
              // A pin points at its spot with its tip; a cluster sits centred.
              anchor={grouped ? { x: 0.5, y: 0.5 } : PIN_ANCHOR}
            >
              {grouped ? (
                <View style={[st.cluster, { backgroundColor: meta.color }]}>
                  <Text style={st.clusterTxt}>{m.count}</Text>
                </View>
              ) : (
                <MapPin symbol={m.symbol} />
              )}
            </Marker>
          );
        })}

        {rider && (
          <>
            <Circle
              center={rider}
              radius={RIDER_RING_M}
              fillColor="rgba(76,175,80,0.18)"
              strokeColor="rgba(76,175,80,0.75)"
              strokeWidth={2}
              zIndex={3}
            />
            <Marker
              coordinate={rider}
              title="Live Rider"
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={999}
              /**
               * Kept on. Freezing this marker's snapshot on the New Architecture
               * produced a cropped image (a quarter of the disc). It is one
               * static view, so tracking costs next to nothing now that the
               * animated pulse is gone.
               */
              tracksViewChanges
            >
              {/* collapsable={false}: a layout-only wrapper is otherwise
                  flattened away on Fabric, and the marker is then sized from
                  the wrong child — the cause of the clipping. */}
              <View style={st.riderWrap} collapsable={false}>
                <View style={st.riderDot} collapsable={false}>
                  <Text style={st.riderEmoji}>{RIDER_EMOJI}</Text>
                </View>
              </View>
            </Marker>
          </>
        )}
      </MapView>

      {/* Re-centre, only offered once the user has panned off the rider */}
      {rider && !followRider && (
        <Text
          style={st.recenter}
          onPress={() => {
            setFollowRider(true);
            mapRef.current?.animateCamera({ center: rider, zoom: 16 }, { duration: 600 });
          }}
        >
          ◎ Recentre on rider
        </Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: COLORS.background },
  cluster: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  clusterTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  // Bigger than the stop pins on purpose — it is the one thing that moves and
  // the thing everyone opens the map to find.
  // A little padding round the disc so its anti-aliased edge is never shaved.
  riderWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  riderDot: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#fff',
    borderWidth: 3.5, borderColor: MARKER_COLORS.rider,
    alignItems: 'center', justifyContent: 'center',
  },
  riderEmoji: {
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
    // Android pads emoji glyphs, which shoves them off-centre in a small disc.
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : {}),
  },
  recenter: {
    position: 'absolute',
    bottom: 14, alignSelf: 'center',
    color: COLORS.background,
    backgroundColor: COLORS.primary,
    fontSize: 12, fontWeight: '700',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
