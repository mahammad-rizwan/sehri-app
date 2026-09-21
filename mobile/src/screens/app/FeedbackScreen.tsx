import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import PremiumCard from '../../components/ui/PremiumCard';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';

const CATEGORIES = [
  { key: 'general', label: 'General', icon: '💬', hint: 'Anything else you want to tell us' },
  { key: 'food_quality', label: 'Food Quality', icon: '🍱', hint: 'Taste, quantity, freshness or packaging' },
  { key: 'distribution', label: 'Distribution', icon: '🛵', hint: 'Timing, delivery or the pickup point' },
  { key: 'suggestion', label: 'Suggestion', icon: '💡', hint: 'An idea to make things better' },
  { key: 'complaint', label: 'Complaint', icon: '⚠️', hint: 'Something went wrong and needs attention' },
];

const RATING_LABELS = ['', 'Very Poor 😞', 'Poor 😕', 'Average 😊', 'Good 👍', 'Excellent 🌟'];

const MIN_CHARS = 5;
const MAX_CHARS = 1000;

type Tab = 'write' | 'mine';

export default function FeedbackScreen() {
  const [tab, setTab] = useState<Tab>('write');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [mine, setMine] = useState<any[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const selected = CATEGORIES.find((c) => c.key === category);
  const trimmed = message.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_CHARS;
  const canSubmit = trimmed.length >= MIN_CHARS && !loading;

  const loadMine = useCallback(async () => {
    try {
      const { data } = await api.get(ENDPOINTS.MY_FEEDBACK);
      setMine(data.data || []);
    } catch {
      // Non-fatal — the write tab still works without history.
    } finally {
      setLoadingMine(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine]);

  const handleSubmit = async () => {
    if (trimmed.length < MIN_CHARS) {
      Toast.show({ type: 'error', text1: `Please write at least ${MIN_CHARS} characters` });
      return;
    }
    try {
      setLoading(true);
      await api.post(ENDPOINTS.FEEDBACK, {
        message: trimmed,
        category,
        rating: rating || null,
      });
      setSubmitted(true);
      loadMine();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to submit' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setMessage('');
    setRating(0);
    setCategory('general');
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🤲</Text>
          <Text style={styles.successTitle}>JazakAllahu Khayran!</Text>
          <Text style={styles.successDate}>
            Submitted on {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
          <Text style={styles.successText}>
            Your feedback has reached your zone admin. You can follow its status under
            "My Feedback" any time.
          </Text>

          <GoldButton
            title="View My Feedback"
            onPress={() => { resetForm(); setTab('mine'); }}
            size="lg"
            style={{ marginTop: 26, width: '100%' }}
          />
          <TouchableOpacity onPress={resetForm} style={{ marginTop: 14 }} activeOpacity={0.7}>
            <Text style={styles.linkTxt}>Write another</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }} activeOpacity={0.7}>
            <Text style={styles.linkMuted}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'write' && styles.tabOn]}
          onPress={() => setTab('write')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabTxt, tab === 'write' && styles.tabTxtOn]}>✍️ Write</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'mine' && styles.tabOn]}
          onPress={() => setTab('mine')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabTxt, tab === 'mine' && styles.tabTxtOn]}>
            📋 My Feedback{mine.length ? ` (${mine.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'write' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.headerEmoji}>💬</Text>
              <Text style={styles.title}>Share Feedback</Text>
              <Text style={styles.subtitle}>Help us serve you better</Text>
            </View>

            {/* Category */}
            <PremiumCard style={styles.card}>
              <Text style={styles.cardTitle}>What is this about?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catChip, category === c.key && styles.catChipActive]}
                    onPress={() => setCategory(c.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.catIcon}>{c.icon}</Text>
                    <Text style={[styles.catLabel, category === c.key && { color: COLORS.primary }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* Tells the user what belongs in the category they picked */}
              {selected && <Text style={styles.catHint}>{selected.hint}</Text>}
            </PremiumCard>

            {/* Rating */}
            <PremiumCard style={styles.card}>
              <Text style={styles.cardTitle}>Rating (optional)</Text>
              <Text style={styles.cardSub}>How has the service been overall?</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(rating === star ? 0 : star)} activeOpacity={0.7}>
                    <Text style={[styles.star, rating >= star && styles.starActive]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {rating > 0 && (
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
                  <TouchableOpacity onPress={() => setRating(0)} activeOpacity={0.7}>
                    <Text style={styles.clearRating}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}
            </PremiumCard>

            {/* Message */}
            <PremiumCard style={styles.card}>
              <Text style={styles.cardTitle}>Your Feedback *</Text>
              <TextInput
                style={styles.messageInput}
                placeholder={
                  category === 'complaint'
                    ? 'What went wrong, and when did it happen?'
                    : category === 'suggestion'
                      ? 'What would you change, and why?'
                      : 'Write your feedback here...'
                }
                placeholderTextColor={COLORS.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                maxLength={MAX_CHARS}
                textAlignVertical="top"
              />
              <View style={styles.counterRow}>
                <Text style={[styles.counterHint, tooShort && { color: COLORS.accentRed }]}>
                  {tooShort ? `At least ${MIN_CHARS} characters` : ' '}
                </Text>
                <Text style={[
                  styles.counter,
                  trimmed.length > MAX_CHARS * 0.9 && { color: COLORS.accentOrange },
                ]}>
                  {message.length}/{MAX_CHARS}
                </Text>
              </View>
            </PremiumCard>

            <Text style={styles.privacyNote}>
              Your name and zone are shared with your zone admin so they can act on this.
            </Text>

            <GoldButton
              title="Submit Feedback"
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
              size="lg"
              style={{ marginTop: 10, marginBottom: 30 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* ── My feedback history ─────────────────────────────────────────── */
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadMine(); }}
              tintColor={COLORS.primary}
            />
          }
        >
          {loadingMine ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 50 }} />
          ) : mine.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <Text style={styles.emptyTitle}>Nothing submitted yet</Text>
              <Text style={styles.emptySub}>Your feedback will appear here once you send it.</Text>
            </View>
          ) : (
            mine.map((f) => {
              const cat = CATEGORIES.find((c) => c.key === f.category);
              return (
                <PremiumCard key={f.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyCat}>
                      {cat?.icon} {cat?.label || f.category}
                    </Text>
                    {/* Closes the loop — the user can see it was actually read */}
                    <View style={[styles.statusPill, f.is_read ? styles.statusRead : styles.statusNew]}>
                      <Text style={[styles.statusTxt, { color: f.is_read ? COLORS.accentGreen : COLORS.accentOrange }]}>
                        {f.is_read ? '✓ Seen by admin' : '⏳ Awaiting review'}
                      </Text>
                    </View>
                  </View>

                  {f.rating ? (
                    <Text style={styles.historyStars}>
                      {'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}
                    </Text>
                  ) : null}

                  <Text style={styles.historyMsg}>{f.message}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(f.created_at || f.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </PremiumCard>
              );
            })
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topBarContent: { flexDirection: 'row', alignItems: 'center', height: Platform.OS === 'ios' ? 44 : 56, paddingHorizontal: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  backBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: SIZES.spacing.base, paddingVertical: SIZES.spacing.sm },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary, alignItems: 'center',
  },
  tabOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.14)' },
  tabTxt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTxtOn: { color: COLORS.primary, fontWeight: '700' },

  scroll: { padding: SIZES.spacing.base, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: SIZES.spacing.lg, marginTop: SIZES.spacing.sm },
  headerEmoji: { fontSize: 40 },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '700', marginTop: 6 },
  subtitle: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },

  card: { marginBottom: SIZES.spacing.base, padding: SIZES.spacing.base },
  cardTitle: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700' },
  cardSub: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 3 },

  catScroll: { marginTop: SIZES.spacing.sm },
  catChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: SIZES.radius.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary, marginRight: 8, minWidth: 92,
  },
  catChipActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.12)' },
  catIcon: { fontSize: 20 },
  catLabel: { color: COLORS.textSecondary, fontSize: 11.5, marginTop: 4, fontWeight: '600' },
  catHint: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 10, lineHeight: 17 },

  stars: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: SIZES.spacing.md },
  star: { fontSize: 34, color: COLORS.border },
  starActive: { color: COLORS.primary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
  ratingLabel: { color: COLORS.textSecondary, fontSize: SIZES.sm },
  clearRating: { color: COLORS.textMuted, fontSize: 11.5, textDecorationLine: 'underline' },

  messageInput: {
    backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: SIZES.radius.md, color: COLORS.textPrimary,
    padding: 14, fontSize: 14.5, minHeight: 130, marginTop: SIZES.spacing.sm,
  },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  counterHint: { color: COLORS.textMuted, fontSize: 11 },
  counter: { color: COLORS.textMuted, fontSize: 11 },
  privacyNote: {
    color: COLORS.textMuted, fontSize: 11, lineHeight: 17,
    textAlign: 'center', marginBottom: 12, paddingHorizontal: 16,
  },

  historyCard: { marginBottom: SIZES.spacing.sm, padding: SIZES.spacing.base },
  historyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyCat: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusRead: { backgroundColor: 'rgba(76,175,80,0.14)', borderColor: COLORS.accentGreen },
  statusNew: { backgroundColor: 'rgba(255,152,0,0.14)', borderColor: COLORS.accentOrange },
  statusTxt: { fontSize: 9.5, fontWeight: '700' },
  historyStars: { color: COLORS.primary, fontSize: 13, marginTop: 6 },
  historyMsg: { color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  historyDate: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 8 },

  empty: { alignItems: 'center', paddingVertical: 70, gap: 10 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: 12.5, textAlign: 'center' },

  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SIZES.spacing.xl },
  successEmoji: { fontSize: 60 },
  successTitle: { color: COLORS.primary, fontSize: SIZES.xxl, fontWeight: '700', marginTop: 14 },
  successDate: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 8, textAlign: 'center' },
  successText: { color: COLORS.textSecondary, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 22, marginTop: 14 },
  linkTxt: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '600' },
  linkMuted: { color: COLORS.textMuted, fontSize: SIZES.sm },
});
