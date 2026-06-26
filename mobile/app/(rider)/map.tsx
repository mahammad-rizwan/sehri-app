/**
 * Rider Map Screen — rider can preview what users see on the live tracking map.
 * Accessible from the Broadcast screen via "View Live Map" button.
 * Has a back button to return to broadcasting.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../src/constants/theme';
import api from '../../src/services/api';
import { ENDPOINTS } from '../../src/constants/api';
import { buildMapHtml, NO_RIDER_HTML } from '../../src/utils/mapHtml';

const POLL_MS    = 20000;
const DEFAULT_LAT = 12.9141;
const DEFAULT_LNG = 77.4822;

export default function RiderMapScreen() {
  const router = useRouter();
  const [riders, setRiders]          = useState<any[]>([]);
  const [loading, setLoading]        = useState(true);
  const [mapReady, setMapReady]      = useState(false);
  const [selectedRider, setSelected] = useState<any>(null);
  const webviewRef  = useRef<WebView>(null);
  const prevCoords  = useRef<{ lat: number; lng: number } | null>(null);

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

  // Inject JS to move pin on coord update — no map reload
  useEffect(() => {
    if (!mapReady || !selectedRider) return;
    const lat = selectedRider.latitude  ? parseFloat(selectedRider.latitude)  : null;
    const lng = selectedRider.longitude ? parseFloat(selectedRider.longitude) : null;
    if (!lat || !lng) return;
    const prev = prevCoords.current;
    if (prev && prev.lat === lat && prev.lng === lng) return;
    prevCoords.current = { lat, lng };
    webviewRef.current?.injectJavaScript(
      `if(typeof updatePin==='function'){updatePin(${lat},${lng});}true;`
    );
  }, [selectedRider?.latitude, selectedRider?.longitude, mapReady]);

  const rider   = selectedRider;
  const lat     = rider?.latitude  ? parseFloat(rider.latitude)  : DEFAULT_LAT;
  const lng     = rider?.longitude ? parseFloat(rider.longitude) : DEFAULT_LNG;
  const mapHtml = rider
    ? buildMapHtml(lat, lng)
    : NO_RIDER_HTML;

  return (
    <View style={st.root}>
      {/* Map */}
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
          onLoadEnd={() => setMapReady(true)}
          onError={() => setMapReady(false)}
          startInLoadingState
          renderLoading={() => (
            <View style={st.loader}>
              <Text style={{ fontSize: 28 }}>🌙</Text>
              <Text style={st.loaderTxt}>Loading map…</Text>
            </View>
          )}
        />
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
  root:    { flex: 1, backgroundColor: '#050D16' },
  mapArea: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0d1b2a' },
  loader:  { ...StyleSheet.absoluteFillObject, backgroundColor: '#050D16', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loaderTxt: { color: COLORS.primary, fontSize: SIZES.sm },

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
