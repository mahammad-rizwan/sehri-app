import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES } from '../../../src/constants/theme';
import api from '../../../src/services/api';
import { ENDPOINTS } from '../../../src/constants/api';
import Toast from 'react-native-toast-message';

export default function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('unread');

  const load = async () => {
    try {
      const params: any = { limit: 50 };
      if (filter === 'unread') params.is_read = false;
      const { data } = await api.get(ENDPOINTS.FEEDBACK, params);
      setFeedbacks(data.data);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const toggleRead = async (id: string) => {
    try {
      await api.patch(`${ENDPOINTS.FEEDBACK}/${id}/read`, {});
      Toast.show({ type: 'success', text1: 'Updated' });
      load();
    } catch {
      Toast.show({ type: 'error', text1: 'Failed' });
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.userName}>{item.User?.name || 'Unknown'}</Text>
          <Text style={styles.userMeta}>
            {item.User?.zone ? item.User.zone.charAt(0).toUpperCase() + item.User.zone.slice(1) : ''}
            {item.User?.address ? ` • ${item.User.address}` : ''}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <View style={[styles.categoryChip, { backgroundColor: item.category === 'complaint' ? 'rgba(239,83,80,0.15)' : item.category === 'suggestion' ? 'rgba(33,150,243,0.15)' : 'rgba(201,168,76,0.15)' }]}>
            <Text style={[styles.categoryText, { color: item.category === 'complaint' ? '#EF5350' : item.category === 'suggestion' ? '#2196F3' : COLORS.primary }]}>
              {item.category?.replace('_', ' ')}
            </Text>
          </View>
          {item.rating && <Text style={styles.rating}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</Text>}
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      <Text style={styles.message}>"{item.message}"</Text>
      <View style={styles.actionsRow}>
        {!item.is_read ? (
          <TouchableOpacity style={styles.readBtn} onPress={() => toggleRead(item.id)}>
            <Text style={styles.readBtnText}>✓ Mark as Read</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.readBtn, styles.readBtnDone]} onPress={() => toggleRead(item.id)}>
            <Text style={[styles.readBtnText, { color: COLORS.textMuted }]}>Mark as Unread</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💬 User Feedback</Text>
        <View style={styles.filterRow}>
          {['unread', 'all'].map((f) => (
            <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.chipText, filter === f && { color: COLORS.primary }]}>{f === 'unread' ? 'Unread' : 'All'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <FlatList
        data={feedbacks}
        renderItem={renderItem}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={styles.emptyText}>No feedback found 🤲</Text></View> : null}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.md },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700', marginBottom: SIZES.spacing.md },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: SIZES.radius.full, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.1)' },
  chipText: { color: COLORS.textSecondary, fontSize: SIZES.sm },
  list: { padding: SIZES.spacing.base, paddingBottom: 60 },
  card: { backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.lg, padding: SIZES.spacing.base, marginBottom: SIZES.spacing.sm, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SIZES.spacing.sm },
  userName: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '600' },
  userMeta: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  rightMeta: { alignItems: 'flex-end', gap: 3 },
  categoryChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  categoryText: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  rating: { color: COLORS.primary, fontSize: SIZES.sm },
  date: { color: COLORS.textMuted, fontSize: SIZES.xs },
  message: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontStyle: 'italic', lineHeight: 20, marginBottom: SIZES.spacing.sm },
  actionsRow: { flexDirection: 'row', marginTop: SIZES.spacing.sm },
  readBtn: { backgroundColor: 'rgba(76,175,80,0.2)', borderRadius: SIZES.radius.sm, paddingHorizontal: SIZES.spacing.md, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.accentGreen },
  readBtnDone: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: COLORS.border },
  readBtnText: { color: COLORS.accentGreen, fontSize: SIZES.xs, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: SIZES.base },
});
