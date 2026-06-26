import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { COLORS, SIZES } from '../../src/constants/theme';
import { API_BASE_URL } from '../../src/constants/api';

const LOCATION_TASK_NAME = 'sehri-rider-broadcast';

// ── Background location task ──────────────────────────────────────
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as any;
  const loc = locations?.[0];
  if (!loc) return;

  try {
    const riderId = await SecureStore.getItemAsync('riderId');
    const token = await SecureStore.getItemAsync('accessToken');
    if (!riderId || !token) return;

    await fetch(`${API_BASE_URL}/tracking/${riderId}/push-location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        status: 'delivering',
      }),
    });
  } catch {}
});

// ═════════════════════════════════════════════════════════════════
export default function BroadcastScreen() {
  const router = useRouter();

  const [riderId, setRiderId]       = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastPush, setLastPush]     = useState<string | null>(null);
  const [coords, setCoords]         = useState<{ lat: number; lng: number } | null>(null);
  const [pushError, setPushError]   = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load rider ID saved at login
  useEffect(() => {
    SecureStore.getItemAsync('riderId').then((id) => {
      if (id) setRiderId(id);
    });
    return () => {
      stopLocationUpdates();
    };
  }, []);

  const stopLocationUpdates = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  };

  // ── Get current position ────────────────────────────────────────
  const getPosition = async () => {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  };

  // ── Push GPS to server ────────────────────────────────────────
  const pushGPS = async (id: string) => {
    try {
      const { latitude, longitude } = await getPosition();
      setCoords({ lat: latitude, lng: longitude });

      await fetch(`${API_BASE_URL}/tracking/${id}/push-location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await SecureStore.getItemAsync('accessToken')}`,
        },
        body: JSON.stringify({ latitude, longitude, status: 'delivering' }),
      });

      setLastPush(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
      );
      setPushError(null);
    } catch (err: any) {
      const msg = err?.message || 'Failed to send location';
      setPushError(msg);
    }
  };

  // ── Start broadcasting ────────────────────────────────────────
  const startTracking = async () => {
    if (!riderId) {
      Alert.alert('Error', 'Rider ID not found. Please login again.');
      return;
    }

    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) {
      Alert.alert('Permission Required', 'Location access is needed for live tracking.');
      return;
    }

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) {
      Alert.alert(
        'Background Permission Required',
        'Please allow "Always" location access so tracking continues when you switch apps.',
      );
      return;
    }

    setIsTracking(true);
    setPushError(null);

    // Push immediately
    await pushGPS(riderId);

    // Start background location updates
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 20000,
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Sehri Connect',
          notificationBody: 'Broadcasting your location…',
          notificationColor: '#C9A84C',
        },
      });
    } catch {
      // Fallback: use interval if background fails
      intervalRef.current = setInterval(() => pushGPS(riderId), 20000);
    }
  };

  // ── Stop broadcasting ─────────────────────────────────────────
  const stopTracking = async () => {
    await stopLocationUpdates();
    setIsTracking(false);

    // Mark as completed on server
    if (riderId && coords) {
      try {
        await fetch(`${API_BASE_URL}/tracking/${riderId}/push-location`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await SecureStore.getItemAsync('accessToken')}`,
          },
          body: JSON.stringify({
            latitude: coords.lat,
            longitude: coords.lng,
            status: 'completed',
          }),
        });
      } catch {}
    }
  };

  // ── Logout ────────────────────────────────────────────────────
  const logout = async () => {
    await stopTracking();
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('userRole');
    await SecureStore.deleteItemAsync('riderId');
    router.replace('/(auth)/welcome');
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.root}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>🛵 Broadcast</Text>
            <Text style={st.sub}>Share your live location for delivery tracking</Text>
          </View>
          <TouchableOpacity style={st.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.accentRed} />
          </TouchableOpacity>
        </View>

        {/* Live status card */}
        <LinearGradient
          colors={
            isTracking
              ? ['rgba(76,175,80,0.2)', 'rgba(76,175,80,0.06)']
              : ['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']
          }
          style={[st.statusCard, { borderColor: isTracking ? COLORS.accentGreen : COLORS.border }]}
        >
          <View style={[st.liveDot, { backgroundColor: isTracking ? COLORS.accentGreen : COLORS.textMuted }]} />
          <View style={{ flex: 1 }}>
            <Text style={[st.liveTxt, { color: isTracking ? COLORS.accentGreen : COLORS.textSecondary }]}>
              {isTracking ? '🔴 LIVE — Broadcasting your location' : '⏸ Not broadcasting'}
            </Text>
            {lastPush && <Text style={st.lastPush}>Last update: {lastPush}</Text>}
            {coords && (
              <Text style={st.coordsTxt}>
                📍 {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </Text>
            )}
          </View>
        </LinearGradient>

        {/* Error */}
        {pushError && (
          <View style={st.errorBox}>
            <Ionicons name="warning-outline" size={16} color={COLORS.accentRed} />
            <Text style={st.errorTxt}>{pushError}</Text>
          </View>
        )}

        {/* Start / Stop */}
        {!isTracking ? (
          <TouchableOpacity style={st.startBtn} onPress={startTracking} activeOpacity={0.85}>
            <LinearGradient
              colors={[COLORS.accentGreen, '#2e7d32']}
              style={st.btnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Ionicons name="navigate" size={22} color="#fff" />
              <Text style={st.btnTxt}>Start Broadcasting</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={st.stopBtn} onPress={stopTracking} activeOpacity={0.85}>
              <LinearGradient
                colors={[COLORS.accentRed, '#b71c1c']}
                style={st.btnGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name="stop-circle" size={22} color="#fff" />
                <Text style={st.btnTxt}>Stop Broadcasting</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* View in Map — only visible while broadcasting */}
            <TouchableOpacity style={st.mapBtn} onPress={() => router.push('/(rider)/map')} activeOpacity={0.85}>
              <LinearGradient
                colors={['rgba(201,168,76,0.2)', 'rgba(201,168,76,0.05)']}
                style={st.mapBtnGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name="map-outline" size={20} color={COLORS.primary} />
                <Text style={st.mapBtnTxt}>View in Map</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* Info */}
        <LinearGradient
          colors={['rgba(201,168,76,0.08)', 'transparent']}
          style={st.infoBox}
        >
          <Text style={st.infoTitle}>ℹ️ How it works</Text>
          {[
            'Tap Start Broadcasting to begin sharing your location',
            'Your GPS updates every 20 seconds — even when you switch apps',
            'Users see your live pin on the tracking map',
            'Tap Stop when delivery is complete',
          ].map((t, i) => (
            <View key={i} style={st.infoRow}>
              <View style={st.infoDot} />
              <Text style={st.infoTxt}>{t}</Text>
            </View>
          ))}
        </LinearGradient>

      </ScrollView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: SIZES.spacing.xl, paddingTop: 64, paddingBottom: 80 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: SIZES.spacing.xl,
  },
  title:  { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '800' },
  sub:    { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 2 },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(239,83,80,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(239,83,80,0.3)',
  },

  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: SIZES.radius.lg, borderWidth: 1.5,
    padding: SIZES.spacing.md, marginBottom: SIZES.spacing.md,
  },
  liveDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  liveTxt:   { fontSize: SIZES.sm, fontWeight: '700' },
  lastPush:  { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  coordsTxt: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 2 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,83,80,0.1)',
    borderRadius: SIZES.radius.md, borderWidth: 1, borderColor: COLORS.accentRed,
    padding: SIZES.spacing.sm, marginBottom: SIZES.spacing.md,
  },
  errorTxt: { color: COLORS.accentRed, fontSize: SIZES.xs, flex: 1 },

  startBtn: { marginTop: SIZES.spacing.xl, borderRadius: SIZES.radius.lg, overflow: 'hidden' },
  stopBtn:  { marginTop: SIZES.spacing.xl, borderRadius: SIZES.radius.lg, overflow: 'hidden' },
  btnGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  btnTxt:   { color: '#fff', fontSize: SIZES.md, fontWeight: '800' },

  mapBtn:   { marginTop: SIZES.spacing.md, borderRadius: SIZES.radius.lg, overflow: 'hidden' },
  mapBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: SIZES.radius.lg,
  },
  mapBtnTxt: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '700' },

  infoBox: {
    marginTop: SIZES.spacing.xl, borderRadius: SIZES.radius.lg,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', padding: SIZES.spacing.lg,
  },
  infoTitle: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '700', marginBottom: SIZES.spacing.md },
  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  infoDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 6 },
  infoTxt:   { color: COLORS.textSecondary, fontSize: SIZES.sm, flex: 1, lineHeight: 20 },
});
