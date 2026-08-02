import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../../../constants/theme';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';

interface Donation {
  id: string;
  amount: number;
  currency: string;
  status: string;
  donor_name: string | null;
  donor_phone: string | null;
  donor_email: string | null;
  payment_method: string | null;
  message: string | null;
  razorpay_payment_id: string | null;
  is_anonymous: boolean;
  createdAt: string;
}

export default function DonationHistoryScreen() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDonations = async () => {
    try {
      const res = await api.get(ENDPOINTS.DONATION_ALL);
      setDonations(res.data.data || []);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load donation history' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDonations(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDonations();
    setRefreshing(false);
  };

  const formatDate = (s: string) => {
    const d = new Date(s.replace(' ', 'T'));
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const totalAmount = donations.reduce((sum, d) => sum + Number(d.amount), 0);

  const renderDonation = ({ item }: { item: Donation }) => {
    const methodIcon = item.payment_method === 'card' ? '💳' :
      item.payment_method === 'netbanking' ? '🏦' :
      item.payment_method === 'upi' ? '📲' : '💚';
    return (
      <View style={styles.row}>
        <LinearGradient colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']} style={styles.avatar}>
          <Text style={styles.avatarText}>{item.donor_name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </LinearGradient>
        <View style={styles.rowInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.donorName}>{item.donor_name || 'Unknown'}</Text>
            {item.is_anonymous && (
              <View style={styles.anonBadge}>
                <Text style={styles.anonBadgeText}>Anonymous</Text>
              </View>
            )}
          </View>
          <Text style={styles.donorMeta}>{item.donor_email || item.donor_phone || '—'}</Text>
          <Text style={styles.donorMeta}>{formatDate(item.createdAt)}</Text>
          {item.message && <Text style={styles.messageText} numberOfLines={1}>"{item.message}"</Text>}
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amount}>₹{Number(item.amount).toLocaleString()}</Text>
          <Text style={styles.method}>{methodIcon} {item.payment_method || '—'}</Text>
          <Text style={styles.paymentId}>ID: {(item.razorpay_payment_id || '').slice(-8)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <View style={styles.summaryBar}>
        <LinearGradient colors={['rgba(201,168,76,0.2)', 'rgba(201,168,76,0.05)']} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Collected</Text>
          <Text style={styles.summaryAmount}>₹{totalAmount.toLocaleString()}</Text>
        </LinearGradient>
        <LinearGradient colors={['rgba(79,195,247,0.2)', 'rgba(79,195,247,0.05)']} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Donations</Text>
          <Text style={styles.summaryCount}>{donations.length}</Text>
        </LinearGradient>
      </View>

      <FlatList
        data={donations}
        keyExtractor={(item) => item.id}
        renderItem={renderDonation}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>🎁</Text>
            <Text style={styles.emptyText}>No donations yet</Text>
          </View>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryBar: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  summaryAmount: { color: COLORS.primary, fontSize: 22, fontWeight: '800', marginTop: 4 },
  summaryCount: { color: COLORS.accent, fontSize: 22, fontWeight: '800', marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundCard,
    borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  avatarText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  rowInfo: { flex: 1, marginLeft: 12 },
  donorName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  donorMeta: { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
  messageText: { color: COLORS.textSecondary, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  amount: { color: COLORS.accentGreen, fontSize: 16, fontWeight: '800' },
  method: { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
  paymentId: { color: COLORS.textMuted, fontSize: 9, marginTop: 1 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
  anonBadge: {
    backgroundColor: 'rgba(79,195,247,0.12)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(79,195,247,0.3)',
  },
  anonBadgeText: { color: COLORS.accent, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
