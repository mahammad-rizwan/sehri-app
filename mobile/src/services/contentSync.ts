import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { ENDPOINTS } from '../constants/api';

/**
 * Cache-busting for the static Quran and Dua content.
 *
 * That content lives in each device's AsyncStorage, so the server cannot clear
 * it directly. Instead the super admin bumps a version number, and each client
 * compares it against the version it last cached under. When they differ the
 * device drops its cached copy and re-fetches — which is what makes "sync" in
 * the admin panel actually fix a user whose cache went bad.
 *
 * Bookmarks and last-read position are user data and are never touched.
 */

const LOCAL_VERSION_KEYS = {
  quran: 'quran_cache_version',
  dua: 'dua_cache_version',
} as const;

const CACHE_PREFIXES = {
  quran: ['quran_surah_cache'],
  dua: ['dua_cache_categories', 'dua_cache_duas'],
} as const;

export type ContentKind = keyof typeof LOCAL_VERSION_KEYS;

/** Wipes cached content for one kind, leaving bookmarks and settings alone. */
export async function clearContentCache(kind: ContentKind): Promise<number> {
  const prefixes = CACHE_PREFIXES[kind];
  const all = await AsyncStorage.getAllKeys();
  const doomed = all.filter((k) => prefixes.some((p) => k === p || k.startsWith(`${p}_`)));
  if (doomed.length) await AsyncStorage.multiRemove(doomed);
  return doomed.length;
}

/**
 * Compares the server's content version against this device's and rebuilds the
 * cache if the super admin has since triggered a sync.
 *
 * Deliberately silent on failure — a network blip must never stop the Quran or
 * Dua screens from opening with whatever is already cached.
 */
export async function reconcileContentVersions(): Promise<void> {
  try {
    const { data } = await api.get(ENDPOINTS.SYNC_VERSIONS);
    const remote = data?.data;
    if (!remote) return;

    for (const kind of ['quran', 'dua'] as ContentKind[]) {
      const serverVersion = Number(remote[kind] ?? 0);
      if (!serverVersion) continue;

      const localRaw = await AsyncStorage.getItem(LOCAL_VERSION_KEYS[kind]);
      const localVersion = Number(localRaw ?? 0);

      // First run just records the version — there is nothing stale to clear.
      if (localVersion === 0) {
        await AsyncStorage.setItem(LOCAL_VERSION_KEYS[kind], String(serverVersion));
        continue;
      }

      if (serverVersion > localVersion) {
        const removed = await clearContentCache(kind);
        await AsyncStorage.setItem(LOCAL_VERSION_KEYS[kind], String(serverVersion));
        console.log(`[contentSync] ${kind} cache rebuilt (v${localVersion} → v${serverVersion}, ${removed} entries cleared)`);
      }
    }
  } catch {
    // Offline or unauthenticated — keep whatever is cached.
  }
}
