import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../../constants/theme';
import { useDuaSettings, ThemeKey } from '../../../store/duaSettingsStore';
import { getBookmarks, toggleBookmark, DuaBookmark } from './duaStorage';

const THEMES: Record<ThemeKey, { bg: string[]; card: string; text: string; secondary: string; border: string }> = {
  dark: { bg: ['#050D16', '#0D1B2A', '#0A1A2E'], card: '#111E2E', text: '#E8E8E8', secondary: '#A0AAB5', border: 'rgba(255,255,255,0.06)' },
  sepia: { bg: ['#F5E6C8', '#EDD9B5', '#E5CEA3'], card: '#FFF8EC', text: '#3E2C1A', secondary: '#6B5B4B', border: 'rgba(62,44,26,0.12)' },
  light: { bg: ['#FFFFFF', '#F8F8FA', '#F0F0F4'], card: '#FFFFFF', text: '#1A1A2E', secondary: '#666680', border: 'rgba(0,0,0,0.08)' },
  green: { bg: ['#0D3B1E', '#1A5C2E', '#0A2E14'], card: '#144A24', text: '#E8F5E9', secondary: '#A5D6A7', border: 'rgba(165,214,167,0.12)' },
};

export default function DuaBookmarksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useDuaSettings();
  const [bookmarks, setBookmarks] = useState<DuaBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getBookmarks().then((b) => {
        setBookmarks(b.reverse());
        setLoading(false);
      });
    }, []),
  );

  const handleRemove = async (item: DuaBookmark) => {
    const list = await toggleBookmark(item);
    setBookmarks(list.reverse());
  };

  const t = THEMES[theme];

  if (loading) {
    return (
      <LinearGradient colors={t.bg} style={styles.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={t.bg} style={styles.container}>
      <View style={[styles.topBar, { backgroundColor: COLORS.background, paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/dua' as any)} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Duas</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.headerRow, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <Text style={[styles.headerTitle, { color: t.text }]}>Saved Duas</Text>
        <Text style={[styles.headerCount, { color: t.secondary }]}>{bookmarks.length} saved</Text>
      </View>
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={[styles.bmCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.bmHeader}>
              <View style={styles.bmTitleRow}>
                <View style={styles.bmIndex}>
                  <Text style={styles.bmIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.bmTitleInfo}>
                  <Text style={[styles.bmTitle, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.bmCategory, { color: COLORS.primary }]}>{item.categoryName}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleRemove(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color={t.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.bmArabic, { color: t.text, fontFamily: 'IndopakNastaleeq' }]} numberOfLines={1}>{item.arabic}</Text>
            <Text style={[styles.bmTranslation, { color: t.secondary }]} numberOfLines={2}>{item.translation}</Text>
            <View style={[styles.bmSource, { borderTopColor: t.border }]}>
              <Ionicons name="book-outline" size={11} color={COLORS.primary} />
              <Text style={[styles.bmSourceText, { color: t.secondary }]} numberOfLines={1}>{item.source}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bookmarks" size={40} color={COLORS.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: t.text }]}>No saved duas yet</Text>
            <Text style={[styles.emptySub, { color: t.secondary }]}>Tap the bookmark icon on any dua to save it here</Text>
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
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIZES.spacing.base,
    paddingVertical: SIZES.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: SIZES.lg, fontWeight: '700' },
  headerCount: { fontSize: SIZES.xs, fontWeight: '500' },
  listContent: { padding: SIZES.spacing.base, paddingBottom: 100 },
  bmCard: {
    borderRadius: SIZES.radius.md, padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm, borderWidth: 1,
  },
  bmHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: SIZES.spacing.sm,
  },
  bmTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  bmIndex: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  bmIndexText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  bmTitleInfo: { flex: 1 },
  bmTitle: { fontSize: SIZES.sm, fontWeight: '700' },
  bmCategory: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  bmArabic: { fontSize: SIZES.md, fontWeight: '500', marginBottom: 4, textAlign: 'right' },
  bmTranslation: { fontSize: SIZES.xs, lineHeight: SIZES.md, marginBottom: SIZES.spacing.sm },
  bmSource: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingTop: SIZES.spacing.xs, borderTopWidth: StyleSheet.hairlineWidth,
  },
  bmSourceText: { fontSize: 10, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(201,168,76,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: SIZES.lg, fontWeight: '700' },
  emptySub: { fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});
