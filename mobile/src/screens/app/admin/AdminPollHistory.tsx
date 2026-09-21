import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { COLORS, ZONE_CONFIG } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ZONE_KEYS = ['masjid', 'boys_hostel', 'stanza', 'girls'] as const;

export default function AdminPollHistory() {
  const router = useRouter();
  const { user, activeRole } = useAuthStore();
  const isSuperAdmin = activeRole === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [pollDates, setPollDates] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateStats, setDateStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedZoneVoters, setSelectedZoneVoters] = useState<any[]>([]);
  const [selectedZoneInfo, setSelectedZoneInfo] = useState<any>(null);
  const [voterModalVisible, setVoterModalVisible] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchPollDates = async () => {
    try {
      setLoading(true);
      const res = await api.get(ENDPOINTS.POLL_HISTORY, { limit: 365 });
      const polls = res.data.data || [];
      setPollDates(polls.map((p: any) => p.date));
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPollDates(); }, []);

  const pollDateSet = useMemo(() => new Set(pollDates), [pollDates]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const fetchDateStats = async (date: string) => {
    try {
      setStatsLoading(true);
      setSelectedDate(date);
      setDateStats(null);
      const res = await api.get(ENDPOINTS.POLL_DATE_STATS(date));
      setDateStats(res.data.data);
    } catch { } finally {
      setStatsLoading(false);
    }
  };

  const openZoneVoters = (zone: string) => {
    const info = isSuperAdmin
      ? ZONE_CONFIG[zone as keyof typeof ZONE_CONFIG]
      : ZONE_CONFIG[user?.zone as keyof typeof ZONE_CONFIG];
    setSelectedZoneInfo(info);
    const voters = dateStats?.zones?.[zone]?.voters || [];
    setSelectedZoneVoters(voters);
    setVoterModalVisible(true);
  };

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasPoll = pollDateSet.has(dateStr);
    const isSelected = selectedDate === dateStr;
    const isToday = dateStr === todayStr;
    cells.push(
      <TouchableOpacity
        key={d}
        style={styles.dayCell}
        onPress={() => hasPoll && fetchDateStats(dateStr)}
        disabled={!hasPoll || statsLoading}
        activeOpacity={0.6}
      >
        <View
          style={[
            styles.dayInner,
            hasPoll && styles.dayHasPoll,
            isSelected && styles.daySelected,
            isToday && styles.dayToday,
          ]}
        >
          <Text
            style={[
              styles.dayText,
              hasPoll && styles.dayTextHasPoll,
              isSelected && styles.dayTextSelected,
              isToday && styles.dayTextToday,
              !hasPoll && styles.dayTextDisabled,
            ]}
          >
            {d}
          </Text>
        </View>
      </TouchableOpacity>,
    );
  }

  const renderVoterGroup = (voters: any[], zoneKey?: string) => {
    if (!voters || voters.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No Yes votes for this date</Text>
        </View>
      );
    }
    const grouped: Record<string, any[]> = {};
    voters.forEach((v: any) => {
      const addr = v.address || 'Unknown Address';
      if (!grouped[addr]) grouped[addr] = [];
      grouped[addr].push(v);
    });
    return (
      <>
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
      </>
    );
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Poll History</Text>
          <Text style={styles.headerSub}>
            {isSuperAdmin ? 'View all zones' : 'View your zone'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <View style={styles.calendarCard}>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {MONTHS[month]} {year}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {DAYS.map((d) => (
                <View key={d} style={styles.weekCell}>
                  <Text style={styles.weekText}>{d}</Text>
                </View>
              ))}
            </View>

            <View style={styles.dayGrid}>{cells}</View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                <Text style={styles.legendText}>Poll Exists</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border }]} />
                <Text style={styles.legendText}>No Poll</Text>
              </View>
            </View>
          </View>
        )}

        {/* Date selection results */}
        {selectedDate && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {selectedDate} — Stats
            </Text>

            {statsLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : dateStats ? (
              <>
                {/* Total */}
                <View style={styles.pollOverview}>
                  <View style={styles.pollStat}>
                    <Text style={[styles.pollStatNum, { color: COLORS.accentGreen }]}>
                      {dateStats.totalYes ?? 0}
                    </Text>
                    <Text style={styles.pollStatLabel}>
                      {isSuperAdmin ? 'Total Yes' : `${ZONE_CONFIG[user?.zone as keyof typeof ZONE_CONFIG]?.emoji} Your Zone Yes`}
                    </Text>
                  </View>
                  {dateStats.specialCases?.length > 0 && (
                    <>
                      <View style={styles.statDivider} />
                      <View style={styles.pollStat}>
                        <Text style={[styles.pollStatNum, { color: '#FF9800' }]}>
                          {dateStats.specialCases.length}
                        </Text>
                        <Text style={styles.pollStatLabel}>Special Cases</Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Zone breakdown for super admin */}
                {isSuperAdmin && (
                  <>
                    <Text style={styles.sectionTitleSm}>Zone-wise Breakdown</Text>
                    {ZONE_KEYS.map((zone) => {
                      const cfg = ZONE_CONFIG[zone];
                      const zd = dateStats.zones?.[zone];
                      const cnt = zd?.yesCount || 0;
                      return (
                        <TouchableOpacity
                          key={zone}
                          style={styles.zoneRow}
                          onPress={() => openZoneVoters(zone)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.zoneEmoji}>{cfg.emoji}</Text>
                          <Text style={styles.zoneName}>{cfg.label}</Text>
                          <Text style={[styles.zoneCount, { color: cfg.color }]}>{cnt}</Text>
                          <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {/* Address-grouped voters for non-super admin */}
                {!isSuperAdmin && (
                  <>
                    <Text style={styles.sectionTitleSm}>Address-wise Details</Text>
                    {renderVoterGroup(user?.zone ? dateStats.zones?.[user.zone]?.voters || [] : [])}
                  </>
                )}
              </>
            ) : (
              <Text style={styles.noDataText}>No data available for this date</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Voter detail modal */}
      <Modal visible={voterModalVisible} animationType="slide" transparent onRequestClose={() => setVoterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedZoneInfo?.emoji} {selectedZoneInfo?.label} — Voters
              </Text>
              <TouchableOpacity onPress={() => setVoterModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {renderVoterGroup(selectedZoneVoters)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },

  headerTitle: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800' },
  headerSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  loadingBox: { alignItems: 'center', paddingVertical: 80 },
  calendarCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthLabel: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  dayInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHasPoll: { backgroundColor: 'rgba(201,168,76,0.15)' },
  daySelected: { backgroundColor: 'rgba(201,168,76,0.35)', borderWidth: 1.5, borderColor: COLORS.primary },
  dayToday: { borderWidth: 2, borderColor: COLORS.primary },
  dayText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  dayTextHasPoll: { color: COLORS.primary, fontWeight: '700' },
  dayTextSelected: { color: '#fff', fontWeight: '800' },
  dayTextToday: { color: COLORS.primary, fontWeight: '800' },
  dayTextDisabled: { color: COLORS.textMuted, fontWeight: '400' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: COLORS.textMuted, fontSize: 11 },
  resultCard: {
    margin: 16,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  pollOverview: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  pollStat: { alignItems: 'center' },
  pollStatNum: { fontSize: 28, fontWeight: '800' },
  pollStatLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  sectionTitleSm: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  zoneEmoji: { fontSize: 16, width: 24 },
  zoneName: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
  zoneCount: { fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'right' },
  noDataText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
  // Voter group styles
  addrGroup: { marginBottom: 12 },
  addrGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.15)' },
  addrGroupLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '700', flex: 1 },
  addrGroupCount: { backgroundColor: 'rgba(201,168,76,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  addrGroupCountText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
  voterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  voterAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(201,168,76,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  voterAvatarText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  voterName: { flex: 1, color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  yesBadge: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  yesBadgeText: { color: '#4CAF50', fontSize: 10, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0D1B2A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 44, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', flex: 1 },
});
