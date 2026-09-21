import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, GradientColors } from '../../../constants/theme';
import { toggleBookmark, getCachedSurah, cacheSurah } from './quranStorage';
import { useQuranSettings, ThemeKey, FontSizeKey } from '../../../store/quranSettingsStore';

const API_BASE = 'https://api.quran.com/api/v4';

interface IndopakVerse {
  id: number;
  verse_key: string;
  text_indopak_nastaleeq: string;
}

interface TranslationVerse {
  resource_id: number;
  text: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
}

interface ChapterInfo {
  name_simple: string;
  name_arabic: string;
}

const THEMES: Record<ThemeKey, { bg: GradientColors; card: string; text: string; secondary: string; border: string; headerBg: GradientColors }> = {
  dark: {
    bg: ['#050D16', '#0D1B2A', '#0A1A2E'],
    card: '#111E2E', text: '#E8E8E8', secondary: '#A0AAB5',
    border: 'rgba(255,255,255,0.06)', headerBg: ['rgba(201,168,76,0.12)', 'rgba(13,27,42,0.95)'],
  },
  sepia: {
    bg: ['#F5E6C8', '#EDD9B5', '#E5CEA3'],
    card: '#FFF8EC', text: '#3E2C1A', secondary: '#6B5B4B',
    border: 'rgba(62,44,26,0.12)', headerBg: ['rgba(62,44,26,0.08)', '#F5E6C8'],
  },
  light: {
    bg: ['#FFFFFF', '#F8F8FA', '#F0F0F4'],
    card: '#FFFFFF', text: '#1A1A2E', secondary: '#666680',
    border: 'rgba(0,0,0,0.08)', headerBg: ['rgba(201,168,76,0.08)', '#F8F8FA'],
  },
  green: {
    bg: ['#0D3B1E', '#1A5C2E', '#0A2E14'],
    card: '#144A24', text: '#E8F5E9', secondary: '#A5D6A7',
    border: 'rgba(165,214,167,0.12)', headerBg: ['rgba(165,214,167,0.1)', '#0D3B1E'],
  },
};

const FONT_SIZES: Record<FontSizeKey, { arabic: number; translation: number }> = {
  sm: { arabic: 18, translation: 12 },
  md: { arabic: 22, translation: 14 },
  lg: { arabic: 28, translation: 16 },
  xl: { arabic: 34, translation: 18 },
};

export default function QuranReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const surahId = parseInt(id || '1');
  const flatListRef = useRef<FlatList>(null);

  const { theme, fontSizeKey, setTheme, setFontSizeKey } = useQuranSettings();

  const [arabic, setArabic] = useState<Ayah[]>([]);
  const [translation, setTranslation] = useState<Ayah[]>([]);
  const [surahName, setSurahName] = useState('');
  const [surahNameAr, setSurahNameAr] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [jumpTo, setJumpTo] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fetchSurah = useCallback(async () => {
    const cached = await getCachedSurah(surahId);
    if (cached) {
      setArabic(cached.arabic);
      setTranslation(cached.translation);
      setSurahName(cached.surahName);
      setSurahNameAr(cached.surahNameAr || '');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [arRes, trRes, chRes] = await Promise.all([
        fetch(`${API_BASE}/quran/verses/indopak_nastaleeq?chapter_number=${surahId}`),
        fetch(`${API_BASE}/quran/translations/20?chapter_number=${surahId}`),
        fetch(`${API_BASE}/chapters/${surahId}?language=en`),
      ]);
      const arJson = await arRes.json();
      const trJson = await trRes.json();
      const chJson = await chRes.json();

      const indopakVerses: IndopakVerse[] = arJson.verses || [];
      const translationVerses: TranslationVerse[] = trJson.translations || [];
      const chapter: ChapterInfo = chJson.chapter;

      const arabicAyahs = indopakVerses.map((v) => ({
        number: v.id,
        text: v.text_indopak_nastaleeq,
        numberInSurah: parseInt(v.verse_key.split(':')[1], 10),
        juz: 0,
      }));
      const stripHtml = (s: string) => s.replace(/<sup[^>]*>.*?<\/sup>/gi, '').replace(/<[^>]*>/g, '');
      const enAyahs = translationVerses.map((v, i) => ({
        number: i + 1,
        text: stripHtml(v.text),
        numberInSurah: arabicAyahs[i]?.numberInSurah || i + 1,
        juz: 0,
      }));

      setArabic(arabicAyahs);
      setTranslation(enAyahs);
      const name = chapter?.name_simple || `Surah ${surahId}`;
      const nameAr = chapter?.name_arabic || '';
      setSurahName(name);
      setSurahNameAr(nameAr);
      cacheSurah(surahId, { arabic: arabicAyahs, translation: enAyahs, surahName: name, surahNameAr: nameAr });
    } catch {
      setError('Failed to load this Surah. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [surahId]);

  useEffect(() => { fetchSurah(); }, [fetchSurah]);

  useEffect(() => {
    (async () => {
      const { getBookmarks } = await import('./quranStorage');
      const list = await getBookmarks();
      const s = new Set<number>();
      list.forEach((b) => { if (b.surahId === surahId) s.add(b.ayahNumber); });
      setBookmarked(s);
    })();
  }, [surahId]);

  const handleBookmark = async (ayahNumber: number, text: string) => {
    const newList = await toggleBookmark({ surahId, surahName, ayahNumber, text });
    const s = new Set<number>();
    newList.forEach((b: any) => { if (b.surahId === surahId) s.add(b.ayahNumber); });
    setBookmarked(s);
  };

  const handleJump = () => {
    const num = parseInt(jumpTo);
    if (num && num >= 1 && num <= arabic.length) {
      flatListRef.current?.scrollToIndex({ index: num - 1, animated: true, viewPosition: 0.1 });
      setShowJump(false);
      setJumpTo('');
    }
  };

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: 130, offset: 130 * index, index }),
    [],
  );

  const t = THEMES[theme];
  const fs = FONT_SIZES[fontSizeKey];

  if (loading) {
    return (
      <LinearGradient colors={t.bg} style={styles.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={t.bg} style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={t.secondary} />
        <Text style={[styles.emptyText, { color: t.secondary, textAlign: 'center', marginTop: 12, marginBottom: 20 }]}>{error}</Text>
        <TouchableOpacity onPress={fetchSurah} activeOpacity={0.8} style={{ backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 14 }}>Retry</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={t.bg} style={styles.container}>

      {/* Top bar — fixed theme */}
      <View style={[styles.topBar, { backgroundColor: COLORS.background, paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/quran/surah' as any)} style={styles.backBtnReader} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnReaderText}>Surahs</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Surah header */}
      <LinearGradient colors={t.headerBg} style={[styles.surahHeader, { borderBottomColor: t.border }]}>
        {surahNameAr ? <Text style={[styles.surahNameArHeader, { color: COLORS.primary, fontFamily: 'IndopakNastaleeq' }]}>{surahNameAr}</Text> : null}
        <Text style={[styles.surahNameBig, { color: COLORS.primary }]}>{surahName}</Text>
        <Text style={[styles.surahSub, { color: t.secondary }]}>{arabic.length} verses</Text>
        <Text style={[styles.resumeHint, { color: t.secondary }]}>Bookmark ayahs to save your place</Text>
      </LinearGradient>

      {/* Search + Settings */}
      <View style={[styles.searchRow, { backgroundColor: t.card, borderColor: t.border }]}>
        <Ionicons name="search" size={16} color={t.secondary} />
        <TextInput
          style={[styles.searchInput, { color: t.text }]}
          placeholder="Search in this Surah..."
          placeholderTextColor={t.secondary}
          value={searchText}
          onChangeText={setSearchText}
        />
        <TouchableOpacity onPress={() => setShowSettings(true)} activeOpacity={0.7} style={styles.settingsBtn}>
          <Ionicons name="text" size={16} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowJump(true)} activeOpacity={0.7} style={styles.jumpBtn}>
          <Text style={styles.jumpBtnText}>JUMP</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={arabic}
        keyExtractor={(item) => String(item.number)}
        renderItem={({ item, index }) => {
          const ayahNum = item.numberInSurah;
          const enText = translation[index]?.text || '';
          const isBm = bookmarked.has(ayahNum);
          const highlighted = searchText.trim() && enText.toLowerCase().includes(searchText.toLowerCase());
          return (
            <View
              style={[styles.ayahBlock, { backgroundColor: t.card, borderColor: t.border }, highlighted && { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.08)' }]}
            >
              <View style={styles.ayahHeader}>
                <TouchableOpacity onPress={() => handleBookmark(ayahNum, item.text)} activeOpacity={0.7} style={styles.bookmarkBtn}>
                  <Ionicons name={isBm ? 'bookmark' : 'bookmark-outline'} size={18} color={isBm ? COLORS.primary : t.secondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.ayahArabic, { color: t.text, fontSize: fs.arabic, lineHeight: fs.arabic * 1.7, fontFamily: 'IndopakNastaleeq', writingDirection: 'rtl' }]}>
                {item.text}
              </Text>
              <Text style={[styles.ayahTranslation, { color: t.secondary, fontSize: fs.translation, borderTopColor: t.border }]}>{enText}</Text>
            </View>
          );
        }}
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
        }}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 30 }}
        ListHeaderComponent={<View style={{ height: 4 }} />}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={[styles.emptyText, { color: t.secondary }]}>No verses loaded</Text></View>
        }
      />

      {/* Jump modal */}
      <Modal visible={showJump} animationType="fade" transparent onRequestClose={() => setShowJump(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Jump to Ayah</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={`1-${arabic.length}`}
              placeholderTextColor={t.secondary}
              keyboardType="number-pad"
              value={jumpTo}
              onChangeText={setJumpTo}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowJump(false)} activeOpacity={0.7} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleJump} activeOpacity={0.85} style={styles.modalGo}>
                <Text style={styles.modalGoText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings modal */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.settingsSheet, { backgroundColor: t.card }]}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, { color: t.text }]}>Reader Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={t.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.settingsLabel, { color: t.secondary }]}>Background</Text>
            <View style={styles.themeRow}>
              {(['dark', 'sepia', 'light', 'green'] as ThemeKey[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.themeSwatch, { borderColor: theme === k ? COLORS.primary : t.border }]}
                  onPress={() => setTheme(k)}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={THEMES[k].bg} style={styles.themePreview} />
                  <Text style={[styles.themeLabel, { color: t.text, fontWeight: theme === k ? '700' : '400' }]}>{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.settingsLabel, { color: t.secondary, marginTop: 16 }]}>Font Size</Text>
            <View style={styles.fontRow}>
              {(['sm', 'md', 'lg', 'xl'] as FontSizeKey[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.fontOption, { borderColor: fontSizeKey === k ? COLORS.primary : t.border }]}
                  onPress={() => setFontSizeKey(k)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.fontOptionText, { color: t.text, fontSize: k === 'sm' ? 12 : k === 'md' ? 14 : k === 'lg' ? 16 : 18 }, fontSizeKey === k && { color: COLORS.primary }]}>
                    {k === 'sm' ? 'S' : k === 'md' ? 'M' : k === 'lg' ? 'L' : 'XL'}
                  </Text>
                  <Text style={[styles.fontOptionSub, { color: t.secondary }]}>{FONT_SIZES[k].arabic}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    justifyContent: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  topBarContent: {
    flexDirection: 'row', alignItems: 'center',
    height: Platform.OS === 'ios' ? 44 : 56,
    paddingHorizontal: 4,
  },
  backBtnReader: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnReaderText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
  surahHeader: { alignItems: 'center', paddingVertical: SIZES.spacing.lg, paddingHorizontal: SIZES.spacing.base, borderBottomWidth: 1 },
  surahNameArHeader: { fontSize: 24, marginBottom: 2 },
  surahNameBig: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  surahSub: { fontSize: 12 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SIZES.spacing.base, marginVertical: SIZES.spacing.sm,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: 12, height: 40, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 12 },
  settingsBtn: { padding: 4 },
  jumpBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  jumpBtnText: { color: COLORS.textOnPrimary, fontSize: 10, fontWeight: '800' },
  listContent: { paddingHorizontal: SIZES.spacing.base, paddingBottom: 80 },
  bookmarkBtn: { padding: 6, marginRight: -4 },
  resumeHint: { fontSize: 11, marginTop: 4, opacity: 0.7 },
  ayahBlock: {
    borderRadius: SIZES.radius.md,
    padding: SIZES.spacing.md, marginBottom: SIZES.spacing.sm,
    borderWidth: 1,
  },
  ayahHeader: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 6 },
  ayahArabic: { textAlign: 'right', fontWeight: '500' },
  verseEndCircle: { fontSize: 24, lineHeight: 36, color: '#D4A843', marginLeft: 4 },
  ayahTranslation: { marginTop: 8, borderTopWidth: 1, paddingTop: 8 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: SIZES.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  modalSheet: { backgroundColor: COLORS.background, borderRadius: 20, padding: 24, width: '80%', maxWidth: 320, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 16, textAlign: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  modalCancelText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  modalGo: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.primary },
  modalGoText: { color: COLORS.textOnPrimary, fontSize: 14, fontWeight: '800' },
  settingsSheet: { borderRadius: 20, padding: 24, width: '85%', maxWidth: 360 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingsTitle: { fontSize: 18, fontWeight: '700' },
  settingsLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeSwatch: { alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 12, padding: 6, flex: 1 },
  themePreview: { width: '100%', height: 40, borderRadius: 8 },
  themeLabel: { fontSize: 10, textTransform: 'capitalize' },
  fontRow: { flexDirection: 'row', gap: 10 },
  fontOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 2 },
  fontOptionText: { fontWeight: '700' },
  fontOptionSub: { fontSize: 10, marginTop: 2 },
});
