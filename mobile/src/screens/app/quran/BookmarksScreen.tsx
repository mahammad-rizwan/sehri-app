import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../../constants/theme';
import { getBookmarks, removeBookmark, Bookmark } from './quranStorage';
import { useQuranSettings, ThemeKey } from '../../../store/quranSettingsStore';

const THEMES: Record<ThemeKey, { bg: string[]; card: string; text: string; secondary: string; border: string }> = {
  dark: { bg: ['#050D16', '#0D1B2A', '#0A1A2E'], card: '#111E2E', text: '#E8E8E8', secondary: '#A0AAB5', border: 'rgba(255,255,255,0.06)' },
  sepia: { bg: ['#F5E6C8', '#EDD9B5', '#E5CEA3'], card: '#FFF8EC', text: '#3E2C1A', secondary: '#6B5B4B', border: 'rgba(62,44,26,0.12)' },
  light: { bg: ['#FFFFFF', '#F8F8FA', '#F0F0F4'], card: '#FFFFFF', text: '#1A1A2E', secondary: '#666680', border: 'rgba(0,0,0,0.08)' },
  green: { bg: ['#0D3B1E', '#1A5C2E', '#0A2E14'], card: '#144A24', text: '#E8F5E9', secondary: '#A5D6A7', border: 'rgba(165,214,167,0.12)' },
};

export default function BookmarksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useQuranSettings();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
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

  const handleDelete = (item: Bookmark) => {
    Alert.alert('Remove Bookmark', `Remove Ayah ${item.ayahNumber} from ${item.surahName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await removeBookmark(item.surahId, item.ayahNumber);
          setBookmarks((prev) => prev.filter((b) => !(b.surahId === item.surahId && b.ayahNumber === item.ayahNumber)));
        },
      },
    ]);
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
          <TouchableOpacity onPress={() => router.push('/(app)/quran/surah' as any)} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Surahs</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.headerRow, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <Text style={[styles.headerTitle, { color: t.text }]}>Bookmarks</Text>
        <Text style={[styles.headerCount, { color: t.secondary }]}>{bookmarks.length} saved</Text>
      </View>
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => `s-${item.surahId}-${item.ayahNumber}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.bmCard, { backgroundColor: t.card, borderColor: t.border }]}
            onPress={() => router.push(`/(app)/quran/${item.surahId}?ayah=${item.ayahNumber}` as any)}
            activeOpacity={0.8}
          >
            <View style={styles.bmNumWrap}>
              <Text style={styles.bmNumText}>{item.ayahNumber}</Text>
            </View>
            <View style={styles.bmInfo}>
              <View style={styles.bmTitleRow}>
                <Text style={[styles.bmSurah, { color: COLORS.primary }]}>{item.surahName}</Text>
                <Text style={[styles.bmAyah, { color: t.secondary }]}>Ayah {item.ayahNumber}</Text>
              </View>
              <Text style={[styles.bmText, { color: t.text, fontFamily: 'IndopakNastaleeq' }]} numberOfLines={2}>{item.text}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={16} color={t.secondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bookmarks" size={40} color={COLORS.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: t.text }]}>No bookmarks yet</Text>
            <Text style={[styles.emptySub, { color: t.secondary }]}>Tap the bookmark icon while reading to save verses here</Text>
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
    flexDirection: 'row', alignItems: 'center',
    borderRadius: SIZES.radius.md, padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm, borderWidth: 1,
  },
  bmNumWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    marginRight: SIZES.spacing.md,
  },
  bmNumText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bmInfo: { flex: 1, marginRight: 8 },
  bmTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bmSurah: { fontSize: 13, fontWeight: '700' },
  bmAyah: { fontSize: 11 },
  bmText: { fontSize: SIZES.sm, lineHeight: SIZES.lg },
  deleteBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(201,168,76,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: SIZES.lg, fontWeight: '700' },
  emptySub: { fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});
