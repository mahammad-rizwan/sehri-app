import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
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

/** Re-read while the screen is open, so a second rider's progress shows up. */
const REFRESH_MS = 30000;

/** How long "Delivered" stays on screen with an Undo before moving on. */
const UNDO_SECONDS = 7;

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

/** Recomputes the derived counters after a stop is ticked or un-ticked locally. */
function withDelivered(prev: DropPoints, id: string, delivered: boolean): DropPoints {
  const stops = prev.stops.map((s) => (s.id === id ? { ...s, delivered } : s));
  const active = stops.filter((s) => s.count > 0);
  return {
    ...prev,
    stops,
    next_stop_id: active.find((s) => !s.delivered)?.id || null,
    delivered_stops: active.filter((s) => s.delivered).length,
  };
}

/**
 * Tonight's drop points for the rider, one stop at a time.
 *
 * The current stop sits in a card with a single action, Mark delivered. That
 * flips the card to a green "Delivered" state with an Undo for seven seconds —
 * long enough to catch a mis-tap on a moving scooter — and then the next stop
 * takes its place. Below it, a read-only list of what is still to come, so the
 * rider can see how many Sehri each later stop needs while packing.
 */
export default function DropPointList() {
  const [data, setData] = useState<DropPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justDone, setJustDone] = useState<{ stop: Stop; left: number } | null>(null);

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

  // The undo countdown. When it runs out the card simply moves on — the stop
  // was already saved as delivered the moment the button was pressed.
  useEffect(() => {
    if (!justDone) return;
    if (justDone.left <= 0) {
      setJustDone(null);
      return;
    }
    const t = setTimeout(() => setJustDone((j) => (j ? { ...j, left: j.left - 1 } : j)), 1000);
    return () => clearTimeout(t);
  }, [justDone]);

  /**
   * Saved straight away rather than after the countdown, so closing the app
   * during those seven seconds cannot lose a delivery. Undo un-saves it.
   */
  const markDelivered = async (stop: Stop) => {
    if (busy) return;
    setBusy(true);
    setData((prev) => (prev ? withDelivered(prev, stop.id, true) : prev));
    setJustDone({ stop, left: UNDO_SECONDS });
    try {
      await riderFetch(`/tracking/drop-points/${stop.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ delivered: true }),
      });
    } catch (e: any) {
      setJustDone(null);
      setError(e?.message || 'Could not mark that stop delivered');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!justDone || busy) return;
    const { stop } = justDone;
    setBusy(true);
    setJustDone(null);
    setData((prev) => (prev ? withDelivered(prev, stop.id, false) : prev));
    try {
      await riderFetch(`/tracking/drop-points/${stop.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ delivered: false }),
      });
    } catch (e: any) {
      setError(e?.message || 'Could not undo — pull down to refresh');
      await load();
    } finally {
      setBusy(false);
    }
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
  const next = active.find((s) => s.id === data.next_stop_id) || null;
  const pct = data.active_stops ? data.delivered_stops / data.active_stops : 0;
  const unroutedCount = data.unrouted.reduce((n, u) => n + u.count, 0);
  const dateLabel = new Date(`${data.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  // While the undo card is up, the stop that will come next is still "coming up".
  const comingUp = active.filter((s) => !s.delivered && (justDone ? true : s.id !== next?.id));

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

          {justDone ? (
            /* Just delivered — Undo for a few seconds, then the next stop */
            <View style={st.doneCard}>
              <View style={st.doneRow}>
                <Ionicons name="checkmark-circle" size={26} color={COLORS.accentGreen} />
                <View style={{ flex: 1 }}>
                  <Text style={st.doneTitle}>Delivered</Text>
                  <Text style={st.doneLabel} numberOfLines={2}>
                    #{justDone.stop.position} {justDone.stop.label} · {justDone.stop.count} Sehri
                  </Text>
                </View>
              </View>
              <View style={st.undoRow}>
                <Text style={st.undoCount}>
                  {next ? `Next stop in ${justDone.left}s` : `Last stop · closing in ${justDone.left}s`}
                </Text>
                <TouchableOpacity
                  style={[st.undoBtn, busy && { opacity: 0.6 }]}
                  onPress={undo}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-undo" size={16} color={COLORS.textPrimary} />
                  <Text style={st.undoTxt}>Undo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : next ? (
            /* The one the rider needs right now */
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
              <TouchableOpacity
                style={[st.deliverBtn, busy && { opacity: 0.6 }]}
                onPress={() => markDelivered(next)}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={st.deliverTxt}>Mark delivered</Text>
              </TouchableOpacity>
            </View>
          ) : active.length > 0 ? (
            <View style={st.allDone}>
              <Ionicons name="checkmark-done-circle" size={22} color={COLORS.accentGreen} />
              <Text style={st.allDoneTxt}>All {active.length} stops delivered. Jazakallah khair!</Text>
            </View>
          ) : null}

          {/* Read-only: what is left, for packing and a sense of the route */}
          {comingUp.length > 0 && (
            <>
              <Text style={st.subHeading}>COMING UP · {comingUp.length}</Text>
              {comingUp.map((s) => (
                <View key={s.id} style={st.upRow}>
                  <Text style={st.upPos}>{s.position}</Text>
                  <Text style={st.upLabel} numberOfLines={1}>{s.label}</Text>
                  <Text style={st.upCount}>{s.count}</Text>
                </View>
              ))}
            </>
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
  subHeading: {
    color: COLORS.textMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6,
    marginTop: 16, marginBottom: 4,
  },
  date: { color: COLORS.textMuted, fontSize: 11.5 },
  summary: { color: COLORS.textSecondary, fontSize: 12.5, marginTop: 8 },
  bar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: COLORS.accentGreen },
  empty: { color: COLORS.textMuted, fontSize: 12.5, marginTop: 10, lineHeight: 19 },

  nextCard: {
    marginTop: 14, padding: 12,
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
  deliverBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: 12, paddingVertical: 12, borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.accentGreen,
  },
  deliverTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },

  doneCard: {
    marginTop: 14, padding: 12,
    borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.accentGreen,
    backgroundColor: 'rgba(76,175,80,0.12)',
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneTitle: { color: COLORS.accentGreen, fontSize: 15, fontWeight: '800' },
  doneLabel: { color: COLORS.textSecondary, fontSize: 12.5, marginTop: 2 },
  undoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12,
  },
  undoCount: { color: COLORS.textMuted, fontSize: 12 },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 18, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.textSecondary,
  },
  undoTxt: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '800' },

  allDone: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    padding: 12, borderRadius: SIZES.radius.md, backgroundColor: 'rgba(76,175,80,0.12)',
  },
  allDoneTxt: { flex: 1, color: COLORS.accentGreen, fontSize: 13, fontWeight: '700' },

  upRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  upPos: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  upLabel: { flex: 1, color: COLORS.textSecondary, fontSize: 13 },
  upCount: { color: COLORS.primary, fontSize: 13, fontWeight: '800', minWidth: 28, textAlign: 'right' },

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
