import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import { buildMapHtml, NO_RIDER_HTML } from '../../utils/mapHtml';

const POLL_MS   = 20000;

const DEFAULT_LAT = 12.9141;
const DEFAULT_LNG = 77.4822;

export default function TrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [riders, setRiders]          = useState<any[]>([]);
  const [loading, setLoading]        = useState(true);
  const [selectedRider, setSelected] = useState<any>(null);
  const [mapReady, setMapReady]      = useState(false);
  const [mapError, setMapError]      = useState(false);

  const webviewRef  = useRef<WebView>(null);
  const prevCoords  = useRef<{ lat: number; lng: number } | null>(null);

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

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  const rider = selectedRider;
  const lat   = rider?.latitude  ? parseFloat(rider.latitude)  : DEFAULT_LAT;
  const lng   = rider?.longitude ? parseFloat(rider.longitude) : DEFAULT_LNG;

  // ── Inject JS to move pin without reloading ─────────────────
  useEffect(() => {
    if (!mapReady || !rider?.latitude || !rider?.longitude) return;
    const prev = prevCoords.current;
    if (prev && prev.lat === lat && prev.lng === lng) return;
    prevCoords.current = { lat, lng };
    webviewRef.current?.injectJavaScript(`
      if (typeof updatePin === 'function') { updatePin(${lat}, ${lng}); }
      true;
    `);
  }, [rider?.latitude, rider?.longitude, mapReady]);

  const mapHtml = rider
    ? buildMapHtml(lat, lng)
    : NO_RIDER_HTML;

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
        <WebView
          ref={webviewRef}
          key={rider?.id ?? 'no-rider'}
          source={{ html: mapHtml }}
          style={st.webview}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          onLoadEnd={() => { setMapReady(true); setMapError(false); prevCoords.current = null; }}
          onError={() => { setMapReady(false); setMapError(true); }}
          startInLoadingState
          renderLoading={() => (
            <View style={st.loader}>
              <Text style={{ fontSize: 32 }}>🌙</Text>
              <Text style={st.loaderTxt}>Loading map…</Text>
            </View>
          )}
        />
        {mapError && (
          <View style={st.mapError}>
            <Text style={{ fontSize: 40 }}>🗺️</Text>
            <Text style={st.mapErrorTitle}>Map unavailable</Text>
            <Text style={st.mapErrorSub}>Check your internet connection.{'\n'}Google Maps may need an unrestricted API key.</Text>
          </View>
        )}
      </View>

      {/* ══  BOTTOM — minimal status  ══ */}
      <View style={st.sheet}>
        <Text style={st.statusTxt}>
          {loading ? 'Loading…'
            : riders.length > 0
              ? '🛵 Delivery in progress'
              : '⏳ Waiting for delivery'}
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
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
