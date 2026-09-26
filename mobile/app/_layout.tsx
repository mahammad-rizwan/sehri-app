import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { View } from 'react-native';
import * as Device from 'expo-device';
import Toast from 'react-native-toast-message';
import { COLORS } from '../src/constants/theme';
import { registerForPushNotifications, addNotificationReceivedListener, addNotificationResponseListener, cancelLegacyLocalReminders } from '../src/services/notificationService';

/**
 * Gesture Handler needs a root view or its gestures never fire on Android, but
 * importing it pulls in Reanimated's worklets runtime — which is missing in some
 * environments (Expo Go without the native worklets module). A throw here would
 * take down the whole app, since Expo Router imports every route file to build
 * the route tree, so fall back to a plain View and lose only the gestures.
 */
let GestureRoot: React.ComponentType<any> = View;
try {
  GestureRoot = require('react-native-gesture-handler').GestureHandlerRootView || View;
} catch {
  console.warn('[Gestures] Gesture Handler unavailable — drag-to-reorder disabled');
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    IndopakNastaleeq: require('../assets/fonts/IndopakNastaleeq.ttf'),
  });
  const notifResponseListener = useRef<any>(null);
  const notifReceivedListener = useRef<any>(null);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Push notifications only work on a real physical device.
      // Skip entirely on emulator / Expo Go to avoid SDK 53 errors.
      if (Device.isDevice) {
        registerForPushNotifications().catch(err => console.warn('[Push] Registration error (layout):', err));
        cancelLegacyLocalReminders();

        notifReceivedListener.current = addNotificationReceivedListener((notification) => {
          console.log('[Notification] Received in foreground:', notification.request.content.title);
        });

        notifResponseListener.current = addNotificationResponseListener((screen, data) => {
          if (screen === 'chat' && data?.groupId) {
            router.push(`/(app)/admin/chat/${data.groupId}` as any);
          } else if (screen === 'reports') {
            router.push('/(app)/admin/reports' as any);
          } else if (screen === 'my-reports') {
            router.push('/(app)/my-reports' as any);
          } else if (screen === 'tracking') {
            router.push('/(app)/tracking' as any);
          } else if (screen === 'poll') {
            router.push('/(app)/home' as any);
          }
        });

        return () => {
          if (notifResponseListener.current) notifResponseListener.current.remove();
          if (notifReceivedListener.current) notifReceivedListener.current.remove();
        };
      }
    }
  }, [fontsLoaded, fontError]);

  /**
   * Hidden from an effect rather than the root view's `onLayout`.
   *
   * It used to hang off `onLayout`, which broke the moment the root became
   * GestureHandlerRootView — that wrapper does not reliably forward the prop, so
   * the callback never fired, the splash never hid, and the app sat on a white
   * screen while the JS underneath carried on running. An effect does not care
   * what component is at the root.
   */
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    // Gesture Handler needs this at the root or none of its gestures fire on
    // Android — used by the drag-to-reorder list in Zone & Map Management.
    <GestureRoot style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(rider)" />
      </Stack>
      <Toast />
    </GestureRoot>
  );
}
