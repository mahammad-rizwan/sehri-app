import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Modal, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ZONE_CONFIG, RESPONSIVE, SIZES, SHADOWS } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import PremiumCard from '../../components/ui/PremiumCard';
import GoldButton from '../../components/ui/GoldButton';
import { CrescentMoon, IslamicGeometric, StarDivider } from '../../components/ui/IslamicPattern';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import Toast from 'react-native-toast-message';
import ExpoGoNotice from '../../components/ui/ExpoGoNotice';
import { getUnreadBroadcastCount } from '../../services/broadcastBadge';

interface PrayerSlot { key: string; name: string; time: string; icon: string; color: string; }

let prayerCache: { date: string; slots: PrayerSlot[]; date_hijri?: string } | null = null;

const PRAYER_META: Record<string, { name: string; icon: string; color: string }> = {
  Tahajjud: { name: 'Tahajjud', icon: '🌌', color: '#7B68EE' },
  Imsak: { name: 'Sehri End', icon: '🍽️', color: '#C9A84C' },
  Fajr: { name: 'Fajr', icon: '🌅', color: '#FF8C69' },
  Sunrise: { name: 'Sunrise', icon: '☀️', color: '#FFD700' },
  Dhuhr: { name: 'Dhuhr', icon: '🕛', color: '#4FC3F7' },
  Asr: { name: 'Asr', icon: '🕓', color: '#FF9800' },
  Iftar: { name: 'Iftari', icon: '🌴', color: '#EF5350' },
  Maghrib: { name: 'Maghrib', icon: '🌇', color: '#E65100' },
  Isha: { name: 'Isha', icon: '🌙', color: '#AB47BC' },
};

const SHOW_KEYS = ['Tahajjud', 'Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Iftar', 'Maghrib', 'Isha'];

async function fetchPrayerTimes(): Promise<PrayerSlot[]> {
  const today = new Date().toDateString();
  if (prayerCache?.date === today) return prayerCache.slots;
  try {
    const res = await api.get(ENDPOINTS.PRAYER_TIMINGS);
    const data = res.data.data;
    const slots: PrayerSlot[] = (data.slots || []).map((s: any) => ({
      key: s.key,
      name: PRAYER_META[s.key]?.name || s.key,
      time: s.time,
      icon: PRAYER_META[s.key]?.icon || '🕌',
      color: PRAYER_META[s.key]?.color || '#C9A84C',
    }));
    prayerCache = { date: today, slots, date_hijri: data.date_hijri };
    return slots;
  } catch {
    const fallback: PrayerSlot[] = [
      { key: 'Tahajjud', name: 'Tahajjud', time: '03:30', icon: '🌌', color: '#7B68EE' },
      { key: 'Imsak', name: 'Sehri End', time: '05:10', icon: '🍽️', color: '#C9A84C' },
      { key: 'Fajr', name: 'Fajr', time: '05:20', icon: '🌅', color: '#FF8C69' },
      { key: 'Sunrise', name: 'Sunrise', time: '06:28', icon: '☀️', color: '#FFD700' },
      { key: 'Dhuhr', name: 'Dhuhr', time: '12:35', icon: '🕛', color: '#4FC3F7' },
      { key: 'Asr', name: 'Asr', time: '16:00', icon: '🕓', color: '#FF9800' },
      { key: 'Iftar', name: 'Iftari', time: '18:45', icon: '🌴', color: '#EF5350' },
      { key: 'Maghrib', name: 'Maghrib', time: '18:47', icon: '🌇', color: '#E65100' },
      { key: 'Isha', name: 'Isha', time: '20:00', icon: '🌙', color: '#AB47BC' },
    ];
    prayerCache = { date: today, slots: fallback };
    return fallback;
  }
}

function toMinutes(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); }
function getActivePrayer(nowMinutes: number, slots: PrayerSlot[]): string {
  for (let i = slots.length - 1; i >= 0; i--) { if (nowMinutes >= toMinutes(slots[i].time)) return slots[i].key; }
  return slots[slots.length - 1]?.key || '';
}

function getApproxHijri(): string {
  const MONTHS = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhira', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'];
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
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
  return `${dh} ${MONTHS[(mh - 1) % 12]} ${yh} AH`;
}

const POLL_OPEN_HOUR = 22;
const POLL_CLOSE_HOUR = 10;

function isPollOpen(now: Date): boolean { const h = now.getHours(); return h >= POLL_OPEN_HOUR || h < POLL_CLOSE_HOUR; }

const CARD_W = (RESPONSIVE.width - 32 - 10) / 2 - 5;

function PrayerHeroCard() {
  const [slots, setSlots] = useState<PrayerSlot[]>([]);
  const [prayerLoading, setPrayerLoading] = useState(true);
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  const [hijri, setHijri] = useState(getApproxHijri());
  const gregorian = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    fetchPrayerTimes().then((s) => { setSlots(s); if (prayerCache?.date_hijri) setHijri(prayerCache.date_hijri); setPrayerLoading(false); });
    const t = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60000);
    return () => clearInterval(t);
  }, []);

  const active = slots.length > 0 ? getActivePrayer(nowMin, slots) : '';

  return (
    <LinearGradient colors={['rgba(201,168,76,0.15)', 'rgba(13,27,42,0.95)']} style={hs.heroCard}>
      <View style={hs.dateStrip}>
        <View style={hs.dateLeft}>
          <Text style={hs.hijriDate}>📅 {hijri}</Text>
          <Text style={hs.gregorianDate}>{gregorian}</Text>
        </View>
        <CrescentMoon size={30} color={COLORS.primary} />
      </View>
      <View style={hs.dividerLine} />
      {prayerLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 8 }}>Loading prayer times...</Text>
        </View>
      ) : (
        <View>
          {[slots.slice(0, 3), slots.slice(3, 6), slots.slice(6, 9)].map((row, ri) => (
            <View key={ri} style={hs.prayerRow}>
              {row.map((p) => {
                const isActive = p.key === active;
                return (
                  <LinearGradient
                    key={p.key}
                    colors={isActive ? [`${p.color}45`, `${p.color}15`] : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                    style={[hs.prayerItem, isActive && { borderColor: p.color, borderWidth: 1.5, ...SHADOWS.sm }]}
                  >
                    {isActive && <View style={[hs.activeDot, { backgroundColor: p.color }]} />}
                    <Text style={hs.prayerIcon}>{p.icon}</Text>
                    <Text style={[hs.prayerName, isActive && { color: p.color, fontWeight: '800' }]}>{p.name}</Text>
                    <View style={hs.timeRow}>
                      <Text style={[hs.prayerTime, isActive && { color: p.color }]}>{p.time}</Text>
                      {isActive && <View style={[hs.nowBadge, { backgroundColor: p.color }]}><Text style={hs.nowBadgeText}>NOW</Text></View>}
                    </View>
                  </LinearGradient>
                );
              })}
            </View>
          ))}
        </View>
      )}
      <Text style={hs.bangaloreNote}>📍 Live prayer times • Bangalore, India</Text>
    </LinearGradient>
  );
}

function TomorrowPollCard({
  poll, userResponse, zoneYesCount, pollLoading,
  sehriDateLabel, phase, isSpecialCase, specialCaseType,
  specialCaseLoading, sehriStatus, sehriStatusLoading, sehriAllowed,
  onVote, onSpecialCase, onUndoSpecialCase, onViewVoters,
}: {
  poll: any; userResponse: string | null; zoneYesCount: number; pollLoading: boolean;
  sehriDateLabel: string; phase: string; isSpecialCase: boolean;
  specialCaseType: string | null; specialCaseLoading: boolean;
  sehriStatus: any; sehriStatusLoading: boolean; sehriAllowed: boolean | null;
  onVote: (r: 'yes' | 'no') => void; onSpecialCase: (t: 'want' | 'dont_want') => void;
  onUndoSpecialCase: () => void; onViewVoters: () => void;
}) {
  const open = phase === 'voting';
  const inSpecialWindow = phase === 'special_case';
  const showDontWant = open && userResponse === 'yes';
  const showWantSehri = open && userResponse !== 'yes';
  const showSpecialDontWant = inSpecialWindow && userResponse === 'yes' && specialCaseType !== 'dont_want';
  const showSpecialWant = inSpecialWindow && userResponse !== 'yes' && specialCaseType !== 'want';
  const showUndoSpecialCase = inSpecialWindow && isSpecialCase;

  const pillLabel =
    open ? 'Open' :
    phase === 'special_case' ? 'Special Case' :
    phase === 'allotment' ? 'Confirming' :
    phase === 'status' ? 'Sehri Status' : 'Closed';

  const pillColor = open ? COLORS.accentGreen : (phase === 'status' ? COLORS.primary : COLORS.accentOrange);

  const status = sehriStatus?.status;
  const statusStyle =
    status === 'confirmed' ? { bg: 'rgba(76,175,80,0.12)', border: 'rgba(76,175,80,0.4)', color: COLORS.accentGreen, icon: '✅' } :
    status === 'no' ? { bg: 'rgba(239,83,80,0.12)', border: 'rgba(239,83,80,0.4)', color: COLORS.accentRed, icon: '❌' } :
    status === 'pending' ? { bg: 'rgba(255,152,0,0.12)', border: 'rgba(255,152,0,0.4)', color: COLORS.accentOrange, icon: '⏳' } :
    { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)', color: COLORS.textSecondary, icon: '—' };

  return (
    <LinearGradient colors={['rgba(26,46,69,0.8)', 'rgba(21,35,54,0.9)']} style={hs.pollCard}>
      <View style={hs.pollHeader}>
        <View style={hs.pollTitleGroup}>
          <Text style={hs.pollIcon}>🗳️</Text>
          <View>
            <Text style={hs.pollTitle}>Sehri for {sehriDateLabel}</Text>
            <Text style={hs.pollSubtitle}>Voting: 10:00 PM — 10:00 AM</Text>
          </View>
        </View>
        <LinearGradient
          colors={[`${pillColor}33`, `${pillColor}0D`]}
          style={[hs.statusPill, { borderColor: `${pillColor}80` }]}
        >
          <View style={[hs.statusDot, { backgroundColor: pillColor }]} />
          <Text style={[hs.statusText, { color: pillColor }]}>{pillLabel}</Text>
        </LinearGradient>
      </View>

      {open && userResponse && (
        <View style={[hs.voteStatus, {
          backgroundColor: userResponse === 'yes' ? 'rgba(76,175,80,0.12)' : 'rgba(239,83,80,0.12)',
          borderColor: userResponse === 'yes' ? 'rgba(76,175,80,0.4)' : 'rgba(239,83,80,0.4)',
        }]}>
          <Text style={{ fontSize: 16 }}>{userResponse === 'yes' ? '✅' : '❌'}</Text>
          <Text style={[hs.voteStatusText, { color: userResponse === 'yes' ? COLORS.accentGreen : COLORS.accentRed }]}>
            {userResponse === 'yes' ? 'You voted: Yes — Sehri will be arranged' : 'You voted: No'}
          </Text>
        </View>
      )}

      {open && (
        <View style={hs.pollActions}>
          {showWantSehri && <GoldButton title="✅ Yes, I need Sehri" onPress={() => onVote('yes')} loading={pollLoading} size="md" glow />}
          {showDontWant && <GoldButton title="❌ I don't want Sehri" onPress={() => onVote('no')} loading={pollLoading} variant="outline" size="md" />}
        </View>
      )}

      {phase === 'special_case' && (
        <View style={hs.specialCaseSection}>
          <View style={hs.specialCaseHeader}>
            <Ionicons name="alert-circle-outline" size={15} color={COLORS.accentOrange} />
            <Text style={hs.specialCaseLabel}>Special Case</Text>
            <Text style={hs.specialCaseText}>Window open: 10:00 AM — 5:00 PM</Text>
          </View>
          {isSpecialCase && specialCaseType === 'dont_want' && (
            <View style={hs.specialCaseBadge}>
              <Text style={hs.specialCaseText}>
                ❌ You opted out — no Sehri for today
              </Text>
            </View>
          )}
          {isSpecialCase && specialCaseType === 'want' && (
            <View style={hs.specialCaseBadge}>
              <Text style={hs.specialCaseText}>
                ✅ You requested Sehri — admin will confirm by 6:00 PM
              </Text>
            </View>
          )}
          {showUndoSpecialCase && (
            <GoldButton title="↩️ Undo Special Case" onPress={onUndoSpecialCase} loading={specialCaseLoading} variant="outline" size="sm" style={{ marginTop: 4 }} />
          )}
          {!isSpecialCase && userResponse === 'yes' && (
            <View style={hs.specialCaseInfo}>
              <Text style={hs.specialCaseInfoText}>
                💡 You voted <Text style={{ fontWeight: '800', color: COLORS.accentGreen }}>YES</Text> during the voting window. Your Sehri is confirmed unless you submit a special case.
              </Text>
            </View>
          )}
          {showSpecialWant && (
            <GoldButton title="✅ I need Sehri (Special)" onPress={() => onSpecialCase('want')} loading={specialCaseLoading} size="sm" style={{ marginTop: 8 }} />
          )}
          {showSpecialDontWant && (
            <GoldButton title="❌ Don't want (Special)" onPress={() => onSpecialCase('dont_want')} loading={specialCaseLoading} variant="outline" size="sm" style={{ marginTop: 8 }} />
          )}
          {!showSpecialWant && !showSpecialDontWant && !isSpecialCase && userResponse !== 'yes' && (
            <View style={hs.closedNotice}>
              <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
              <Text style={hs.closedText}>No special case options available</Text>
            </View>
          )}
        </View>
      )}

      {phase === 'allotment' && (
        <View style={hs.specialCaseSection}>
          <View style={hs.specialCaseHeader}>
            <Ionicons name="time-outline" size={15} color={COLORS.accentOrange} />
            <Text style={hs.specialCaseLabel}>Sehri Confirmation</Text>
          </View>
          <View style={hs.closedNotice}>
            <Text style={hs.closedText}>
              {isSpecialCase && specialCaseType === 'want'
                ? '⏳ Your request is being reviewed. The admin will confirm your Sehri between 5–6 PM.'
                : 'Final Sehri status will be shown at 6:00 PM.'}
            </Text>
          </View>
        </View>
      )}

      {phase === 'status' && (
        <View>
          {sehriStatusLoading ? (
            <View style={[hs.voteStatus, { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.04)' }]}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={[hs.voteStatusText, { color: COLORS.textSecondary }]}>Loading your Sehri status...</Text>
            </View>
          ) : (
            <View style={[hs.voteStatus, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
              <Text style={{ fontSize: 16 }}>{statusStyle.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[hs.voteStatusText, { color: statusStyle.color, fontWeight: '700' }]}>
                  {status === 'confirmed' ? 'Sehri Confirmed — your Sehri will be arranged'
                    : status === 'no' ? 'No Sehri for you today'
                    : status === 'pending' ? 'Awaiting confirmation'
                    : 'No response recorded'}
                </Text>
                {sehriStatus?.reason ? <Text style={hs.closedText}>{sehriStatus.reason}</Text> : null}
              </View>
            </View>
          )}

        </View>
      )}

      {phase === 'closed' && (
        <View style={hs.specialCaseSection}>
          <View style={hs.specialCaseHeader}>
            <Ionicons name="lock-closed-outline" size={15} color={COLORS.textMuted} />
            <Text style={hs.specialCaseLabel}>Special Case</Text>
            <Text style={hs.specialCaseText}>Window closed</Text>
          </View>
          {isSpecialCase && (
            <View style={hs.specialCaseBadge}>
              <Text style={hs.specialCaseText}>
                {specialCaseType === 'want' ? '✅ You requested Sehri — admin will confirm at 5 PM' : '❌ Opted out — no Sehri'}
              </Text>
            </View>
          )}
          <View style={hs.closedNotice}>
            <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
            <Text style={hs.closedText}>Voting opens at 10:00 PM tonight</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={hs.viewVotersRow} onPress={onViewVoters} activeOpacity={0.75}>
        <View style={hs.zoneCountChip}>
          <Text style={hs.zoneCountNum}>{zoneYesCount}</Text>
          <Text style={hs.zoneCountLabel}> Yes — Your Zone</Text>
        </View>
        <View style={hs.viewVotersBtn}>
          <Text style={hs.viewVotersText}>View voters</Text>
          <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );
}

export default function HomeScreen() {
  const { user, activeRole, isGuest, ramadanActive } = useAuthStore();
  const [unreadBroadcasts, setUnreadBroadcasts] = useState(0);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [poll, setPoll] = useState<any>(null);
  const [pollResponse, setPollResponse] = useState<string | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [zoneYesCount, setZoneYesCount] = useState(0);
  const [pollDisplayLabel, setPollDisplayLabel] = useState('');
  const [pollWindowOpen, setPollWindowOpen] = useState(false);
  const [donationTotal, setDonationTotal] = useState(0);
  const [donationCount, setDonationCount] = useState(0);
  const [isSpecialCase, setIsSpecialCase] = useState(false);
  const [specialCaseType, setSpecialCaseType] = useState<string | null>(null);
  const [specialCaseLoading, setSpecialCaseLoading] = useState(false);
  const [phase, setPhase] = useState('closed');
  const [sehriStatus, setSehriStatus] = useState<any>(null);
  const [sehriStatusLoading, setSehriStatusLoading] = useState(false);
  const [votersModalVisible, setVotersModalVisible] = useState(false);
  const [voters, setVoters] = useState<any[]>([]);
  const [votersLoading, setVotersLoading] = useState(false);
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const loadData = useCallback(async () => {
    // Guests have no token — every call below would 401. Prayer timings are a
    // public endpoint and load separately, so there is nothing to fetch here.
    // Outside Ramadan there is no poll at all.
    if (isGuest || !ramadanActive) return;
    try {
      const pollRes = await api.get(ENDPOINTS.ACTIVE_POLL);
      const d = pollRes.data.data;
      setPoll(d.poll);
      setPollResponse(d.userResponse);
      setZoneYesCount(d.zoneYesCount || 0);
      setPollDisplayLabel(d.displayLabel || '');
      setPollWindowOpen(d.isWindowOpen ?? isPollOpen(new Date()));
      setIsSpecialCase(d.isSpecialCase || false);
      setSpecialCaseType(d.specialCaseType || null);
      const currentPhase = d.phase || (d.isWindowOpen ? 'voting' : 'closed');
      setPhase(currentPhase);
      if (currentPhase === 'status') {
        setSehriStatusLoading(true);
        try {
          const statusRes = await api.get(ENDPOINTS.ACTIVE_POLL_STATUS);
          setSehriStatus(statusRes.data.data);
        } catch {}
        setSehriStatusLoading(false);
      }
    } catch {}
    // Only super admins can see donation summary — skip for regular users
    if (activeRole === 'super_admin') {
      try {
        const donRes = await api.get(ENDPOINTS.DONATION_SUMMARY);
        setDonationTotal(donRes.data.data.total_amount || 0);
        setDonationCount(donRes.data.data.total_donations || 0);
      } catch {}
    }
  }, [activeRole, isGuest, ramadanActive]);

  useEffect(() => { loadData(); }, []);

  // Auto-refresh when screen comes into focus (poll toggle, etc.)
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Re-check on every focus so the badge clears as soon as they come back
  // from reading the feed.
  useFocusEffect(useCallback(() => {
    useAuthStore.getState().refreshSettings();
    if (isGuest) { setUnreadBroadcasts(0); return; }
    getUnreadBroadcastCount().then(setUnreadBroadcasts);
  }, [isGuest]));

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const submitPollResponse = (response: 'yes' | 'no') => {
    if (!poll) return;
    const isChanging = pollResponse !== null;
    const label = response === 'yes' ? 'Yes, I need Sehri' : 'No, I do not want Sehri';
    Alert.alert(
      isChanging ? 'Change Your Vote?' : 'Confirm Your Vote',
      isChanging ? `You voted "${pollResponse === 'yes' ? 'Yes' : 'No'}". Change to "${label}"?` : `Vote "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            try { setPollLoading(true); await api.post(ENDPOINTS.POLL_RESPOND(poll.id), { response }); setPollResponse(response); if (response === 'yes') setZoneYesCount((c) => c + 1); else if (response === 'no' && pollResponse === 'yes') setZoneYesCount((c) => Math.max(0, c - 1)); Toast.show({ type: 'success', text1: response === 'yes' ? "✅ Noted! We'll prepare your Sehri" : "✅ Noted! May Allah accept your fast" }); }
            catch (err: any) { Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to submit' }); }
            finally { setPollLoading(false); }
          },
        },
      ]
    );
  };

  const submitSpecialCase = (type: 'want' | 'dont_want') => {
    if (!poll) return;
    const label = type === 'want' ? 'I need Sehri' : 'I do not want Sehri';
    Alert.alert('Confirm Special Case', `Submit "${label}" outside voting window?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', onPress: async () => {
          try { setSpecialCaseLoading(true); await api.post(ENDPOINTS.POLL_SPECIAL_CASE(poll.id), { type }); setIsSpecialCase(true); setSpecialCaseType(type); Toast.show({ type: 'success', text1: type === 'want' ? '✅ Special case noted' : '✅ Preference updated' }); }
          catch (err: any) { Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed' }); }
          finally { setSpecialCaseLoading(false); }
        },
      },
    ]);
  };

  const undoSpecialCase = () => {
    if (!poll || !isSpecialCase) return;
    Alert.alert('Undo Special Case', 'Undo your special case request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Undo', style: 'destructive', onPress: async () => {
        try { setSpecialCaseLoading(true); await api.post(ENDPOINTS.POLL_SPECIAL_CASE_UNDO(poll.id)); setIsSpecialCase(false); setSpecialCaseType(null); Toast.show({ type: 'success', text1: '↩️ Special case undone' }); }
        catch (err: any) { Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed' }); }
        finally { setSpecialCaseLoading(false); }
      } },
    ]);
  };

  const openVoters = async () => {
    if (!poll) return;
    setVotersModalVisible(true); setVotersLoading(true);
    try { const res = await api.get(ENDPOINTS.POLL_ZONE_VOTERS(poll.id)); setVoters(res.data.data.voters || []); }
    catch { Toast.show({ type: 'error', text1: 'Could not load voters' }); }
    finally { setVotersLoading(false); }
  };

  const zoneInfo = user?.zone ? (ZONE_CONFIG as any)[user.zone] : null;

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        <ExpoGoNotice />
        <Animated.View style={{ opacity: headerFade }}>
          <View style={styles.header}>
            <IslamicGeometric opacity={0.07} size={RESPONSIVE.width * 0.9} />
            <View style={styles.headerContent}>
              <View style={styles.greetingBlock}>
                <Text style={styles.assalam}>Assalamualaikum</Text>
                <Text style={styles.fullName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{user?.name || 'Friend'}</Text>
                {zoneInfo && (
                  <View style={[styles.zoneBadge, { borderColor: zoneInfo.color }]}>
                    <Text style={styles.zoneEmoji}>{zoneInfo.emoji}</Text>
                    <Text style={[styles.zoneText, { color: zoneInfo.color }]}>{zoneInfo.label}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => router.push('/(app)/profile')} activeOpacity={0.85}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.avatar}>
                  <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <View style={styles.content}>
          <PrayerHeroCard />
          <StarDivider />

          {!isGuest && ramadanActive && (
          <>
          <Text style={styles.sectionTitle}>🗳️ Today's Sehri Poll</Text>
          {poll ? (
            <TomorrowPollCard
              poll={poll} userResponse={pollResponse} zoneYesCount={zoneYesCount}
              pollLoading={pollLoading} sehriDateLabel={pollDisplayLabel}
              phase={phase} isSpecialCase={isSpecialCase}
              specialCaseType={specialCaseType} specialCaseLoading={specialCaseLoading}
              sehriStatus={sehriStatus} sehriStatusLoading={sehriStatusLoading}
              sehriAllowed={pollResponse ? (isSpecialCase ? (sehriStatus?.sehriAllowed ?? null) : null) : null}
              onVote={submitPollResponse} onSpecialCase={submitSpecialCase}
              onUndoSpecialCase={undoSpecialCase} onViewVoters={openVoters}
            />
          ) : (
            <LinearGradient colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']} style={styles.pollSkeleton}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={styles.skeletonText}>Loading poll...</Text>
            </LinearGradient>
          )}

          {donationTotal > 0 && (
            <LinearGradient colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']} style={hs.donationHomeCard}>
              <Text style={hs.donationHomeLabel}>💰 Total Donations Collected</Text>
              <Text style={hs.donationHomeAmount}>₹{Number(donationTotal).toLocaleString()}</Text>
              {donationCount > 0 && <Text style={hs.donationHomeSub}>{donationCount} donations</Text>}
              {activeRole === 'super_admin' && (
                <TouchableOpacity
                  style={hs.viewDonationsBtn}
                  onPress={() => router.push('/(app)/admin/donation-history' as any)}
                  activeOpacity={0.75}
                >
                  <Text style={hs.viewDonationsText}>View Donations →</Text>
                </TouchableOpacity>
              )}
            </LinearGradient>
          )}

          </>
          )}

          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionCard icon="📖" title="Al-Quran" subtitle="Read the Quran" color="#1A6B3C" onPress={() => router.push('/(app)/quran/surah' as any)} />
            <ActionCard icon="🤲" title="Duas" subtitle="Daily supplications" color="#8B5CF6" onPress={() => router.push('/(app)/dua' as any)} />
            {/* Tracking and donating both need an account, so they are not
                offered to guests — the prompt above already explains why. */}
            <ActionCard icon="🎁" title="Donate" subtitle="Support Sehri" color={COLORS.accentGreen} onPress={() => router.push('/(app)/donation')} />
            {/* Announcements are per-zone, so a guest has no feed to read. */}
            {!isGuest && (
              <ActionCard
                icon="📢"
                title="Announcements"
                subtitle={unreadBroadcasts > 0
                  ? `${unreadBroadcasts} new update${unreadBroadcasts > 1 ? 's' : ''}`
                  : 'Updates from admins'}
                color={COLORS.accentPurple}
                badge={unreadBroadcasts}
                onPress={() => router.push('/(app)/broadcast' as any)}
              />
            )}
            {/* Tracking is tied to the donor's delivery zone, so it stays
                behind sign-in — and there is nothing to track outside Ramadan. */}
            {!isGuest && ramadanActive && (
              <ActionCard icon="🛵" title="Live Track" subtitle="Track your rider" color={COLORS.accent} onPress={() => router.push('/(app)/tracking')} />
            )}
          </View>

          <LinearGradient colors={['rgba(26,10,46,0.8)', 'rgba(10,10,30,0.9)']} style={styles.ramzanBanner}>
            <Text style={styles.ramzanIcon}>🌙</Text>
            <Text style={styles.ramzanText}>Ramzan Mubarak!</Text>
            <Text style={styles.ramzanSubtext}>May Allah accept your fasts and prayers. Ameen. 🤲</Text>
          </LinearGradient>
        </View>
      </ScrollView>

      <Modal visible={votersModalVisible} animationType="slide" transparent onRequestClose={() => setVotersModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{zoneInfo?.emoji} {zoneInfo?.label} — Yes Voters</Text>
              <TouchableOpacity onPress={() => setVotersModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>{voters.length} confirmed for Sehri</Text>
            {votersLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ padding: 24 }} />
            ) : voters.length === 0 ? (
              <View style={styles.emptyVoters}>
                <Text style={{ fontSize: 44 }}>🌙</Text>
                <Text style={styles.emptyText}>No one from your zone yet</Text>
              </View>
            ) : (() => {
              const grouped: Record<string, any[]> = {};
              voters.forEach((v: any) => { const addr = v.address || 'Unknown'; if (!grouped[addr]) grouped[addr] = []; grouped[addr].push(v); });
              return (
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  {Object.entries(grouped).map(([addr, members]) => (
                    <View key={addr} style={styles.addrGroup}>
                      <View style={styles.addrGroupHeader}>
                        <Ionicons name="location-outline" size={12} color={COLORS.primary} />
                        <Text style={styles.addrGroupLabel}>{addr}</Text>
                        <View style={styles.addrGroupCount}><Text style={styles.addrGroupCountText}>{members.length}</Text></View>
                      </View>
                      {members.map((item: any, i: number) => (
                        <View key={item.id || i} style={styles.voterRow}>
                          <LinearGradient colors={[`${COLORS.primary}25`, `${COLORS.primary}08`]} style={styles.voterAvatar}>
                            <Text style={styles.voterAvatarText}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                          </LinearGradient>
                          <Text style={styles.voterName}>{item.name}</Text>
                          {item.type === 'special' ? (
                            <View style={styles.voterBadgeSpecial}><Text style={styles.voterBadgeSpecialText}>⭐ Special</Text></View>
                          ) : (
                            <View style={styles.voterBadge}><Text style={styles.voterBadgeText}>✅ Yes</Text></View>
                          )}
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
    </LinearGradient>
  );
}

function ActionCard({ icon, title, subtitle, color, onPress, badge }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.actionCard}>
      <LinearGradient colors={[`${color}22`, `${color}08`]} style={styles.actionCardGradient}>
        <View style={[styles.actionIconBg, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
          <Text style={styles.actionIcon}>{icon}</Text>
        </View>
        {/* Unread count — sits on the card corner so it reads at a glance */}
        {badge > 0 && (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeTxt}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actionBadge: {
    position: 'absolute', top: 8, right: 8,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.accentRed,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5, borderColor: COLORS.background,
  },
  actionBadgeTxt: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  header: { paddingTop: RESPONSIVE.hp(7), paddingBottom: 16, overflow: 'hidden' },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginTop: 8 },
  greetingBlock: { flex: 1, marginRight: 12 },
  assalam: { color: COLORS.primary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  fullName: { color: COLORS.textPrimary, fontSize: RESPONSIVE.isSmall ? 15 : 17, fontWeight: '700', lineHeight: 22 },
  zoneBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', gap: 4 },
  zoneEmoji: { fontSize: 12 },
  zoneText: { fontSize: 11, fontWeight: '700' },
  avatar: { width: RESPONSIVE.isSmall ? 44 : 50, height: RESPONSIVE.isSmall ? 44 : 50, borderRadius: RESPONSIVE.isSmall ? 22 : 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.textOnPrimary, fontSize: RESPONSIVE.isSmall ? 18 : 20, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  pollSkeleton: { height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  skeletonText: { color: COLORS.textMuted, fontSize: 13 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: CARD_W, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  actionCardGradient: { padding: 16, alignItems: 'center', minHeight: 120, justifyContent: 'center' },
  actionIconBg: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionIcon: { fontSize: 24 },
  actionTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  actionSubtitle: { color: COLORS.textMuted, fontSize: 10, textAlign: 'center' },
  ramzanBanner: { marginTop: 20, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  ramzanIcon: { fontSize: 32, marginBottom: 4 },
  ramzanText: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  ramzanSubtext: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 44, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', flex: 1 },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 16 },
  emptyVoters: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  voterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  voterAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  voterAvatarText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  voterName: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  voterBadge: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  voterBadgeText: { color: COLORS.accentGreen, fontSize: 11, fontWeight: '700' },
  voterBadgeSpecial: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)' },
  voterBadgeSpecialText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  addrGroup: { marginBottom: 12 },
  addrGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.15)' },
  addrGroupLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '700', flex: 1 },
  addrGroupCount: { backgroundColor: 'rgba(201,168,76,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  addrGroupCountText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
});

const hs = StyleSheet.create({
  heroCard: { borderRadius: 20, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', ...SHADOWS.md },
  dateStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateLeft: { flex: 1 },
  hijriDate: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  gregorianDate: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  dividerLine: { height: 1, backgroundColor: 'rgba(201,168,76,0.15)', marginBottom: 12 },
  prayerRow: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  prayerItem: { flex: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden', minHeight: 90, justifyContent: 'center' },
  activeDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4 },
  prayerIcon: { fontSize: 20, marginBottom: 4 },
  prayerName: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  prayerTime: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700' },
  nowBadge: { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  nowBadgeText: { fontSize: 6, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  bangaloreNote: { color: COLORS.textMuted, fontSize: 9, textAlign: 'right', marginTop: 10 },
  pollCard: { borderRadius: 20, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', ...SHADOWS.md },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  pollTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pollIcon: { fontSize: 22 },
  pollTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  pollSubtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  voteStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1 },
  voteStatusText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },
  specialCaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, backgroundColor: 'rgba(255,152,0,0.08)', borderColor: 'rgba(255,152,0,0.35)' },
  specialCaseText: { color: COLORS.accentOrange, fontSize: 12, flex: 1, lineHeight: 18, fontWeight: '600' },
  specialCaseInfo: { backgroundColor: 'rgba(76,175,80,0.08)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(76,175,80,0.25)', marginBottom: 8 },
  specialCaseInfoText: { color: COLORS.accentGreen, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  specialCaseSection: { backgroundColor: 'rgba(255,152,0,0.06)', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,152,0,0.2)', gap: 8 },
  specialCaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  specialCaseLabel: { color: COLORS.accentOrange, fontSize: 12, fontWeight: '700' },
  pollActions: { marginBottom: 10, gap: 8 },
  closedNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: 'rgba(255,152,0,0.08)', borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,152,0,0.25)' },
  closedText: { color: COLORS.accentOrange, fontSize: 12, fontWeight: '600' },
  viewVotersRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 4 },
  zoneCountChip: { flexDirection: 'row', alignItems: 'baseline' },
  zoneCountNum: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
  zoneCountLabel: { color: COLORS.textSecondary, fontSize: 11 },
  viewVotersBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewVotersText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  donationHomeCard: { borderRadius: 20, padding: 16, marginTop: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', ...SHADOWS.md },
  donationHomeLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  donationHomeAmount: { color: COLORS.primary, fontSize: 32, fontWeight: '800', marginTop: 4 },
  donationHomeSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  viewDonationsBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.1)' },
  viewDonationsText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
});
