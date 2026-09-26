import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../constants/theme';
import { isExpoGo } from '../../utils/runtime';
import { MAP_STYLE, DEFAULT_REGION, SYMBOL_META, LatLng } from '../../constants/mapData';
import { MapPin, PIN_ANCHOR } from '../map/MapPin';

// Same reasoning as DeliveryMap: Google everywhere except iOS Expo Go, which
// has no Google Maps SDK compiled in and would fall back to Cupertino.
const MAP_PROVIDER = Platform.OS === 'ios' && !isExpoGo ? PROVIDER_GOOGLE : undefined;

/**
 * Full-screen map for choosing one point.
 *
 * Tap anywhere to drop the pin, drag it to fine-tune, or press "My location" to
 * jump the camera to where you are standing. Save stays disabled until a pin
 * exists — a marker without a location is not a marker.
 */
export default function MapPicker({
  visible,
  initial,
  symbol,
  onCancel,
  onPick,
}: {
  visible: boolean;
  /** Existing coordinate when editing, so the pin starts where it already is. */
  initial?: LatLng | null;
  symbol?: keyof typeof SYMBOL_META;
  onCancel: () => void;
  onPick: (point: LatLng) => void;
}) {
  const mapRef = useRef<MapView>(null);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  // Reset each time it opens, otherwise the previous marker's pin leaks in.
  useEffect(() => {
    if (visible) setPoint(initial || null);
  }, [visible, initial?.latitude, initial?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps


  const goToMyLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Location permission denied',
          text2: 'Allow location access, or tap the map to place the pin manually.',
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      // Recentre only. The pin is still placed by hand — standing near a place
      // is not the same as marking it.
      mapRef.current?.animateToRegion({ ...here, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 700);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not get your location' });
    } finally {
      setLocating(false);
    }
  };

  const region = initial
    ? { ...initial, latitudeDelta: 0.008, longitudeDelta: 0.008 }
    : DEFAULT_REGION;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={st.wrap}>
        <MapView
          ref={mapRef}
          provider={MAP_PROVIDER}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          customMapStyle={MAP_STYLE}
          onPress={(e) => setPoint(e.nativeEvent.coordinate)}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          loadingEnabled
          loadingBackgroundColor={COLORS.background}
          loadingIndicatorColor={COLORS.primary}
        >
          {point && (
            <Marker
              coordinate={point}
              draggable
              onDragEnd={(e) => setPoint(e.nativeEvent.coordinate)}
              // A dragged pin re-renders constantly, so tracking has to stay on.
              tracksViewChanges
              anchor={PIN_ANCHOR}
            >
              <MapPin symbol={symbol || 'distributor'} />
            </Marker>
          )}
        </MapView>

        {/* Instruction bar */}
        <View style={st.hint} pointerEvents="none">
          <Text style={st.hintTxt}>
            {point ? 'Drag the pin to fine-tune, or tap elsewhere to move it.' : 'Tap the map to drop the pin.'}
          </Text>
          {point && (
            <Text style={st.coords}>
              {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
            </Text>
          )}
        </View>

        {/* My location */}
        <TouchableOpacity style={st.locBtn} onPress={goToMyLocation} disabled={locating} activeOpacity={0.85}>
          {locating
            ? <ActivityIndicator color={COLORS.primary} size="small" />
            : <Ionicons name="locate" size={20} color={COLORS.primary} />}
        </TouchableOpacity>

        {/* Actions */}
        <View style={st.bar}>
          <TouchableOpacity style={[st.btn, st.cancel]} onPress={onCancel} activeOpacity={0.85}>
            <Text style={st.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.btn, st.save, !point && st.saveOff]}
            onPress={() => point && onPick(point)}
            disabled={!point}
            activeOpacity={0.85}
          >
            <Text style={[st.saveTxt, !point && { color: COLORS.textMuted }]}>
              {point ? 'Use this location' : 'Drop a pin first'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.background },

  hint: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 18,
    left: SIZES.spacing.base, right: SIZES.spacing.base,
    backgroundColor: 'rgba(5,13,22,0.88)',
    borderRadius: SIZES.radius.md, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  hintTxt: { color: COLORS.textSecondary, fontSize: 12.5, textAlign: 'center' },
  coords: { color: COLORS.primary, fontSize: 11.5, textAlign: 'center', marginTop: 4, fontWeight: '700' },

  locBtn: {
    position: 'absolute', right: SIZES.spacing.base, bottom: 108,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(5,13,22,0.92)',
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },

  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 10,
    padding: SIZES.spacing.base, paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: 'rgba(5,13,22,0.94)',
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  btn: { flex: 1, paddingVertical: 14, borderRadius: SIZES.radius.md, alignItems: 'center' },
  cancel: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary },
  cancelTxt: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  save: { flex: 1.4, backgroundColor: COLORS.primary },
  saveOff: { backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  saveTxt: { color: COLORS.background, fontSize: 14, fontWeight: '800' },
});
