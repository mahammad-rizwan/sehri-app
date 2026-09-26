import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { COLORS, SIZES } from '../../src/constants/theme';
import { REPORT_STATUS } from '../../src/constants/reports';
import { fetchMyReports, type MyReport } from '../../src/services/reports';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});

/**
 * Everything the signed-in person has reported, with where each one stands and
 * the reviewer's reply. Reached from the Profile page.
 */
export default function MyReports() {
  const [items, setItems] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyReports());
      setError(null);
    } catch (err: any) {
      setError(err?.response?.status === 404
        ? 'Reports need the latest backend deployed.'
        : (err?.response?.data?.message || 'Could not load your reports'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.container}>
      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        <Text style={st.title}>🚩 My Reports</Text>
        <Text style={st.subtitle}>
          What you have reported and what happened. Only the organisers see who reported something.
        </Text>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={st.error}>{error}</Text>
        ) : items.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="flag-outline" size={40} color={COLORS.textMuted} />
            <Text style={st.emptyTitle}>Nothing reported</Text>
            <Text style={st.emptySub}>
              If an announcement or message is inappropriate, press and hold it (or tap ⋮) and choose Report.
            </Text>
          </View>
        ) : (
          items.map((r) => {
            const s = REPORT_STATUS[r.status];
            return (
              <View key={r.id} style={st.card}>
                <View style={st.topRow}>
                  <View style={[st.pill, { borderColor: s.color, backgroundColor: `${s.color}1F` }]}>
                    <Ionicons name={s.icon as any} size={13} color={s.color} />
                    <Text style={[st.pillTxt, { color: s.color }]}>{s.label}</Text>
                  </View>
                  <Text style={st.date}>{fmt(r.created_at)}</Text>
                </View>

                <Text style={st.what}>
                  {r.target_type === 'broadcast' ? 'Announcement' : 'Chat message'} · {r.reason_label}
                </Text>
                <Text style={st.quote} numberOfLines={3}>“{r.content_snapshot}”</Text>

                <Text style={st.label}>YOUR DESCRIPTION</Text>
                <Text style={st.body}>{r.description}</Text>

                {r.status !== 'pending' && (
                  <View style={st.reply}>
                    <Text style={st.label}>OUTCOME</Text>
                    {r.content_removed && (
                      <Text style={st.removed}>The content has been removed.</Text>
                    )}
                    <Text style={st.body}>
                      {r.reviewer_note
                        || (r.status === 'action_taken'
                          ? 'The organisers took action on this.'
                          : 'It was reviewed and did not break the rules.')}
                    </Text>
                    {r.reviewed_at && <Text style={st.date}>Reviewed {fmt(r.reviewed_at)}</Text>}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SIZES.spacing.base, paddingTop: 16, paddingBottom: 60 },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 6, marginBottom: 14, lineHeight: 17 },
  error: { color: COLORS.accentRed, fontSize: 13, marginTop: 20, textAlign: 'center' },
  empty: { alignItems: 'center', marginTop: 50, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: 12.5, textAlign: 'center', lineHeight: 19 },

  card: {
    backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.md, marginBottom: SIZES.spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  pillTxt: { fontSize: 11.5, fontWeight: '700' },
  date: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 2 },
  what: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 10 },
  quote: {
    color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 18, fontStyle: 'italic', marginTop: 6,
    borderLeftWidth: 3, borderLeftColor: COLORS.border, paddingLeft: 9,
  },
  label: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 10, marginBottom: 3 },
  body: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 19 },
  reply: {
    marginTop: 10, padding: 10, borderRadius: SIZES.radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  removed: { color: COLORS.accentGreen, fontSize: 12.5, fontWeight: '700', marginBottom: 3 },
});
