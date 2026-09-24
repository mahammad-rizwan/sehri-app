import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, Switch, Alert, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, ZONE_CONFIG, RESPONSIVE, SHADOWS } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import PremiumCard from '../../../components/ui/PremiumCard';
import { IslamicGeometric, StarDivider } from '../../../components/ui/IslamicPattern';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';
import ExpoGoNotice from '../../../components/ui/ExpoGoNotice';

const ZONE_KEYS = ['masjid', 'boys_hostel', 'stanza', 'girls'] as const;

export default function AdminDashboard() {
  const { user, activeRole, logout, switchRole } = useAuthStore();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [tomorrowStats, setTomorrowStats] = useState<any>(null);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [editRequests, setEditRequests] = useState(0);
  const [donationSummary, setDonationSummary] = useState<any>(null);
  const [pollActive, setPollActive] = useState<boolean | null>(null);
  const [pollToggling, setPollToggling] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [voterModalVisible, setVoterModalVisible] = useState(false);
  const [scModalVisible, setScModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const isSuperAdmin = activeRole === 'super_admin';

  const loadData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get(ENDPOINTS.USERS, { status: 'pending', limit: 10 }),
        api.get(ENDPOINTS.ACTIVE_POLL_STATS),
      ]);
      setPendingUsers(usersRes.data.data || []);

      // Badge count for the profile edit review queue. Non-fatal — an older
      // backend without this route should not break the dashboard.
      try {
        const editRes = await api.get(ENDPOINTS.PROFILE_EDIT_REQUESTS);
        setEditRequests((editRes.data.data || []).length);
      } catch { setEditRequests(0); }

      setTomorrowStats(statsRes.data.data);
      const liveActive = statsRes.data.data?.isPollActive ?? statsRes.data.data?.poll?.is_active;
      if (liveActive !== undefined) setPollActive(liveActive);
      
      // Fetch donation summary for both admin and super admin
      try { 
        const donRes = await api.get(ENDPOINTS.DONATION_SUMMARY); 
        console.log('[AdminDashboard] Donation summary:', donRes.data.data);
        setDonationSummary(donRes.data.data); 
      } catch (err) {
        console.error('[AdminDashboard] Failed to fetch donation summary:', err);
      }
    } catch {}
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleTogglePoll = () => {
    const nextState = !pollActive;
    Alert.alert(
      `${nextState ? '🔓 Open' : '🔒 Close'} Poll`,
      `Are you sure you want to ${nextState ? 'open' : 'close'} the poll?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            try { setPollToggling(true); const res = await api.patch(ENDPOINTS.ACTIVE_POLL_TOGGLE, {}); const newState = res.data.data.is_active; setPollActive(newState); Toast.show({ type: 'success', text1: `✅ Poll ${newState ? 'opened' : 'closed'}` }); }
            catch (err: any) { Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed' }); }
            finally { setPollToggling(false); }
          },
        },
      ],
    );
  };

  const handleSwitchToUser = async () => {
    setMenuVisible(false);
    try { await switchRole('user'); router.replace('/(app)/home'); } catch {}
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    await logout();
    router.replace('/(auth)/welcome');
  };

  const openZoneVoters = (zone: string) => { setSelectedZone(zone); setVoterModalVisible(true); };
  const selectedZoneVoters: any[] = selectedZone && tomorrowStats?.zones?.[selectedZone]?.voters || [];
  const selectedZoneInfo = selectedZone ? ZONE_CONFIG[selectedZone as keyof typeof ZONE_CONFIG] : null;

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        <ExpoGoNotice />
        <View style={styles.header}>
          <IslamicGeometric opacity={0.08} size={300} />
          <View style={styles.headerContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>👋 Admin Panel</Text>
              <Text style={styles.adminName}>{user?.name}</Text>
              <View style={[styles.roleBadge, { borderColor: isSuperAdmin ? COLORS.primary : COLORS.accent }]}>
                <Text style={[styles.roleText, { color: isSuperAdmin ? COLORS.primary : COLORS.accent }]}>
                  {isSuperAdmin ? '⭐ Super Admin' : '🛡️ Zone Admin'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setMenuVisible((v) => !v)} activeOpacity={0.85}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.avatar}>
                <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'A'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {tomorrowStats && (
            <PremiumCard golden style={styles.card}>
              <Text style={styles.cardTitle}>📊 Sehri Poll — {tomorrowStats.displayLabel || tomorrowStats.date || 'Today'}</Text>
              <View style={styles.pollOverview}>
                <LinearGradient colors={['rgba(76,175,80,0.15)', 'rgba(76,175,80,0.05)']} style={styles.pollStatCard}>
                  <Text style={[styles.pollStatNum, { color: COLORS.accentGreen }]}>{tomorrowStats.totalYes ?? 0}</Text>
                  <Text style={styles.pollStatLabel}>Need Sehri</Text>
                </LinearGradient>
                <LinearGradient colors={['rgba(255,152,0,0.15)', 'rgba(255,152,0,0.05)']} style={styles.pollStatCard}>
                  <Text style={[styles.pollStatNum, { color: COLORS.accentOrange }]}>{(tomorrowStats.specialCaseCount ?? 0)}</Text>
                  <Text style={styles.pollStatLabel}>Special Cases</Text>
                </LinearGradient>
              </View>

              <StarDivider />

              {tomorrowStats.zones && (
                <>
                  <Text style={styles.zoneTitle}>📍 Zone-wise Breakdown</Text>
                  {ZONE_KEYS.map((zone) => {
                    const cfg = ZONE_CONFIG[zone];
                    const cnt = tomorrowStats.zones[zone]?.yesCount || 0;
                    const maxCnt = Math.max(1, tomorrowStats.totalYes || 1);
                    return (
                      <TouchableOpacity key={zone} style={styles.zoneRow} onPress={() => openZoneVoters(zone)} activeOpacity={0.75}>
                        <Text style={styles.zoneEmoji}>{cfg.emoji}</Text>
                        <Text style={styles.zoneName} numberOfLines={1}>{cfg.label}</Text>
                        <View style={styles.zoneBarContainer}>
                          <LinearGradient colors={[cfg.color, `${cfg.color}70`]} style={[styles.zoneBar, { width: `${Math.min(100, (cnt / maxCnt) * 100)}%` }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        </View>
                        <Text style={[styles.zoneCount, { color: cfg.color }]}>{cnt}</Text>
                        <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    );
                  })}
                  {(tomorrowStats.specialCaseCount ?? 0) > 0 && (
                    <TouchableOpacity
                      style={styles.scBtn}
                      onPress={() => isSuperAdmin
                        ? router.push('/(app)/admin/special-cases' as any)
                        : setScModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="alert-circle-outline" size={15} color={COLORS.accentOrange} />
                      <Text style={styles.scBtnText}>{isSuperAdmin ? 'Allot Special Cases' : 'View Special Cases'} ({tomorrowStats.specialCaseCount})</Text>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.accentOrange} />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </PremiumCard>
          )}

          {isSuperAdmin && donationSummary && (
            <PremiumCard style={styles.card}>
              <Text style={styles.cardTitle}>💰 Donations</Text>
              <View style={styles.donationRow}>
                <LinearGradient colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']} style={styles.donationCard}>
                  <Text style={styles.donationAmount}>₹{Number(donationSummary.total_amount || 0).toLocaleString()}</Text>
                  <Text style={styles.donationLabel}>Total Collected</Text>
                </LinearGradient>
                <LinearGradient colors={['rgba(79,195,247,0.12)', 'rgba(79,195,247,0.03)']} style={styles.donationCard}>
                  <Text style={[styles.donationAmount, { color: COLORS.accent }]}>{donationSummary.total_donations}</Text>
                  <Text style={styles.donationLabel}>Donations</Text>
                </LinearGradient>
              </View>
              <TouchableOpacity
                style={styles.viewDonationsBtn}
                onPress={() => router.push('/(app)/admin/donation-history' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="receipt-outline" size={15} color={COLORS.primary} />
                <Text style={styles.viewDonationsBtnText}>View Donation History</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </PremiumCard>
          )}

          {!isSuperAdmin && donationSummary && (
            <PremiumCard style={styles.card}>
              <Text style={styles.cardTitle}>💰 Donations</Text>
              <View style={styles.donationRow}>
                <LinearGradient colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']} style={styles.donationCard}>
                  <Text style={styles.donationAmount}>₹{Number(donationSummary.total_amount || 0).toLocaleString()}</Text>
                  <Text style={styles.donationLabel}>Total Collected</Text>
                </LinearGradient>
                <LinearGradient colors={['rgba(79,195,247,0.12)', 'rgba(79,195,247,0.03)']} style={styles.donationCard}>
                  <Text style={[styles.donationAmount, { color: COLORS.accent }]}>{donationSummary.total_donations}</Text>
                  <Text style={styles.donationLabel}>Donations</Text>
                </LinearGradient>
              </View>
            </PremiumCard>
          )}

          <Text style={styles.sectionTitle}>{isSuperAdmin ? '⚡ Super Admin Actions' : '⚡ Zone Admin Actions'}</Text>

          {isSuperAdmin && (
            <PremiumCard style={styles.pollControlCard} gradient>
              <View style={styles.pollControlRow}>
                <View style={styles.pollControlLeft}>
                  <Text style={styles.pollControlTitle}>🔘 Poll Control</Text>
                  <Text style={styles.pollControlSub}>Override the active poll</Text>
                  {pollActive === null ? (
                    <Text style={[styles.pollStatusText, { color: COLORS.textMuted }]}>Loading...</Text>
                  ) : (
                    <View style={styles.pollStatusRow}>
                      <View style={[styles.pollStatusDot, { backgroundColor: pollActive ? COLORS.accentGreen : COLORS.accentRed }]} />
                      <Text style={[styles.pollStatusText, { color: pollActive ? COLORS.accentGreen : COLORS.accentRed }]}>
                        {pollActive ? '🟢 Open — users can vote' : '🔴 Closed — voting disabled'}
                      </Text>
                    </View>
                  )}
                </View>
                <Switch
                  value={pollActive === true}
                  onValueChange={handleTogglePoll}
                  disabled={pollToggling || pollActive === null}
                  trackColor={{ false: 'rgba(239,83,80,0.35)', true: 'rgba(76,175,80,0.35)' }}
                  thumbColor={pollActive ? COLORS.accentGreen : COLORS.accentRed}
                  ios_backgroundColor="rgba(239,83,80,0.35)"
                />
              </View>
            </PremiumCard>
          )}

          <View style={styles.actionsGrid}>
            {isSuperAdmin ? (
              <>
                <AdminAction icon="👥" title="Users" color={COLORS.accentOrange} badge={pendingUsers.length} onPress={() => router.push('/(app)/admin/users' as any)} />
                <AdminAction icon="⭐" title="Special Cases" color={COLORS.accentOrange} badge={tomorrowStats?.specialCaseCount || 0} onPress={() => router.push('/(app)/admin/special-cases' as any)} />
                <AdminAction icon="📝" title="Edit Requests" color={COLORS.accentOrange} badge={editRequests} onPress={() => router.push('/(app)/admin/profile-edit-requests' as any)} />
                <AdminAction icon="📢" title="Broadcast" color={COLORS.accentPurple} onPress={() => router.push('/(app)/admin/broadcast' as any)} />
                <AdminAction icon="💬" title="Feedback" color={COLORS.accent} onPress={() => router.push('/(app)/admin/feedback' as any)} />
                <AdminAction icon="📅" title="Poll History" color={COLORS.primary} onPress={() => router.push('/(app)/admin/poll-history' as any)} />
                <AdminAction icon="🛵" title="Riders" color={COLORS.accentGreen} onPress={() => router.push('/(app)/admin/tracking' as any)} />
                <AdminAction icon="💬" title="Chat" color={COLORS.accentPurple} onPress={() => router.push('/(app)/admin/chat' as any)} />
                <AdminAction icon="👤" title="Manage Admins" color="#FF6B35" onPress={() => router.push('/(app)/admin/manage-admins' as any)} />
                <AdminAction icon="📢" title="Broadcast" color={COLORS.accentPurple} onPress={() => router.push('/(app)/admin/broadcast' as any)} />
                <AdminAction icon="🔄" title="Sync Data" color={COLORS.accent} onPress={() => router.push('/(app)/admin/sync-data' as any)} />
              </>
            ) : (
              <>
                <AdminAction icon="👥" title="Zone Approvals" color={COLORS.accentOrange} badge={pendingUsers.length} onPress={() => router.push('/(app)/admin/users' as any)} />
                <AdminAction icon="📝" title="Edit Requests" color={COLORS.accentOrange} badge={editRequests} onPress={() => router.push('/(app)/admin/profile-edit-requests' as any)} />
                <AdminAction icon="💬" title="Feedback" color={COLORS.accent} onPress={() => router.push('/(app)/admin/feedback' as any)} />
                <AdminAction icon="📅" title="Poll History" color={COLORS.primary} onPress={() => router.push('/(app)/admin/poll-history' as any)} />
                <AdminAction icon="💬" title="Chat" color={COLORS.accentPurple} onPress={() => router.push('/(app)/admin/chat' as any)} />
              </>
            )}
          </View>

          {pendingUsers.length > 0 && (
            <PremiumCard style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>⏳ Pending Approvals ({pendingUsers.length})</Text>
                <TouchableOpacity onPress={() => router.push('/(app)/admin/users' as any)}>
                  <Text style={styles.viewAll}>View All →</Text>
                </TouchableOpacity>
              </View>
              {pendingUsers.slice(0, 3).map((u: any) => (
                <View key={u.id} style={styles.pendingUserRow}>
                  <LinearGradient colors={[`${COLORS.primary}25`, `${COLORS.primary}08`]} style={styles.pendingUserAvatar}>
                    <Text style={styles.pendingUserInitial}>{u.name?.charAt(0)}</Text>
                  </LinearGradient>
                  <View style={styles.pendingUserInfo}>
                    <Text style={styles.pendingUserName}>{u.name}</Text>
                    <Text style={styles.pendingUserMeta}>
                      {ZONE_CONFIG[u.zone as keyof typeof ZONE_CONFIG]?.emoji} {u.zone} • {u.phone}
                    </Text>
                  </View>
                </View>
              ))}
            </PremiumCard>
          )}
        </View>
      </ScrollView>

      <Modal visible={voterModalVisible} animationType="slide" transparent onRequestClose={() => setVoterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedZoneInfo?.emoji} {selectedZoneInfo?.label} — Yes Votes</Text>
              <TouchableOpacity onPress={() => setVoterModalVisible(false)} activeOpacity={0.7}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
            </View>
            {(() => {
              const votersList: any[] = selectedZoneVoters || [];
              if (votersList.length === 0) return (<View style={styles.emptyVoters}><Text style={{ fontSize: 36 }}>🌙</Text><Text style={styles.emptyText}>No Yes votes yet</Text></View>);
              const grouped: Record<string, any[]> = {};
              votersList.forEach((v: any) => { const addr = v.address || 'Unknown'; if (!grouped[addr]) grouped[addr] = []; grouped[addr].push(v); });
              return (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                  {Object.entries(grouped).map(([addr, members]) => (
                    <View key={addr} style={styles.addrGroup}>
                      <View style={styles.addrGroupHeader}>
                        <Ionicons name="location-outline" size={13} color={COLORS.primary} />
                        <Text style={styles.addrGroupLabel}>{addr}</Text>
                        <View style={styles.addrGroupCount}><Text style={styles.addrGroupCountText}>{members.length}</Text></View>
                      </View>
                      {members.map((item: any, i: number) => (
                        <View key={item.id || i} style={styles.voterRow}>
                          <LinearGradient colors={[`${COLORS.primary}25`, `${COLORS.primary}08`]} style={styles.voterAvatar}>
                            <Text style={styles.voterAvatarText}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                          </LinearGradient>
                          <Text style={styles.voterName}>{item.name}</Text>
                          <View style={styles.yesBadge}><Text style={styles.yesBadgeText}>✅ Yes</Text></View>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal visible={scModalVisible} animationType="slide" transparent onRequestClose={() => setScModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚨 Special Cases</Text>
              <TouchableOpacity onPress={() => setScModalVisible(false)} activeOpacity={0.7}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
            </View>
            {(() => {
              let allSC: any[] = [];
              if (tomorrowStats?.zones) { ZONE_KEYS.forEach((z) => { const zSC = tomorrowStats.zones[z]?.specialCases || []; allSC = [...allSC, ...zSC]; }); }
              if (allSC.length === 0) return (<View style={styles.emptyVoters}><Text style={{ fontSize: 36 }}>✅</Text><Text style={styles.emptyText}>No special cases</Text></View>);
              return (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                  {allSC.map((sc: any, i: number) => {
                    const zCfg = ZONE_CONFIG[sc.zone as keyof typeof ZONE_CONFIG];
                    return (
                      <View key={sc.id || i} style={styles.scRow}>
                        <View style={[styles.voterAvatar, { borderColor: 'rgba(255,152,0,0.4)', backgroundColor: 'rgba(255,152,0,0.1)' }]}>
                          <Text style={[styles.voterAvatarText, { color: COLORS.accentOrange }]}>{sc.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.voterName}>{sc.name}</Text>
                          {zCfg && <Text style={{ color: zCfg.color, fontSize: 11, marginTop: 1 }}>{zCfg.emoji} {zCfg.label}</Text>}
                          {sc.address ? <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 1 }}>📍 {sc.address}</Text> : null}
                          <Text style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 2 }}>{sc.time ? new Date(sc.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                        </View>
                        <View style={[styles.yesBadge, { borderColor: 'rgba(255,152,0,0.4)', backgroundColor: 'rgba(255,152,0,0.1)' }]}>
                          <Text style={[styles.yesBadgeText, { color: COLORS.accentOrange }]}>{sc.type === 'want' ? 'Wants' : "Don't Want"}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {menuVisible && (
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.dropdown}>
            <Text style={styles.dropdownName}>{user?.name || 'Admin'}</Text>
            <Text style={styles.dropdownRole}>
              {activeRole === 'super_admin' ? '⭐ Super Admin' : '🛡️ Admin'}
            </Text>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleSwitchToUser} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
              <Text style={styles.menuItemText}>Switch to User Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.accentRed} />
              <Text style={[styles.menuItemText, { color: COLORS.accentRed }]}>Logout</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      )}
    </LinearGradient>
  );
}

function AdminAction({ icon, title, color, badge, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.actionCard} activeOpacity={0.8}>
      <LinearGradient colors={[`${color}20`, `${color}08`]} style={styles.actionGradient}>
        <Text style={styles.actionIcon}>{icon}</Text>
        <Text style={styles.actionTitle}>{title}</Text>
        {badge !== undefined && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: color }]}><Text style={styles.badgeText}>{badge}</Text></View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: RESPONSIVE.hp(7), paddingBottom: SIZES.spacing.xl, overflow: 'hidden' },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SIZES.spacing.xl, paddingTop: SIZES.spacing.md },
  greeting: { color: COLORS.textSecondary, fontSize: SIZES.sm },
  adminName: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  roleBadge: { borderWidth: 1, borderRadius: SIZES.radius.round, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  roleText: { fontSize: 11, fontWeight: '700' },
  content: { paddingHorizontal: SIZES.spacing.base, paddingBottom: 100 },
  card: { marginVertical: SIZES.spacing.sm },
  cardTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.md },
  pollOverview: { flexDirection: 'row', gap: 12, marginBottom: SIZES.spacing.md },
  pollStatCard: { flex: 1, borderRadius: SIZES.radius.md, padding: SIZES.spacing.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  pollStatNum: { fontSize: SIZES.xxl, fontWeight: '800' },
  pollStatLabel: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 2, fontWeight: '600' },
  zoneTitle: { color: COLORS.textSecondary, fontSize: SIZES.xs, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SIZES.spacing.sm, marginTop: SIZES.spacing.sm },
  zoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingVertical: 4 },
  zoneEmoji: { fontSize: 16, width: 24 },
  zoneName: { color: COLORS.textSecondary, fontSize: SIZES.xs, width: 85 },
  zoneBarContainer: { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  zoneBar: { height: '100%', borderRadius: 4, minWidth: 4 },
  zoneCount: { fontSize: SIZES.sm, fontWeight: '700', width: 24, textAlign: 'right' },
  donationRow: { flexDirection: 'row', gap: 12 },
  donationCard: { flex: 1, borderRadius: SIZES.radius.md, padding: SIZES.spacing.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  donationAmount: { color: COLORS.primary, fontSize: SIZES.lg, fontWeight: '800', textAlign: 'center' },
  donationLabel: { color: COLORS.textSecondary, fontSize: SIZES.xs, textAlign: 'center', marginTop: 2 },
  viewDonationsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: SIZES.spacing.md, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', alignSelf: 'stretch',
  },
  viewDonationsBtnText: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '700', flex: 1 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginTop: SIZES.spacing.md, marginBottom: SIZES.spacing.sm },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: '47%', borderRadius: SIZES.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  actionGradient: { padding: SIZES.spacing.lg, alignItems: 'center', position: 'relative', minHeight: 90 },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionTitle: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '600' },
  badge: { position: 'absolute', top: 8, right: 8, borderRadius: SIZES.radius.full, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.spacing.md },
  viewAll: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '600' },
  pendingUserRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.spacing.sm, borderBottomWidth: 1, borderColor: COLORS.border },
  pendingUserAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: SIZES.spacing.sm, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  pendingUserInitial: { color: COLORS.primary, fontSize: SIZES.base, fontWeight: '700' },
  pendingUserInfo: { flex: 1 },
  pendingUserName: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '600' },
  pendingUserMeta: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  voterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  voterAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(201,168,76,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  voterAvatarText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  voterName: { flex: 1, color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  yesBadge: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  yesBadgeText: { color: COLORS.accentGreen, fontSize: 10, fontWeight: '700' },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 44, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', flex: 1 },
  emptyVoters: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  scBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,152,0,0.08)', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)' },
  scBtnText: { color: COLORS.accentOrange, fontSize: 13, fontWeight: '600', flex: 1 },
  addrGroup: { marginBottom: 12 },
  addrGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.15)' },
  addrGroupLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '700', flex: 1 },
  addrGroupCount: { backgroundColor: 'rgba(201,168,76,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  addrGroupCountText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
  scRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  pollControlCard: { marginBottom: SIZES.spacing.sm },
  pollControlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pollControlLeft: { flex: 1, marginRight: 16 },
  pollControlTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: 2 },
  pollControlSub: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginBottom: 8 },
  pollStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pollStatusDot: { width: 8, height: 8, borderRadius: 4 },
  pollStatusText: { fontSize: SIZES.sm, fontWeight: '600' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.textOnPrimary, fontSize: 18, fontWeight: '800' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  dropdown: {
    position: 'absolute', top: 100, right: 16,
    backgroundColor: COLORS.background, borderRadius: 12, padding: 16, minWidth: 200,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 20,
  },
  dropdownName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  dropdownRole: { color: COLORS.primary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(201,168,76,0.15)', marginVertical: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8 },
  menuItemText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
});
