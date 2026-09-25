/**
 * Rider Map Screen — rider can preview what users see on the live tracking map.
 * Accessible from the Broadcast screen via "View Live Map" button.
 * Has a back button to return to broadcasting.
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS, SIZES } from '../../src/constants/theme';
import api from '../../src/services/api';
import { ENDPOINTS } from '../../src/constants/api';
import DeliveryMap from '../../src/components/map/DeliveryMap';

const POLL_MS    = 10000; // matches the rider's push interval
const DEFAULT_LAT = 12.9141;
const DEFAULT_LNG = 77.4822;

export default function RiderMapScreen() {
  const router = useRouter();
  const [riders, setRiders]          = useState<any[]>([]);
  const [loading, setLoading]        = useState(true);
  const [selectedRider, setSelected] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(ENDPOINTS.ACTIVE_TRACKING);
      const raw  = data.data;
      const list: any[] = Array.isArray(raw) ? raw : (raw?.riders ?? []);
      setRiders(list);
      setSelected((prev: any) => {
        if (!list.length) return null;
        return list.find((r: any) => r.id === prev?.id) ?? list[0];
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  // Only poll while this screen is on top.
  useFocusEffect(
    useCallback(() => {
      load();
      const iv = setInterval(load, POLL_MS);
      return () => clearInterval(iv);
    }, [load]),
  );

  const rider = selectedRider;
  const riderCoord = rider?.latitude && rider?.longitude
    ? { latitude: parseFloat(rider.latitude), longitude: parseFloat(rider.longitude) }
    : null;

  return (
    <View style={st.root}>
      {/* Map */}
      <View style={st.mapArea}>
        <DeliveryMap rider={riderCoord} />

        {!riderCoord && (
          <View pointerEvents="none" style={st.noRider}>
            <Text style={{ fontSize: 36 }}>🛵</Text>
            <Text style={st.noRiderTitle}>No active delivery</Text>
            <Text style={st.noRiderSub}>Start broadcasting to appear on the map.</Text>
          </View>
        )}
      </View>

      {/* Header gradient with back button */}
      <LinearGradient
        colors={['rgba(5,13,22,0.95)', 'rgba(5,13,22,0.6)', 'transparent']}
        style={st.header}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
          <Text style={st.backTxt}>Back to Broadcast</Text>
        </TouchableOpacity>
        <Text style={st.title}>🗺️ Live Map Preview</Text>
      </LinearGradient>
    </View>
  );
}

const st = StyleSheet.create({
  noRider: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(5,13,22,0.82)', gap: 8, paddingHorizontal: 32,
  },
  noRiderTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  noRiderSub: { color: COLORS.textMuted, fontSize: 12.5, textAlign: 'center', lineHeight: 19 },
  root:    { flex: 1, backgroundColor: '#050D16' },
  mapArea: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0d1b2a' },
  loader:  { ...StyleSheet.absoluteFillObject, backgroundColor: '#050D16', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loaderTxt: { color: COLORS.primary, fontSize: SIZES.sm },

  mapError: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050D16',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 32,
  },
  mapErrorTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  mapErrorSub: { color: '#8899AA', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 56, paddingBottom: 36, paddingHorizontal: SIZES.spacing.xl,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginBottom: SIZES.spacing.sm,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: SIZES.radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
  },
  backTxt: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '600' },
  title:   { color: '#fff', fontSize: SIZES.xl, fontWeight: '800' },
});
