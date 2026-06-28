import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RESPONSIVE } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';

interface ChatGroup {
  id: string;
  name: string;
  member_count: number;
  unread_count: number;
  last_message: { message: string; sender_name: string; createdAt: string } | null;
  createdAt: string;
}

export default function ChatListScreen() {
  const { user, activeRole } = useAuthStore();
  const router = useRouter();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const loadGroups = useCallback(async () => {
    try {
      const res = await api.get(ENDPOINTS.CHAT_GROUPS);
      setGroups(res.data.data || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to load chats' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadGroups(); }, [loadGroups]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  const handleDeleteGroup = (item: ChatGroup) => {
    Alert.alert('Delete Group', `Delete "${item.name}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(ENDPOINTS.CHAT_DELETE_GROUP(item.id));
            setGroups((prev) => prev.filter((g) => g.id !== item.id));
            Toast.show({ type: 'success', text1: 'Group deleted' });
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to delete group' });
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr.replace(' ', 'T'));
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const renderGroup = ({ item }: { item: ChatGroup }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => router.push(`/(app)/admin/chat/${item.id}` as any)}
      onLongPress={() => handleDeleteGroup(item)}
      delayLongPress={500}
      activeOpacity={0.8}
    >
      <View style={{ marginRight: SIZES.spacing.md }}>
        <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>{item.name?.charAt(0)?.toUpperCase() || '#'}</Text>
        </LinearGradient>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
          </View>
        )}
      </View>
      <View style={styles.groupInfo}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
          {item.last_message && (
            <Text style={styles.groupTime}>{formatDate(item.last_message.createdAt)}</Text>
          )}
        </View>
        <View style={styles.groupMeta}>
          <Text style={styles.memberCount}>{item.member_count} members</Text>
        </View>
        {item.last_message && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            <Text style={styles.lastMsgSender}>{item.last_message.sender_name}: </Text>
            {item.last_message.message}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No chat groups yet</Text>
            <Text style={styles.emptySub}>Create a group to start a conversation</Text>
          </View>
        }
      />
      {isSuperAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(app)/admin/chat/create' as any)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.fabGradient}>
            <Ionicons name="add" size={28} color={COLORS.textOnPrimary} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: SIZES.spacing.base, paddingTop: SIZES.spacing.lg, paddingBottom: 100 },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.md,
    padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute', top: -4, right: 8,
    backgroundColor: COLORS.accentRed || '#FF3B30',
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2, borderColor: '#050D16',
  },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  groupAvatarText: { color: COLORS.textOnPrimary, fontSize: 22, fontWeight: '800' },
  groupInfo: { flex: 1, marginRight: 8 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', flex: 1 },
  groupTime: { color: COLORS.textMuted, fontSize: SIZES.xs, marginLeft: 8 },
  groupMeta: { flexDirection: 'row', marginTop: 2 },
  memberCount: { color: COLORS.textMuted, fontSize: SIZES.xs },
  lastMessage: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },
  lastMsgSender: { color: COLORS.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: SIZES.sm, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 20, zIndex: 10 },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
