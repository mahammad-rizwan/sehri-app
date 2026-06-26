import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PollHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ responses: any[]; pollDates: string[] } | null>(null);
  const [viewDate, setViewDate] = useState(new Date());

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
        </View>
      </View>,
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
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
            {/* Month navigation */}
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
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
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
  dayGreen: { backgroundColor: 'rgba(46,125,50,0.35)' },
  dayRed: { backgroundColor: 'rgba(198,40,40,0.35)' },
  dayToday: { borderWidth: 2, borderColor: COLORS.primary },
  dayText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  dayTextGreen: { color: '#81C784' },
  dayTextRed: { color: '#EF9A9A' },
  dayTextToday: { color: COLORS.primary, fontWeight: '800' },
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
