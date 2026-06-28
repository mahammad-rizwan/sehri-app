import { useRef, useMemo } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Text, View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS, RESPONSIVE } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/authStore';

type Role = 'user' | 'admin' | 'super_admin';

interface TabDef {
  name: string;
  title: string;
  icon: string;
  iconActive: string;
}

const TAB_META: Record<string, TabDef> = {
  home:               { name: 'home', title: 'Home', icon: '🏠', iconActive: '🏡' },
  donation:           { name: 'donation', title: 'Donate', icon: '🎁', iconActive: '💝' },
  tracking:           { name: 'tracking', title: 'Track', icon: '🛵', iconActive: '📍' },
  'quran/surah':      { name: 'quran/surah', title: 'Quran', icon: '📖', iconActive: '🕋' },
  'dua/index':        { name: 'dua/index', title: 'Duas', icon: '🤲', iconActive: '📿' },
  profile:            { name: 'profile', title: 'Profile', icon: '👤', iconActive: '🌟' },
  'admin/dashboard':  { name: 'admin/dashboard', title: 'Dashboard', icon: '📊', iconActive: '📊' },
  'admin/users':      { name: 'admin/users', title: 'Users', icon: '👥', iconActive: '👥' },
  'admin/chat/index': { name: 'admin/chat/index', title: 'Chat', icon: '💬', iconActive: '💬' },
  'admin/poll-history': { name: 'admin/poll-history', title: 'Polls', icon: '📅', iconActive: '🗳️' },
  'admin/manage-admins': { name: 'admin/manage-admins', title: 'Admins', icon: '👤', iconActive: '⭐' },
  'admin/profile':    { name: 'admin/profile', title: 'Profile', icon: '👤', iconActive: '🌟' },
};

const USER_TAB_ORDER = ['home', 'dua/index', 'quran/surah', 'tracking', 'profile'];
const ADMIN_TAB_ORDER = ['admin/dashboard', 'admin/users', 'admin/chat/index', 'admin/poll-history', 'admin/profile'];
const SUPER_ADMIN_TAB_ORDER = ['admin/dashboard', 'admin/users', 'admin/chat/index', 'admin/manage-admins', 'admin/profile'];

const USER_VISIBLE = new Set(USER_TAB_ORDER);
const ADMIN_VISIBLE = new Set(ADMIN_TAB_ORDER);
const SUPER_ADMIN_VISIBLE = new Set(SUPER_ADMIN_TAB_ORDER);

const NO_BACK = new Set(['home', 'admin/dashboard', 'dua/index', 'dua/category/[id]', 'dua/bookmarks']);

function TabIcon({ icon, iconActive, focused }: { icon: string; iconActive: string; focused: boolean }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.85)).current;

  return (
    <Animated.View style={[
      styles.tabIconWrap,
      focused && styles.tabIconActive,
      { transform: [{ scale: scaleAnim }] },
    ]}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>
        {focused ? iconActive : icon}
      </Text>
    </Animated.View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeRole = useAuthStore((s) => s.activeRole) || 'user';
  const tabOrder = activeRole === 'user'
    ? USER_TAB_ORDER
    : activeRole === 'super_admin'
      ? SUPER_ADMIN_TAB_ORDER
      : ADMIN_TAB_ORDER;

  const routeMap = useMemo(() => {
    const map: Record<string, typeof state.routes[0]> = {};
    state.routes.forEach((r) => { map[r.name] = r; });
    return map;
  }, [state.routes]);

  function isTabActive(name: string) {
    if (state.routes[state.index]?.name === name) return true;
    const tabPath = `/${name.replace('/index', '')}`;
    if (pathname === tabPath) return true;
    if (pathname.startsWith(tabPath + '/')) return true;
    if (name === 'quran/surah' && pathname.startsWith('/quran/')) return true;
    return false;
  }

  return (
    <View style={tabStyles.container}>
      {tabOrder.map((name) => {
        const meta = TAB_META[name];
        if (!meta) return null;
        const route = routeMap[name];
        const isFocused = isTabActive(name);

        const onPress = () => {
          if (route) {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(name);
            }
          } else {
            router.push(`/(app)/${name}`);
          }
        };

        return (
          <TouchableOpacity
            key={name}
            onPress={onPress}
            style={tabStyles.tabItem}
            activeOpacity={0.7}
          >
            <TabIcon icon={meta.icon} iconActive={meta.iconActive} focused={isFocused} />
            <Text style={[tabStyles.label, isFocused && tabStyles.labelActive]}>
              {meta.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BackBtn({ target }: { target: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.push(target)} style={styles.backBtn} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
      <Text style={styles.backBtnText}>{target.includes('admin') ? 'Dashboard' : 'Home'}</Text>
    </TouchableOpacity>
  );
}

function getHeaderOptions(name: string, homeTarget: string) {
  const isQuran = name === 'quran/surah';
  if (NO_BACK.has(name)) return {};
  return {
    headerShown: true,
    headerTitle: isQuran ? 'Al-Quran' : '',
    headerStyle: { backgroundColor: COLORS.background },
    headerShadowVisible: false,
    headerLeft: () => <BackBtn target={homeTarget} />,
  };
}

export default function AppLayout() {
  const activeRole = useAuthStore((s) => s.activeRole) || 'user';
  const isAdmin = activeRole === 'admin' || activeRole === 'super_admin';
  const homeTarget = isAdmin ? '/(app)/admin/dashboard' : '/(app)/home';

  const routes = useMemo(() => {
    if (activeRole === 'user') {
      return [...USER_VISIBLE, 'feedback', 'poll-history', 'rider', 'dua/category/[id]', 'dua/bookmarks'];
    }
    const visible = activeRole === 'super_admin' ? SUPER_ADMIN_VISIBLE : ADMIN_VISIBLE;
    return [...visible, 'admin/chat/[id]', 'admin/chat/create', 'admin/tracking', 'admin/feedback', 'feedback', 'poll-history', 'rider'];
  }, [activeRole]);

  return (
    <Tabs
      backBehavior="none"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      {routes.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={getHeaderOptions(name, homeTarget)}
        />
      ))}
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundCard,
    borderTopColor: COLORS.border,
    borderTopWidth: 0.5,
    paddingBottom: RESPONSIVE.isSmall ? 4 : 6,
    paddingTop: 4,
    height: RESPONSIVE.isSmall ? 60 : RESPONSIVE.isMedium ? 64 : 70,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontSize: RESPONSIVE.isSmall ? 9 : 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 0,
  },
  labelActive: {
    color: COLORS.primary,
  },
});

const styles = StyleSheet.create({
  tabIconWrap: {
    width: RESPONSIVE.isSmall ? 28 : 30,
    height: RESPONSIVE.isSmall ? 28 : 30,
    borderRadius: RESPONSIVE.isSmall ? 14 : 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabEmoji: { fontSize: RESPONSIVE.isSmall ? 15 : 17 },
  tabEmojiActive: { fontSize: RESPONSIVE.isSmall ? 17 : 19 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
});
