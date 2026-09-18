import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, Image, Alert, TextInput,
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
  id: string;
  amount: number | null;
  status: 'pending' | 'paid' | 'rejected';
  donor_name: string;
  donor_phone: string;
  donor_zone: string;
  is_anonymous: boolean;
  message: string | null;
  proof_url: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: COLORS.accentOrange, icon: '⏳' },
  paid:     { label: 'Paid',     color: COLORS.accentGreen,  icon: '✅' },
  rejected: { label: 'Rejected', color: COLORS.accentRed,    icon: '❌' },
};

export default function AdminDonationHistory() {
  const router = useRouter();
  const { activeRole } = useAuthStore();
  const [loading, setLoading]                     = useState(true);
  const [refreshing, setRefreshing]               = useState(false);
  const [data, setData]                           = useState<any>(null);
  const [donations, setDonations]                 = useState<Donation[]>([]);
  const [filteredDonations, setFilteredDonations] = useState<Donation[]>([]);
  const [selectedZone, setSelectedZone]           = useState<string>('all');
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [selectedProof, setSelectedProof]         = useState<{ id: string; name: string; url: string } | null>(null);
  const [actionLoading, setActionLoading]         = useState<string | null>(null);
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [pendingAction, setPendingAction]         = useState<{ donation: Donation; status: 'paid' | 'rejected' } | null>(null);
  const [amountInput, setAmountInput]             = useState('');

  useEffect(() => {
    if (activeRole !== 'super_admin') {
      Toast.show({ type: 'error', text1: 'Access Denied', text2: 'Super admin only' });
      router.back();
    }
  }, [activeRole, router]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.DONATION_ALL);
      const d = res.data.data;
      setData(d);
      setDonations(d.donations || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to load donations' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(true); };

  useEffect(() => {
    setFilteredDonations(
      selectedZone === 'all' ? donations : donations.filter(d => d.donor_zone === selectedZone)
    );
  }, [selectedZone, donations]);

  // Update totals locally without a refetch
  const updateLocalTotals = (donation: Donation, newStatus: 'paid' | 'rejected', newAmount: number | null) => {
    setData((prev: any) => {
      if (!prev) return prev;
      let totalAmount    = Number(prev.total_amount    || 0);
      let totalDonations = Number(prev.total_donations || 0);
      // Undo previous paid contribution
      if (donation.status === 'paid') { totalAmount -= Number(donation.amount || 0); totalDonations -= 1; }
      // Apply new paid contribution
      if (newStatus === 'paid') { totalAmount += Number(newAmount || 0); totalDonations += 1; }
      return { ...prev, total_amount: totalAmount, total_donations: totalDonations };
    });
  };

  const executeStatusChange = async (donation: Donation, newStatus: 'paid' | 'rejected', amount?: string) => {
    setActionLoading(donation.id);
    try {
      const body: any = { status: newStatus };
      if (newStatus === 'paid' && amount) body.amount = parseFloat(amount);
      await api.patch(ENDPOINTS.DONATION_UPDATE_STATUS(donation.id), body);
      const newAmount = newStatus === 'paid' && amount ? parseFloat(amount) : null;
      setDonations(prev => prev.map(d =>
        d.id === donation.id ? { ...d, status: newStatus, amount: newAmount ?? d.amount } : d
      ));
      updateLocalTotals(donation, newStatus, newAmount ?? donation.amount);
      Toast.show({
        type: 'success',
        text1: newStatus === 'paid' ? '✅ Donation accepted' : '❌ Donation rejected',
        text2: newStatus === 'paid' && newAmount ? `₹${newAmount.toLocaleString()} added to total` : undefined,
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Action failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = (donation: Donation) => {
    setAmountInput(donation.amount ? String(donation.amount) : '');
    setPendingAction({ donation, status: 'paid' });
    setAmountModalVisible(true);
  };

  const handleReject = (donation: Donation) => {
    const deductMsg = donation.status === 'paid'
      ? `\n\nThis will deduct ₹${Number(donation.amount || 0).toLocaleString()} from the total.` : '';
    Alert.alert(
      '❌ Reject Donation',
      `Reject donation from ${donation.donor_name}?${deductMsg}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => executeStatusChange(donation, 'rejected') },
      ]
    );
  };

  const confirmAccept = () => {
    if (!pendingAction) return;
    const amt = parseFloat(amountInput);
    if (!amountInput.trim() || isNaN(amt) || amt <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount' });
      return;
    }
    setAmountModalVisible(false);
    executeStatusChange(pendingAction.donation, 'paid', amountInput);
    setPendingAction(null);
    setAmountInput('');
  };

  const openProof = (donation: Donation) => {
    if (!donation.proof_url) { Toast.show({ type: 'info', text1: 'No proof uploaded' }); return; }
    setSelectedProof({ id: donation.id, name: donation.donor_name, url: `${API_BASE_URL}${donation.proof_url}` });
    setProofModalVisible(true);
  };

  const zoneLabel = (z: string) => (ZONE_CONFIG as any)[z]?.label || z;
  const zoneEmoji = (z: string) => (ZONE_CONFIG as any)[z]?.emoji || '📍';
  const fmtDate = (s: string) => {
    if (!s) return '—';
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const fmtTime = (s: string) => {
    if (!s) return '';
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={st.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  const zones = ['masjid', 'boys_hostel', 'stanza', 'girls'];

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={st.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={st.header}>
          <IslamicGeometric opacity={0.07} size={240} />
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={st.title}>💰 Donation History</Text>
          <Text style={st.subtitle}>All transactions & payment proofs</Text>
        </View>

        <View style={st.content}>
          {/* Summary Stats */}
          <LinearGradient colors={['rgba(201,168,76,0.15)', 'rgba(201,168,76,0.03)']} style={st.statsCard}>
            <View style={st.statsRow}>
              <View style={st.stat}>
                <Text style={st.statNum}>₹{Number(data?.total_amount || 0).toLocaleString()}</Text>
                <Text style={st.statLabel}>Total Collected</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.stat}>
                <Text style={[st.statNum, { color: COLORS.accent }]}>{data?.total_donations || 0}</Text>
                <Text style={st.statLabel}>Paid Donations</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Zone Filter */}
          <Text style={st.sectionTitle}>Filter by Zone</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterScroll}>
            <TouchableOpacity
              style={[st.filterChip, selectedZone === 'all' && st.filterChipActive]}
              onPress={() => setSelectedZone('all')} activeOpacity={0.7}
            >
              <Text style={[st.filterText, selectedZone === 'all' && st.filterTextActive]}>All Zones</Text>
            </TouchableOpacity>
            {zones.map((z) => (
              <TouchableOpacity
                key={z}
                style={[st.filterChip, selectedZone === z && st.filterChipActive]}
                onPress={() => setSelectedZone(z)} activeOpacity={0.7}
              >
                <Text style={st.filterEmoji}>{zoneEmoji(z)}</Text>
                <Text style={[st.filterText, selectedZone === z && st.filterTextActive]}>{zoneLabel(z)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.sectionTitle}>Recent Transactions ({filteredDonations.length})</Text>

          {filteredDonations.length === 0 ? (
            <View style={st.emptyBox}>
              <Text style={st.emptyEmoji}>🌙</Text>
              <Text style={st.emptyText}>No donations found</Text>
            </View>
          ) : (
            filteredDonations.map((d) => {
              const statusCfg = STATUS_CONFIG[d.status];
              const isActing  = actionLoading === d.id;
              return (
                <LinearGradient
                  key={d.id}
                  colors={['rgba(26,46,69,0.8)', 'rgba(21,35,54,0.9)']}
                  style={[
                    st.donationCard,
                    d.status === 'paid'     && st.cardPaid,
                    d.status === 'rejected' && st.cardRejected,
                  ]}
                >
                  {/* Header */}
                  <View style={st.donationHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={st.nameRow}>
                        <Text style={st.donorName}>{d.donor_name}</Text>
                        {d.is_anonymous && (
                          <View style={st.anonymousBadge}>
                            <Text style={st.anonymousBadgeText}>🔒 Anon</Text>
                          </View>
                        )}
                      </View>
                      <View style={st.metaRow}>
                        <Text style={st.metaText}>{zoneEmoji(d.donor_zone)} {zoneLabel(d.donor_zone)}</Text>
                        <Text style={st.metaDot}>•</Text>
                        <Text style={st.metaText}>📱 {d.donor_phone}</Text>
                      </View>
                    </View>
                    <View style={[st.statusBadge, { backgroundColor: `${statusCfg.color}20`, borderColor: `${statusCfg.color}60` }]}>
                      <Text style={[st.statusText, { color: statusCfg.color }]}>
                        {statusCfg.icon} {statusCfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* Amount & Date */}
                  <View style={st.amountRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.amountLabel}>
                        {d.status === 'pending' ? 'Declared Amount' : 'Amount'}
                      </Text>
                      <Text style={[st.amountValue, d.status === 'pending' && d.amount && { color: COLORS.accentOrange }]}>
                        {d.amount ? `₹${Number(d.amount).toLocaleString()}` : '—'}
                      </Text>
                      {d.status === 'pending' && d.amount ? (
                        <Text style={st.amountNote}>⚠️ User declared — verify before accepting</Text>
                      ) : null}
                      {d.status === 'pending' && !d.amount ? (
                        <Text style={st.amountNote}>Enter amount when accepting</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={st.dateLabel}>Date</Text>
                      <Text style={st.dateValue}>{fmtDate(d.created_at)}</Text>
                      <Text style={st.timeValue}>{fmtTime(d.created_at)}</Text>
                    </View>
                  </View>

                  {/* Message */}
                  {d.message ? (
                    <View style={st.messageBox}>
                      <Ionicons name="chatbox-ellipses-outline" size={14} color={COLORS.textSecondary} />
                      <Text style={st.messageText} numberOfLines={2}>{d.message}</Text>
                    </View>
                  ) : null}

                  {/* View Proof */}
                  <TouchableOpacity style={st.proofBtn} onPress={() => openProof(d)} activeOpacity={0.75}>
                    <Ionicons name="image-outline" size={16} color={COLORS.primary} />
                    <Text style={st.proofBtnText}>View Proof</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                  </TouchableOpacity>

                  {/* Action Buttons */}
                  {isActing ? (
                    <View style={st.actingRow}>
                      <ActivityIndicator color={COLORS.primary} size="small" />
                      <Text style={st.actingText}>Updating...</Text>
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

      {/* Amount Entry Modal */}
      <Modal
        visible={amountModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setAmountModalVisible(false); setPendingAction(null); }}
      >
        <View style={st.modalOverlay}>
          <View style={st.amountModalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>✅ Confirm Amount</Text>
              <TouchableOpacity onPress={() => { setAmountModalVisible(false); setPendingAction(null); }} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={st.modalSubtitle}>
              {pendingAction?.donation.donor_name}
              {pendingAction?.donation.donor_zone ? ` • ${zoneEmoji(pendingAction.donation.donor_zone)} ${zoneLabel(pendingAction.donation.donor_zone)}` : ''}
            </Text>
            <Text style={st.amountInputLabel}>Enter verified amount (₹)</Text>
            <TextInput
              style={st.amountInputField}
              value={amountInput}
              onChangeText={(t) => setAmountInput(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="e.g. 500"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            {pendingAction?.donation.amount ? (
              <Text style={st.amountHint}>
                User declared: ₹{Number(pendingAction.donation.amount).toLocaleString()} — you can change this if needed
              </Text>
            ) : (
              <Text style={st.amountHint}>User did not declare an amount — enter the actual amount from proof</Text>
            )}
            <View style={st.amountModalActions}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => { setAmountModalVisible(false); setPendingAction(null); }} activeOpacity={0.8}>
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

      {/* Proof Image Modal */}
      <Modal
        visible={proofModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setProofModalVisible(false)}
      >
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Payment Proof</Text>
              <TouchableOpacity onPress={() => setProofModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={st.modalSubtitle}>{selectedProof?.name}</Text>
            {selectedProof && (
              <ScrollView style={st.proofScroll} contentContainerStyle={st.proofScrollContent} showsVerticalScrollIndicator={false}>
                <Image source={{ uri: selectedProof.url }} style={st.proofImage} resizeMode="contain" />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header:    { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 14, position: 'relative' },
  backBtn:   { position: 'absolute', top: 52, left: 16, zIndex: 2, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  title:     { color: COLORS.textPrimary,   fontSize: 24, fontWeight: '800' },
  subtitle:  { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  content:   { paddingHorizontal: 20, paddingBottom: 40 },

  statsCard:   { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', ...SHADOWS.md },
  statsRow:    { flexDirection: 'row', alignItems: 'center' },
  stat:        { flex: 1, alignItems: 'center' },
  statNum:     { color: COLORS.primary, fontSize: 28, fontWeight: '800' },
  statLabel:   { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(201,168,76,0.3)' },

  sectionTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 8, marginBottom: 12 },

  filterScroll:     { marginBottom: 20 },
  filterChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary, marginRight: 8 },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.15)' },
  filterEmoji:      { fontSize: 14 },
  filterText:       { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: COLORS.primary, fontWeight: '700' },

  emptyBox:  { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji:{ fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },

  donationCard:  { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', ...SHADOWS.md },
  cardPaid:      { borderColor: 'rgba(76,175,80,0.35)' },
  cardRejected:  { borderColor: 'rgba(239,83,80,0.2)', opacity: 0.85 },

  donationHeader:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  nameRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  donorName:         { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  anonymousBadge:    { backgroundColor: 'rgba(255,152,0,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,152,0,0.4)' },
  anonymousBadgeText:{ color: COLORS.accentOrange, fontSize: 10, fontWeight: '700' },
  metaRow:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:          { color: COLORS.textSecondary, fontSize: 12 },
  metaDot:           { color: COLORS.textMuted, fontSize: 12 },
  statusBadge:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText:        { fontSize: 11, fontWeight: '700' },

  amountRow:   { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginBottom: 8 },
  amountLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
  amountValue: { color: COLORS.primary, fontSize: 20, fontWeight: '800' },
  dateLabel:   { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
  dateValue:   { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  timeValue:   { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  messageBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginBottom: 8 },
  messageText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },

  proofBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.08)', marginBottom: 10 },
  proofBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  actionRow:     { flexDirection: 'row', gap: 10 },
  acceptBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: COLORS.accentGreen },
  acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rejectBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: COLORS.accentRed },
  rejectBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actingRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  actingText:    { color: COLORS.textMuted, fontSize: 13 },

  amountModalContent: { backgroundColor: COLORS.background, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  amountInputLabel:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  amountInputField:   { backgroundColor: COLORS.backgroundSecondary, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  amountHint:         { color: COLORS.textMuted, fontSize: 12, marginTop: 6 },
  amountNote:         { color: COLORS.accentOrange, fontSize: 11, marginTop: 3, fontWeight: '600' },
  amountModalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn:          { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText:      { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  confirmBtn:         { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: COLORS.accentGreen },
  confirmBtnText:     { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent:      { backgroundColor: COLORS.background, borderRadius: 20, padding: 20, width: '100%', maxHeight: '80%', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle:        { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  modalSubtitle:     { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },
  proofScroll:       { maxHeight: 500 },
  proofScrollContent:{ alignItems: 'center' },
  proofImage:        { width: '100%', height: 400, borderRadius: 12 },
});
