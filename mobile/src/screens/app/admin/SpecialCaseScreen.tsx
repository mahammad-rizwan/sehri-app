import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ZONE_CONFIG, SHADOWS } from '../../../constants/theme';
import { IslamicGeometric } from '../../../components/ui/IslamicPattern';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';

interface SpecialCase {
  userId: string;
  name: string;
  phone: string;
  zone: string;
  address: string;
  time: string | null;
  sehriAllowed: boolean | null;
  allottedAt: string | null;
}

export default function SpecialCaseScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.SPECIAL_CASES);
      const d = res.data.data;
      setData(d);
      // Pre-select already-allotted users so re-allotment keeps them
      // But only if allotment is not locked (before 6 PM)
      const keep = new Set<string>();
      if (!d?.allotmentLocked) {
        (d?.want || []).forEach((w: SpecialCase) => {
          if (w.sehriAllowed === true) keep.add(w.userId);
        });
      }
      setSelected(keep);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to load special cases' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(true); };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmAllot = () => {
    const count = selected.size;
    const totalWant = want.length;
    if (count === 0) {
      Toast.show({ type: 'info', text1: 'Select at least one person to allot Sehri' });
      return;
    }
    if (data?.allotmentLocked) {
      Toast.show({ type: 'error', text1: 'Allotment is locked after 6 PM — no changes allowed' });
      return;
    }
    Alert.alert(
      'Allot Sehri to Special Cases',
      `Confirm Sehri for ${count} out of ${totalWant} person(s)?\n\n✅ Selected: ${count} get "Sehri Confirmed"\n❌ Not selected: ${totalWant - count} get "No Sehri"\n\nAll special-case users + all app users will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Notify All', onPress: async () => {
            setSubmitting(true);
            try {
              const res = await api.post(ENDPOINTS.SPECIAL_CASES_ALLOT, { userIds: Array.from(selected) });
              Toast.show({ type: 'success', text1: res.data?.message || '✅ Allotted & notifications sent' });
              await load(true);
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to allot' });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const zlabel = (z?: string) => (z ? (ZONE_CONFIG as any)[z]?.label || z : '—');
  const zemoji = (z?: string) => (z ? (ZONE_CONFIG as any)[z]?.emoji || '📍' : '📍');

  const fmtTime = (s: string | null) => {
    if (!s) return '—';
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const renderDontWant = (item: SpecialCase) => (
    <View key={item.userId} style={styles.row}>
      <View style={styles.avatarRejected}>
        <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>{zemoji(item.zone)} {zlabel(item.zone)} • {item.address || '-'}</Text>
        <Text style={styles.rowMeta}>Requested at {fmtTime(item.time)} • 📱 {item.phone}</Text>
      </View>
      <View style={styles.noBadge}>
        <Text style={styles.noBadgeText}>❌ NO</Text>
      </View>
    </View>
  );

  const renderWant = (row: SpecialCase) => {
    const isSelected = selected.has(row.userId);
    const decided = row.sehriAllowed === true || row.sehriAllowed === false;
    const locked = data?.allotmentLocked;
    return (
      <TouchableOpacity
        key={row.userId}
        style={styles.row}
        onPress={() => {
          if (data?.allotmentOpen && !locked) toggle(row.userId);
        }}
        activeOpacity={(data?.allotmentOpen && !locked) ? 0.7 : 1}
      >
        <LinearGradient colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']} style={styles.avatar}>
          <Text style={styles.avatarText}>{row.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </LinearGradient>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{row.name}</Text>
          <Text style={styles.rowMeta}>{zemoji(row.zone)} {zlabel(row.zone)} • {row.address || '-'}</Text>
          <Text style={styles.rowMeta}>Requested at {fmtTime(row.time)} • 📱 {row.phone}</Text>
        </View>
        {locked && decided ? (
          row.sehriAllowed === true ? (
            <View style={styles.yesSolidBadge}><Text style={styles.yesSolidText}>✅ Confirmed</Text></View>
          ) : (
            <View style={styles.noBadge}><Text style={styles.noBadgeText}>❌ Not Allotted</Text></View>
          )
        ) : decided ? (
          row.sehriAllowed === true ? (
            <View style={styles.yesSolidBadge}><Text style={styles.yesSolidText}>✅ Allotted</Text></View>
          ) : (
            <View style={styles.noBadge}><Text style={styles.noBadgeText}>❌ No</Text></View>
          )
        ) : data?.allotmentOpen && !locked ? (
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={26}
            color={isSelected ? COLORS.primary : COLORS.textMuted}
          />
        ) : (
          <View style={styles.pendingBadge}><Text style={styles.pendingText}>⏳ Pending</Text></View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  const dontWant = data?.dontWant || [];
  const want = data?.want || [];

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        <View style={styles.header}>
          <IslamicGeometric opacity={0.07} size={240} />
          <Text style={styles.title}>⭐ Special Cases</Text>
          <Text style={styles.subtitle}>Sehri for {data?.displayLabel || ''}</Text>
          <View style={[styles.windowBadge, { borderColor: data?.allotmentOpen ? 'rgba(76,175,80,0.5)' : 'rgba(255,152,0,0.4)' }]}>
            <View style={[styles.dot, { backgroundColor: data?.allotmentOpen ? COLORS.accentGreen : COLORS.accentOrange }]} />
            <Text style={[styles.windowText, { color: data?.allotmentOpen ? COLORS.accentGreen : COLORS.accentOrange }]}>
              {data?.allotmentOpen ? '🟢 Allotment open — 5:00 PM to 6:00 PM' : '🔴 Allotment allowed only 5:00 PM – 6:00 PM'}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>❌ Opted Out — No Sehri ({dontWant.length})</Text>
          <LinearGradient colors={['rgba(26,46,69,0.8)', 'rgba(21,35,54,0.9)']} style={styles.card}>
            {dontWant.length === 0 ? (
              <Text style={styles.emptyText}>No one opted out.</Text>
            ) : (
              dontWant.map(renderDontWant)
            )}
          </LinearGradient>

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>✅ Requested Sehri — Special ({want.length})</Text>
          <LinearGradient colors={['rgba(26,46,69,0.8)', 'rgba(21,35,54,0.9)']} style={styles.card}>
            {want.length === 0 ? (
              <Text style={styles.emptyText}>No special case requests.</Text>
            ) : (
              want.map(renderWant)
            )}
          </LinearGradient>

          {want.length > 0 && (
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {data?.allotmentLocked 
                  ? '🔒 Allotment is final — no changes after 6:00 PM' 
                  : `Tick the people you want to allot Sehri. Selected: ${selected.size} / ${want.length}`}
              </Text>
              {!data?.allotmentLocked && (
                <TouchableOpacity
                  style={[styles.allotBtn, { opacity: (data?.allotmentOpen && !submitting) ? 1 : 0.5 }]}
                  onPress={confirmAllot}
                  disabled={!data?.allotmentOpen || submitting}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.allotBtnInner}>
                    {submitting
                      ? <ActivityIndicator color="#0D1B2A" size="small" />
                      : <Text style={styles.allotBtnText}>🎁 Confirm & Notify All Users</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              )}
              {!data?.allotmentOpen && !data?.allotmentLocked && (
                <Text style={styles.lockText}>⏰ Allotment window: 5:00 PM — 6:00 PM only</Text>
              )}
              {data?.allotmentLocked && (
                <View style={styles.finalBadge}>
                  <Ionicons name="lock-closed" size={16} color={COLORS.accentRed} />
                  <Text style={styles.finalText}>Final decisions — locked at 6:00 PM</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  windowBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderRadius: 12, padding: 10, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  windowText: { fontSize: 12, fontWeight: '700', flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  card: { borderRadius: 20, padding: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', ...SHADOWS.md },
  emptyText: { color: COLORS.textMuted, fontSize: 13, paddingVertical: 8, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarRejected: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,83,80,0.14)' },
  avatarText: { color: COLORS.primary, fontSize: 17, fontWeight: '800' },
  rowInfo: { flex: 1 },
  rowName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  noBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(239,83,80,0.14)', borderWidth: 1, borderColor: 'rgba(239,83,80,0.4)' },
  noBadgeText: { color: COLORS.accentRed, fontSize: 11, fontWeight: '800' },
  pendingBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,152,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,152,0,0.4)' },
  pendingText: { color: COLORS.accentOrange, fontSize: 11, fontWeight: '800' },
  yesSolidBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(76,175,80,0.14)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  yesSolidText: { color: COLORS.accentGreen, fontSize: 11, fontWeight: '800' },
  summary: { marginTop: 20, gap: 12 },
  summaryText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' },
  allotBtn: { borderRadius: 16, overflow: 'hidden' },
  allotBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  allotBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  lockText: { color: COLORS.accentOrange, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  finalBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: 'rgba(239,83,80,0.1)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(239,83,80,0.3)' },
  finalText: { color: COLORS.accentRed, fontSize: 13, fontWeight: '700' },
});