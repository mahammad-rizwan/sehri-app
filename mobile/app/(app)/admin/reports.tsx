import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES, ZONE_CONFIG } from '../../../src/constants/theme';
import { REPORT_STATUS } from '../../../src/constants/reports';
import { useAuthStore } from '../../../src/store/authStore';
import {
  fetchReports, resolveReport, fetchPendingReports,
  type ReviewReport, type ReportTarget,
} from '../../../src/services/reports';

type Filter = 'pending' | 'resolved' | 'all';
type Decision = 'remove' | 'action_taken' | 'dismissed';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});
const roleLabel = (r: string | null) => (r === 'super_admin' ? 'Organiser' : r === 'admin' ? 'Zone Admin' : 'User');

/**
 * Where reports are reviewed.
 *
 *   Super admin — two sections, Announcements and Chats, and the only one who
 *                 can remove the reported content.
 *   Zone admin  — Announcements only: reports from their zone's users, never
 *                 about their own posts. They can mark action taken or dismiss.
 */
export default function ReportsReview() {
  const isSuperAdmin = useAuthStore((s) => s.activeRole) === 'super_admin';

  const [tab, setTab] = useState<ReportTarget>('broadcast');
  const [filter, setFilter] = useState<Filter>('pending');
  const [items, setItems] = useState<ReviewReport[]>([]);
  const [counts, setCounts] = useState({ broadcast: 0, chat_message: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deciding, setDeciding] = useState<{ report: ReviewReport; decision: Decision } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (t: ReportTarget = tab, f: Filter = filter) => {
    try {
      const [list, c] = await Promise.all([fetchReports(t, f), fetchPendingReports()]);
      setItems(list);
      setCounts({ broadcast: c.broadcast, chat_message: c.chat_message });
      setError(null);
    } catch (err: any) {
      setError(err?.response?.status === 404
        ? 'Reports need the latest backend deployed.'
        : (err?.response?.data?.message || 'Could not load reports'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const switchTab = (t: ReportTarget) => { setTab(t); setLoading(true); load(t, filter); };
  const switchFilter = (f: Filter) => { setFilter(f); setLoading(true); load(tab, f); };

  const openDecision = (report: ReviewReport, decision: Decision) => {
    setNote('');
    setDeciding({ report, decision });
  };

  const confirm = async () => {
    if (!deciding) return;
    const { report, decision } = deciding;
    try {
      setSaving(true);
      const res = await resolveReport(report.id, {
        decision: decision === 'dismissed' ? 'dismissed' : 'action_taken',
        remove_content: decision === 'remove',
        note: note.trim() || undefined,
      });
      Toast.show({ type: 'success', text1: res?.message || 'Report updated' });
      setDeciding(null);
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not update the report' });
    } finally {
      setSaving(false);
    }
  };

  const DECISION_COPY: Record<Decision, { title: string; body: string; button: string; color: string }> = {
    remove: {
      title: 'Remove this content?',
      body: `It is deleted for everyone${deciding && deciding.report.same_item_reports > 1
        ? `, and all ${deciding.report.same_item_reports} reports about it are closed` : ''}. This cannot be undone.`,
      button: 'Remove content',
      color: COLORS.accentRed,
    },
    action_taken: {
      title: 'Mark action taken?',
      body: 'Use this when you dealt with it another way — for example you spoke to the sender. The content stays.',
      button: 'Mark action taken',
      color: COLORS.accentGreen,
    },
    dismissed: {
      title: 'Dismiss this report?',
      body: 'Nothing is removed. The reporter is told it was reviewed and no violation was found.',
      button: 'Dismiss',
      color: COLORS.textSecondary,
    },
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.container}>
      <View style={st.header}>
        <Text style={st.title}>🚩 Reports</Text>
        <Text style={st.subtitle}>
          {isSuperAdmin
            ? 'Content people have flagged. You decide what stays.'
            : 'Announcement reports from users in your zone.'}
        </Text>
      </View>

      {/* Sections — chats only exist for the super admin */}
      {isSuperAdmin && (
        <View style={st.tabs}>
          {([['broadcast', 'Announcements'], ['chat_message', 'Chats']] as const).map(([k, label]) => (
            <TouchableOpacity key={k} style={[st.tab, tab === k && st.tabOn]} onPress={() => switchTab(k)} activeOpacity={0.85}>
              <Text style={[st.tabTxt, tab === k && st.tabTxtOn]}>{label}</Text>
              {counts[k] > 0 && <View style={st.badge}><Text style={st.badgeTxt}>{counts[k]}</Text></View>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={st.filters}>
        {([['pending', 'Pending'], ['resolved', 'Resolved'], ['all', 'All']] as const).map(([k, label]) => (
          <TouchableOpacity key={k} style={[st.chip, filter === k && st.chipOn]} onPress={() => switchFilter(k)}>
            <Text style={[st.chipTxt, filter === k && st.chipTxtOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={st.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={st.error}>{error}</Text>
        ) : items.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.accentGreen} />
            <Text style={st.emptyTitle}>{filter === 'pending' ? 'Nothing waiting for review' : 'No reports here'}</Text>
          </View>
        ) : (
          items.map((r) => {
            const s = REPORT_STATUS[r.status];
            const zone = r.reporter_zone ? (ZONE_CONFIG as any)[r.reporter_zone]?.label || r.reporter_zone : null;
            return (
              <View key={r.id} style={[st.card, r.status === 'pending' && st.cardPending]}>
                <View style={st.topRow}>
                  <View style={st.reasonPill}>
                    <Ionicons name="flag" size={12} color={COLORS.accentOrange} />
                    <Text style={st.reasonTxt}>{r.reason_label}</Text>
                  </View>
                  {r.same_item_reports > 1 && (
                    <Text style={st.multi}>{r.same_item_reports} reports on this</Text>
                  )}
                </View>

                <Text style={st.label}>
                  {r.target_type === 'broadcast' ? 'ANNOUNCEMENT' : `MESSAGE${r.group_name ? ` IN ${r.group_name.toUpperCase()}` : ''}`}
                  {!r.content_exists && r.status === 'pending' ? ' · ALREADY DELETED' : ''}
                </Text>
                <Text style={st.snapshot}>{r.content_snapshot}</Text>
                <Text style={st.meta}>
                  By {r.content_author_name || 'unknown'} · {roleLabel(r.content_author_role)}
                </Text>

                <Text style={st.label}>WHY IT WAS REPORTED</Text>
                <Text style={st.body}>{r.description}</Text>
                <Text style={st.meta}>
                  {r.reporter_name || 'Someone'} · {roleLabel(r.reporter_role)}{zone ? ` · ${zone}` : ''} · {fmt(r.created_at)}
                </Text>

                {r.status === 'pending' ? (
                  <View style={st.actions}>
                    {r.can_remove && (
                      <TouchableOpacity style={[st.act, st.actRemove]} onPress={() => openDecision(r, 'remove')}>
                        <Ionicons name="trash-outline" size={15} color="#fff" />
                        <Text style={st.actTxtLight}>Remove</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[st.act, st.actDone]} onPress={() => openDecision(r, 'action_taken')}>
                      <Ionicons name="checkmark" size={15} color={COLORS.accentGreen} />
                      <Text style={[st.actTxt, { color: COLORS.accentGreen }]}>Action taken</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.act, st.actDismiss]} onPress={() => openDecision(r, 'dismissed')}>
                      <Text style={st.actTxt}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={st.outcome}>
                    <View style={st.topRow}>
                      <Text style={[st.outcomeStatus, { color: s.color }]}>
                        {s.label}{r.content_removed ? ' · content removed' : ''}
                      </Text>
                      {r.reviewed_at && <Text style={st.meta}>{fmt(r.reviewed_at)}</Text>}
                    </View>
                    {r.reviewer_note ? <Text style={st.body}>{r.reviewer_note}</Text> : null}
                    {r.reviewed_by_name ? <Text style={st.meta}>by {r.reviewed_by_name}</Text> : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Decision + optional note for the reporter */}
      <Modal visible={!!deciding} transparent animationType="fade" onRequestClose={() => setDeciding(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
          {deciding && (
            <View style={st.dialog}>
              <Text style={st.dialogTitle}>{DECISION_COPY[deciding.decision].title}</Text>
              <Text style={st.dialogBody}>{DECISION_COPY[deciding.decision].body}</Text>
              <Text style={st.label}>NOTE FOR THE REPORTER (OPTIONAL)</Text>
              <TextInput
                style={st.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Thanks — we have removed it."
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
              <View style={st.dialogRow}>
                <TouchableOpacity style={[st.dBtn, st.dCancel]} onPress={() => setDeciding(null)} disabled={saving}>
                  <Text style={st.actTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.dBtn, { backgroundColor: DECISION_COPY[deciding.decision].color }]}
                  onPress={confirm}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={st.actTxtLight}>{DECISION_COPY[deciding.decision].button}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 16, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.md },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 6 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: SIZES.spacing.base, marginBottom: SIZES.spacing.sm },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary,
  },
  tabOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.14)' },
  tabTxt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTxtOn: { color: COLORS.primary, fontWeight: '700' },
  badge: { minWidth: 18, paddingHorizontal: 5, height: 18, borderRadius: 9, backgroundColor: COLORS.accentRed, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 10.5, fontWeight: '800' },

  filters: { flexDirection: 'row', gap: 7, paddingHorizontal: SIZES.spacing.base, marginBottom: SIZES.spacing.sm },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 },
  chipOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.16)' },
  chipTxt: { color: COLORS.textSecondary, fontSize: 12 },
  chipTxtOn: { color: COLORS.primary, fontWeight: '700' },

  list: { paddingHorizontal: SIZES.spacing.base, paddingBottom: 60 },
  error: { color: COLORS.accentRed, fontSize: 13, marginTop: 20, textAlign: 'center' },
  empty: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.md, marginBottom: SIZES.spacing.sm,
  },
  cardPending: { borderLeftWidth: 3, borderLeftColor: COLORS.accentOrange },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reasonPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(255,152,0,0.12)',
  },
  reasonTxt: { color: COLORS.accentOrange, fontSize: 11.5, fontWeight: '700' },
  multi: { color: COLORS.accentRed, fontSize: 11, fontWeight: '700' },
  label: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 11, marginBottom: 4 },
  snapshot: {
    color: COLORS.textPrimary, fontSize: 13, lineHeight: 19,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: SIZES.radius.sm, padding: 9,
  },
  body: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 19 },
  meta: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 4 },

  actions: { flexDirection: 'row', gap: 7, marginTop: 13 },
  act: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: SIZES.radius.md,
  },
  actRemove: { backgroundColor: COLORS.accentRed },
  actDone: { borderWidth: 1, borderColor: COLORS.accentGreen },
  actDismiss: { borderWidth: 1, borderColor: COLORS.border },
  actTxt: { color: COLORS.textSecondary, fontSize: 12.5, fontWeight: '700' },
  actTxtLight: { color: '#fff', fontSize: 12.5, fontWeight: '800' },

  outcome: { marginTop: 12, padding: 9, borderRadius: SIZES.radius.sm, backgroundColor: 'rgba(255,255,255,0.04)' },
  outcomeStatus: { fontSize: 12, fontWeight: '800' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SIZES.spacing.lg },
  dialog: {
    backgroundColor: '#0D1B2A', borderRadius: SIZES.radius.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SIZES.spacing.lg,
  },
  dialogTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700' },
  dialogBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  noteInput: {
    minHeight: 80, backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radius.md,
    padding: 10, color: COLORS.textPrimary, fontSize: 13.5,
  },
  dialogRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  dBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: SIZES.radius.md },
  dCancel: { borderWidth: 1, borderColor: COLORS.border },
});
