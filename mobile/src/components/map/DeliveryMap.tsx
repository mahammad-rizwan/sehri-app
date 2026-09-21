import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { COLORS } from '../../constants/theme';
import {
  ZONE_POINTS, GIRLS_POINTS, MAP_STYLE, MARKER_COLORS,
  DEFAULT_REGION, clusterForRegion, regionForAll, LatLng,
} from '../../constants/mapData';

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

  // Pulse behind the rider marker, so "live" reads at a glance.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!rider) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rider, pulse]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setMapHeight(e.nativeEvent.layout.height || 400);
  }, []);

  // Only the visible span matters for clustering, and it changes on every pan,
  // so round it hard to avoid re-clustering on tiny movements.
  const onRegionChangeComplete = useCallback((r: Region) => {
    const rounded = Number(r.latitudeDelta.toFixed(4));
    setLatitudeDelta((prev) => (Math.abs(prev - rounded) > prev * 0.15 ? rounded : prev));
  }, []);

  const girlsClusters = useMemo(
    () => clusterForRegion(GIRLS_POINTS, latitudeDelta, mapHeight),
    [latitudeDelta, mapHeight],
  );

  // Recentre when the rider moves, unless the user has panned away.
  useEffect(() => {
    if (!rider || !followRider) return;
    mapRef.current?.animateCamera({ center: rider }, { duration: 1200 });
  }, [rider?.latitude, rider?.longitude, followRider]);

  const initialRegion = useMemo(() => regionForAll(rider), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[st.wrap, style]} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        // Google on both platforms so the dark style and zone colours match —
        // Apple Maps ignores customMapStyle entirely. Keys come from app.json:
        // android.config.googleMaps.apiKey and ios.config.googleMapsApiKey.
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
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
        {ZONE_POINTS.map((p) => (
          <Marker
            key={p.key}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.title}
            tracksViewChanges={false}
          >
            <View style={[st.pin, { backgroundColor: p.color }]}>
              <Text style={st.pinEmoji}>{p.emoji}</Text>
            </View>
          </Marker>
        ))}

        {girlsClusters.map((c, i) => (
          <Marker
            key={`girls-${i}-${c.count}`}
            coordinate={{ latitude: c.latitude, longitude: c.longitude }}
            title={c.count > 1 ? `${c.count} girls-zone drop points` : 'Girls Zone'}
            description={c.count > 1 ? 'Zoom in to separate' : undefined}
            tracksViewChanges={false}
          >
            {c.count > 1 ? (
              <View style={[st.cluster, { backgroundColor: MARKER_COLORS.girls }]}>
                <Text style={st.clusterTxt}>{c.count}</Text>
              </View>
            ) : (
              <View style={[st.pin, { backgroundColor: MARKER_COLORS.girls }]}>
                <Text style={st.pinEmoji}>🌸</Text>
              </View>
            )}
          </Marker>
        ))}

        {rider && (
          <Marker
            coordinate={rider}
            title="Live Rider"
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}
            // The pulse animates, so this marker does need view tracking.
            tracksViewChanges
          >
            <View style={st.riderWrap}>
              <Animated.View
                style={[
                  st.riderRing,
                  {
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.7] }) }],
                  },
                ]}
              />
              <View style={st.riderDot}>
                <Text style={st.riderEmoji}>🛵</Text>
              </View>
            </View>
          </Marker>
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
  pin: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  pinEmoji: { fontSize: 14 },
  cluster: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  clusterTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  riderWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  riderRing: {
    position: 'absolute',
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: MARKER_COLORS.rider,
  },
  riderDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: MARKER_COLORS.rider,
    borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  riderEmoji: { fontSize: 15 },
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
