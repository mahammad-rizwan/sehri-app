import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, ZONE_CONFIG } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import GoldButton from '../../components/ui/GoldButton';
import PremiumCard from '../../components/ui/PremiumCard';
import { GoldenDivider } from '../../components/ui/IslamicPattern';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import { EditProfileRequestModal, ChangePasswordModal } from '../../components/profile/ProfileModals';
import SignInPrompt from '../../components/ui/SignInPrompt';

export default function ProfileScreen() {
  const { user, logout, isGuest, ramadanActive } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPasswordModal] = useState(false);
  const [zoneAdmins, setZoneAdmins] = useState<{ id?: string; name: string; phone: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(ENDPOINTS.ZONE_ADMIN);
        const d = res.data.data;
        // `admins` is the current shape; fall back to the older single-admin
        // response so a stale backend still shows something.
        setZoneAdmins(
          Array.isArray(d?.admins) && d.admins.length
            ? d.admins
            : (d?.name ? [{ name: d.name, phone: d.phone }] : []),
        );
      } catch {
        // No admin assigned yet, or offline — the card just stays hidden.
      }
    })();
  }, []);

  const zoneInfo = user?.zone ? ZONE_CONFIG[user.zone as keyof typeof ZONE_CONFIG] : null;

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/welcome'); } },
      ]
    );
  };

  if (isGuest) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
        <View style={{ paddingTop: insets.top }} />
        <SignInPrompt
          variant="full"
          title="You're browsing as a guest"
          message="Sign in to vote in the Sehri poll, track deliveries, donate, save bookmarks to your account and message your zone admin."
        />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/home' as any)} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topSpacer} />

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.initialCircle}>
            <Text style={styles.initialText}>{user?.name?.charAt(0)?.toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userPhone}>+91 {user?.phone}</Text>
        </View>

        <GoldenDivider />

        {/* Profile Details */}
        <PremiumCard style={styles.card}>
          <Text style={styles.cardTitle}>Profile Information</Text>
          {[
            { label: 'Zone', value: zoneInfo?.label || user?.zone },
            { label: 'Address', value: user?.address || 'N/A' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value || 'N/A'}</Text>
            </View>
          ))}
        </PremiumCard>

        {/* Zone admins — the one place contact details are shown, straight
            from the database rather than a hardcoded list */}
        {zoneAdmins.length > 0 && (
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>
              📞 {zoneAdmins.length > 1 ? 'Your Zone Admins' : 'Your Zone Admin'}
              {zoneInfo ? ` · ${zoneInfo.label}` : ''}
            </Text>

            {zoneAdmins.map((a, i) => (
              <TouchableOpacity
                key={a.id || a.phone || i}
                style={styles.adminRow}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(`tel:${a.phone}`).catch(() => {})}
              >
                <View style={styles.adminAvatar}>
                  <Text style={styles.adminAvatarText}>{a.name?.charAt(0)?.toUpperCase()}</Text>
                </View>
                <View style={styles.adminInfo}>
                  <Text style={styles.adminName}>{a.name}</Text>
                  <Text style={styles.adminPhone}>{a.phone}</Text>
                </View>
                <Ionicons name="call-outline" size={17} color={COLORS.primary} />
              </TouchableOpacity>
            ))}

            <Text style={styles.adminNote}>
              Tap to call about anything profile-related or if you need help.
            </Text>
          </PremiumCard>
        )}

        {/* Switch to Admin mode (dual-role users) */}
        {(user?.hasAdminRole || user?.hasSuperAdminRole) && (
          <GoldButton
            title={`Switch to ${user?.hasSuperAdminRole ? 'Super Admin' : 'Admin'} Mode`}
            onPress={async () => {
              const { switchRole } = useAuthStore.getState();
              try {
                const targetRole = user?.hasSuperAdminRole ? 'super_admin' : 'admin';
                console.log('[Switch Role] Attempting to switch to:', targetRole);
                await switchRole(targetRole);
                console.log('[Switch Role] Success!');
                router.replace('/(app)/admin/dashboard');
              } catch (err: any) {
                console.error('[Switch Role] Error:', err);
                const errorMsg = err?.response?.data?.message || err?.message || 'Failed to switch mode';
                Alert.alert('Error Switching Mode', errorMsg);
              }
            }}
            style={styles.switchBtn}
          />
        )}

        {/* Poll History — Sehri only, so it goes away outside Ramadan */}
        {ramadanActive && (
          <PremiumCard style={styles.card}>
            <TouchableOpacity onPress={() => router.push('/(app)/poll-history')} style={styles.pollHistoryRow} activeOpacity={0.7}>
              <View style={styles.pollHistoryIcon}>
                <Text style={{ fontSize: 22 }}>📅</Text>
              </View>
              <View style={styles.pollHistoryInfo}>
                <Text style={styles.cardTitle}>Poll History</Text>
                <Text style={styles.pollHistorySub}>View your past Sehri responses</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </PremiumCard>
        )}

        {/* Islamic Quote */}
        <LinearGradient
          colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']}
          style={styles.quoteBanner}
        >
          <Text style={styles.quoteText}>
            "The best of people are those who are most beneficial to others."
          </Text>
          <Text style={styles.quoteSource}>— Prophet Muhammad ﷺ</Text>
        </LinearGradient>

        {/* Feedback — lives in the profile section */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/feedback')}
          style={styles.feedbackRow}
          activeOpacity={0.7}
        >
          <View style={styles.feedbackIcon}>
            <Text style={{ fontSize: 18 }}>💬</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Share Feedback</Text>
            <Text style={styles.feedbackSub}>Tell your zone admin what's working and what isn't</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Request profile changes — needs admin approval */}
        <GoldButton
          title="Request Profile Edit ✏️"
          onPress={() => setShowEdit(true)}
          style={{ marginTop: 4 }}
        />
        <Text style={styles.actionHint}>
          Changes need your zone admin's approval. You'll be signed out until they review it.
        </Text>

        {/* Change password — instant, no approval */}
        <GoldButton
          title="Change Password 🔒"
          onPress={() => setShowPasswordModal(true)}
          variant="outline"
          style={{ marginTop: 12 }}
        />
        <Text style={styles.actionHint}>Takes effect immediately — no approval needed.</Text>

        {/* Delete Account */}
        <GoldButton
          title="Delete Account 🗑️"
          onPress={async () => {
            Alert.alert(
              'Delete Account',
              'Are you sure you want to delete your account? This action cannot be undone. Your poll responses and donations will be preserved for record-keeping.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { logout } = useAuthStore.getState();
                      await api.delete(ENDPOINTS.DELETE_MY_ACCOUNT);
                      Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
                      await logout();
                      router.replace('/(auth)/login');
                    } catch (err: any) {
                      Alert.alert('Error', err?.response?.data?.message || 'Failed to delete account');
                    }
                  },
                },
              ]
            );
          }}
          variant="outline"
          style={styles.deleteBtn}
          textStyle={{ color: COLORS.accentRed }}
        />

        {/* Logout */}
        <GoldButton
          title="Logout 🚪"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutBtn}
          textStyle={{ color: COLORS.textSecondary }}
        />
      </ScrollView>

      <EditProfileRequestModal
        visible={showEdit}
        user={user}
        onClose={() => setShowEdit(false)}
        onSubmitted={async () => {
          setShowEdit(false);
          await logout();
          router.replace('/(auth)/login');
        }}
      />

      <ChangePasswordModal visible={showPassword} onClose={() => setShowPasswordModal(false)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  feedbackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.base, marginBottom: SIZES.spacing.base,
  },
  feedbackIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(201,168,76,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  feedbackSub: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  actionHint: {
    color: COLORS.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  topBar: {
    justifyContent: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  topBarContent: {
    flexDirection: 'row', alignItems: 'center',
    height: Platform.OS === 'ios' ? 44 : 56,
    paddingHorizontal: 4,
  },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
  scroll: { paddingHorizontal: SIZES.spacing.xl, paddingTop: 4, paddingBottom: 60 },
  topSpacer: { height: 16 },
  profileHeader: { alignItems: 'center', marginBottom: SIZES.spacing.xl, marginTop: SIZES.spacing.md },
  initialCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.spacing.md, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  initialText: { color: COLORS.textOnPrimary, fontSize: SIZES.xxxl, fontWeight: '800' },
  userName: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  userPhone: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },
  card: { marginVertical: SIZES.spacing.sm },
  cardTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SIZES.spacing.sm, borderBottomWidth: 1, borderColor: COLORS.border },
  infoLabel: { color: COLORS.textMuted, fontSize: SIZES.sm },
  infoValue: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '500', textTransform: 'capitalize' },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SIZES.spacing.md },
  adminAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(201,168,76,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  adminAvatarText: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  adminInfo: { flex: 1 },
  adminName: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '600' },
  adminPhone: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 2 },
  adminNote: { color: COLORS.textMuted, fontSize: SIZES.xs, fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
  quoteBanner: { borderRadius: SIZES.radius.lg, padding: SIZES.spacing.base, marginVertical: SIZES.spacing.md, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  quoteText: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontStyle: 'italic', textAlign: 'center' },
  quoteSource: { color: COLORS.primary, fontSize: SIZES.xs, textAlign: 'right', marginTop: 6 },
  switchBtn: { marginTop: SIZES.spacing.md },
  deleteBtn: { marginTop: SIZES.spacing.md, borderColor: COLORS.accentRed },
  logoutBtn: { marginTop: SIZES.spacing.sm, borderColor: COLORS.border },
  pollHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pollHistoryIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(171,71,188,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(171,71,188,0.35)' },
  pollHistoryInfo: { flex: 1 },
  pollHistorySub: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
});
