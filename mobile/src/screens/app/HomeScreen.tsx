import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ZONE_CONFIG } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import PremiumCard from '../../components/ui/PremiumCard';
import GoldButton from '../../components/ui/GoldButton';
import { CrescentMoon, IslamicGeometric } from '../../components/ui/IslamicPattern';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import Toast from 'react-native-toast-message';

// ─────────────────────────────────────────────────────────────────────────────
// ALADHAN API — live prayer times for Bangalore (method 1 = Karachi/MWL)
// https://api.aladhan.com/v1/timingsByCity
// ─────────────────────────────────────────────────────────────────────────────
interface PrayerSlot {
  key: string;
  name: string;
  time: string;   // "HH:MM" 24-hr
  icon: string;
  color: string;
}

const PRAYER_META: Record<string, { name: string; icon: string; color: string }> = {
  Tahajjud: { name: 'Tahajjud', icon: '🌌', color: '#7B68EE' },
  Imsak:    { name: 'Sehri End', icon: '🍽️', color: '#C9A84C' },
  Fajr:     { name: 'Fajr',     icon: '🌅', color: '#FF8C69' },
  Sunrise:  { name: 'Sunrise',  icon: '☀️',  color: '#FFD700' },
  Dhuhr:    { name: 'Dhuhr',   icon: '🕛', color: '#4FC3F7' },
  Asr:      { name: 'Asr',     icon: '🕓', color: '#FF9800' },
  Maghrib:  { name: 'Maghrib / Iftar', icon: '🌇', color: '#EF5350' },
  Isha:     { name: 'Isha',    icon: '🌙', color: '#AB47BC' },
};

// Keys we show, in order
const SHOW_KEYS = ['Tahajjud', 'Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

async function fetchPrayerTimes(): Promise<PrayerSlot[]> {
  try {
    const res = await fetch(
      'https://api.aladhan.com/v1/timingsByCity?city=Bangalore&country=India&method=1'
    );
    const json = await res.json();
    const timings = json?.data?.timings;
    if (!timings) throw new Error('No timings');

    // Aladhan returns "HH:MM (IST)" — strip timezone label
    const clean = (t: string) => t.replace(/\s*\(.*\)/, '').trim();

    // Compute Tahajjud = last third of night (between Isha and Fajr)
    const ishaMin  = toMinutes(clean(timings.Isha));
    const fajrMin  = toMinutes(clean(timings.Fajr));
    const nightDur = (fajrMin + 1440 - ishaMin) % 1440;
    const tahajjudMin = (ishaMin + Math.floor(nightDur * 2 / 3)) % 1440;
    const tahajjudTime = `${String(Math.floor(tahajjudMin / 60)).padStart(2, '0')}:${String(tahajjudMin % 60).padStart(2, '0')}`;

    const slots: PrayerSlot[] = SHOW_KEYS.map((key) => {
      const rawTime = key === 'Tahajjud' ? tahajjudTime : clean(timings[key] || '00:00');
      return {
        key,
        name: PRAYER_META[key].name,
        time: rawTime,
        icon: PRAYER_META[key].icon,
        color: PRAYER_META[key].color,
      };
    });
    // Sort by time ascending
    slots.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
    return slots;
  } catch {
    // Fallback to Bangalore approximate times
    return [
      { key: 'Tahajjud', name: 'Tahajjud',        time: '03:30', icon: '🌌', color: '#7B68EE' },
      { key: 'Imsak',    name: 'Sehri End',        time: '05:10', icon: '🍽️', color: '#C9A84C' },
      { key: 'Fajr',     name: 'Fajr',             time: '05:20', icon: '🌅', color: '#FF8C69' },
      { key: 'Sunrise',  name: 'Sunrise',           time: '06:28', icon: '☀️',  color: '#FFD700' },
      { key: 'Dhuhr',    name: 'Dhuhr',            time: '12:35', icon: '🕛', color: '#4FC3F7' },
      { key: 'Asr',      name: 'Asr',              time: '16:00', icon: '🕓', color: '#FF9800' },
      { key: 'Maghrib',  name: 'Maghrib / Iftar',  time: '18:45', icon: '🌇', color: '#EF5350' },
      { key: 'Isha',     name: 'Isha',             time: '20:00', icon: '🌙', color: '#AB47BC' },
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getActivePrayer(nowMinutes: number, slots: PrayerSlot[]): string {
  for (let i = slots.length - 1; i >= 0; i--) {
    if (nowMinutes >= toMinutes(slots[i].time)) return slots[i].key;
  }
  return slots[slots.length - 1]?.key || '';
}

function getApproxHijri(): string {
  const MONTHS = ['Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Ula','Jumada al-Akhira','Rajab',"Sha'ban",'Ramadan','Shawwal',"Dhu al-Qi'dah",'Dhu al-Hijjah'];
  const now = new Date();
  const jd = Math.floor(now.getTime() / 86400000 + 2440587.5);
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return `${day} ${MONTHS[(month - 1) % 12]} ${year} AH`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Poll window helpers
// ─────────────────────────────────────────────────────────────────────────────
const POLL_OPEN_HOUR  = 22; // 10 PM IST
const POLL_CLOSE_HOUR = 10;

// Client-side fallback — server always sends the authoritative isWindowOpen
function isPollOpen(now: Date): boolean {
  const h = now.getHours();
  return h >= POLL_OPEN_HOUR || h < POLL_CLOSE_HOUR;
}

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Prayer Times Hero Card — fetches live from Aladhan API
// ─────────────────────────────────────────────────────────────────────────────
function PrayerHeroCard() {
  const [slots, setSlots]       = useState<PrayerSlot[]>([]);
  const [prayerLoading, setPrayerLoading] = useState(true);
  const [nowMin, setNowMin]     = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  const hijri    = getApproxHijri();
  const gregorian = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    fetchPrayerTimes().then((s) => { setSlots(s); setPrayerLoading(false); });
    const t = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60000);
    return () => clearInterval(t);
  }, []);

  const active = slots.length > 0 ? getActivePrayer(nowMin, slots) : '';

  return (
    <LinearGradient
      colors={['rgba(201,168,76,0.18)', 'rgba(13,27,42,0.95)', 'rgba(10,16,35,1)']}
      style={hs.heroCard}
    >
      {/* Date strip */}
      <View style={hs.dateStrip}>
        <View style={hs.dateLeft}>
          <Text style={hs.hijriDate}>{hijri}</Text>
          <Text style={hs.gregorianDate}>{gregorian}</Text>
        </View>
        <CrescentMoon size={32} color={COLORS.primary} />
      </View>

      <View style={hs.dividerLine} />

      {/* Prayer grid */}
      {prayerLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 8 }}>Loading prayer times...</Text>
        </View>
      ) : (
        <View style={hs.prayerGrid}>
          {slots.map((p) => {
            const isActive = p.key === active;
            return (
              <LinearGradient
                key={p.key}
                colors={isActive ? [`${p.color}40`, `${p.color}18`] : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                style={[hs.prayerItem, isActive && { borderColor: p.color, borderWidth: 1.5 }]}
              >
                {isActive && <View style={[hs.activeDot, { backgroundColor: p.color }]} />}
                <Text style={hs.prayerIcon}>{p.icon}</Text>
                <Text style={[hs.prayerName, isActive && { color: p.color, fontWeight: '700' }]}>{p.name}</Text>
                <Text style={[hs.prayerTime, isActive && { color: p.color }]}>{p.time}</Text>
                {isActive && <Text style={[hs.nowBadge, { color: p.color, borderColor: p.color }]}>NOW</Text>}
              </LinearGradient>
            );
          })}
        </View>
      )}

      <Text style={hs.bangaloreNote}>Live prayer times • Bangalore, India</Text>
    </LinearGradient>
  );
}

// sehriDateLabel comes from server (displayLabel field in getActivePoll response)
function TomorrowPollCard({
  poll, userResponse, zoneYesCount, pollLoading,
  sehriDateLabel, isWindowOpen, isSpecialCase, specialCaseType,
  specialCaseLoading, onVote, onSpecialCase, onUndoSpecialCase, onViewVoters,
}: {
  poll: any; userResponse: string | null; zoneYesCount: number;
  pollLoading: boolean; sehriDateLabel: string; isWindowOpen: boolean;
  isSpecialCase: boolean; specialCaseType: string | null;
  specialCaseLoading: boolean;
  onVote: (r: 'yes' | 'no') => void;
  onSpecialCase: (t: 'want' | 'dont_want') => void;
  onUndoSpecialCase: () => void;
  onViewVoters: () => void;
}) {
  const open = isWindowOpen;
  // Normal voting buttons — only when poll is OPEN
  const showDontWant    = open && userResponse === 'yes';
  const showWantSehri   = open && userResponse !== 'yes';
  // Special case buttons — only when poll is CLOSED
  // Allow changing: if a special case exists, show the opposite option too
  const showSpecialDontWant = !open && specialCaseType !== 'dont_want' && (userResponse === 'yes' || isSpecialCase);
  const showSpecialWant     = !open && specialCaseType !== 'want' && (userResponse !== 'yes' || isSpecialCase);
  const showUndoSpecialCase = isSpecialCase;

  return (
    <PremiumCard style={hs.pollCard}>
      {/* Header */}
      <View style={hs.pollHeader}>
        <View style={hs.pollTitleGroup}>
          <Text style={hs.pollIcon}>🗳️</Text>
          <View>
            <Text style={hs.pollTitle}>Sehri for {sehriDateLabel}</Text>
            <Text style={hs.pollSubtitle}>Voting window: 10:00 PM — 10:00 AM</Text>
          </View>
        </View>
        {/* Status pill — open/closed */}
        <View style={[hs.statusPill, { borderColor: open ? '#4CAF50' : '#FF9800' }]}>
          <View style={[hs.statusDot, { backgroundColor: open ? '#4CAF50' : '#FF9800' }]} />
          <Text style={[hs.statusText, { color: open ? '#4CAF50' : '#FF9800' }]}>
            {open ? 'Open' : 'Closed'}
          </Text>
        </View>
      </View>

      {/* Current vote status — only show when poll is OPEN */}
      {open && userResponse && (
        <View style={[hs.voteStatus, {
          backgroundColor: userResponse === 'yes' ? 'rgba(76,175,80,0.12)' : 'rgba(239,83,80,0.12)',
          borderColor: userResponse === 'yes' ? 'rgba(76,175,80,0.4)' : 'rgba(239,83,80,0.4)',
        }]}>
          <Text style={{ fontSize: 16 }}>{userResponse === 'yes' ? '✅' : '❌'}</Text>
          <Text style={[hs.voteStatusText, { color: userResponse === 'yes' ? '#4CAF50' : '#EF5350' }]}>
            {userResponse === 'yes' ? 'You voted: Yes — Sehri will be arranged' : 'You voted: No'}
          </Text>
        </View>
      )}

      {/* Normal window buttons — only when OPEN */}
      {open && (
        <View style={hs.pollActions}>
          {showWantSehri && (
            <GoldButton title="Yes, I need Sehri" onPress={() => onVote('yes')} loading={pollLoading} size="md" />
          )}
          {showDontWant && (
            <GoldButton title="I don't want Sehri" onPress={() => onVote('no')} loading={pollLoading} variant="outline" size="md" />
          )}
        </View>
      )}

      {/* CLOSED state — show special case section */}
      {!open && (
        <View style={hs.specialCaseSection}>
          {/* Header */}
          <View style={hs.specialCaseHeader}>
            <Ionicons name="alert-circle-outline" size={15} color="#FF9800" />
            <Text style={hs.specialCaseLabel}>Special Case</Text>
            <Text style={hs.specialCaseText}>Voting window is closed</Text>
          </View>

          {/* Already submitted special case badge */}
          {isSpecialCase && (
            <View style={hs.specialCaseBadge}>
              <Text style={hs.specialCaseText}>
                {specialCaseType === 'want'
                  ? '✅ You requested Sehri outside voting window'
                  : '❌ You opted out outside voting window'}
              </Text>
            </View>
          )}

          {/* Undo special case */}
          {showUndoSpecialCase && (
            <GoldButton
              title="Undo Special Case"
              onPress={onUndoSpecialCase}
              loading={specialCaseLoading}
              variant="outline"
              size="sm"
              style={{ marginTop: 4 }}
            />
          )}

          {/* Special case buttons — shown if not yet submitted for this type */}
          {showSpecialWant && (
            <GoldButton
              title="I need Sehri (Special Case)"
              onPress={() => onSpecialCase('want')}
              loading={specialCaseLoading}
              size="sm"
              style={{ marginTop: 8 }}
            />
          )}
          {showSpecialDontWant && (
            <GoldButton
              title="I don't want Sehri (Special Case)"
              onPress={() => onSpecialCase('dont_want')}
              loading={specialCaseLoading}
              variant="outline"
              size="sm"
              style={{ marginTop: 8 }}
            />
          )}

          {/* No action available — neither button applies */}
          {!showSpecialWant && !showSpecialDontWant && !isSpecialCase && (
            <View style={hs.closedNotice}>
              <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
              <Text style={hs.closedText}>Voting opens at 10:00 PM tonight</Text>
            </View>
          )}
        </View>
      )}

      {/* Zone count + view voters */}
      <TouchableOpacity style={hs.viewVotersRow} onPress={onViewVoters} activeOpacity={0.75}>
        <View style={hs.zoneCountChip}>
          <Text style={hs.zoneCountNum}>{zoneYesCount}</Text>
          <Text style={hs.zoneCountLabel}> Yes from your zone</Text>
        </View>
        <View style={hs.viewVotersBtn}>
          <Text style={hs.viewVotersText}>View voters</Text>
          <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    </PremiumCard>
  );
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [refreshing, setRefreshing]           = useState(false);
  const [poll, setPoll]                       = useState<any>(null);
  const [pollResponse, setPollResponse]       = useState<string | null>(null);
  const [pollLoading, setPollLoading]         = useState(false);
  const [zoneYesCount, setZoneYesCount]       = useState(0);
  const [pollDisplayLabel, setPollDisplayLabel] = useState('');
  const [pollWindowOpen, setPollWindowOpen]   = useState(false);
  const [isSpecialCase, setIsSpecialCase]     = useState(false);
  const [specialCaseType, setSpecialCaseType] = useState<string | null>(null);
  const [specialCaseLoading, setSpecialCaseLoading] = useState(false);
  const [votersModalVisible, setVotersModalVisible] = useState(false);
  const [voters, setVoters]                   = useState<any[]>([]);
  const [votersLoading, setVotersLoading]     = useState(false);

  const loadData = useCallback(async () => {
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
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const submitPollResponse = (response: 'yes' | 'no') => {
    if (!poll) return;
    const isChanging = pollResponse !== null;
    const label = response === 'yes' ? 'Yes, I need Sehri' : 'No, I do not want Sehri';
    const title = isChanging ? 'Change Your Vote?' : 'Confirm Your Vote';
    const msg = isChanging
      ? `You currently voted "${pollResponse === 'yes' ? 'Yes' : 'No'}". Are you sure you want to change your vote to "${label}"?`
      : `Are you sure you want to vote "${label}"?`;

    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            setPollLoading(true);
            await api.post(ENDPOINTS.POLL_RESPOND(poll.id), { response });
            setPollResponse(response);
            if (response === 'yes') setZoneYesCount((c) => c + 1);
            else if (response === 'no' && pollResponse === 'yes') setZoneYesCount((c) => Math.max(0, c - 1));
            Toast.show({ type: 'success', text1: response === 'yes' ? "Noted! We'll prepare your Sehri" : 'Noted! May Allah accept your fast' });
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to submit' });
          } finally { setPollLoading(false); }
        },
      },
    ]);
  };

  const submitSpecialCase = (type: 'want' | 'dont_want') => {
    if (!poll) return;
    const isChanging = isSpecialCase && specialCaseType !== type;
    const label = type === 'want' ? 'I need Sehri' : 'I do not want Sehri';
    const title = isChanging ? 'Change Special Case?' : 'Confirm Special Case';

    Alert.alert(title, `Are you sure you want to submit "${label}" (outside voting window)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            setSpecialCaseLoading(true);
            await api.post(ENDPOINTS.POLL_SPECIAL_CASE(poll.id), { type });
            setIsSpecialCase(true);
            setSpecialCaseType(type);
            Toast.show({ type: 'success', text1: type === 'want' ? 'Special case noted — we will try to arrange Sehri' : 'Special case noted — your preference updated' });
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to submit' });
          } finally { setSpecialCaseLoading(false); }
        },
      },
    ]);
  };

  const undoSpecialCase = () => {
    if (!poll || !isSpecialCase) return;
    Alert.alert('Undo Special Case', 'Are you sure you want to undo your special case request? Your original vote will remain unchanged.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo', style: 'destructive',
        onPress: async () => {
          try {
            setSpecialCaseLoading(true);
            await api.post(ENDPOINTS.POLL_SPECIAL_CASE_UNDO(poll.id));
            setIsSpecialCase(false);
            setSpecialCaseType(null);
            Toast.show({ type: 'success', text1: 'Special case undone' });
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to undo special case' });
          } finally { setSpecialCaseLoading(false); }
        },
      },
    ]);
  };

  const openVoters = async () => {
    if (!poll) return;
    setVotersModalVisible(true);
    setVotersLoading(true);
    try {
      const res = await api.get(ENDPOINTS.POLL_ZONE_VOTERS(poll.id));
      setVoters(res.data.data.voters || []);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load voters' });
    } finally { setVotersLoading(false); }
  };

  const zoneInfo = user?.zone ? (ZONE_CONFIG as any)[user.zone] : null;

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <IslamicGeometric opacity={0.08} size={width * 0.9} />
          <View style={styles.headerContent}>
            <View style={styles.greetingBlock}>
              <Text style={styles.assalam}>Assalamualaikum</Text>
              <Text style={styles.fullName}>{user?.name || 'Friend'}</Text>
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

        <View style={styles.content}>
          <PrayerHeroCard />
          <Text style={styles.sectionTitle}>Sehri Poll</Text>
          {poll ? (
            <TomorrowPollCard
              poll={poll}
              userResponse={pollResponse}
              zoneYesCount={zoneYesCount}
              pollLoading={pollLoading}
              sehriDateLabel={pollDisplayLabel}
              isWindowOpen={pollWindowOpen}
              isSpecialCase={isSpecialCase}
              specialCaseType={specialCaseType}
              specialCaseLoading={specialCaseLoading}
              onVote={submitPollResponse}
              onSpecialCase={submitSpecialCase}
              onUndoSpecialCase={undoSpecialCase}
              onViewVoters={openVoters}
            />
          ) : (
            <View style={styles.pollSkeleton}>
              <Text style={styles.skeletonText}>Loading poll...</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionCard icon="��" title="Donate" subtitle="Support Sehri" color={COLORS.accentGreen} onPress={() => router.push('/(app)/donation')} />
            <ActionCard icon="🛵" title="Live Track" subtitle="Track your rider" color={COLORS.accent} onPress={() => router.push('/(app)/tracking')} />
            <ActionCard icon="💬" title="Feedback" subtitle="Share thoughts" color={COLORS.accentOrange} onPress={() => router.push('/(app)/feedback')} />
            <ActionCard icon="📅" title="Poll History" subtitle="View your responses" color="#FF9800" onPress={() => router.push('/(app)/poll-history')} />
          </View>

          <LinearGradient colors={['#1a0a2e', '#0a0a1e']} style={styles.ramzanBanner}>
            <Text style={styles.ramzanText}>Ramzan Mubarak!</Text>
            <Text style={styles.ramzanSubtext}>May Allah accept your fasts and prayers. Ameen.</Text>
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
            <Text style={styles.modalSubtitle}>{voters.length} confirmed Sehri</Text>
            {votersLoading ? (
              <Text style={styles.loadingText}>Loading...</Text>
            ) : voters.length === 0 ? (
              <View style={styles.emptyVoters}>
                <Text style={{ fontSize: 40 }}>🌙</Text>
                <Text style={styles.emptyText}>No one from your zone yet</Text>
              </View>
            ) : (() => {
              // Group by address, sorted (already sorted from backend)
              const grouped: Record<string, any[]> = {};
              voters.forEach((v: any) => {
                const addr = v.address || 'Unknown Address';
                if (!grouped[addr]) grouped[addr] = [];
                grouped[addr].push(v);
              });
              return (
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  {Object.entries(grouped).map(([addr, members]) => (
                    <View key={addr} style={styles.addrGroup}>
                      <View style={styles.addrGroupHeader}>
                        <Ionicons name="location-outline" size={12} color={COLORS.primary} />
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
                          <View style={styles.voterBadge}><Text style={styles.voterBadgeText}>Yes</Text></View>
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

function ActionCard({ icon, title, subtitle, color, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.actionCard}>
      <LinearGradient colors={[`${color}22`, `${color}08`]} style={styles.actionCardGradient}>
        <View style={[styles.actionIconBg, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
          <Text style={styles.actionIcon}>{icon}</Text>
        </View>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 16, overflow: 'hidden' },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginTop: 8 },
  greetingBlock: { flex: 1, marginRight: 12 },
  assalam: { color: COLORS.primary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  fullName: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  zoneBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', gap: 4 },
  zoneEmoji: { fontSize: 12 },
  zoneText: { fontSize: 11, fontWeight: '700' },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.textOnPrimary, fontSize: 20, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  pollSkeleton: { height: 80, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  skeletonText: { color: COLORS.textMuted, fontSize: 13 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: (width - 32 - 10) / 2 - 5, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  actionCardGradient: { padding: 16, alignItems: 'center', minHeight: 120, justifyContent: 'center' },
  actionIconBg: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionIcon: { fontSize: 24 },
  actionTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  actionSubtitle: { color: COLORS.textMuted, fontSize: 10, textAlign: 'center' },
  ramzanBanner: { marginTop: 20, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  ramzanText: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  ramzanSubtext: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0D1B2A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 44, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', flex: 1 },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 16 },
  loadingText: { color: COLORS.textMuted, textAlign: 'center', padding: 24, fontSize: 14 },
  emptyVoters: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  voterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  voterAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(201,168,76,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  voterAvatarText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  voterName: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  voterBadge: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  voterBadgeText: { color: '#4CAF50', fontSize: 11, fontWeight: '700' },
  addrGroup: { marginBottom: 12 },
  addrGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.15)' },
  addrGroupLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '700', flex: 1 },
  addrGroupCount: { backgroundColor: 'rgba(201,168,76,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  addrGroupCountText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
});

const hs = StyleSheet.create({
  heroCard: { borderRadius: 20, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)' },
  dateStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateLeft: { flex: 1 },
  hijriDate: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  gregorianDate: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  dividerLine: { height: 1, backgroundColor: 'rgba(201,168,76,0.15)', marginBottom: 12 },
  prayerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prayerItem: { width: (width - 32 - 8 * 3) / 4, borderRadius: 12, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden', minHeight: 82, justifyContent: 'center' },
  activeDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4 },
  prayerIcon: { fontSize: 18, marginBottom: 4 },
  prayerName: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
  prayerTime: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700', marginTop: 3 },
  nowBadge: { fontSize: 8, fontWeight: '800', borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 3, letterSpacing: 0.5 },
  bangaloreNote: { color: COLORS.textMuted, fontSize: 9, textAlign: 'right', marginTop: 10 },
  pollCard: { marginBottom: 4 },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  pollTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pollIcon: { fontSize: 22 },
  pollTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  pollSubtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  countdownBadge: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', gap: 5, alignItems: 'center' },
  countdownDot: { width: 6, height: 6, borderRadius: 3 },
  countdownLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  countdownTime: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  windowInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  windowText: { color: COLORS.textMuted, fontSize: 11 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },  voteStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1 },
  voteStatusText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },
  specialCaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, backgroundColor: 'rgba(255,152,0,0.08)', borderColor: 'rgba(255,152,0,0.35)' },
  specialCaseText: { color: '#FF9800', fontSize: 12, flex: 1, lineHeight: 18, fontWeight: '600' },
  specialCaseSection: { backgroundColor: 'rgba(255,152,0,0.06)', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,152,0,0.2)', gap: 8 },
  specialCaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  specialCaseLabel: { color: '#FF9800', fontSize: 12, fontWeight: '700' },
  pollActions: { marginBottom: 10, gap: 8 },
  closedNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: 'rgba(255,152,0,0.08)', borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,152,0,0.25)' },
  closedText: { color: '#FF9800', fontSize: 12, fontWeight: '600' },
  viewVotersRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 4 },
  zoneCountChip: { flexDirection: 'row', alignItems: 'baseline' },
  zoneCountNum: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
  zoneCountLabel: { color: COLORS.textSecondary, fontSize: 11 },
  viewVotersBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewVotersText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
});
