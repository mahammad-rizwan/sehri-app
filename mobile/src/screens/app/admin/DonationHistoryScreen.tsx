import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, SHADOWS } from '../../../constants/theme';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';

interface Donation {
  id: string;
  amount: string | number | null;
  status: string;
  donor_name: string | null;
  donor_phone: string | null;
  is_anonymous: boolean;
  message: string | null;
  created_at: string | null;
  donor_zone: string | null;
}

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const STATUS_COLORS: Record<string, string> = {
  paid: '#4CAF50', pending: '#FF9800', rejected: '#EF5350',
};

export default function DonationHistoryScreen() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary]     = useState({ total: 0, count: 0 });

  const load = async () => {
    try {
      const res = await api.get(ENDPOINTS.DONATION_ALL);
      const d = res.data.data;
      const list: Donation[] = d.donations || [];
      setDonations(list);
      setSummary({
        total: Number(d.total_amount || 0),
        count: Number(d.total_donations || 0),
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load donation history' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }: { item: Donation }) => {
    const statusColor = STATUS_COLORS[item.status] || COLORS.textMuted;
    const initial = item.is_anonymous ? '🔒' : (item.donor_name?.charAt(0)?.toUpperCase() || '?');
    return (
      <View style={styles.row}>
        <LinearGradient
          colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </LinearGradient>

        <View style={styles.rowInfo}>
          <Text style={styles.donorName}>
            {item.is_anonymous ? 'Anonymous' : (item.donor_name || '—')}
          </Text>
          <Text style={styles.donorMeta}>{item.donor_phone || '—'}</Text>
          <Text style={styles.donorMeta}>{fmtDate(item.created_at)}</Text>
          {item.message ? (
            <Text style={styles.messageText} numberOfLines={1}>"{item.message}"</Text>
          ) : null}
        </View>

        <View style={styles.amountCol}>
          <Text style={styles.amount}>
            {item.amount ? `₹${Number(item.amount).toLocaleString()}` : '—'}
          </Text>
          <View style={[styles.statusChip, { borderColor: statusColor + '60', backgroundColor: statusColor + '18' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status === 'paid' ? '✅' : item.status === 'rejected' ? '❌' : '⏳'} {item.status}
            </Text>
          </View>
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
      {/* Summary */}
      <View style={styles.summaryBar}>
        <LinearGradient colors={['rgba(201,168,76,0.2)', 'rgba(201,168,76,0.05)']} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Collected</Text>
          <Text style={styles.summaryAmount}>₹{summary.total.toLocaleString()}</Text>
        </LinearGradient>
        <LinearGradient colors={['rgba(79,195,247,0.2)', 'rgba(79,195,247,0.05)']} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Paid Donations</Text>
          <Text style={styles.summaryCount}>{summary.count}</Text>
        </LinearGradient>
      </View>

      <FlatList
        data={donations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
  container:     { flex: 1 },
  summaryBar:    { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16, marginBottom: 12 },
  summaryCard:   { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  summaryLabel:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  summaryAmount: { color: COLORS.primary, fontSize: 22, fontWeight: '800', marginTop: 4 },
  summaryCount:  { color: COLORS.accent, fontSize: 22, fontWeight: '800', marginTop: 4 },
  list:          { paddingHorizontal: 16, paddingBottom: 40 },
  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  avatar:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', marginRight: 12 },
  avatarText:    { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  rowInfo:       { flex: 1 },
  donorName:     { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  donorMeta:     { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  messageText:   { color: COLORS.textSecondary, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  amountCol:     { alignItems: 'flex-end', gap: 6 },
  amount:        { color: COLORS.accentGreen, fontSize: 16, fontWeight: '800' },
  statusChip:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  statusText:    { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  empty:         { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:     { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
});
