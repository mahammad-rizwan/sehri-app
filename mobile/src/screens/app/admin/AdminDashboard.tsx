import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, Switch, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, ZONE_CONFIG } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import PremiumCard from '../../../components/ui/PremiumCard';
import { IslamicGeometric } from '../../../components/ui/IslamicPattern';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';

const ZONE_KEYS = ['masjid', 'boys_hostel', 'stanza', 'girls'] as const;

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [refreshing, setRefreshing]     = useState(false);
  const [tomorrowStats, setTomorrowStats] = useState<any>(null);
  const [pendingUsers, setPendingUsers]  = useState<any[]>([]);
  const [donationSummary, setDonationSummary] = useState<any>(null);
  const [pollActive, setPollActive] = useState<boolean | null>(null); // null = loading
  const [pollToggling, setPollToggling] = useState(false);

  // Super admin modal state
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [voterModalVisible, setVoterModalVisible] = useState(false);
  const [scModalVisible, setScModalVisible] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const loadData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get(ENDPOINTS.USERS, { status: 'pending', limit: 10 }),
        api.get(ENDPOINTS.ACTIVE_POLL_STATS),
      ]);
      setPendingUsers(usersRes.data.data || []);
      setTomorrowStats(statsRes.data.data);
      // Read live is_active status from DB — not a default
      const liveActive = statsRes.data.data?.isPollActive ?? statsRes.data.data?.poll?.is_active;
      if (liveActive !== undefined) setPollActive(liveActive);

      if (isSuperAdmin) {
        try {
          const donRes = await api.get(ENDPOINTS.DONATION_SUMMARY);
          setDonationSummary(donRes.data.data);
        } catch {}
      }
    } catch {}
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleTogglePoll = () => {
    const nextState = !pollActive;
    Alert.alert(
      `${nextState ? 'Open' : 'Close'} Poll`,
      `Are you sure you want to ${nextState ? 'open' : 'close'} the poll? Users will ${nextState ? 'be able to' : 'not be able to'} vote.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setPollToggling(true);
              const res = await api.patch(ENDPOINTS.ACTIVE_POLL_TOGGLE, {});
              const newState = res.data.data.is_active;
              setPollActive(newState);
              Toast.show({ type: 'success', text1: `Poll ${newState ? 'opened' : 'closed'} successfully` });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to toggle poll' });
            } finally {
              setPollToggling(false);
            }
          },
        },
      ],
    );
  };

  const openZoneVoters = (zone: string) => {
    setSelectedZone(zone);
    setVoterModalVisible(true);
  };

  const selectedZoneVoters: any[] = selectedZone && tomorrowStats?.zones?.[selectedZone]?.voters || [];
  const selectedZoneInfo = selectedZone ? ZONE_CONFIG[selectedZone as keyof typeof ZONE_CONFIG] : null;

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <IslamicGeometric opacity={0.08} size={300} />
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Admin Panel</Text>
              <Text style={styles.adminName}>{user?.name}</Text>
              <Text style={styles.adminRole}>{isSuperAdmin ? 'Super Admin' : 'Zone Admin'}</Text>
            </View>
            <View style={styles.headerActions} />
          </View>
        </View>

        <View style={styles.content}>

          {/* ── Tomorrow's Sehri Poll Stats ── */}
          {tomorrowStats && (
            <PremiumCard style={styles.card} golden>
              <Text style={styles.cardTitle}>
                Sehri Poll — {tomorrowStats.displayLabel || tomorrowStats.date || 'Today'}
              </Text>

              {/* Super admin poll toggle — removed from here, now in Quick Actions */}

              {/* Total counts */}
              <View style={styles.pollOverview}>
                <View style={styles.pollStat}>
                  <Text style={[styles.pollStatNum, { color: COLORS.accentGreen }]}>
                    {tomorrowStats.totalYes ?? 0}
                  </Text>
                  <Text style={styles.pollStatLabel}>Total Need Sehri</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.pollStat}>
                  <Text style={[styles.pollStatNum, { color: '#FF9800' }]}>
                    {(tomorrowStats.specialCaseCount ?? 0)}
                  </Text>
                  <Text style={styles.pollStatLabel}>Special Cases</Text>
                </View>
              </View>

              {/* All zones breakdown — same for admin and super admin */}
              {tomorrowStats.zones && (
                <>
                  <Text style={styles.zoneTitle}>Zone-wise Breakdown</Text>
                  {ZONE_KEYS.map((zone) => {
                    const cfg = ZONE_CONFIG[zone];
                    const cnt = tomorrowStats.zones[zone]?.yesCount || 0;
                    const maxCnt = Math.max(1, tomorrowStats.totalYes || 1);
                    return (
                      <TouchableOpacity key={zone} style={styles.zoneRow} onPress={() => openZoneVoters(zone)} activeOpacity={0.75}>
                        <Text style={styles.zoneEmoji}>{cfg.emoji}</Text>
                        <Text style={styles.zoneName}>{cfg.label}</Text>
                        <View style={styles.zoneBarContainer}>
                          <LinearGradient
                            colors={[cfg.color, `${cfg.color}80`]}
                            style={[styles.zoneBar, { width: `${Math.min(100, (cnt / maxCnt) * 100)}%` }]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          />
                        </View>
                        <Text style={[styles.zoneCount, { color: cfg.color }]}>{cnt}</Text>
                        <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    );
                  })}

                  {/* Dedicated Special Cases button */}
                  {(tomorrowStats.specialCaseCount ?? 0) > 0 && (
                    <TouchableOpacity style={styles.scBtn} onPress={() => setScModalVisible(true)} activeOpacity={0.8}>
                      <Ionicons name="alert-circle-outline" size={15} color="#FF9800" />
                      <Text style={styles.scBtnText}>
                        View Special Cases ({tomorrowStats.specialCaseCount})
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#FF9800" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </PremiumCard>
          )}

          {/* Donations — super admin only */}
          {isSuperAdmin && donationSummary && (
            <PremiumCard style={styles.card}>
              <Text style={styles.cardTitle}>Donations Today</Text>
              <View style={styles.donationRow}>
                <View>
                  <Text style={styles.donationAmount}>Rs.{Number(donationSummary.total_amount || 0).toLocaleString()}</Text>
                  <Text style={styles.donationLabel}>Total Collected</Text>
                </View>
                <View>
                  <Text style={[styles.donationAmount, { color: COLORS.accent }]}>{donationSummary.total_donations}</Text>
                  <Text style={styles.donationLabel}>Donations</Text>
                </View>
              </View>
            </PremiumCard>
          )}

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>{isSuperAdmin ? 'Super Admin Actions' : 'Zone Admin Actions'}</Text>

          {/* Super admin — Poll Control dedicated card */}
          {isSuperAdmin && (
            <PremiumCard style={styles.pollControlCard}>
              <View style={styles.pollControlRow}>
                <View style={styles.pollControlLeft}>
                  <Text style={styles.pollControlTitle}>Poll Control</Text>
                  <Text style={styles.pollControlSub}>Override the active poll for users</Text>
                  {pollActive === null ? (
                    <Text style={[styles.pollStatusText, { color: COLORS.textMuted }]}>Loading status...</Text>
                  ) : (
                    <View style={styles.pollStatusRow}>
                      <View style={[styles.pollStatusDot, { backgroundColor: pollActive ? '#4CAF50' : '#EF5350' }]} />
                      <Text style={[styles.pollStatusText, { color: pollActive ? '#4CAF50' : '#EF5350' }]}>
                        {pollActive ? 'Poll Open — users can vote' : 'Poll Closed — voting disabled'}
                      </Text>
                    </View>
                  )}
                </View>
                <Switch
                  value={pollActive === true}
                  onValueChange={handleTogglePoll}
                  disabled={pollToggling || pollActive === null}
                  trackColor={{ false: 'rgba(239,83,80,0.35)', true: 'rgba(76,175,80,0.35)' }}
                  thumbColor={pollActive ? '#4CAF50' : '#EF5350'}
                  ios_backgroundColor="rgba(239,83,80,0.35)"
                />
              </View>
            </PremiumCard>
          )}

          <View style={styles.actionsGrid}>
            {isSuperAdmin ? (
              <>
                <AdminAction icon="👥" title="Users" color={COLORS.accentOrange} badge={pendingUsers.length} onPress={() => router.push('/(app)/admin/users' as any)} />
                <AdminAction icon="💬" title="Feedback" color={COLORS.accent} onPress={() => router.push('/(app)/admin/feedback' as any)} />
                <AdminAction icon="📅" title="Poll History" color={COLORS.primary} onPress={() => router.push('/(app)/admin/poll-history' as any)} />
                <AdminAction icon="🛵" title="Riders" color={COLORS.accentGreen} onPress={() => router.push('/(app)/admin/tracking' as any)} />
                <AdminAction icon="👤" title="Manage Admins" color="#FF6B35" onPress={() => router.push('/(app)/admin/manage-admins' as any)} />
              </>
            ) : (
              <>
                <AdminAction icon="👥" title="Zone Approvals" color={COLORS.accentOrange} badge={pendingUsers.length} onPress={() => router.push('/(app)/admin/users' as any)} />
                <AdminAction icon="💬" title="Feedback" color={COLORS.accent} onPress={() => router.push('/(app)/admin/feedback' as any)} />
                <AdminAction icon="📅" title="Poll History" color={COLORS.primary} onPress={() => router.push('/(app)/admin/poll-history' as any)} />
              </>
            )}
          </View>

          {/* Pending Users Preview */}
          {pendingUsers.length > 0 && (
            <PremiumCard style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Pending Approvals</Text>
                <TouchableOpacity onPress={() => router.push('/(app)/admin/users' as any)}>
                  <Text style={styles.viewAll}>View All</Text>
                </TouchableOpacity>
              </View>
              {pendingUsers.slice(0, 3).map((u: any) => (
                <View key={u.id} style={styles.pendingUserRow}>
                  <View style={styles.pendingUserAvatar}>
                    <Text style={styles.pendingUserInitial}>{u.name?.charAt(0)}</Text>
                  </View>
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

      {/* ── Zone Voters Modal (Yes votes, address sorted) ── */}
      <Modal visible={voterModalVisible} animationType="slide" transparent onRequestClose={() => setVoterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedZoneInfo?.emoji} {selectedZoneInfo?.label} — Sehri Yes Votes
              </Text>
              <TouchableOpacity onPress={() => setVoterModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            {(() => {
              const votersList: any[] = selectedZoneVoters || [];
              if (votersList.length === 0) {
                return (
                  <View style={styles.emptyVoters}>
                    <Text style={{ fontSize: 36 }}>🌙</Text>
                    <Text style={styles.emptyText}>No Yes votes yet</Text>
                  </View>
                );
              }
              // Group by address
              const grouped: Record<string, any[]> = {};
              votersList.forEach((v: any) => {
                const addr = v.address || 'Unknown Address';
                if (!grouped[addr]) grouped[addr] = [];
                grouped[addr].push(v);
              });
              return (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                  {Object.entries(grouped).map(([addr, members]) => (
                    <View key={addr} style={styles.addrGroup}>
                      <View style={styles.addrGroupHeader}>
                        <Ionicons name="location-outline" size={13} color={COLORS.primary} />
                        <Text style={styles.addrGroupLabel}>{addr}</Text>
                        <View style={styles.addrGroupCount}>
                          <Text style={styles.addrGroupCountText}>{members.length}</Text>
                        </View>
                      </View>
                      {members.map((item: any, i: number) => (
                        <View key={item.id || i} style={styles.voterRow}>
                          <View style={styles.voterAvatar}>
                            <Text style={styles.voterAvatarText}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                          </View>
                          <Text style={styles.voterName}>{item.name}</Text>
                          <View style={styles.yesBadge}><Text style={styles.yesBadgeText}>Yes</Text></View>
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

      {/* ── Special Cases Modal ── */}
      <Modal visible={scModalVisible} animationType="slide" transparent onRequestClose={() => setScModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Special Cases</Text>
              <TouchableOpacity onPress={() => setScModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            {(() => {
              let allSC: any[] = [];
              if (tomorrowStats?.zones) {
                ZONE_KEYS.forEach((z) => {
                  const zSC = tomorrowStats.zones[z]?.specialCases || [];
                  allSC = [...allSC, ...zSC];
                });
              }
              if (allSC.length === 0) {
                return (
                  <View style={styles.emptyVoters}>
                    <Text style={{ fontSize: 36 }}>✅</Text>
                    <Text style={styles.emptyText}>No special cases</Text>
                  </View>
                );
              }
              return (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                  {allSC.map((sc: any, i: number) => {
                    const zCfg = ZONE_CONFIG[sc.zone as keyof typeof ZONE_CONFIG];
                    return (
                      <View key={sc.id || i} style={styles.scRow}>
                        <View style={[styles.voterAvatar, { borderColor: 'rgba(255,152,0,0.4)', backgroundColor: 'rgba(255,152,0,0.1)' }]}>
                          <Text style={[styles.voterAvatarText, { color: '#FF9800' }]}>{sc.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.voterName}>{sc.name}</Text>
                          {zCfg && <Text style={{ color: zCfg.color, fontSize: 11 }}>{zCfg.emoji} {zCfg.label}</Text>}
                          {sc.address ? <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>📍 {sc.address}</Text> : null}
                          <Text style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 2 }}>
                            {sc.time ? new Date(sc.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </Text>
                        </View>
                        <View style={[styles.yesBadge, { borderColor: 'rgba(255,152,0,0.4)', backgroundColor: 'rgba(255,152,0,0.1)' }]}>
                          <Text style={[styles.yesBadgeText, { color: '#FF9800' }]}>
                            {sc.type === 'want' ? 'Wants' : "Don't Want"}
                          </Text>
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
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: SIZES.spacing.xl, overflow: 'hidden' },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SIZES.spacing.xl, paddingTop: SIZES.spacing.md },
  greeting: { color: COLORS.textSecondary, fontSize: SIZES.sm },
  adminName: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  adminRole: { color: COLORS.primary, fontSize: SIZES.sm, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  content: { paddingHorizontal: SIZES.spacing.base, paddingBottom: 100 },
  card: { marginVertical: SIZES.spacing.sm },
  cardTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.md },
  pollOverview: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SIZES.spacing.md },
  pollStat: { alignItems: 'center' },
  pollStatNum: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '800' },
  pollStatLabel: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  zoneTitle: { color: COLORS.textSecondary, fontSize: SIZES.xs, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SIZES.spacing.sm, marginTop: SIZES.spacing.sm },
  zoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingVertical: 4 },
  zoneEmoji: { fontSize: 16, width: 24 },
  zoneName: { color: COLORS.textSecondary, fontSize: SIZES.xs, width: 90 },
  zoneBarContainer: { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  zoneBar: { height: '100%', borderRadius: 4, minWidth: 4 },
  zoneCount: { fontSize: SIZES.sm, fontWeight: '700', width: 24, textAlign: 'right' },
  donationRow: { flexDirection: 'row', justifyContent: 'space-around' },
  donationAmount: { color: COLORS.primary, fontSize: SIZES.xxl, fontWeight: '800', textAlign: 'center' },
  donationLabel: { color: COLORS.textSecondary, fontSize: SIZES.xs, textAlign: 'center', marginTop: 2 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginTop: SIZES.spacing.md, marginBottom: SIZES.spacing.sm },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: '47%', borderRadius: SIZES.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  actionGradient: { padding: SIZES.spacing.lg, alignItems: 'center', position: 'relative', minHeight: 90 },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionTitle: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '600' },
  badge: { position: 'absolute', top: 8, right: 8, borderRadius: SIZES.radius.full, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.spacing.md },
  viewAll: { color: COLORS.primary, fontSize: SIZES.sm },
  pendingUserRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.spacing.sm, borderBottomWidth: 1, borderColor: COLORS.border },
  pendingUserAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.backgroundElevated, alignItems: 'center', justifyContent: 'center', marginRight: SIZES.spacing.sm, borderWidth: 1, borderColor: COLORS.primary },
  pendingUserInitial: { color: COLORS.primary, fontSize: SIZES.base, fontWeight: '700' },
  pendingUserInfo: { flex: 1 },
  pendingUserName: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '600' },
  pendingUserMeta: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  // Voter rows
  voterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  voterAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(201,168,76,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  voterAvatarText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  voterName: { flex: 1, color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  yesBadge: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  yesBadgeText: { color: '#4CAF50', fontSize: 10, fontWeight: '700' },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0D1B2A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 44, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', flex: 1 },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 16 },
  emptyVoters: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  scBadge: { backgroundColor: 'rgba(255,152,0,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,152,0,0.4)', marginLeft: 4 },
  scBadgeText: { color: '#FF9800', fontSize: 10, fontWeight: '700' },
  // Special case button
  scBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,152,0,0.08)', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)' },
  scBtnText: { color: '#FF9800', fontSize: 13, fontWeight: '600', flex: 1 },
  // View poll response button
  viewPollBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  viewPollBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600', flex: 1 },
  // Address grouping
  addrGroup: { marginBottom: 12 },
  addrGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.15)' },
  addrGroupLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '700', flex: 1 },
  addrGroupCount: { backgroundColor: 'rgba(201,168,76,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  addrGroupCountText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
  // SC row
  scRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  // Poll control card
  pollControlCard: { marginBottom: SIZES.spacing.sm },
  pollControlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pollControlLeft: { flex: 1, marginRight: 16 },
  pollControlTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: 2 },
  pollControlSub: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginBottom: 8 },
  pollStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pollStatusDot: { width: 8, height: 8, borderRadius: 4 },
  pollStatusText: { fontSize: SIZES.sm, fontWeight: '600' },
});
