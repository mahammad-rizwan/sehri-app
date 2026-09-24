import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { ENDPOINTS } from '../constants/api';

/**
 * Unread announcement tracking.
 *
 * The "last seen" marker lives on the device rather than the server: read
 * state is per-device and needs no schema, and getting it slightly wrong
 * across two devices only means seeing a badge twice — not missing anything.
 * Erring toward showing the badge is the right failure mode here.
 */
export const LAST_SEEN_KEY = 'broadcast_last_seen';

/** Counts announcements for this user newer than what they last opened. */
export async function getUnreadBroadcastCount(): Promise<number> {
  try {
    const since = await AsyncStorage.getItem(LAST_SEEN_KEY);
    const { data } = await api.get(
      ENDPOINTS.BROADCAST_UNREAD,
      since ? { since } : undefined,
    );
    return Number(data?.data?.count ?? 0);
  } catch {
    // A badge must never break the screen it sits on.
    return 0;
  }
}

/** Called when the feed is opened — everything up to `newest` is now read. */
export async function markBroadcastsSeen(newestCreatedAt?: string) {
  try {
    await AsyncStorage.setItem(LAST_SEEN_KEY, newestCreatedAt || new Date().toISOString());
  } catch {
    // Not worth surfacing; the badge simply lingers until next time.
  }
}
