import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';
import { ENDPOINTS } from '../constants/api';

// Only configure notification handler on real devices.
// expo-notifications push support was removed from Expo Go in SDK 53.
if (Device.isDevice) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotifications() {
  try {
    // Push notifications require a real physical device
    if (!Device.isDevice) {
      console.warn('[Push] Must use a physical device for push notifications');
      return null;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      const msg = '[Push] Permission not granted: ' + finalStatus;
      console.warn(msg);
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C9A84C',
      });

      /**
       * Delivery alerts get their own channel, because on Android the sound is
       * a property of the channel — a push cannot override it. The backend
       * sends `channelId: 'sehri-delivery'` so these arrive with the chime
       * instead of the phone's default notification tone.
       *
       * MAX rather than HIGH: these fire at ~3 AM and the whole point is to
       * wake someone who is asleep and expecting food.
       *
       * Android caches channel settings after the first creation, so changing
       * the sound later needs a new channel id — the app cannot edit this one.
       */
      await Notifications.setNotificationChannelAsync('sehri-delivery', {
        name: 'Sehri Delivery Alerts',
        description: 'Tells you when your Sehri leaves the kitchen and when it reaches you.',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'sehri_alert.wav',
        vibrationPattern: [0, 400, 200, 400],
        lightColor: '#C9A84C',
        bypassDnd: true,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants.expoConfig as any)?.projectId ||
      (Constants.expoConfig as any)?.manifest?.extra?.eas?.projectId ||
      (Constants.expoConfig?.updates?.url?.match(/\/projects\/([^/]+)$/)?.[1]);

    console.log('[Push] projectId:', projectId);

    if (!projectId) {
      console.warn('[Push] No projectId found in Constants');
      return null;
    }

    let token: string | null = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenData.data;
    } catch (err1: any) {
      console.warn('[Push] Token retrieval with projectId failed:', err1?.message);
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        token = tokenData.data;
      } catch (err2: any) {
        console.warn('[Push] Token retrieval failed (both methods):', err2?.message);
        return null;
      }
    }

    console.log('[Push] Got token:', token?.substring(0, 30) + '...');

    try {
      await api.post(ENDPOINTS.FCM_TOKEN, { fcm_token: token });
      console.log('[Push] Token stored on backend');
    } catch (err: any) {
      console.warn('[Push] Backend store failed:', err?.response?.status, err?.message);
    }

    return token;
  } catch (err: any) {
    console.warn('[Push] Registration failed:', err?.message);
    return null;
  }
}

export async function cancelLegacyLocalReminders() {
  // Cancels any local scheduled reminders that were set up by older app versions.
  // Reminders are now sent exclusively via backend push — no local scheduling needed.
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

// Keep export so any remaining call sites don't crash at import time,
// but the function is a no-op — backend cron handles all reminders.
export async function schedulePollReminders() {
  // No-op: reminders are sent from the backend (server.js cron).
  // Calling cancelLegacyLocalReminders() on first launch clears old ones.
}

export function addNotificationReceivedListener(handler: (notification: Notifications.Notification) => void) {
  if (!Device.isDevice) return { remove: () => {} };
  const sub = Notifications.addNotificationReceivedListener((notification) => {
    handler(notification);
  });
  return sub;
}

export function addNotificationResponseListener(handler: (screen?: string, data?: any) => void) {
  if (!Device.isDevice) return { remove: () => {} };
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.screen === 'chat' && data?.groupId) {
      handler('chat', { groupId: data.groupId });
    } else if (data?.screen === 'tracking') {
      // Delivery alerts open live tracking, so they can see where the rider is.
      handler('tracking');
    } else if (data?.screen === 'poll') {
      handler('poll');
    }
  });
  return sub;
}
