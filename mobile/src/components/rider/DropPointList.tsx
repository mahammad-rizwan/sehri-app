import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { COLORS, SIZES } from '../../constants/theme';
import { API_BASE_URL } from '../../constants/api';
import { SYMBOL_META, type MapSymbol } from '../../constants/mapData';

type Stop = {
  id: string;
  position: number;
  label: string;
  symbol: MapSymbol;
  mode: 'doorstep' | 'zone_point';
  count: number;
  latitude: number;
  longitude: number;
  delivered: boolean;
  delivered_at: string | null;
  delivered_by: string | null;
};

type DropPoints = {
  date: string;
  total: number;
  routed: number;
  stops: Stop[];
  next_stop_id: string | null;
  delivered_stops: number;
  active_stops: number;
  unrouted: { address: string; zone: string | null; count: number }[];
};

/** Re-read while the screen is open, so a second rider's ticks show up. */
const REFRESH_MS = 30000;

/**
 * Plain fetch with the rider's token, the same way the rest of the rider screen
 * talks to the server. The shared `api` client is deliberately not used: its
 * 401 handler clears stored tokens, which would log a rider out mid-delivery.
 */
async function riderFetch(path: string, init?: RequestInit) {
  const token = await SecureStore.getItemAsync('accessToken');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body?.data;
}

/**
 * Tonight's drop points for the rider: every stop in delivery order with how
 * many Sehri go there, a checkbox to tick it off, and the next stop pulled out
 * at the top so the rider never has to scan the list mid-ride.
 */
export default function DropPointList() {
  const [data, setData] = useState<DropPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await riderFetch('/tracking/drop-points'));
      setError(null);
    } catch (e: any) {
      setError(e?.status === 404
        ? 'Drop points need the latest backend deployed.'
        : (e?.message || 'Could not load drop points'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const iv = setInterval(load, REFRESH_MS);
      return () => clearInterval(iv);
    }, [load]),
  );

  /**
   * Ticks a stop on or off. The list updates immediately and the next stop moves
   * on; if the server refuses, reload so the screen never shows a false tick.
   */
  const toggle = async (stop: Stop) => {
    if (busyId) return;
    const delivered = !stop.delivered;
    setBusyId(stop.id);
    setData((prev) => {
      if (!prev) return prev;
      const stops = prev.stops.map((s) => (s.id === stop.id ? { ...s, delivered } : s));
      const active = stops.filter((s) => s.count > 0);
      return {
        ...prev,
        stops,
        next_stop_id: active.find((s) => !s.delivered)?.id || null,
        delivered_stops: active.filter((s) => s.delivered).length,
      };
    });
    try {
      await riderFetch(`/tracking/drop-points/${stop.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ delivered }),
      });
    } catch (e: any) {
      setError(e?.message || 'Could not update that stop');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  /** Hands the next stop to Google Maps for turn-by-turn. Opening Maps costs no API call. */
  const navigate = (s: Stop) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`
      + `&travelmode=${Platform.OS === 'android' ? 'two-wheeler' : 'driving'}`;
    Linking.openURL(url).catch(() => setError('Could not open Google Maps'));
  };

  if (loading) {
    return (
      <View style={st.card}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={st.card}>
        <Text style={st.heading}>TODAY'S DROP POINTS</Text>
        <Text style={st.errorTxt}>{error || 'Nothing to show'}</Text>
        <TouchableOpacity onPress={load} style={st.retry}>
          <Text style={st.retryTxt}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const active = data.stops.filter((s) => s.count > 0);
  const idle = data.stops.length - active.length;
  const next = active.find((s) => s.id === data.next_stop_id) || null;
  const pct = data.active_stops ? data.delivered_stops / data.active_stops : 0;
  const unroutedCount = data.unrouted.reduce((n, u) => n + u.count, 0);
  const dateLabel = new Date(`${data.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <View style={st.card}>
      <View style={st.headRow}>
        <Text style={st.heading}>TODAY'S DROP POINTS</Text>
        <Text style={st.date}>{dateLabel}</Text>
      </View>

      {data.total === 0 ? (
        <Text style={st.empty}>No one is receiving Sehri today — nothing to deliver.</Text>
      ) : (
        <>
          <Text style={st.summary}>
            {data.total} Sehri · {data.active_stops} stops · {data.delivered_stops} of {data.active_stops} delivered
          </Text>
          <View style={st.bar}>
            <View style={[st.barFill, { width: `${Math.round(pct * 100)}%` }]} />
          </View>

          {/* The one the rider needs right now */}
          {next ? (
            <View style={st.nextCard}>
              <Text style={st.nextTag}>NEXT STOP · #{next.position}</Text>
              <View style={st.nextRow}>
                <Text style={st.nextEmoji}>{SYMBOL_META[next.symbol]?.emoji || '📍'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.nextLabel} numberOfLines={2}>{next.label}</Text>
                  <Text style={st.nextMode}>
                    {next.mode === 'doorstep' ? 'Deliver to the door' : 'Zone collection point'}
                  </Text>
                </View>
                <View style={st.countBig}>
                  <Text style={st.countBigNum}>{next.count}</Text>
                  <Text style={st.countBigLbl}>Sehri</Text>
                </View>
              </View>
              <View style={st.nextActions}>
                <TouchableOpacity style={st.navBtn} onPress={() => navigate(next)} activeOpacity={0.85}>
                  <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
                  <Text style={st.navTxt}>Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.doneBtn, busyId === next.id && { opacity: 0.6 }]}
                  onPress={() => toggle(next)}
                  disabled={!!busyId}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={17} color="#fff" />
                  <Text style={st.doneTxt}>Mark delivered</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : active.length > 0 ? (
            <View style={st.allDone}>
              <Ionicons name="checkmark-done-circle" size={22} color={COLORS.accentGreen} />
              <Text style={st.allDoneTxt}>All {active.length} stops delivered. Jazakallah khair!</Text>
            </View>
          ) : null}

          {/* Every stop, in route order */}
          {active.map((s) => {
            const isNext = s.id === data.next_stop_id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[st.row, isNext && st.rowNext, s.delivered && st.rowDone]}
                onPress={() => toggle(s)}
                disabled={!!busyId}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={s.delivered ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={s.delivered ? COLORS.accentGreen : isNext ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={st.pos}>{s.position}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[st.label, s.delivered && st.labelDone]} numberOfLines={1}>{s.label}</Text>
                  <Text style={st.meta}>
                    {s.mode === 'doorstep' ? 'to the door' : 'zone point'}
                    {s.delivered && s.delivered_by ? ` · ✓ ${s.delivered_by}` : ''}
                  </Text>
                </View>
                <View style={[st.count, s.delivered && { opacity: 0.5 }]}>
                  <Text style={st.countTxt}>{s.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {idle > 0 && (
            <Text style={st.idle}>
              {idle} stop{idle > 1 ? 's have' : ' has'} no Sehri today and {idle > 1 ? 'are' : 'is'} skipped.
            </Text>
          )}

          {/* People who are owed Sehri but have no pin on the route */}
          {unroutedCount > 0 && (
            <View style={st.warnBox}>
              <View style={st.warnHead}>
                <Ionicons name="warning" size={15} color={COLORS.accentOrange} />
                <Text style={st.warnTitle}>
                  {unroutedCount} {unroutedCount > 1 ? 'people are' : 'person is'} getting Sehri with no drop point on the route
                </Text>
              </View>
              {data.unrouted.map((u) => (
                <Text key={`${u.zone}|${u.address}`} style={st.warnLine}>
                  • {u.address} — {u.count}
                </Text>
              ))}
              <Text style={st.warnHint}>Ask the super admin to add a pin for these in Zone & Map.</Text>
            </View>
          )}
        </>
      )}

      {error && <Text style={[st.errorTxt, { marginTop: 10 }]}>{error}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: SIZES.radius.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.base, marginBottom: SIZES.spacing.lg,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { color: COLORS.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  date: { color: COLORS.textMuted, fontSize: 11.5 },
  summary: { color: COLORS.textSecondary, fontSize: 12.5, marginTop: 8 },
  bar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: COLORS.accentGreen },
  empty: { color: COLORS.textMuted, fontSize: 12.5, marginTop: 10, lineHeight: 19 },

  nextCard: {
    marginTop: 14, marginBottom: 10, padding: 12,
    borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.primary,
    backgroundColor: 'rgba(201,168,76,0.10)',
  },
  nextTag: { color: COLORS.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  nextEmoji: { fontSize: 24 },
  nextLabel: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  nextMode: { color: COLORS.textSecondary, fontSize: 11.5, marginTop: 2 },
  countBig: { alignItems: 'center', minWidth: 52 },
  countBigNum: { color: COLORS.primary, fontSize: 24, fontWeight: '900' },
  countBigLbl: { color: COLORS.textMuted, fontSize: 10 },
  nextActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  navTxt: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  doneBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: SIZES.radius.md, backgroundColor: COLORS.accentGreen,
  },
  doneTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },

  allDone: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 8,
    padding: 12, borderRadius: SIZES.radius.md, backgroundColor: 'rgba(76,175,80,0.12)',
  },
  allDoneTxt: { flex: 1, color: COLORS.accentGreen, fontSize: 13, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 10, paddingHorizontal: 8, marginTop: 6,
    borderRadius: SIZES.radius.sm, borderWidth: 1, borderColor: 'transparent',
  },
  rowNext: { borderColor: 'rgba(201,168,76,0.5)', backgroundColor: 'rgba(201,168,76,0.06)' },
  rowDone: { opacity: 0.55 },
  pos: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800', minWidth: 16, textAlign: 'center' },
  label: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '600' },
  labelDone: { textDecorationLine: 'line-through', color: COLORS.textSecondary },
  meta: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 2 },
  count: {
    minWidth: 34, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(201,168,76,0.16)', alignItems: 'center',
  },
  countTxt: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  idle: { color: COLORS.textMuted, fontSize: 11, marginTop: 10, fontStyle: 'italic' },

  warnBox: {
    marginTop: 14, padding: 11, borderRadius: SIZES.radius.md,
    backgroundColor: 'rgba(255,152,0,0.10)', borderWidth: 1, borderColor: 'rgba(255,152,0,0.35)',
  },
  warnHead: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  warnTitle: { flex: 1, color: COLORS.accentOrange, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  warnLine: { color: COLORS.textSecondary, fontSize: 12, marginTop: 5, marginLeft: 22 },
  warnHint: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 7, marginLeft: 22 },

  errorTxt: { color: COLORS.accentRed, fontSize: 12, marginTop: 8 },
  retry: { marginTop: 10, alignSelf: 'flex-start' },
  retryTxt: { color: COLORS.primary, fontSize: 12.5, fontWeight: '700' },
});
