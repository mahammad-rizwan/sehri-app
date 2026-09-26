import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../../src/constants/theme';
import { useAuthStore } from '../../../src/store/authStore';
import GoldButton from '../../../src/components/ui/GoldButton';

export default function AdminProfile() {
  const { user, activeRole, logout, switchRole } = useAuthStore();
  const router = useRouter();
  const isSuperAdmin = activeRole === 'super_admin';

  const handleSwitchToUser = async () => {
    try {
      await switchRole('user');
      router.replace('/(app)/home');
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topSpacer} />

        <View style={styles.profileHeader}>
          <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'A'}</Text>
          </LinearGradient>
          <Text style={styles.name}>{user?.name}</Text>
          <View style={[styles.roleBadge, { borderColor: isSuperAdmin ? COLORS.primary : COLORS.accent }]}>
            <Text style={[styles.roleText, { color: isSuperAdmin ? COLORS.primary : COLORS.accent }]}>
              {isSuperAdmin ? '⭐ Super Admin' : '🛡️ Admin'}
            </Text>
          </View>
        </View>

        <LinearGradient colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']} style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>{isSuperAdmin ? 'Super Admin' : 'Zone Admin'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>+91 {user?.phone || 'N/A'}</Text>
          </View>
        </LinearGradient>

        {/* Chat messages an admin has reported, and the outcome */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/my-reports' as any)}
          style={styles.linkRow}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18 }}>🚩</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>My Reports</Text>
            <Text style={styles.linkSub}>See the status of anything you reported</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <GoldButton
          title="Switch to User Mode 🔄"
          onPress={handleSwitchToUser}
          glow
          style={styles.switchBtn}
        />

        <GoldButton
          title="Logout 🚪"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutBtn}
          textStyle={{ color: COLORS.accentRed }}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: SIZES.spacing.xl, paddingBottom: 60 },
  topSpacer: { height: 36 },
  profileHeader: { alignItems: 'center', marginBottom: SIZES.spacing.xl, marginTop: SIZES.spacing.md },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.spacing.md, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  avatarText: { color: COLORS.textOnPrimary, fontSize: 28, fontWeight: '800' },
  name: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  roleBadge: { borderWidth: 1, borderRadius: SIZES.radius.round, paddingHorizontal: 14, paddingVertical: 4, marginTop: 8 },
  roleText: { fontSize: 13, fontWeight: '700' },
  infoCard: { borderRadius: SIZES.radius.lg, padding: SIZES.spacing.base, marginBottom: SIZES.spacing.lg, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: SIZES.spacing.sm, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  infoLabel: { color: COLORS.textMuted, fontSize: SIZES.sm, flex: 1 },
  infoValue: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: SIZES.spacing.md, padding: SIZES.spacing.md,
    borderRadius: SIZES.radius.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundCard,
  },
  linkTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  linkSub: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 2 },
  switchBtn: { marginTop: SIZES.spacing.md },
  logoutBtn: { marginTop: SIZES.spacing.md, borderColor: COLORS.accentRed },
});
