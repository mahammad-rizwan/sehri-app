import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../../constants/theme';
import { useQuranSettings, ThemeKey, FontSizeKey } from '../../../store/quranSettingsStore';

const API_BASE = 'https://api.quran.com/api/v4';

interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
  translated_name: { name: string };
}

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
}

let chapterCache: { data: Chapter[] } | null = null;

const THEMES: Record<ThemeKey, { bg: string[]; card: string; text: string; secondary: string; border: string; surface: string }> = {
  dark: {
    bg: ['#050D16', '#0D1B2A', '#0A1A2E'],
    card: '#111E2E', text: '#E8E8E8', secondary: '#A0AAB5',
    border: 'rgba(255,255,255,0.06)', surface: '#0D1B2A',
  },
  sepia: {
    bg: ['#F5E6C8', '#EDD9B5', '#E5CEA3'],
    card: '#FFF8EC', text: '#3E2C1A', secondary: '#6B5B4B',
    border: 'rgba(62,44,26,0.12)', surface: '#EDD9B5',
  },
  light: {
    bg: ['#FFFFFF', '#F8F8FA', '#F0F0F4'],
    card: '#FFFFFF', text: '#1A1A2E', secondary: '#666680',
    border: 'rgba(0,0,0,0.08)', surface: '#F0F0F4',
  },
  green: {
    bg: ['#0D3B1E', '#1A5C2E', '#0A2E14'],
    card: '#144A24', text: '#E8F5E9', secondary: '#A5D6A7',
    border: 'rgba(165,214,167,0.12)', surface: '#1A5C2E',
  },
};

const FONT_SIZES: Record<FontSizeKey, { name: number; meta: number }> = {
  sm: { name: 14, meta: 10 },
  md: { name: 16, meta: 11 },
  lg: { name: 20, meta: 13 },
  xl: { name: 24, meta: 15 },
};

const mapChapter = (c: Chapter): Surah => ({
  number: c.id,
  name: c.name_arabic,
  englishName: c.name_simple,
  englishNameTranslation: c.translated_name?.name || '',
  numberOfAyahs: c.verses_count,
});

export default function SurahListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, fontSizeKey, setTheme, setFontSizeKey } = useQuranSettings();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const fetchSurahs = useCallback(async () => {
    if (chapterCache) {
      setSurahs(chapterCache.data.map(mapChapter));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/chapters?language=en`);
      const json = await res.json();
      const chapters: Chapter[] = json.chapters || [];
      chapterCache = { data: chapters };
      setSurahs(chapters.map(mapChapter));
    } catch {
      setError('Failed to load Surahs. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSurahs(); }, [fetchSurahs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return surahs;
    const q = search.toLowerCase();
    return surahs.filter(
      (s) =>
        s.number.toString().includes(q) ||
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q),
    );
  }, [search, surahs]);

  const t = THEMES[theme];
  const fs = FONT_SIZES[fontSizeKey];

  const renderSurah = ({ item }: { item: Surah }) => (
    <TouchableOpacity
      style={[styles.surahCard, { backgroundColor: t.card, borderColor: t.border }]}
      onPress={() => router.push(`/(app)/quran/${item.number}` as any)}
      activeOpacity={0.8}
    >
      <LinearGradient colors={[`${COLORS.primary}20`, `${COLORS.primary}05`]} style={[styles.surahNum, { borderColor: 'rgba(201,168,76,0.3)' }]}>
        <Text style={styles.surahNumText}>{item.number}</Text>
      </LinearGradient>
      <View style={styles.surahInfo}>
        <Text style={[styles.surahNameAr, { color: t.text, fontSize: fs.name, fontFamily: 'IndopakNastaleeq' }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.surahNameEn, { color: t.secondary, fontSize: fs.meta }]} numberOfLines={1}>{item.englishName} — {item.englishNameTranslation}</Text>
        <View style={styles.surahMeta}>
          <Text style={[styles.surahAyahs, { color: t.secondary, fontSize: fs.meta }]}>{item.numberOfAyahs} verses</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.secondary} />
    </TouchableOpacity>
  );

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
        <TouchableOpacity onPress={fetchSurahs} activeOpacity={0.8} style={{ backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 14 }}>Retry</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={t.bg} style={styles.container}>
      <View style={[styles.topBar, { backgroundColor: COLORS.background, paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/home' as any)} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.titleRow, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <View>
          <Text style={[styles.titleRowText, { color: t.text }]}>Surah Listing</Text>
          <Text style={[styles.titleRowSub, { color: t.secondary }]}>Browse the Quran by chapter</Text>
        </View>
        <View style={styles.titleRowActions}>
          <TouchableOpacity onPress={() => router.push('/(app)/quran/bookmarks' as any)} activeOpacity={0.7} style={styles.actionBtn}>
            <Ionicons name="bookmark-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} activeOpacity={0.7} style={styles.actionBtn}>
            <Ionicons name="text" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.searchRow, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <View style={[styles.searchWrap, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Ionicons name="search" size={16} color={t.secondary} />
          <TextInput
            style={[styles.searchInput, { color: t.text }]}
            placeholder="Search Surah..."
            placeholderTextColor={t.secondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={t.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.number)}
        renderItem={renderSurah}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: t.secondary }]}>No Surahs found</Text>
          </View>
        }
      />

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
                  <Text style={[styles.fontOptionSub, { color: t.secondary }]}>{FONT_SIZES[k].name}</Text>
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIZES.spacing.base,
    paddingTop: SIZES.spacing.md,
    paddingBottom: SIZES.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRowText: { fontSize: SIZES.lg, fontWeight: '700' },
  titleRowSub: { fontSize: SIZES.xs, marginTop: 2 },
  titleRowActions: { flexDirection: 'row', gap: 8 },
  searchRow: {
    paddingHorizontal: SIZES.spacing.base,
    paddingVertical: SIZES.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(201,168,76,0.1)', alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: SIZES.radius.md, paddingHorizontal: 10, height: 36,
    borderWidth: 1, width: '100%',
  },
  searchInput: { flex: 1, fontSize: SIZES.sm },
  listContent: { padding: SIZES.spacing.base, paddingBottom: 100 },
  surahCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: SIZES.radius.md, padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm, borderWidth: 1,
  },
  surahNum: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', marginRight: SIZES.spacing.md,
    borderWidth: 1,
  },
  surahNumText: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
  surahInfo: { flex: 1, marginRight: 8 },
  surahNameAr: { fontWeight: '700' },
  surahNameEn: { marginTop: 2 },
  surahMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  surahAyahs: {},
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: SIZES.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
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
