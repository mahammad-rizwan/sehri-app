import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../../src/constants/theme';
import api from '../../../src/services/api';
import { ENDPOINTS } from '../../../src/constants/api';
import { useAuthStore } from '../../../src/store/authStore';

/** What appears and disappears with the switch, per role. */
const AFFECTED = [
  { role: 'Everyone', items: ['Sehri poll & voting', 'Live delivery tracking', 'Poll history', 'Nightly poll reminders'] },
  { role: 'Super admin', items: ['Sehri dashboard stats', 'Poll open/close control', 'Special cases & allotment'] },
  { role: 'Zone admin', items: ['Sehri poll results', 'Poll history'] },
];

const ALWAYS_ON = ['Prayer timings', 'Al-Quran', 'Duas', 'Donations', 'Announcements', 'Feedback', 'Chat'];

export default function RamadanControl() {
  const refreshSettings = useAuthStore((s) => s.refreshSettings);
  const [active, setActive] = useState<boolean | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(ENDPOINTS.RAMADAN_STATUS);
      setActive(!!data.data.ramadanActive);
      setUpdatedBy(data.data.updated_by || null);
      setUpdatedAt(data.data.updated_at || null);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not read status' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (next: boolean) => {
    Alert.alert(
      next ? 'Start Ramadan?' : 'End Ramadan?',
      next
        ? 'Sehri polls, live tracking and poll history will appear for everyone, and the nightly poll reminders start going out.\n\nEveryone gets a notification.'
        : 'Sehri polls, live tracking and poll history will be hidden for everyone, and the nightly reminders stop.\n\nNothing is deleted — past poll data is kept and comes back when you start Ramadan again. Everyone gets a notification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Start Ramadan' : 'End Ramadan',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const res = await api.patch(ENDPOINTS.RAMADAN_SET, { active: next });
              Toast.show({ type: 'success', text1: res.data?.message || 'Updated' });
              await load();
              // Every screen reads this from the store, so refresh it now.
              await refreshSettings();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not update' });
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={[st.container, st.center]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.container}>
      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        <Text style={st.title}>🌙 Ramadan Mode</Text>
        <Text style={st.subtitle}>
          Controls whether the Sehri side of the app is running. Everything else stays available
          all year.
        </Text>

        {/* Current state */}
        <LinearGradient
          colors={active
            ? ['rgba(76,175,80,0.20)', 'rgba(76,175,80,0.05)']
            : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
          style={[st.statusCard, { borderColor: active ? COLORS.accentGreen : COLORS.border }]}
        >
          <Text style={st.statusEmoji}>{active ? '🌙' : '🌑'}</Text>
          <Text style={[st.statusTitle, { color: active ? COLORS.accentGreen : COLORS.textSecondary }]}>
            {active ? 'Ramadan is running' : 'Ramadan has not started'}
          </Text>
          <Text style={st.statusSub}>
            {active
              ? 'Sehri polls, tracking and reminders are live for everyone.'
              : 'Sehri features are hidden. Prayer timings, Quran, Duas and donations remain available.'}
          </Text>
          {updatedBy && (
            <Text style={st.statusMeta}>
              Last changed by {updatedBy}
              {updatedAt ? ` · ${new Date(updatedAt).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}` : ''}
            </Text>
          )}
        </LinearGradient>

        {/* The switch */}
        <TouchableOpacity
          style={[st.actionBtn, active ? st.endBtn : st.startBtn, saving && { opacity: 0.6 }]}
          onPress={() => toggle(!active)}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={active ? COLORS.accentRed : COLORS.textOnPrimary} />
          ) : (
            <>
              <Ionicons
                name={active ? 'moon-outline' : 'sunny-outline'}
                size={18}
                color={active ? COLORS.accentRed : COLORS.textOnPrimary}
              />
              <Text style={[st.actionTxt, { color: active ? COLORS.accentRed : COLORS.textOnPrimary }]}>
                {active ? 'End Ramadan' : 'Start Ramadan'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={st.confirmNote}>You'll be asked to confirm before anything changes.</Text>

        {/* What it affects */}
        <Text style={st.section}>What this turns {active ? 'off' : 'on'}</Text>
        {AFFECTED.map((g) => (
          <View key={g.role} style={st.affectCard}>
            <Text style={st.affectRole}>{g.role}</Text>
            {g.items.map((i) => (
              <Text key={i} style={st.affectItem}>• {i}</Text>
            ))}
          </View>
        ))}

        <Text style={st.section}>Always available</Text>
        <View style={st.chipWrap}>
          {ALWAYS_ON.map((a) => (
            <View key={a} style={st.chip}><Text style={st.chipTxt}>{a}</Text></View>
          ))}
        </View>

        <Text style={st.footNote}>
          Ending Ramadan hides features — it never deletes anything. Past polls, votes and
          donation records are kept and reappear when you start Ramadan again.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SIZES.spacing.base, paddingTop: 16, paddingBottom: 60 },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 6, lineHeight: 18 },

  statusCard: {
    borderRadius: SIZES.radius.lg, borderWidth: 1,
    padding: SIZES.spacing.lg, alignItems: 'center', marginTop: SIZES.spacing.base,
  },
  statusEmoji: { fontSize: 38 },
  statusTitle: { fontSize: 17, fontWeight: '800', marginTop: 8 },
  statusSub: {
    color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 19,
    textAlign: 'center', marginTop: 8, paddingHorizontal: 8,
  },
  statusMeta: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 12, textAlign: 'center' },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderRadius: SIZES.radius.md, paddingVertical: 15,
    marginTop: SIZES.spacing.base, borderWidth: 1.5,
  },
  startBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  endBtn: { backgroundColor: 'rgba(239,83,80,0.14)', borderColor: COLORS.accentRed },
  actionTxt: { fontSize: 15, fontWeight: '800' },
  confirmNote: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },

  section: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 26, marginBottom: 8 },
  affectCard: {
    backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.md, marginBottom: SIZES.spacing.sm,
  },
  affectRole: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  affectItem: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 20 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6, backgroundColor: COLORS.backgroundSecondary,
  },
  chipTxt: { color: COLORS.textSecondary, fontSize: 11.5 },
  footNote: {
    color: COLORS.textMuted, fontSize: 11.5, lineHeight: 18,
    marginTop: 22, paddingHorizontal: 4,
  },
});
