import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
  Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES, ZONE_CONFIG } from '../../../src/constants/theme';
import api from '../../../src/services/api';
import { ENDPOINTS } from '../../../src/constants/api';

type Diff = { field: string; from: any; to: any };
type Request = {
  id: string;
  user: { id: string; name: string; phone: string; zone: string; status: string } | null;
  created_at: string;
  diff: Diff[];
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Full Name',
  gender: 'Gender',
  occupation: 'Occupation',
  zone: 'Zone',
  area: 'Locality',
  address: 'PG / Address',
};

/** Zone values render with their own colour so the change reads at a glance. */
function fieldValue(field: string, value: any) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'zone') {
    const z = ZONE_CONFIG[value as keyof typeof ZONE_CONFIG];
    return z ? `${z.emoji} ${z.label}` : String(value);
  }
  return String(value).replace(/_/g, ' ');
}

function fieldColor(field: string, value: any) {
  if (field === 'zone') {
    const z = ZONE_CONFIG[value as keyof typeof ZONE_CONFIG];
    if (z) return z.color;
  }
  return COLORS.textPrimary;
}

export default function ProfileEditRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Request | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(ENDPOINTS.PROFILE_EDIT_REQUESTS);
      setRequests(data.data || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not load requests' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, status: 'approved' | 'rejected', rejection_reason?: string) => {
    try {
      setBusyId(id);
      await api.patch(ENDPOINTS.REVIEW_PROFILE_EDIT(id), { status, rejection_reason });
      Toast.show({
        type: 'success',
        text1: status === 'approved' ? 'Changes approved' : 'Request rejected',
        text2: 'The user can log in again now.',
      });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Action failed' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmApprove = (r: Request) => {
    Alert.alert(
      'Approve changes?',
      `${r.user?.name}'s profile will be updated with ${r.diff.length} change${r.diff.length > 1 ? 's' : ''}, and they will be able to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => review(r.id, 'approved') },
      ],
    );
  };

  const renderItem = ({ item }: { item: Request }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.userName}>{item.user?.name || 'Unknown user'}</Text>
          <Text style={s.userMeta}>
            +91 {item.user?.phone}
            {item.user?.zone ? ` • ${ZONE_CONFIG[item.user.zone as keyof typeof ZONE_CONFIG]?.label || item.user.zone}` : ''}
          </Text>
        </View>
        <View style={s.countPill}>
          <Text style={s.countPillTxt}>{item.diff.length}</Text>
        </View>
      </View>

      <View style={s.diffBox}>
        {item.diff.map((d) => (
          <View key={d.field} style={s.diffRow}>
            <View style={s.diffLabelRow}>
              <Text style={s.diffField}>{FIELD_LABELS[d.field] || d.field}</Text>
              <Text style={s.changedTag}>CHANGED</Text>
            </View>
            <View style={s.diffValues}>
              <Text style={s.fromVal} numberOfLines={2}>{fieldValue(d.field, d.from)}</Text>
              <Ionicons name="arrow-forward" size={13} color={COLORS.primary} style={{ marginHorizontal: 8 }} />
              <Text style={[s.toVal, { color: fieldColor(d.field, d.to) }]} numberOfLines={2}>
                {fieldValue(d.field, d.to)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.submitted}>
        Submitted {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
      </Text>

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.btn, s.rejectBtn]}
          disabled={busyId === item.id}
          onPress={() => { setRejecting(item); setReason(''); }}
          activeOpacity={0.85}
        >
          <Text style={s.rejectTxt}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, s.approveBtn]}
          disabled={busyId === item.id}
          onPress={() => confirmApprove(item)}
          activeOpacity={0.85}
        >
          <Text style={s.approveTxt}>{busyId === item.id ? 'Working…' : 'Approve'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>📝 Profile Edit Requests</Text>
        <Text style={s.subtitle}>
          These users are signed out until you approve or reject their changes.
        </Text>
      </View>

      <FlatList
        data={requests}
        renderItem={renderItem}
        keyExtractor={(i) => i.id}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>✅</Text>
              <Text style={s.emptyTxt}>No pending edit requests</Text>
            </View>
          ) : null
        }
      />

      {/* Reject with an optional reason */}
      <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reject changes?</Text>
            <Text style={s.modalNote}>
              {rejecting?.user?.name}'s details stay as they are and they can log in again.
              A reason is optional but gets sent to them.
            </Text>
            <TextInput
              style={s.modalInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (optional)"
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            <View style={s.actions}>
              <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={() => setRejecting(null)} activeOpacity={0.85}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.rejectBtn]}
                onPress={() => {
                  const r = rejecting;
                  setRejecting(null);
                  if (r) review(r.id, 'rejected', reason.trim() || undefined);
                }}
                activeOpacity={0.85}
              >
                <Text style={s.rejectTxt}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 16, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.md },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 6, lineHeight: 17 },
  list: { padding: SIZES.spacing.base, paddingBottom: 60 },
  card: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.base,
    marginBottom: SIZES.spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.spacing.md },
  userName: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700' },
  userMeta: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 3 },
  countPill: {
    minWidth: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,152,0,0.18)',
    borderWidth: 1, borderColor: COLORS.accentOrange,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countPillTxt: { color: COLORS.accentOrange, fontSize: 12, fontWeight: '800' },
  diffBox: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: SIZES.radius.md,
    padding: SIZES.spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  diffRow: { marginBottom: 12 },
  diffLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  diffField: { color: COLORS.textSecondary, fontSize: 11.5, fontWeight: '600' },
  changedTag: {
    color: COLORS.background,
    backgroundColor: COLORS.accentOrange,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  diffValues: { flexDirection: 'row', alignItems: 'center' },
  fromVal: {
    color: COLORS.textMuted,
    fontSize: 13,
    textDecorationLine: 'line-through',
    flexShrink: 1,
  },
  toVal: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  submitted: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: SIZES.spacing.md },
  btn: { flex: 1, paddingVertical: 11, borderRadius: SIZES.radius.md, alignItems: 'center', borderWidth: 1 },
  approveBtn: { backgroundColor: 'rgba(76,175,80,0.18)', borderColor: COLORS.accentGreen },
  approveTxt: { color: COLORS.accentGreen, fontSize: 13.5, fontWeight: '700' },
  rejectBtn: { backgroundColor: 'rgba(239,83,80,0.15)', borderColor: COLORS.accentRed },
  rejectTxt: { color: COLORS.accentRed, fontSize: 13.5, fontWeight: '700' },
  cancelBtn: { backgroundColor: 'transparent', borderColor: COLORS.border },
  cancelTxt: { color: COLORS.textSecondary, fontSize: 13.5, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 70, gap: 12 },
  emptyTxt: { color: COLORS.textMuted, fontSize: SIZES.base },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  modalNote: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 19, marginTop: 8 },
  modalInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius.md,
    color: COLORS.textPrimary,
    padding: 12,
    fontSize: 14,
    marginTop: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
});
