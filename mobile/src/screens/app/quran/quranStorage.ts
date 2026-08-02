import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  LAST_READ: 'quran_last_read',
  BOOKMARKS: 'quran_bookmarks',
  SURAH_CACHE: 'quran_surah_cache',
};

export interface LastRead {
  surahId: number;
  ayahNumber: number;
  surahName: string;
}

export interface Bookmark {
  surahId: number;
  surahName: string;
  ayahNumber: number;
  text: string;
}

export async function saveLastRead(data: LastRead) {
  await AsyncStorage.setItem(KEYS.LAST_READ, JSON.stringify(data));
}

export async function getLastRead(): Promise<LastRead | null> {
  const raw = await AsyncStorage.getItem(KEYS.LAST_READ);
  return raw ? JSON.parse(raw) : null;
}

export async function getBookmarks(): Promise<Bookmark[]> {
  const raw = await AsyncStorage.getItem(KEYS.BOOKMARKS);
  return raw ? JSON.parse(raw) : [];
}

export async function toggleBookmark(bm: Bookmark): Promise<Bookmark[]> {
  const list = await getBookmarks();
  const idx = list.findIndex((b) => b.surahId === bm.surahId && b.ayahNumber === bm.ayahNumber);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(bm);
  await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(list));
  return list;
}

export async function removeBookmark(surahId: number, ayahNumber: number): Promise<Bookmark[]> {
  const list = await getBookmarks();
  const filtered = list.filter((b) => !(b.surahId === surahId && b.ayahNumber === ayahNumber));
  await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(filtered));
  return filtered;
}

export async function isBookmarked(surahId: number, ayahNumber: number): Promise<boolean> {
  const list = await getBookmarks();
  return list.some((b) => b.surahId === surahId && b.ayahNumber === ayahNumber);
}

export async function getCachedSurah(surahId: number): Promise<any | null> {
  const raw = await AsyncStorage.getItem(`${KEYS.SURAH_CACHE}_${surahId}`);
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (data.translation) {
    data.translation = data.translation.map((v: any) => ({
      ...v,
      text: v.text.replace(/<sup[^>]*>.*?<\/sup>/gi, '').replace(/<[^>]*>/g, ''),
    }));
  }
  return data;
}

export async function cacheSurah(surahId: number, data: any) {
  await AsyncStorage.setItem(`${KEYS.SURAH_CACHE}_${surahId}`, JSON.stringify(data));
}


