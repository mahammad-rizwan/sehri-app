import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  BOOKMARKS: 'dua_bookmarks',
  CACHE_CATEGORIES: 'dua_cache_categories',
  CACHE_DUAS: 'dua_cache_duas',
};

export interface DuaBookmark {
  id: number;
  title: string;
  category: string;
  categoryName: string;
  arabic: string;
  transliteration: string;
  translation: string;
  source: string;
}

export async function getBookmarks(): Promise<DuaBookmark[]> {
  const raw = await AsyncStorage.getItem(KEYS.BOOKMARKS);
  return raw ? JSON.parse(raw) : [];
}

export async function toggleBookmark(dua: DuaBookmark): Promise<DuaBookmark[]> {
  const list = await getBookmarks();
  const idx = list.findIndex((b) => b.id === dua.id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(dua);
  await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(list));
  return list;
}

export async function isBookmarked(id: number): Promise<boolean> {
  const list = await getBookmarks();
  return list.some((b) => b.id === id);
}

export async function getCachedCategories(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(KEYS.CACHE_CATEGORIES);
  return raw ? JSON.parse(raw) : null;
}

export async function setCachedCategories(data: any) {
  await AsyncStorage.setItem(KEYS.CACHE_CATEGORIES, JSON.stringify(data));
}

export async function getCachedDuas(categoryId: string): Promise<any | null> {
  const raw = await AsyncStorage.getItem(`${KEYS.CACHE_DUAS}_${categoryId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function setCachedDuas(categoryId: string, data: any) {
  await AsyncStorage.setItem(`${KEYS.CACHE_DUAS}_${categoryId}`, JSON.stringify(data));
}
