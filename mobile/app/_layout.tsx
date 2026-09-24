import { useCallback, useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { View } from 'react-native';
import * as Device from 'expo-device';
import Toast from 'react-native-toast-message';
import { COLORS } from '../src/constants/theme';
import { registerForPushNotifications, addNotificationReceivedListener, addNotificationResponseListener, cancelLegacyLocalReminders } from '../src/services/notificationService';

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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(rider)" />
      </Stack>
      <Toast />
    </View>
  );
}
