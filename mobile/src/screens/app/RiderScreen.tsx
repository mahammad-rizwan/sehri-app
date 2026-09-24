/**
 * RiderScreen — used by the delivery rider to broadcast their live GPS
 * location to the backend every 5 seconds while delivering.
 *
 * How to use:
 *  1. Super admin creates a rider entry and shares the rider ID.
 *  2. Rider opens this screen, enters the rider ID (or scans a QR).
 *  3. Taps "Start Delivery" — the app sends GPS every 5 seconds.
 *  4. Users see the moving pin on their Tracking screen.
 *  5. Rider taps "Stop" when done.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ScrollView, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';

const PUSH_INTERVAL_MS = 10000; // push GPS every 10 seconds
// 10 s = 90 pushes per 15 min, inside riderPushLimiter's 250. Tightening
// this means re-checking that limiter — at 5 s it was exceeding the old 100
// and every run 429'd about eight minutes in.

export default function RiderScreen() {
  const [riderId, setRiderId]       = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [startingUp, setStartingUp] = useState(false);
  const [status, setStatus]         = useState<'idle' | 'delivering' | 'completed'>('delivering');
  const [eta, setEta]               = useState('');
  const [address, setAddress]       = useState('');
  const [lastPush, setLastPush]     = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [coords, setCoords]         = useState<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    // First check if location services are enabled on device
    const providerEnabled = await Location.hasServicesEnabledAsync();
    if (!providerEnabled) {
      Alert.alert(
        'Location Services Disabled',
        'Please enable Location/GPS on your device from Settings, then try again.',
        [{ text: 'OK' }],
      );
      return false;
    }

    const { status: existing } = await Location.getForegroundPermissionsAsync();
    if (existing === 'granted') return true;

    const { status: s } = await Location.requestForegroundPermissionsAsync();
    if (s !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        'Please allow location access so users can track your delivery.',
        [{ text: 'OK' }],
      );
      return false;
    }
    return true;
  };

  const pushGPS = async () => {
    try {
      // Use balanced accuracy with timeout for faster response on real devices
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 3000,
        distanceInterval: 0,
      });
      const { latitude, longitude } = loc.coords;
      setCoords({ lat: latitude, lng: longitude });

      await api.patch(ENDPOINTS.PUSH_LOCATION(riderId.trim()), {
        latitude,
        longitude,
        status,
        ...(eta     ? { eta_minutes: parseInt(eta) }   : {}),
        ...(address ? { current_address: address }     : {}),
      });

      setLastPush(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to push location';
      setError(msg);
    }
  };

  const startTracking = async () => {
    if (!riderId.trim()) {
      Alert.alert('Rider ID required', 'Enter your Rider ID given by the admin.');
      return;
    }
    const ok = await requestPermission();
    if (!ok) return;

    setStartingUp(true);
    setError(null);

    try {
      await pushGPS();
      setIsTracking(true);
      intervalRef.current = setInterval(pushGPS, PUSH_INTERVAL_MS);
    } catch {
      setError('Could not get location. Make sure GPS is on.');
    } finally {
      setStartingUp(false);
    }
  };

  const stopTracking = async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsTracking(false);
    // Mark as completed
    try {
      await api.patch(ENDPOINTS.PUSH_LOCATION(riderId.trim()), {
        status: 'completed',
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      });
    } catch {}
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.root}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

        {/* header */}
        <View style={st.header}>
          <Text style={st.title}>🛵 Rider Tracking</Text>
          <Text style={st.sub}>Broadcast your live location to users</Text>
        </View>

        {/* status card */}
        <LinearGradient
          colors={isTracking
            ? ['rgba(76,175,80,0.18)', 'rgba(76,175,80,0.05)']
            : ['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']}
          style={[st.statusCard, { borderColor: isTracking ? COLORS.accentGreen : COLORS.border }]}
        >
          <View style={[st.statusDot, { backgroundColor: isTracking ? COLORS.accentGreen : COLORS.textMuted }]} />
          <View style={{ flex: 1 }}>
            <Text style={[st.statusTxt, { color: isTracking ? COLORS.accentGreen : COLORS.textSecondary }]}>
              {isTracking ? 'LIVE — Broadcasting location' : 'Not broadcasting'}
            </Text>
            {lastPush && (
              <Text style={st.lastPush}>Last push: {lastPush}</Text>
            )}
            {coords && (
              <Text style={st.coordsTxt}>
                📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
            )}
          </View>
        </LinearGradient>

        {/* error */}
        {error && (
          <View style={st.errorBox}>
            <Ionicons name="warning-outline" size={16} color={COLORS.accentRed} />
            <Text style={st.errorTxt}>{error}</Text>
          </View>
        )}

        {/* rider id input */}
        <Text style={st.label}>Rider ID *</Text>
        <Text style={st.hint}>Get this from the super admin when they add you as a rider</Text>
        <TextInput
          style={[st.input, isTracking && st.inputDisabled]}
          placeholder="Paste Rider ID here"
          placeholderTextColor={COLORS.textMuted}
          value={riderId}
          onChangeText={setRiderId}
          editable={!isTracking}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* delivery status */}
        <Text style={st.label}>Delivery Status</Text>
        <View style={st.statusRow}>
          {(['delivering', 'idle', 'completed'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[st.statusBtn, status === s && st.statusBtnOn]}
              onPress={() => setStatus(s)}
            >
              <Text style={[st.statusBtnTxt, status === s && st.statusBtnTxtOn]}>
                {s === 'delivering' ? '🛵 Delivering'
                : s === 'idle'      ? '⏳ Preparing'
                :                     '✅ Done'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ETA */}
        <Text style={st.label}>ETA (minutes) — optional</Text>
        <TextInput
          style={st.input}
          placeholder="e.g. 10"
          placeholderTextColor={COLORS.textMuted}
          value={eta}
          onChangeText={setEta}
          keyboardType="numeric"
        />

        {/* address */}
        <Text style={st.label}>Current Landmark — optional</Text>
        <TextInput
          style={st.input}
          placeholder="e.g. Near Kengeri Bus Stand"
          placeholderTextColor={COLORS.textMuted}
          value={address}
          onChangeText={setAddress}
        />

        {/* start / stop */}
        {!isTracking ? (
          <TouchableOpacity style={st.startBtn} onPress={startTracking} disabled={startingUp} activeOpacity={0.85}>
            <LinearGradient
              colors={[COLORS.accentGreen, '#2e7d32']}
              style={st.btnGrad}
              start={{ x:0, y:0 }} end={{ x:1, y:0 }}
            >
              {startingUp ? (
                <><Text style={st.btnTxt}>Getting Location...</Text></>
              ) : (
                <><Ionicons name="navigate" size={22} color="#fff" /><Text style={st.btnTxt}>Start Broadcasting</Text></>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={st.stopBtn} onPress={stopTracking} activeOpacity={0.85}>
            <LinearGradient
              colors={[COLORS.accentRed, '#b71c1c']}
              style={st.btnGrad}
              start={{ x:0, y:0 }} end={{ x:1, y:0 }}
            >
              <Ionicons name="stop-circle" size={22} color="#fff" />
              <Text style={st.btnTxt}>Stop Broadcasting</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* info */}
        <LinearGradient
          colors={['rgba(201,168,76,0.07)', 'transparent']}
          style={st.infoBox}
        >
          <Text style={st.infoTitle}>ℹ️ How it works</Text>
          {[
            'Get your Rider ID from the super admin',
            'Tap "Start Broadcasting" when you begin delivery',
            'Your GPS location sends to the server every 5 seconds',
            'Users see your moving pin on the map in real time',
            'Tap "Stop" when delivery is complete',
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
  scroll: { padding: SIZES.spacing.xl, paddingTop: 60, paddingBottom: 80 },

  header: { marginBottom: SIZES.spacing.xl },
  title:  { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '800' },
  sub:    { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },

  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: SIZES.radius.lg, borderWidth: 1.5,
    padding: SIZES.spacing.md, marginBottom: SIZES.spacing.md,
  },
  statusDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  statusTxt:  { fontSize: SIZES.sm, fontWeight: '700' },
  lastPush:   { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  coordsTxt:  { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 2 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,83,80,0.1)',
    borderRadius: SIZES.radius.md, borderWidth: 1, borderColor: COLORS.accentRed,
    padding: SIZES.spacing.sm, marginBottom: SIZES.spacing.md,
  },
  errorTxt: { color: COLORS.accentRed, fontSize: SIZES.xs, flex: 1 },

  label: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontWeight: '600', marginTop: SIZES.spacing.md, marginBottom: 4 },
  hint:  { color: COLORS.textMuted, fontSize: SIZES.xs, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.md,
    color: COLORS.textPrimary, fontSize: SIZES.base,
  },
  inputDisabled: { opacity: 0.5 },

  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn: {
    flex: 1, alignItems: 'center',
    paddingVertical: 10, borderRadius: SIZES.radius.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
  },
  statusBtnOn:    { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.12)' },
  statusBtnTxt:   { color: COLORS.textSecondary, fontSize: SIZES.xs, fontWeight: '600' },
  statusBtnTxtOn: { color: COLORS.primary },

  startBtn: { marginTop: SIZES.spacing.xl, borderRadius: SIZES.radius.lg, overflow: 'hidden' },
  stopBtn:  { marginTop: SIZES.spacing.xl, borderRadius: SIZES.radius.lg, overflow: 'hidden' },
  btnGrad:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  btnTxt: { color: '#fff', fontSize: SIZES.md, fontWeight: '800' },

  infoBox: {
    marginTop: SIZES.spacing.xl, borderRadius: SIZES.radius.lg,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)',
    padding: SIZES.spacing.lg,
  },
  infoTitle: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '700', marginBottom: SIZES.spacing.md },
  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  infoDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 6 },
  infoTxt:   { color: COLORS.textSecondary, fontSize: SIZES.sm, flex: 1, lineHeight: 20 },
});
