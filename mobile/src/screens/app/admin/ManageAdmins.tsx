import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES, ZONE_CONFIG } from '../../../constants/theme';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';

type Staff = {
  id: string;
  name: string;
  phone: string;
  zone?: string | null;
  role: 'admin' | 'super_admin';
};

type AppUser = {
  id: string;
  name: string;
  phone: string;
  zone: string;
  status: string;
};

/**
 * Staff are promoted from existing approved accounts rather than created from
 * a phone number. That means they keep the password they already know, and an
 * admin's zone comes from their own account instead of being chosen — so
 * nobody ends up administering a zone they have nothing to do with.
 */
export default function ManageAdmins() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      const { data } = await api.get(ENDPOINTS.LIST_ADMINS);
      setStaff(data.data || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not load admins' });
    }
  }, []);

  const loadUsers = useCallback(async (q: string) => {
    try {
      // Only approved accounts can be promoted, so there is no point listing
      // anyone else here.
      const { data } = await api.get(ENDPOINTS.USERS, {
        status: 'approved',
        limit: 30,
        ...(q.trim() ? { search: q.trim() } : {}),
      });
      setUsers(data.data || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not load users' });
    }
  }, []);

  const loadAll = useCallback(async (q = search) => {
    await Promise.all([loadStaff(), loadUsers(q)]);
    setLoading(false);
    setRefreshing(false);
  }, [loadStaff, loadUsers, search]);

  useEffect(() => { loadAll(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Phones already holding a role, so the list below can mark them. */
  const staffPhones = new Set(staff.map((s) => s.phone));

  const promote = (user: AppUser, role: 'admin' | 'super_admin') => {
    const zoneLabel = (ZONE_CONFIG as any)[user.zone]?.label || user.zone;
    Alert.alert(
      role === 'admin' ? 'Make zone admin?' : 'Make super admin?',
      role === 'admin'
        ? `${user.name} will become the admin for ${zoneLabel}, taken from their own account.\n\nThey keep their current password and can manage that zone's users, polls and announcements.`
        : `${user.name} will become a super admin with full control over every zone.\n\nThey keep their current password.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: role === 'admin' ? 'Make Admin' : 'Make Super Admin',
          onPress: async () => {
            try {
              setBusyId(user.id);
              const res = await api.post(
                role === 'admin'
                  ? ENDPOINTS.PROMOTE_TO_ADMIN(user.id)
                  : ENDPOINTS.PROMOTE_TO_SUPER_ADMIN(user.id),
                {},
              );
              Toast.show({ type: 'success', text1: res.data?.message || 'Promoted' });
              loadAll();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not promote' });
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const revoke = (s: Staff) => {
    Alert.alert(
      'Remove access?',
      `${s.name} will lose ${s.role === 'super_admin' ? 'super admin' : 'admin'} access.\n\nTheir normal user account is untouched — they can still log in as a regular user.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Access',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyId(s.id);
              await api.delete(
                s.role === 'super_admin'
                  ? ENDPOINTS.DELETE_SUPER_ADMIN(s.id)
                  : ENDPOINTS.DELETE_ADMIN(s.id),
              );
              Toast.show({ type: 'success', text1: `${s.name}'s access removed` });
              loadAll();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not remove access' });
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const superAdmins = staff.filter((s) => s.role === 'super_admin');
  const zoneAdmins = staff.filter((s) => s.role !== 'super_admin');

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.container}>
      <View style={st.header}>
        <Text style={st.title}>👤 Manage Admins</Text>
        <Text style={st.subtitle}>Promote an approved user — no new account needed</Text>
      </View>

      {/* Search, matching the User Management bar */}
      <View style={st.searchBar}>
        <Ionicons name="search-outline" size={16} color="#8892A0" />
        <TextInput
          style={st.searchInput}
          placeholder="Search name or phone..."
          placeholderTextColor="#8892A0"
          value={search}
          onChangeText={(t) => { setSearch(t); if (t.length > 2 || !t) loadUsers(t); }}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); loadUsers(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#8892A0" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          contentContainerStyle={st.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={COLORS.primary} />
          }
        >
          {/* ── Current staff ── */}
          <Text style={st.section}>
            Admins &amp; Super Admins ({staff.length})
          </Text>

          {staff.length === 0 ? (
            <Text style={st.emptyLine}>Nobody has admin access yet.</Text>
          ) : (
            [...superAdmins, ...zoneAdmins].map((s) => {
              const cfg = s.zone ? (ZONE_CONFIG as any)[s.zone] : null;
              const isSuper = s.role === 'super_admin';
              return (
                <View key={`${s.role}-${s.id}`} style={[st.card, isSuper && st.cardSuper]}>
                  <View style={st.avatar}>
                    <Text style={st.avatarTxt}>{s.name?.charAt(0)?.toUpperCase()}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{s.name}</Text>
                    <Text style={st.meta}>+91 {s.phone}</Text>
                    <View style={st.badgeRow}>
                      <View style={[st.badge, isSuper ? st.badgeSuper : st.badgeAdmin]}>
                        <Text style={[st.badgeTxt, { color: isSuper ? '#FF6B35' : COLORS.primary }]}>
                          {isSuper ? '⭐ Super Admin' : '🛡️ Zone Admin'}
                        </Text>
                      </View>
                      {cfg && (
                        <View style={[st.badge, { borderColor: cfg.color, backgroundColor: cfg.color + '1F' }]}>
                          <Text style={[st.badgeTxt, { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => revoke(s)}
                    disabled={busyId === s.id}
                    style={st.revokeBtn}
                    activeOpacity={0.8}
                  >
                    {busyId === s.id
                      ? <ActivityIndicator size="small" color={COLORS.accentRed} />
                      : <Text style={st.revokeTxt}>Remove</Text>}
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {/* ── Approved users available to promote ── */}
          <Text style={[st.section, { marginTop: 26 }]}>
            {search.trim() ? 'Search Results' : 'Approved Users'} ({users.length})
          </Text>
          <Text style={st.sectionHint}>
            Tap a user to give them admin access. Their zone is taken from their own account.
          </Text>

          {users.length === 0 ? (
            <Text style={st.emptyLine}>
              {search.trim() ? 'No approved user matches that search.' : 'No approved users yet.'}
            </Text>
          ) : (
            users.map((usr) => {
              const cfg = (ZONE_CONFIG as any)[usr.zone];
              const already = staffPhones.has(usr.phone);
              return (
                <View key={usr.id} style={[st.card, already && { opacity: 0.55 }]}>
                  <View style={[st.avatar, st.avatarUser]}>
                    <Text style={st.avatarTxt}>{usr.name?.charAt(0)?.toUpperCase()}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{usr.name}</Text>
                    <Text style={st.meta}>+91 {usr.phone}</Text>
                    {cfg && (
                      <View style={st.badgeRow}>
                        <View style={[st.badge, { borderColor: cfg.color, backgroundColor: cfg.color + '1F' }]}>
                          <Text style={[st.badgeTxt, { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {already ? (
                    <Text style={st.alreadyTxt}>Already{'\n'}staff</Text>
                  ) : (
                    <View style={st.actionCol}>
                      <TouchableOpacity
                        onPress={() => promote(usr, 'admin')}
                        disabled={busyId === usr.id}
                        style={st.promoteBtn}
                        activeOpacity={0.85}
                      >
                        {busyId === usr.id
                          ? <ActivityIndicator size="small" color={COLORS.primary} />
                          : <Text style={st.promoteTxt}>Make Admin</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => promote(usr, 'super_admin')}
                        disabled={busyId === usr.id}
                        style={st.superBtn}
                        activeOpacity={0.85}
                      >
                        <Text style={st.superTxt}>Super Admin</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 16, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.sm },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 5 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SIZES.spacing.base, marginBottom: SIZES.spacing.sm,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: SIZES.radius.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#F0E6C8', fontSize: 14 },

  list: { paddingHorizontal: SIZES.spacing.base, paddingBottom: 60 },
  section: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sectionHint: { color: COLORS.textMuted, fontSize: 11.5, lineHeight: 17, marginBottom: 10 },
  emptyLine: { color: COLORS.textMuted, fontSize: 12.5, paddingVertical: 14 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.md, marginBottom: SIZES.spacing.sm,
  },
  cardSuper: { borderColor: 'rgba(255,107,53,0.45)' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(201,168,76,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarUser: { backgroundColor: 'rgba(255,255,255,0.07)' },
  avatarTxt: { color: COLORS.primary, fontSize: 16, fontWeight: '800' },
  name: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '700' },
  meta: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  badgeSuper: { borderColor: '#FF6B35', backgroundColor: 'rgba(255,107,53,0.14)' },
  badgeAdmin: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.14)' },
  badgeTxt: { fontSize: 9.5, fontWeight: '700' },

  revokeBtn: {
    borderWidth: 1, borderColor: COLORS.accentRed, borderRadius: SIZES.radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(239,83,80,0.12)',
  },
  revokeTxt: { color: COLORS.accentRed, fontSize: 12, fontWeight: '700' },

  actionCol: { gap: 6 },
  promoteBtn: {
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radius.sm,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: 'rgba(201,168,76,0.12)', minWidth: 104, alignItems: 'center',
  },
  promoteTxt: { color: COLORS.primary, fontSize: 11.5, fontWeight: '700' },
  superBtn: {
    borderWidth: 1, borderColor: '#FF6B35', borderRadius: SIZES.radius.sm,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: 'rgba(255,107,53,0.12)', minWidth: 104, alignItems: 'center',
  },
  superTxt: { color: '#FF6B35', fontSize: 11.5, fontWeight: '700' },
  alreadyTxt: { color: COLORS.textMuted, fontSize: 10.5, textAlign: 'center' },
});
