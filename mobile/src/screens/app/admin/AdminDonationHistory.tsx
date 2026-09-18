import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, Image, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ZONE_CONFIG, SHADOWS } from '../../../constants/theme';
import { IslamicGeometric } from '../../../components/ui/IslamicPattern';
import api from '../../../services/api';
import { ENDPOINTS, API_BASE_URL } from '../../../constants/api';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';

interface Donation {
  id:           string;
  donor_name:   string;
  donor_phone:  string;
  donor_zone:   string;
  is_anonymous: boolean;
  amount:       string | null;   // decimal comes as string from backend
  status:       'pending' | 'paid' | 'rejected';
  message:      string | null;
  proof_url:    string | null;
  created_at:   string | null;  // ISO string
}

const STATUS = {
  pending:  { label: 'Pending',  color: COLORS.accentOrange, icon: '⏳' },
  paid:     { label: 'Paid',     color: COLORS.accentGreen,  icon: '✅' },
  rejected: { label: 'Rejected', color: COLORS.accentRed,    icon: '❌' },
};

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const fmtAmt = (a: string | null) =>
  a && Number(a) > 0 ? `₹${Number(a).toLocaleString()}` : null;

export default function AdminDonationHistory() {
  const router = useRouter();
  const { activeRole } = useAuthStore();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary,    setSummary]    = useState({ total_amount: 0, total_donations: 0 });
  const [donations,  setDonations]  = useState<Donation[]>([]);
  const [filtered,   setFiltered]   = useState<Donation[]>([]);
  const [zone,       setZone]       = useState('all');

  // Proof modal
  const [proofVisible, setProofVisible] = useState(false);
  const [proofData,    setProofData]    = useState<{ name: string; url: string } | null>(null);

  // Accept amount modal
  const [amountVisible,  setAmountVisible]  = useState(false);
  const [amountInput,    setAmountInput]    = useState('');
  const [pendingDonation, setPendingDonation] = useState<Donation | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (activeRole !== 'super_admin') {
      Toast.show({ type: 'error', text1: 'Access denied — Super Admin only' });
      router.back();
    }
  }, [activeRole]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.DONATION_ALL);
      const d   = res.data.data;
      setSummary({
        total_amount:    Number(d.total_amount    || 0),
        total_donations: Number(d.total_donations || 0),
      });
      setDonations(d.donations || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to load' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setFiltered(zone === 'all' ? donations : donations.filter(d => d.donor_zone === zone));
  }, [zone, donations]);

  // ── Totals update locally ────────────────────────────────────────────────
  const adjustTotals = (prev: Donation, newStatus: 'paid' | 'rejected', newAmt: number | null) => {
    setSummary(s => {
      let amt   = s.total_amount;
      let count = s.total_donations;
      if (prev.status === 'paid') { amt -= Number(prev.amount || 0); count--; }
      if (newStatus === 'paid')   { amt += Number(newAmt || 0);      count++; }
      return { total_amount: Math.max(0, amt), total_donations: Math.max(0, count) };
    });
  };

  // ── Execute status change ────────────────────────────────────────────────
  const executeChange = async (donation: Donation, newStatus: 'paid' | 'rejected', amtStr?: string) => {
    setActionId(donation.id);
    try {
      const body: any = { status: newStatus };
      if (newStatus === 'paid' && amtStr) body.amount = parseFloat(amtStr);

      await api.patch(ENDPOINTS.DONATION_UPDATE_STATUS(donation.id), body);

      const newAmt = newStatus === 'paid' && amtStr ? parseFloat(amtStr) : null;
      adjustTotals(donation, newStatus, newAmt ?? Number(donation.amount));

      setDonations(prev => prev.map(d =>
        d.id === donation.id
          ? { ...d, status: newStatus, amount: newAmt !== null ? String(newAmt) : d.amount }
          : d
      ));

      Toast.show({
        type:  'success',
        text1: newStatus === 'paid' ? '✅ Accepted' : '❌ Rejected',
        text2: newStatus === 'paid' && newAmt ? `₹${newAmt.toLocaleString()} added to total` : undefined,
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Action failed' });
    } finally {
      setActionId(null);
    }
  };

  const handleAccept = (d: Donation) => {
    setAmountInput(d.amount && Number(d.amount) > 0 ? String(Number(d.amount)) : '');
    setPendingDonation(d);
    setAmountVisible(true);
  };

  const handleReject = (d: Donation) => {
    const warn = d.status === 'paid'
      ? `\n\nThis will deduct ₹${Number(d.amount || 0).toLocaleString()} from the total.` : '';
    Alert.alert(
      '❌ Reject Donation',
      `Reject donation from ${d.donor_name}?${warn}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => executeChange(d, 'rejected') },
      ]
    );
  };

  const confirmAccept = () => {
    if (!pendingDonation) return;
    const amt = parseFloat(amountInput);
    if (!amountInput.trim() || isNaN(amt) || amt <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount' });
      return;
    }
    setAmountVisible(false);
    executeChange(pendingDonation, 'paid', amountInput);
    setPendingDonation(null);
    setAmountInput('');
  };

  const openProof = (d: Donation) => {
    if (!d.proof_url) { Toast.show({ type: 'info', text1: 'No proof uploaded' }); return; }
    setProofData({ name: d.donor_name, url: `${API_BASE_URL}${d.proof_url}` });
    setProofVisible(true);
  };

  const zl = (z: string) => (ZONE_CONFIG as any)[z]?.label || z;
  const ze = (z: string) => (ZONE_CONFIG as any)[z]?.emoji || '📍';

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={st.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={st.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={st.header}>
          <IslamicGeometric opacity={0.07} size={240} />
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={st.title}>💰 Donation History</Text>
          <Text style={st.subtitle}>All transactions · verify & manage</Text>
        </View>

        <View style={st.content}>
          {/* Summary */}
          <LinearGradient colors={['rgba(201,168,76,0.15)', 'rgba(201,168,76,0.03)']} style={st.statsCard}>
            <View style={st.statsRow}>
              <View style={st.stat}>
                <Text style={st.statNum}>₹{summary.total_amount.toLocaleString()}</Text>
                <Text style={st.statLabel}>Total Collected</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.stat}>
                <Text style={[st.statNum, { color: COLORS.accent }]}>{summary.total_donations}</Text>
                <Text style={st.statLabel}>Paid Donations</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Zone filter */}
          <Text style={st.sectionTitle}>Filter by Zone</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow}>
            {['all', 'masjid', 'boys_hostel', 'stanza', 'girls'].map((z) => (
              <TouchableOpacity
                key={z}
                style={[st.chip, zone === z && st.chipActive]}
                onPress={() => setZone(z)}
                activeOpacity={0.7}
              >
                {z !== 'all' && <Text style={st.chipEmoji}>{ze(z)}</Text>}
                <Text style={[st.chipText, zone === z && st.chipTextActive]}>
                  {z === 'all' ? 'All Zones' : zl(z)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.sectionTitle}>Transactions ({filtered.length})</Text>

          {filtered.length === 0 ? (
            <View style={st.empty}>
              <Text style={{ fontSize: 48 }}>🌙</Text>
              <Text style={st.emptyText}>No donations found</Text>
            </View>
          ) : (
            filtered.map((d) => {
              const cfg     = STATUS[d.status];
              const isAct   = actionId === d.id;
              const amtDisp = fmtAmt(d.amount);

              return (
                <LinearGradient
                  key={d.id}
                  colors={['rgba(26,46,69,0.8)', 'rgba(21,35,54,0.9)']}
                  style={[
                    st.card,
                    d.status === 'paid'     && st.cardPaid,
                    d.status === 'rejected' && st.cardRejected,
                  ]}
                >
                  {/* Top row */}
                  <View style={st.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={st.nameRow}>
                        <Text style={st.donorName}>
                          {d.is_anonymous ? '🔒 Anonymous' : d.donor_name}
                        </Text>
                      </View>
                      <Text style={st.metaText}>{ze(d.donor_zone)} {zl(d.donor_zone)}  ·  📱 {d.donor_phone}</Text>
                    </View>
                    <View style={[st.statusBadge, { backgroundColor: `${cfg.color}20`, borderColor: `${cfg.color}60` }]}>
                      <Text style={[st.statusText, { color: cfg.color }]}>{cfg.icon} {cfg.label}</Text>
                    </View>
                  </View>

                  {/* Amount + Date */}
                  <View style={st.amountRow}>
                    <View>
                      <Text style={st.amtLabel}>
                        {d.status === 'pending' ? 'Declared Amount' : 'Amount'}
                      </Text>
                      <Text style={[st.amtValue, !amtDisp && { color: COLORS.textMuted, fontSize: 14 }]}>
                        {amtDisp || (d.status === 'pending' ? 'Enter when accepting' : '—')}
                      </Text>
                      {d.status === 'pending' && amtDisp && (
                        <Text style={st.amtNote}>⚠️ Verify before accepting</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={st.dateText}>{fmtDate(d.created_at)}</Text>
                    </View>
                  </View>

                  {/* Message */}
                  {d.message ? (
                    <View style={st.msgBox}>
                      <Ionicons name="chatbox-ellipses-outline" size={13} color={COLORS.textSecondary} />
                      <Text style={st.msgText} numberOfLines={2}>{d.message}</Text>
                    </View>
                  ) : null}

                  {/* View Proof */}
                  <TouchableOpacity style={st.proofBtn} onPress={() => openProof(d)} activeOpacity={0.75}>
                    <Ionicons name="image-outline" size={16} color={COLORS.primary} />
                    <Text style={st.proofBtnText}>View Payment Proof</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                  </TouchableOpacity>

                  {/* Actions */}
                  {isAct ? (
                    <View style={st.actingRow}>
                      <ActivityIndicator color={COLORS.primary} size="small" />
                      <Text style={st.actingText}>Updating…</Text>
                    </View>
                  ) : (
                    <View style={st.actionRow}>
                      {d.status !== 'paid' && (
                        <TouchableOpacity style={st.acceptBtn} onPress={() => handleAccept(d)} activeOpacity={0.8}>
                          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                          <Text style={st.acceptBtnText}>{d.status === 'rejected' ? 'Re-accept' : 'Accept'}</Text>
                        </TouchableOpacity>
                      )}
                      {d.status !== 'rejected' && (
                        <TouchableOpacity style={st.rejectBtn} onPress={() => handleReject(d)} activeOpacity={0.8}>
                          <Ionicons name="close-circle-outline" size={16} color="#fff" />
                          <Text style={st.rejectBtnText}>{d.status === 'paid' ? 'Undo / Reject' : 'Reject'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </LinearGradient>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── Accept Modal ── */}
      <Modal visible={amountVisible} animationType="slide" transparent onRequestClose={() => setAmountVisible(false)}>
        <View style={st.overlay}>
          <View style={st.amtModal}>
            <View style={st.modalHdr}>
              <Text style={st.modalTitle}>✅ Accept Donation</Text>
              <TouchableOpacity onPress={() => { setAmountVisible(false); setPendingDonation(null); }} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={st.modalSub}>
              {pendingDonation?.is_anonymous ? '🔒 Anonymous' : pendingDonation?.donor_name}
              {pendingDonation?.donor_zone ? `  ·  ${ze(pendingDonation.donor_zone)} ${zl(pendingDonation.donor_zone)}` : ''}
            </Text>

            <Text style={st.amtInputLabel}>Verified Amount (₹)</Text>
            <TextInput
              style={st.amtInput}
              value={amountInput}
              onChangeText={t => setAmountInput(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="Enter the actual amount paid"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />

            {pendingDonation?.amount && Number(pendingDonation.amount) > 0 ? (
              <Text style={st.amtHint}>
                User declared: ₹{Number(pendingDonation.amount).toLocaleString()} — edit if different
              </Text>
            ) : (
              <Text style={st.amtHint}>User did not declare an amount — enter from proof</Text>
            )}

            <View style={st.modalActions}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => { setAmountVisible(false); setPendingDonation(null); }} activeOpacity={0.8}>
                <Text style={st.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.confirmBtn} onPress={confirmAccept} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={st.confirmBtnText}>Accept & Add to Total</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Proof Modal ── */}
      <Modal visible={proofVisible} animationType="fade" transparent onRequestClose={() => setProofVisible(false)}>
        <View style={st.overlay}>
          <View style={st.proofModal}>
            <View style={st.modalHdr}>
              <Text style={st.modalTitle}>Payment Proof</Text>
              <TouchableOpacity onPress={() => setProofVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={st.modalSub}>{proofData?.name}</Text>
            {proofData && (
              <ScrollView contentContainerStyle={{ alignItems: 'center' }}>
                <Image source={{ uri: proofData.url }} style={st.proofImg} resizeMode="contain" />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  container:  { flex: 1 },
  header:     { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 14, position: 'relative' },
  backBtn:    { position: 'absolute', top: 52, left: 16, zIndex: 2, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  title:      { color: COLORS.textPrimary,   fontSize: 24, fontWeight: '800' },
  subtitle:   { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  content:    { paddingHorizontal: 20, paddingBottom: 60 },

  statsCard:   { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', ...SHADOWS.md },
  statsRow:    { flexDirection: 'row', alignItems: 'center' },
  stat:        { flex: 1, alignItems: 'center' },
  statNum:     { color: COLORS.primary, fontSize: 28, fontWeight: '800' },
  statLabel:   { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(201,168,76,0.3)' },

  sectionTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  filterRow:    { marginBottom: 20 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary, marginRight: 8 },
  chipActive:   { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.15)' },
  chipEmoji:    { fontSize: 13 },
  chipText:     { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },

  empty:     { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },

  card:         { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', ...SHADOWS.md },
  cardPaid:     { borderColor: 'rgba(76,175,80,0.35)' },
  cardRejected: { borderColor: 'rgba(239,83,80,0.2)', opacity: 0.85 },

  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  donorName:    { color: COLORS.textPrimary,   fontSize: 16, fontWeight: '700' },
  metaText:     { color: COLORS.textSecondary, fontSize: 12 },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText:   { fontSize: 11, fontWeight: '700' },

  amountRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginBottom: 8 },
  amtLabel:   { color: COLORS.textMuted,   fontSize: 11, marginBottom: 2 },
  amtValue:   { color: COLORS.primary,     fontSize: 20, fontWeight: '800' },
  amtNote:    { color: COLORS.accentOrange, fontSize: 10, fontWeight: '600', marginTop: 2 },
  dateText:   { color: COLORS.textSecondary, fontSize: 11, textAlign: 'right' },

  msgBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginBottom: 8 },
  msgText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },

  proofBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.08)', marginBottom: 10 },
  proofBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  actionRow:     { flexDirection: 'row', gap: 10 },
  acceptBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: COLORS.accentGreen },
  acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rejectBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: COLORS.accentRed },
  rejectBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actingRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  actingText:    { color: COLORS.textMuted, fontSize: 13 },

  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  amtModal:  { backgroundColor: COLORS.background, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  proofModal:{ backgroundColor: COLORS.background, borderRadius: 20, padding: 20, width: '100%', maxHeight: '85%', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalHdr:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle:{ color: COLORS.textPrimary,   fontSize: 18, fontWeight: '700' },
  modalSub:  { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },

  amtInputLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  amtInput:      { backgroundColor: COLORS.backgroundSecondary, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  amtHint:       { color: COLORS.textMuted, fontSize: 12, marginTop: 6 },
  modalActions:  { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  confirmBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: COLORS.accentGreen },
  confirmBtnText:{ color: '#fff', fontSize: 14, fontWeight: '700' },

  proofImg: { width: '100%', height: 420, borderRadius: 12 },
});
