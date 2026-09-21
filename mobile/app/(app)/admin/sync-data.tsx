import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../../src/constants/theme';
import api from '../../../src/services/api';
import { ENDPOINTS } from '../../../src/constants/api';
import { clearContentCache } from '../../../src/services/contentSync';

type TabKey = 'prayers' | 'quran' | 'dua';

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'prayers', label: 'Namaz', emoji: '🕌' },
  { key: 'quran', label: 'Quran', emoji: '📖' },
  { key: 'dua', label: 'Dua', emoji: '🤲' },
];

type Panel = {
  key: TabKey;
  version: number;
  last_synced_at: string | null;
  last_synced_by: string | null;
  last_status: 'success' | 'failed' | null;
  last_detail: string | null;
  auto?: boolean;
  schedule?: string;
  today_present?: boolean;
  today_date?: string;
  stored_days?: number;
  note?: string;
};

/** "3 hours ago" reads faster than a raw timestamp when you are checking health. */
function relative(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function absolute(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SyncData() {
  const [tab, setTab] = useState<TabKey>('prayers');
  const [data, setData] = useState<Record<TabKey, Panel> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState<TabKey | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(ENDPOINTS.SYNC_STATUS);
      setData(res.data.data);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not load sync status' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runSync = async (key: TabKey) => {
    const endpoint = key === 'prayers' ? ENDPOINTS.SYNC_PRAYERS
      : key === 'quran' ? ENDPOINTS.SYNC_QURAN
      : ENDPOINTS.SYNC_DUA;
    try {
      setSyncing(key);
      const res = await api.post(endpoint, {}, 45000);

      // For content syncs, rebuild this device immediately rather than waiting
      // for the next app launch like everyone else.
      if (key !== 'prayers') await clearContentCache(key);

      Toast.show({
        type: res.data?.data?.via_api === false ? 'info' : 'success',
        text1: 'Sync complete',
        text2: res.data?.message,
        visibilityTime: 5000,
      });
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Sync failed' });
    } finally {
      setSyncing(null);
    }
  };

  const confirmSync = (key: TabKey) => {
    if (key === 'prayers') return runSync(key);
    Alert.alert(
      `Sync ${key === 'quran' ? 'Quran' : 'Dua'} content?`,
      'Every device will discard its cached copy and download it again the next time it opens this section. Bookmarks and reading position are not affected.\n\nUse this if users report missing or broken content.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sync Now', onPress: () => runSync(key) },
      ],
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={[s.container, s.center]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </LinearGradient>
    );
  }

  const panel = data?.[tab];
  const failed = panel?.last_status === 'failed';

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🔄 Sync Data</Text>
        <Text style={s.subtitle}>Force a refresh when data looks stale or broken.</Text>
      </View>

      <View style={s.tabs}>
        {TABS.map((t) => {
          const p = data?.[t.key];
          const bad = p?.last_status === 'failed';
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[s.tab, tab === t.key && s.tabOn]}
              activeOpacity={0.85}
            >
              <Text style={[s.tabTxt, tab === t.key && s.tabTxtOn]}>
                {t.emoji} {t.label}
              </Text>
              {bad && <View style={s.tabDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
        }
      >
        {panel && (
          <>
            {/* Last sync — the headline on every tab */}
            <View style={[s.card, failed && s.cardBad]}>
              <Text style={s.cardLabel}>LAST SYNCED</Text>
              <Text style={s.bigValue}>{relative(panel.last_synced_at)}</Text>
              <Text style={s.absolute}>{absolute(panel.last_synced_at)}</Text>

              <View style={s.metaRow}>
                <Text style={s.metaKey}>By</Text>
                <Text style={s.metaVal}>{panel.last_synced_by || '—'}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Result</Text>
                <Text style={[s.metaVal, { color: failed ? COLORS.accentRed : COLORS.accentGreen }]}>
                  {panel.last_status ? (failed ? 'Failed' : 'Success') : '—'}
                </Text>
              </View>
              {panel.last_detail ? <Text style={s.detail}>{panel.last_detail}</Text> : null}
            </View>

            {/* Per-source context */}
            {tab === 'prayers' ? (
              <View style={s.card}>
                <Text style={s.cardLabel}>AUTOMATIC SYNC</Text>
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>Schedule</Text>
                  <Text style={s.metaVal}>{panel.schedule}</Text>
                </View>
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>Today ({panel.today_date})</Text>
                  <Text style={[s.metaVal, { color: panel.today_present ? COLORS.accentGreen : COLORS.accentOrange }]}>
                    {panel.today_present ? 'Stored ✓' : 'Missing'}
                  </Text>
                </View>
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>Days stored</Text>
                  <Text style={s.metaVal}>{panel.stored_days}</Text>
                </View>
                <Text style={s.note}>
                  Timings are fetched from the AlAdhan API every night at 00:05 IST. If the API is
                  unreachable the app falls back to a local calculation — those figures are
                  approximate, so force a sync once the connection is back.
                </Text>
              </View>
            ) : (
              <View style={s.card}>
                <Text style={s.cardLabel}>CONTENT VERSION</Text>
                <Text style={s.bigValue}>v{panel.version}</Text>
                <Text style={s.note}>
                  {tab === 'quran' ? 'Quran' : 'Dua'} content does not normally change. Syncing
                  raises this version, and every device rebuilds its cached copy the next time it
                  opens the section. Bookmarks and reading position are kept.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.syncBtn, syncing === tab && s.syncBtnBusy]}
              onPress={() => confirmSync(tab)}
              disabled={syncing !== null}
              activeOpacity={0.85}
            >
              {syncing === tab ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <>
                  <Ionicons name="sync" size={17} color={COLORS.background} />
                  <Text style={s.syncBtnTxt}>
                    {tab === 'prayers' ? 'Force Sync Now' : `Sync ${tab === 'quran' ? 'Quran' : 'Dua'} Content`}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={s.footNote}>
              {tab === 'prayers'
                ? 'Re-fetches today\'s timings from AlAdhan and overwrites what is stored.'
                : 'Safe to run any time. Only cached content is rebuilt — no user data is touched.'}
            </Text>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 16, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.md },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 6 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SIZES.spacing.base,
    marginBottom: SIZES.spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: SIZES.radius.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
  },
  tabOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.14)' },
  tabTxt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTxtOn: { color: COLORS.primary, fontWeight: '700' },
  tabDot: {
    position: 'absolute', top: 6, right: 8,
    width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.accentRed,
  },
  body: { paddingHorizontal: SIZES.spacing.base, paddingBottom: 60 },
  card: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SIZES.spacing.base,
    marginBottom: SIZES.spacing.sm,
  },
  cardBad: { borderColor: COLORS.accentRed },
  cardLabel: {
    color: COLORS.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 1, marginBottom: 8,
  },
  bigValue: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  absolute: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 3, marginBottom: 10 },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 5,
  },
  metaKey: { color: COLORS.textSecondary, fontSize: 12.5 },
  metaVal: { color: COLORS.textPrimary, fontSize: 12.5, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  detail: {
    color: COLORS.textMuted, fontSize: 11.5, lineHeight: 17,
    marginTop: 8, fontStyle: 'italic',
  },
  note: { color: COLORS.textMuted, fontSize: 11.5, lineHeight: 18, marginTop: 10 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius.md,
    paddingVertical: 14,
    marginTop: SIZES.spacing.sm,
  },
  syncBtnBusy: { opacity: 0.7 },
  syncBtnTxt: { color: COLORS.background, fontSize: 14.5, fontWeight: '700' },
  footNote: {
    color: COLORS.textMuted, fontSize: 11, lineHeight: 17,
    textAlign: 'center', marginTop: 10, paddingHorizontal: 10,
  },
});
