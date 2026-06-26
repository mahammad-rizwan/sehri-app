import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/authStore';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={styles.tabEmoji}>{icon}</Text>
    </View>
  );
}

export default function AppLayout() {
  const activeRole = useAuthStore((s) => s.activeRole);
  const isAdminMode = activeRole === 'admin' || activeRole === 'super_admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isAdminMode ? styles.tabBarHidden : styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="donation"
        options={{
          title: 'Donate',
          tabBarIcon: ({ focused }) => <TabIcon icon="🤲" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Track',
          tabBarIcon: ({ focused }) => <TabIcon icon="🛵" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: 'Feedback',
          tabBarIcon: ({ focused }) => <TabIcon icon="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen name="admin"  options={{ href: null }} />
      <Tabs.Screen name="rider"  options={{ href: null }} />
      <Tabs.Screen name="poll-history"  options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.backgroundCard,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
    height: 70,
  },
  tabBarHidden: {
    display: 'none',
  },
  tabLabel:     { fontSize: SIZES.xs, fontWeight: '500' },
  tabIcon:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tabIconActive:{ backgroundColor: 'rgba(201,168,76,0.15)' },
  tabEmoji:     { fontSize: 20 },
});
