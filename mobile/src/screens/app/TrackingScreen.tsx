import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import DeliveryMap from '../../components/map/DeliveryMap';
import { MAP_LEGEND } from '../../constants/mapData';

const POLL_MS   = 20000;

const DEFAULT_LAT = 12.9141;
const DEFAULT_LNG = 77.4822;

export default function TrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [riders, setRiders]          = useState<any[]>([]);
  const [loading, setLoading]        = useState(true);
  const [selectedRider, setSelected] = useState<any>(null);


  // ── Hidden rider login: 5 taps ────────────────────────────────
  const riderTaps  = useRef(0);
  const riderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHeaderTap = () => {
    riderTaps.current += 1;
    if (riderTimer.current) clearTimeout(riderTimer.current);
    if (riderTaps.current >= 5) {
      riderTaps.current = 0;
      router.push('/(auth)/rider-login');
      return;
    }
    riderTimer.current = setTimeout(() => { riderTaps.current = 0; }, 2000);
  };

  // ── Fetch active riders every 20s ────────────────────────────
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

  // Polling every 20s in the background burned data and battery for a screen
  // nobody was looking at. Tie it to focus instead.
  useFocusEffect(
    useCallback(() => {
      load();
      const iv = setInterval(load, POLL_MS);
      return () => clearInterval(iv);
    }, [load]),
  );

  const rider = selectedRider;
  const lat   = rider?.latitude  ? parseFloat(rider.latitude)  : DEFAULT_LAT;
  const lng   = rider?.longitude ? parseFloat(rider.longitude) : DEFAULT_LNG;

  // Native marker — just pass the coordinate down, no bridge plumbing.
  const riderCoord = rider?.latitude && rider?.longitude
    ? { latitude: lat, longitude: lng }
    : null;

  return (
    <View style={st.root}>
      {/* ── Top bar with Home back button ── */}
      <View style={[st.topBar, { paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={st.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/home' as any)} style={st.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={st.backBtnText}>Home</Text>
          </TouchableOpacity>
          {/* Hidden 5-tap title for rider login */}
          <TouchableOpacity onPress={handleHeaderTap} activeOpacity={1} style={st.titleTap}>
            <Text style={st.headerTitle}>🛵 Live Tracking</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══  MAP  ══ */}
      <View style={st.mapArea}>
        <DeliveryMap rider={riderCoord} />

        {/* Riders show on the map; this covers the "nobody is out yet" case. */}
        {!riderCoord && !loading && (
          <View pointerEvents="none" style={st.noRider}>
            <Text style={{ fontSize: 40 }}>🛵</Text>
            <Text style={st.noRiderTitle}>No active delivery</Text>
            <Text style={st.noRiderSub}>
              The live pin appears here once a rider starts their round.
            </Text>
          </View>
        )}
      </View>

      {/* ══  BOTTOM — status + what the pin colours mean  ══ */}
      <View style={st.sheet}>
        <Text style={st.statusTxt}>
          {loading ? 'Loading…'
            : riders.length > 0
              ? '🛵 Delivery in progress'
              : '⏳ Waiting for delivery'}
        </Text>

        <View style={st.legend}>
          {MAP_LEGEND.map((l) => (
            <View key={l.key} style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: l.color }]} />
              <Text style={st.legendTxt}>{l.label}</Text>
            </View>
          ))}
        </View>
      </View>
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  legendTxt: { color: COLORS.textMuted, fontSize: 10.5 },
  root:    { flex: 1, backgroundColor: '#050D16' },

  topBar: {
    justifyContent: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  topBarContent: {
    flexDirection: 'row', alignItems: 'center',
    height: Platform.OS === 'ios' ? 44 : 56,
    paddingHorizontal: 4,
  },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
  titleTap:    { flex: 1, alignItems: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700' },

  mapArea: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0d1b2a' },

  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050D16',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  loaderTxt: { color: COLORS.primary, fontSize: SIZES.base },

  mapError: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050D16',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 32,
  },
  mapErrorTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  mapErrorSub: { color: '#8899AA', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sheet: {
    backgroundColor: COLORS.backgroundCard,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.md,
    paddingBottom: SIZES.spacing.xl,
  },
  statusTxt: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '600', textAlign: 'center' },
});
