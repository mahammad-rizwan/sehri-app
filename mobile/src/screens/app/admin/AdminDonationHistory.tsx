import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, Image,
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
  pending: { label: 'Pending', color: COLORS.accentOrange, icon: '⏳' },
  paid: { label: 'Paid', color: COLORS.accentGreen, icon: '✅' },
  rejected: { label: 'Rejected', color: COLORS.accentRed, icon: '❌' },
};

export default function AdminDonationHistory() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [filteredDonations, setFilteredDonations] = useState<Donation[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [selectedProof, setSelectedProof] = useState<{ id: string; name: string; url: string } | null>(null);

  // Super admin only - redirect if not authorized
  useEffect(() => {
    if (user?.role !== 'super_admin') {
      Toast.show({ type: 'error', text1: 'Access Denied', text2: 'Super admin only' });
      router.back();
    }
  }, [user, router]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.DONATION_ALL);
      const d = res.data.data;
      setData(d);
      setDonations(d.donations || []);
      setFilteredDonations(d.donations || []);
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
    if (selectedZone === 'all') {
      setFilteredDonations(donations);
    } else {
      setFilteredDonations(donations.filter(d => d.donor_zone === selectedZone));
    }
  }, [selectedZone, donations]);

  const openProof = (donation: Donation) => {
    if (!donation.proof_url) {
      Toast.show({ type: 'info', text1: 'No proof uploaded' });
      return;
    }
    setSelectedProof({
      id: donation.id,
      name: donation.donor_name,
      url: `${API_BASE_URL}${donation.proof_url}`,
    });
    setProofModalVisible(true);
  };

  const zoneLabel = (z: string) => (ZONE_CONFIG as any)[z]?.label || z;
  const zoneEmoji = (z: string) => (ZONE_CONFIG as any)[z]?.emoji || '📍';
  const zoneColor = (z: string) => (ZONE_CONFIG as any)[z]?.color || COLORS.primary;

  const fmtDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtTime = (s: string) => {
    const d = new Date(s);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  const zones = ['masjid', 'boys_hostel', 'stanza', 'girls'];

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <IslamicGeometric opacity={0.07} size={240} />
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>💰 Donation History</Text>
          <Text style={styles.subtitle}>All transactions & payment proofs</Text>
        </View>

        <View style={styles.content}>
          {/* Summary Stats */}
          <LinearGradient colors={['rgba(201,168,76,0.15)', 'rgba(201,168,76,0.03)']} style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>₹{Number(data?.total_amount || 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Amount</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: COLORS.accent }]}>{data?.total_donations || 0}</Text>
                <Text style={styles.statLabel}>Total Donations</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Zone Filter */}
          <Text style={styles.sectionTitle}>Filter by Zone</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, selectedZone === 'all' && styles.filterChipActive]}
              onPress={() => setSelectedZone('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, selectedZone === 'all' && styles.filterTextActive]}>
                All Zones
              </Text>
            </TouchableOpacity>
            {zones.map((z) => (
              <TouchableOpacity
                key={z}
                style={[styles.filterChip, selectedZone === z && styles.filterChipActive]}
                onPress={() => setSelectedZone(z)}
                activeOpacity={0.7}
              >
                <Text style={styles.filterEmoji}>{zoneEmoji(z)}</Text>
                <Text style={[styles.filterText, selectedZone === z && styles.filterTextActive]}>
                  {zoneLabel(z)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Donations List */}
          <Text style={styles.sectionTitle}>
            Recent Transactions ({filteredDonations.length})
          </Text>
          
          {filteredDonations.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🌙</Text>
              <Text style={styles.emptyText}>No donations found</Text>
            </View>
          ) : (
            filteredDonations.map((d) => {
              const statusCfg = STATUS_CONFIG[d.status];
              return (
                <LinearGradient
                  key={d.id}
                  colors={['rgba(26,46,69,0.8)', 'rgba(21,35,54,0.9)']}
                  style={styles.donationCard}
                >
                  {/* Header Row */}
                  <View style={styles.donationHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.donorName}>{d.donor_name}</Text>
                        {d.is_anonymous && (
                          <View style={styles.anonymousBadge}>
                            <Text style={styles.anonymousBadgeText}>🔒 Anonymous</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>{zoneEmoji(d.donor_zone)} {zoneLabel(d.donor_zone)}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaText}>📱 {d.donor_phone}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusCfg.color}20`, borderColor: `${statusCfg.color}60` }]}>
                      <Text style={[styles.statusText, { color: statusCfg.color }]}>
                        {statusCfg.icon} {statusCfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* Amount & Date */}
                  <View style={styles.amountRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.amountLabel}>Amount</Text>
                      <Text style={styles.amountValue}>
                        {d.amount ? `₹${Number(d.amount).toLocaleString()}` : 'Pending verification'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.dateLabel}>Date</Text>
                      <Text style={styles.dateValue}>{fmtDate(d.created_at)}</Text>
                      <Text style={styles.timeValue}>{fmtTime(d.created_at)}</Text>
                    </View>
                  </View>

                  {/* Message */}
                  {d.message && (
                    <View style={styles.messageBox}>
                      <Ionicons name="chatbox-ellipses-outline" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.messageText} numberOfLines={2}>{d.message}</Text>
                    </View>
                  )}

                  {/* View Proof Button */}
                  <TouchableOpacity
                    style={styles.proofBtn}
                    onPress={() => openProof(d)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="image-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.proofBtnText}>View Proof</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                </LinearGradient>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Proof Modal */}
      <Modal
        visible={proofModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setProofModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Proof</Text>
              <TouchableOpacity
                onPress={() => setProofModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>{selectedProof?.name}</Text>
            {selectedProof && (
              <ScrollView
                style={styles.proofScroll}
                contentContainerStyle={styles.proofScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: selectedProof.url }}
                  style={styles.proofImage}
                  resizeMode="contain"
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 14, position: 'relative' },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  statsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    ...SHADOWS.md,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { color: COLORS.primary, fontSize: 28, fontWeight: '800' },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(201,168,76,0.3)' },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 12,
  },
  filterScroll: { marginBottom: 20 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    marginRight: 8,
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  filterEmoji: { fontSize: 14 },
  filterText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: COLORS.primary, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
  donationCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
    ...SHADOWS.md,
  },
  donationHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  donorName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  anonymousBadge: {
    backgroundColor: 'rgba(255,152,0,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.4)',
  },
  anonymousBadgeText: { color: COLORS.accentOrange, fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: COLORS.textSecondary, fontSize: 12 },
  metaDot: { color: COLORS.textMuted, fontSize: 12 },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  amountLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
  amountValue: { color: COLORS.primary, fontSize: 20, fontWeight: '800' },
  dateLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
  dateValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  timeValue: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  messageText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  proofBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },
  proofScroll: { maxHeight: 500 },
  proofScrollContent: { alignItems: 'center' },
  proofImage: { width: '100%', height: 400, borderRadius: 12 },
});
