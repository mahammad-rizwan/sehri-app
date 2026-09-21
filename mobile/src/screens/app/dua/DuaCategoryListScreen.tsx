import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, GradientColors } from '../../../constants/theme';
import { useDuaSettings, ThemeKey } from '../../../store/duaSettingsStore';
import { getCachedCategories, setCachedCategories } from './duaStorage';

const API_BASE = 'https://ummahapi.com/api';

interface Category {
  id: string;
  name: string;
  description: string;
  count: number;
}

const THEMES: Record<ThemeKey, { bg: GradientColors; card: string; text: string; secondary: string; border: string; surface: string }> = {
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

const CATEGORY_ICONS: Record<string, string> = {
  morning: '🌅', evening: '🌆', wudu: '🚿', prayer: '🕌',
  after_prayer: '🤲', sleep: '🛌', food: '🍽️', travel: '✈️',
  home: '🏠', masjid: '🕌', distress: '😢', forgiveness: '🤲',
  illness: '🏥', weather: '🌤️', knowledge: '📚', parents: '👨‍👩‍👧‍👦',
  guidance: '🧭', gratitude: '🙏', protection: '🛡️', dhikr: '📿',
  marriage: '💍', hajj: '🕋', grief: '💔', children: '👶',
  business: '💼', night_prayer: '🌙', quran_recitation: '📖',
};

export default function DuaCategoryListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useDuaSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchCategories = useCallback(async () => {
    const cached = await getCachedCategories();
    if (cached) {
      setCategories(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/duas/categories`);
      const json = await res.json();
      const list: Category[] = json.data?.categories || [];
      setCategories(list);
      setCachedCategories(list);
    } catch {
      setError('Failed to load duas. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [search, categories]);

  const t = THEMES[theme];

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[styles.catCard, { backgroundColor: t.card, borderColor: t.border }]}
      onPress={() => router.push(`/(app)/dua/category/${item.id}` as any)}
      activeOpacity={0.8}
    >
      <LinearGradient colors={[`${COLORS.primary}20`, `${COLORS.primary}05`]} style={[styles.catIconWrap, { borderColor: 'rgba(201,168,76,0.3)' }]}>
        <Text style={styles.catIcon}>{CATEGORY_ICONS[item.id] || '🤲'}</Text>
      </LinearGradient>
      <View style={styles.catInfo}>
        <Text style={[styles.catName, { color: t.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.catDesc, { color: t.secondary }]} numberOfLines={1}>{item.description}</Text>
      </View>
      <View style={styles.catRight}>
        <Text style={[styles.catCount, { color: COLORS.primary }]}>{item.count}</Text>
        <Ionicons name="chevron-forward" size={14} color={t.secondary} />
      </View>
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
        <TouchableOpacity onPress={fetchCategories} activeOpacity={0.8} style={{ backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
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
          <Text style={[styles.titleRowText, { color: t.text }]}>Duas</Text>
          <Text style={[styles.titleRowSub, { color: t.secondary }]}>Browse by category</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(app)/dua/bookmarks' as any)} activeOpacity={0.7} style={styles.actionBtn}>
          <Ionicons name="bookmark-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <View style={[styles.searchRow, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <View style={[styles.searchWrap, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Ionicons name="search" size={16} color={t.secondary} />
          <TextInput
            style={[styles.searchInput, { color: t.text }]}
            placeholder="Search categories..."
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
        keyExtractor={(item) => item.id}
        renderItem={renderCategory}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: t.secondary }]}>No categories found</Text>
          </View>
        }
      />
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
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(201,168,76,0.1)', alignItems: 'center', justifyContent: 'center' },
  searchRow: {
    paddingHorizontal: SIZES.spacing.base,
    paddingVertical: SIZES.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: SIZES.radius.md, paddingHorizontal: 10, height: 36,
    borderWidth: 1, width: '100%',
  },
  searchInput: { flex: 1, fontSize: SIZES.sm },
  listContent: { padding: SIZES.spacing.base, paddingBottom: 100 },
  catCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: SIZES.radius.md, padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm, borderWidth: 1,
  },
  catIconWrap: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center',
    justifyContent: 'center', marginRight: SIZES.spacing.md,
    borderWidth: 1,
  },
  catIcon: { fontSize: 20 },
  catInfo: { flex: 1, marginRight: 8 },
  catName: { fontSize: SIZES.md, fontWeight: '700' },
  catDesc: { fontSize: SIZES.xs, marginTop: 2 },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catCount: { fontSize: SIZES.sm, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: SIZES.md },
});
