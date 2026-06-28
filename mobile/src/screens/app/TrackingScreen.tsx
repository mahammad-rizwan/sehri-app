import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import { buildMapHtml, NO_RIDER_HTML } from '../../utils/mapHtml';

const POLL_MS   = 20000;

const DEFAULT_LAT = 12.9141;
const DEFAULT_LNG = 77.4822;

export default function TrackingScreen() {
  const router = useRouter();

  const [riders, setRiders]          = useState<any[]>([]);
  const [loading, setLoading]        = useState(true);
  const [selectedRider, setSelected] = useState<any>(null);
  const [mapReady, setMapReady]      = useState(false);

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
          onLoadEnd={() => { setMapReady(true); prevCoords.current = null; }}
          onError={() => setMapReady(false)}
          startInLoadingState
          renderLoading={() => (
            <View style={st.loader}>
              <Text style={{ fontSize: 32 }}>🌙</Text>
              <Text style={st.loaderTxt}>Loading map…</Text>
            </View>
          )}
        />
      </View>

      {/* ══  HEADER — only title, hidden 5-tap for rider login  ══ */}
      <LinearGradient
        colors={['rgba(5,13,22,0.93)', 'rgba(5,13,22,0.52)', 'transparent']}
        style={st.header}
        pointerEvents="box-none"
      >
        <TouchableOpacity onPress={handleHeaderTap} activeOpacity={0.85}>
          <Text style={st.headerTitle}>🛵 Live Tracking</Text>
        </TouchableOpacity>
      </LinearGradient>

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
  mapArea: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0d1b2a' },

  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050D16',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  loaderTxt: { color: COLORS.primary, fontSize: SIZES.base },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 12, paddingBottom: 40,
    paddingHorizontal: SIZES.spacing.xl,
  },
  headerTitle: { color: '#fff', fontSize: SIZES.xl, fontWeight: '800' },

  sheet: {
    backgroundColor: COLORS.backgroundCard,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.md,
    paddingBottom: SIZES.spacing.xl,
  },

  statusTxt: { color:COLORS.textPrimary, fontSize:SIZES.sm, fontWeight:'600', textAlign:'center' },
});
