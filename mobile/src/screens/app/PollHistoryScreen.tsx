import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HIJRI_MONTHS = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Akhira', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

function gregorianToHijri(date: Date): { day: number; month: number; year: number } {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jd = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const mh = Math.floor((24 * l3) / 709);
  const dh = l3 - Math.floor((709 * mh) / 24);
  const yh = 30 * n + j - 30;
  return { day: dh, month: mh, year: yh };
}

function getHijriDateLabel(date: Date): { day: number; month: number; year: number; monthName: string } {
  const h = gregorianToHijri(date);
  return { ...h, monthName: HIJRI_MONTHS[h.month - 1] || '' };
}

export default function PollHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ responses: any[]; pollDates: string[] } | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get(ENDPOINTS.MY_POLL_HISTORY);
      setData(res.data.data);
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const firstHijri = getHijriDateLabel(new Date(year, month, 1));
  const lastHijri = getHijriDateLabel(new Date(year, month, daysInMonth));
  const hijriLabel = firstHijri.month === lastHijri.month && firstHijri.year === lastHijri.year
    ? `${firstHijri.monthName} ${firstHijri.year} AH`
    : `${firstHijri.monthName} ${firstHijri.year} - ${lastHijri.monthName} ${lastHijri.year} AH`;

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const responseMap = useMemo(() => {
    const map: Record<string, string> = {};
    data?.responses?.forEach((r) => {
      if (r.date) map[r.date] = r.response;
    });
    return map;
  }, [data]);

  const pollDateSet = useMemo(() => {
    return new Set(data?.pollDates || []);
  }, [data]);

  const todayStr = new Date().toISOString().split('T')[0];

  const getDayColor = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasPoll = pollDateSet.has(dateStr);
    if (!hasPoll) return null;
    const response = responseMap[dateStr];
    if (response === 'yes') return 'green';
    return 'red';
  };

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const color = getDayColor(d);
    const dateObj = new Date(year, month, d);
    const hijri = gregorianToHijri(dateObj);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    cells.push(
      <View key={d} style={styles.dayCell}>
        <View
          style={[
            styles.dayInner,
            color === 'green' && styles.dayGreen,
            color === 'red' && styles.dayRed,
            isToday && styles.dayToday,
          ]}
        >
          <Text
            style={[
              styles.dayText,
              color === 'green' && styles.dayTextGreen,
              color === 'red' && styles.dayTextRed,
              isToday && styles.dayTextToday,
            ]}
          >
            {d}
          </Text>
          <Text style={styles.hijriDayText}>{hijri.day}</Text>
        </View>
      </View>,
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/home' as any)} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Poll History</Text>
          <Text style={styles.headerSub}>Track your Sehri responses</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <View style={styles.calendarCard}>
            {/* Month navigation with Hijri */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <View style={styles.monthCenter}>
                <Text style={styles.monthLabel}>
                  {MONTHS[month]} {year}
                </Text>
                <Text style={styles.hijriMonthLabel}>
                  {hijriLabel}
                </Text>
              </View>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={styles.weekRow}>
              {DAYS.map((d) => (
                <View key={d} style={styles.weekCell}>
                  <Text style={styles.weekText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.dayGrid}>{cells}</View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2E7D32' }]} />
                <Text style={styles.legendText}>Voted Yes</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#C62828' }]} />
                <Text style={styles.legendText}>Not Voted / No</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border }]} />
                <Text style={styles.legendText}>No Poll</Text>
              </View>
            </View>
          </View>
        )}

        {/* Response summary */}
        {!loading && data && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryNum, { color: '#4CAF50' }]}>
                  {data.responses.filter((r) => r.response === 'yes').length}
                </Text>
                <Text style={styles.summaryLabel}>Yes Votes</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryNum, { color: '#EF5350' }]}>
                  {data.responses.filter((r) => r.response === 'no').length}
                </Text>
                <Text style={styles.summaryLabel}>No / Missed</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryNum, { color: COLORS.primary }]}>
                  {data.pollDates.length}
                </Text>
                <Text style={styles.summaryLabel}>Total Polls</Text>
              </View>
            </View>
          </View>
        )}

        {/* Response list */}
        {!loading && data && data.responses.length > 0 && (
          <View style={styles.listCard}>
            <Text style={styles.listTitle}>Recent Responses</Text>
            {data.responses.slice(0, 20).map((r) => (
              <View key={r.id} style={styles.listRow}>
                <View style={[styles.listDot, { backgroundColor: r.response === 'yes' ? '#4CAF50' : '#EF5350' }]} />
                <Text style={styles.listDate}>{r.date}</Text>
                <Text style={styles.listStatus}>
                  {r.response === 'yes' ? 'Voted Yes' : 'Voted No'}
                </Text>
                {r.is_special_case && (
                  <View style={styles.scBadge}>
                    <Text style={styles.scBadgeText}>{r.special_case_type === 'want' ? 'Wants' : "Don't Want"}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
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
    backgroundColor: '#050D16',
  },
  topBarContent: {
    flexDirection: 'row', alignItems: 'center',
    height: Platform.OS === 'ios' ? 44 : 56,
    paddingHorizontal: 4,
  },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
  header: { paddingTop: 16, paddingBottom: 24, paddingHorizontal: 20 },
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
  monthCenter: { alignItems: 'center' },
  monthLabel: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  hijriMonthLabel: { color: COLORS.primary, fontSize: 11, fontWeight: '600', marginTop: 2 },
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
    position: 'relative',
  },
  dayGreen: { backgroundColor: 'rgba(46,125,50,0.35)' },
  dayRed: { backgroundColor: 'rgba(198,40,40,0.35)' },
  dayToday: { borderWidth: 2, borderColor: COLORS.primary },
  dayText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  dayTextGreen: { color: '#81C784' },
  dayTextRed: { color: '#EF9A9A' },
  dayTextToday: { color: COLORS.primary, fontWeight: '800' },
  hijriDayText: { color: COLORS.textMuted, fontSize: 8, marginTop: 1 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: COLORS.textMuted, fontSize: 11 },
  summaryCard: {
    margin: 16,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryStat: { alignItems: 'center' },
  summaryNum: { fontSize: 28, fontWeight: '800' },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: COLORS.border },
  listCard: {
    marginHorizontal: 16,
    marginBottom: 40,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  listDot: { width: 8, height: 8, borderRadius: 4 },
  listDate: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', width: 90 },
  listStatus: { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
  scBadge: {
    backgroundColor: 'rgba(255,152,0,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.4)',
  },
  scBadgeText: { color: '#FF9800', fontSize: 10, fontWeight: '700' },
});
