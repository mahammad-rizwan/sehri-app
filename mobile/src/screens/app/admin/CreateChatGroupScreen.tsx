import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RESPONSIVE } from '../../../constants/theme';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';

interface Admin {
  id: string;
  name: string;
  phone: string;
  zone: string;
  user_type: 'admin' | 'super_admin';
}

export default function CreateChatGroupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(ENDPOINTS.CHAT_ADMINS);
        setAdmins(res.data.data || []);
      } catch (err: any) {
        Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to load admins' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleAdmin = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Group name is required' });
      return;
    }
    if (selected.size === 0) {
      Toast.show({ type: 'error', text1: 'Select at least one member' });
      return;
    }
    setCreating(true);
    try {
      const memberIds = Array.from(selected).map((id) => {
        const admin = admins.find((a) => a.id === id)!;
        return { user_id: id, user_type: admin.user_type };
      });
      const res = await api.post(ENDPOINTS.CHAT_GROUPS, {
        name: name.trim(),
        member_ids: memberIds,
      });
      Toast.show({ type: 'success', text1: 'Group created!' });
      router.back();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to create group' });
    } finally {
      setCreating(false);
    }
  };

  const ZONE_LABELS: Record<string, string> = {
    masjid: '🕌 Masjid',
    boys_hostel: '🏠 Boys Hostel',
    stanza: '🏡 Stanza',
    girls: '🌸 Girls',
    all: '👑 Super Admin',
  };

  const renderAdmin = ({ item }: { item: Admin }) => {
    const isSel = selected.has(item.id);
    const isSuper = item.user_type === 'super_admin';
    return (
      <TouchableOpacity
        style={[styles.adminRow, isSel && styles.adminRowSelected, isSuper && styles.superRow]}
        onPress={() => toggleAdmin(item.id)}
        activeOpacity={0.75}
      >
        <View style={[styles.checkbox, isSel && styles.checkboxChecked]}>
          {isSel && <Ionicons name="checkmark" size={16} color={COLORS.textOnPrimary} />}
        </View>
        <LinearGradient
          colors={isSuper ? ['#C9A84C20', '#C9A84C08'] : [`${COLORS.primary}20`, `${COLORS.primary}05`]}
          style={[styles.adminAvatar, isSuper && styles.superAvatar]}
        >
          <Text style={[styles.adminAvatarText, isSuper && styles.superAvatarText]}>
            {item.name?.charAt(0)?.toUpperCase()}
          </Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.adminName}>
            {item.name}
            {isSuper && <Text style={styles.superBadge}> • Super Admin</Text>}
          </Text>
          <Text style={styles.adminMeta}>{ZONE_LABELS[item.zone] || item.zone} • {item.phone}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.formSection}>
          <Text style={styles.label}>Group Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ramadan Coordination"
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
        </View>

        <Text style={styles.sectionTitle}>Select Members ({selected.size})</Text>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={admins}
            keyExtractor={(item) => item.id}
            renderItem={renderAdmin}
            extraData={selected}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No users available</Text>
              </View>
            }
            ListFooterComponent={
              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={creating ? [COLORS.border, COLORS.border] : [COLORS.primary, COLORS.primaryLight]}
                  style={styles.createBtnGradient}
                >
                  {creating ? (
                    <ActivityIndicator color={COLORS.textMuted} size="small" />
                  ) : (
                    <Text style={styles.createBtnText}>Create Group</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            }
          />
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formSection: { paddingHorizontal: SIZES.spacing.base, paddingTop: SIZES.spacing.xl, paddingBottom: SIZES.spacing.md },
  label: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', paddingHorizontal: SIZES.spacing.base, marginBottom: SIZES.spacing.sm },
  listContent: { paddingHorizontal: SIZES.spacing.base, paddingBottom: SIZES.spacing.base },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.md,
    padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  adminRowSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.08)' },
  superRow: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  superAvatar: { borderColor: COLORS.primary },
  superAvatarText: { color: COLORS.primary },
  superBadge: { color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '500' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  adminAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
  },
  adminAvatarText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  adminName: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '600' },
  adminMeta: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: SIZES.md },
  createBtn: { marginTop: SIZES.spacing.md, marginBottom: SIZES.spacing.xxl },
  createBtnGradient: {
    borderRadius: SIZES.radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: COLORS.textOnPrimary, fontSize: SIZES.md, fontWeight: '800' },
});
