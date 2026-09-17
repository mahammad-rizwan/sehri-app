import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform,
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

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [zoneAdmin, setZoneAdmin] = useState<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(ENDPOINTS.ZONE_ADMIN);
        setZoneAdmin(res.data.data);
      } catch {}
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
            { label: 'Gender', value: user?.gender },
            { label: 'Zone', value: zoneInfo?.label || user?.zone },
            { label: 'Address', value: user?.address || 'N/A' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value || 'N/A'}</Text>
            </View>
          ))}
        </PremiumCard>

        {/* Zone Admin Contact */}
        {zoneAdmin && (
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>📞 Your Zone Admin</Text>
            <View style={styles.adminRow}>
              <View style={styles.adminAvatar}>
                <Text style={styles.adminAvatarText}>{zoneAdmin.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.adminInfo}>
                <Text style={styles.adminName}>{zoneAdmin.name}</Text>
                <Text style={styles.adminPhone}>{zoneAdmin.phone}</Text>
              </View>
            </View>
            <Text style={styles.adminNote}>
              Contact your zone admin for any profile-related changes or assistance.
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
                await switchRole(targetRole);
                router.replace('/(app)/admin/dashboard');
              } catch (err: any) {
                Alert.alert('Error', err?.response?.data?.message || 'Failed to switch mode');
              }
            }}
            style={styles.switchBtn}
          />
        )}

        {/* Poll History */}
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

        {/* Logout */}
        <GoldButton
          title="Logout 🚪"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutBtn}
          textStyle={{ color: COLORS.accentRed }}
        />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  logoutBtn: { marginTop: SIZES.spacing.md, borderColor: COLORS.accentRed },
  pollHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pollHistoryIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(171,71,188,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(171,71,188,0.35)' },
  pollHistoryInfo: { flex: 1 },
  pollHistorySub: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
});
