import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../../constants/theme';
import { useDuaSettings, ThemeKey, FontSizeKey } from '../../../store/duaSettingsStore';
import { getCachedDuas, setCachedDuas, toggleBookmark, getBookmarks, DuaBookmark } from './duaStorage';

const API_BASE = 'https://ummahapi.com/api';

interface Dua {
  id: number;
  category: string;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
  source: string;
  repeat: number;
}

interface CategoryInfo {
  id: string;
  name: string;
  description: string;
}

const THEMES: Record<ThemeKey, { bg: string[]; card: string; text: string; secondary: string; border: string; surface: string; headerBg: string[] }> = {
  dark: {
    bg: ['#050D16', '#0D1B2A', '#0A1A2E'],
    card: '#111E2E', text: '#E8E8E8', secondary: '#A0AAB5',
    border: 'rgba(255,255,255,0.06)', surface: '#0D1B2A',
    headerBg: ['#0D1B2A', '#0A1A2E'],
  },
  sepia: {
    bg: ['#F5E6C8', '#EDD9B5', '#E5CEA3'],
    card: '#FFF8EC', text: '#3E2C1A', secondary: '#6B5B4B',
    border: 'rgba(62,44,26,0.12)', surface: '#EDD9B5',
    headerBg: ['#EDD9B5', '#E5CEA3'],
  },
  light: {
    bg: ['#FFFFFF', '#F8F8FA', '#F0F0F4'],
    card: '#FFFFFF', text: '#1A1A2E', secondary: '#666680',
    border: 'rgba(0,0,0,0.08)', surface: '#F0F0F4',
    headerBg: ['#F8F8FA', '#F0F0F4'],
  },
  green: {
    bg: ['#0D3B1E', '#1A5C2E', '#0A2E14'],
    card: '#144A24', text: '#E8F5E9', secondary: '#A5D6A7',
    border: 'rgba(165,214,167,0.12)', surface: '#1A5C2E',
    headerBg: ['#1A5C2E', '#0A2E14'],
  },
};

const FONT_SIZES: Record<FontSizeKey, { arabic: number; translation: number; title: number }> = {
  sm: { arabic: 18, translation: 12, title: 14 },
  md: { arabic: 22, translation: 14, title: 15 },
  lg: { arabic: 26, translation: 16, title: 16 },
  xl: { arabic: 30, translation: 18, title: 17 },
};

export default function DuaListScreen() {
  const router = useRouter();
  const { id: categoryId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme, fontSizeKey, setTheme, setFontSizeKey } = useDuaSettings();
  const [duas, setDuas] = useState<Dua[]>([]);
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const list = await getBookmarks();
        setBookmarkedIds(new Set(list.map((b) => b.id)));
      })();
    }, []),
  );

  const fetchDuas = useCallback(async () => {
    const cached = await getCachedDuas(categoryId);
    if (cached) {
      setDuas(cached.duas || []);
      setCategoryInfo(cached.categoryInfo || null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/duas/category/${categoryId}`);
      const json = await res.json();
      const d: Dua[] = json.data?.duas || [];
      const ci = json.data?.category || null;
      setDuas(d);
      setCategoryInfo(ci);
      setCachedDuas(categoryId, { duas: d, categoryInfo: ci });
    } catch {
      setError('Failed to load duas. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => { fetchDuas(); }, [fetchDuas]);

  const handleBookmark = async (dua: Dua) => {
    const bm: DuaBookmark = {
      id: dua.id,
      title: dua.title,
      category: dua.category,
      categoryName: categoryInfo?.name || '',
      arabic: dua.arabic,
      transliteration: dua.transliteration,
      translation: dua.translation,
      source: dua.source,
    };
    const list = await toggleBookmark(bm);
    setBookmarkedIds(new Set(list.map((b) => b.id)));
  };

  const t = THEMES[theme];
  const fs = FONT_SIZES[fontSizeKey];

  const renderDua = ({ item, index }: { item: Dua; index: number }) => {
    const isBookmarked = bookmarkedIds.has(item.id);
    return (
      <View style={[styles.duaCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.duaHeader, { borderBottomColor: t.border }]}>
          <View style={styles.duaTitleRow}>
            <LinearGradient colors={[COLORS.primary, '#B8942E']} style={styles.duaIndex}>
              <Text style={styles.duaIndexText}>{index + 1}</Text>
            </LinearGradient>
            <View style={styles.duaTitleInfo}>
              <Text style={[styles.duaTitle, { color: t.text, fontSize: fs.title }]}>{item.title}</Text>
              {item.repeat > 1 && (
                <Text style={[styles.duaRepeat, { color: COLORS.primary }]}>Repeat {item.repeat}x</Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => handleBookmark(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isBookmarked ? COLORS.primary : t.secondary}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.duaArabic, { color: t.text, fontSize: fs.arabic, fontFamily: 'IndopakNastaleeq' }]}>{item.arabic}</Text>

        <Text style={[styles.duaTransliteration, { color: t.secondary, fontSize: fs.translation, fontStyle: 'italic' }]}>{item.transliteration}</Text>

        <Text style={[styles.duaTranslation, { color: t.text, fontSize: fs.translation, lineHeight: fs.translation * 1.7 }]}>{item.translation}</Text>

        <View style={[styles.duaSource, { borderTopColor: t.border }]}>
          <Ionicons name="book-outline" size={12} color={COLORS.primary} />
          <Text style={[styles.duaSourceText, { color: t.secondary }]}>{item.source}</Text>
        </View>
      </View>
    );
  };

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
        <TouchableOpacity onPress={fetchDuas} activeOpacity={0.8} style={{ backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 14 }}>Retry</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={t.bg} style={styles.container}>
      <View style={[styles.topBar, { backgroundColor: COLORS.background, paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/dua' as any)} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Categories</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LinearGradient colors={t.headerBg} style={[styles.sectionHeader, { borderBottomColor: t.border }]}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: t.text }]}>{categoryInfo?.name || 'Duas'}</Text>
            <Text style={[styles.sectionSub, { color: t.secondary }]}>{duas.length} duas</Text>
          </View>
          <TouchableOpacity onPress={() => setShowSettings(true)} activeOpacity={0.7} style={styles.actionBtn}>
            <Ionicons name="text" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={duas}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderDua}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
  sectionHeader: {
    paddingHorizontal: SIZES.spacing.base,
    paddingVertical: SIZES.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: '700' },
  sectionSub: { fontSize: SIZES.xs, marginTop: 2 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(201,168,76,0.1)', alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: SIZES.spacing.base, paddingBottom: 100 },
  duaCard: {
    borderRadius: SIZES.radius.md, padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.lg, borderWidth: 1,
  },
  duaHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingBottom: SIZES.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: SIZES.spacing.md,
  },
  duaTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  duaIndex: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  duaIndexText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  duaTitleInfo: { flex: 1 },
  duaTitle: { fontWeight: '700' },
  duaRepeat: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  duaArabic: { textAlign: 'right', fontWeight: '500', marginBottom: SIZES.spacing.md, lineHeight: undefined },
  duaTransliteration: { marginBottom: SIZES.spacing.sm },
  duaTranslation: { marginBottom: SIZES.spacing.md },
  duaSource: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: SIZES.spacing.sm, borderTopWidth: StyleSheet.hairlineWidth,
  },
  duaSourceText: { fontSize: 11, fontWeight: '500', flex: 1 },
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
