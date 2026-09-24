import { useRef, useMemo, useEffect, useState } from 'react';
import { Tabs, useRouter, usePathname, type Href } from 'expo-router';
import {
  Text, View, StyleSheet, Animated, TouchableOpacity,
  BackHandler, Keyboard, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS, RESPONSIVE } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/authStore';

// ─── Tab definitions ──────────────────────────────────────────────────────────
interface TabDef { name: string; title: string; icon: string; iconActive: string; }

const TAB_META: Record<string, TabDef> = {
  home:                  { name: 'home',                  title: 'Home',      icon: '🏠', iconActive: '🏡' },
  donation:              { name: 'donation',              title: 'Donate',    icon: '🎁', iconActive: '💝' },
  tracking:              { name: 'tracking',              title: 'Track',     icon: '🛵', iconActive: '📍' },
  'quran/surah/index':   { name: 'quran/surah/index',    title: 'Quran',     icon: '📖', iconActive: '🕋' },
  'dua/index':           { name: 'dua/index',            title: 'Duas',      icon: '🤲', iconActive: '📿' },
  profile:               { name: 'profile',               title: 'Profile',   icon: '👤', iconActive: '🌟' },
  'admin/dashboard':     { name: 'admin/dashboard',       title: 'Dashboard', icon: '📊', iconActive: '📊' },
  'admin/users':         { name: 'admin/users',           title: 'Users',     icon: '👥', iconActive: '👥' },
  'admin/chat/index':    { name: 'admin/chat/index',      title: 'Chat',      icon: '💬', iconActive: '💬' },
  'admin/poll-history':  { name: 'admin/poll-history',    title: 'Polls',     icon: '📅', iconActive: '🗳️' },
  'admin/manage-admins': { name: 'admin/manage-admins',   title: 'Admins',    icon: '👤', iconActive: '⭐' },
  'admin/profile':       { name: 'admin/profile',         title: 'Profile',   icon: '👤', iconActive: '🌟' },
};

const USER_TAB_ORDER       = ['home', 'donation', 'dua/index', 'quran/surah/index', 'tracking', 'profile'];
// Guests only get what needs no identity: prayer timings (on home), Duas,
// Quran, and a profile tab that is really a sign-in invitation.
const GUEST_TAB_ORDER      = ['home', 'donation', 'dua/index', 'quran/surah/index', 'profile'];
const ADMIN_TAB_ORDER      = ['admin/dashboard', 'admin/users', 'admin/chat/index', 'admin/poll-history', 'admin/profile'];
const SUPER_ADMIN_TAB_ORDER = ['admin/dashboard', 'admin/users', 'admin/chat/index', 'admin/manage-admins', 'admin/profile'];

const USER_VISIBLE       = new Set(USER_TAB_ORDER);
const ADMIN_VISIBLE      = new Set(ADMIN_TAB_ORDER);
const SUPER_ADMIN_VISIBLE = new Set(SUPER_ADMIN_TAB_ORDER);

// Screens that are "root" — back button on these exits or does nothing
const ROOT_SCREENS = new Set(['home', 'admin/dashboard']);

// Screens whose layout header should NOT show a back button
const NO_BACK = new Set(['home', 'admin/dashboard', 'dua/index', 'dua/category/[id]', 'dua/bookmarks', 'quran/surah/index', 'donation', 'tracking', 'profile', 'feedback', 'broadcast']);

// ─── Tab icon ─────────────────────────────────────────────────────────────────
function TabIcon({ icon, iconActive, focused }: { icon: string; iconActive: string; focused: boolean }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.85)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1 : 0.85,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [focused]);

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

// ─── Custom tab bar ───────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();
  const activeRole = useAuthStore((s) => s.activeRole) || 'user';
  const isGuest    = useAuthStore((s) => s.isGuest);
  const ramadanActive = useAuthStore((s) => s.ramadanActive);

  // Keyboard visibility — lift bar for gesture-navigation phones
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // routeMap must be declared before any conditional return (Rules of Hooks)
  const routeMap = useMemo(() => {
    const map: Record<string, typeof state.routes[0]> = {};
    state.routes.forEach((r) => { map[r.name] = r; });
    return map;
  }, [state.routes]);

  // Hide bar entirely when keyboard is up on Android
  if (keyboardVisible && Platform.OS === 'android') return null;

  const baseOrder = isGuest
    ? GUEST_TAB_ORDER
    : activeRole === 'user'
      ? USER_TAB_ORDER
      : activeRole === 'super_admin'
        ? SUPER_ADMIN_TAB_ORDER
        : ADMIN_TAB_ORDER;

  // Sehri-only tabs disappear outside Ramadan. Live tracking exists to follow a
  // Sehri delivery, and the polls tab has nothing to show.
  const RAMADAN_ONLY_TABS = new Set(['tracking', 'admin/poll-history']);
  const tabOrder = ramadanActive
    ? baseOrder
    : baseOrder.filter((t) => !RAMADAN_ONLY_TABS.has(t));

  function isTabActive(name: string) {
    if (state.routes[state.index]?.name === name) return true;
    const tabPath = `/${name.replace('/index', '')}`;
    if (pathname === tabPath) return true;
    if (pathname.startsWith(tabPath + '/')) return true;
    if (name === 'quran/surah/index' && pathname.startsWith('/quran/')) return true;
    return false;
  }

  // Bottom padding: respect system navigation bar (gesture-nav phones have
  // insets.bottom > 0; button-nav phones typically have insets.bottom === 0
  // but we still add a small buffer so nothing gets clipped)
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 4 : 6);

  return (
    <View style={[tabStyles.container, { paddingBottom: bottomPad }]}>
      {tabOrder.map((name) => {
        const meta = TAB_META[name];
        if (!meta) return null;
        const route    = routeMap[name];
        const isFocused = isTabActive(name);

        const onPress = () => {
          if (route) {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(name);
          } else {
            router.push(`/(app)/${name}` as Href);
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

// ─── Header back button ───────────────────────────────────────────────────────
/**
 * Screens that are only ever opened from the Profile tab. Sending them back to
 * Home would drop the user somewhere they never came from.
 */
const FROM_PROFILE = new Set(['feedback', 'poll-history']);

function BackBtn({ target, name }: { target: string; name: string }) {
  const router = useRouter();
  
  // Special case: individual chat screens go back to chat list and show "Back"
  const isIndividualChat = name.startsWith('admin/chat/') && name !== 'admin/chat/index' && name !== 'admin/chat/create';
  const fromProfile = FROM_PROFILE.has(name);

  const label = isIndividualChat ? 'Back'
    : fromProfile ? 'Profile'
    : (target.includes('admin') ? 'Dashboard' : 'Home');

  const destination = isIndividualChat ? '/(app)/admin/chat'
    : fromProfile ? '/(app)/profile'
    : target;
  
  return (
    <TouchableOpacity onPress={() => router.push(destination as any)} style={styles.backBtn} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
      <Text style={styles.backBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function getHeaderOptions(name: string, homeTarget: string) {
  if (NO_BACK.has(name)) return {};
  return {
    headerShown: true,
    headerTitle: name === 'quran/surah/index' ? 'Al-Quran' : '',
    headerStyle: { backgroundColor: COLORS.background },
    headerShadowVisible: false,
    headerLeft: () => <BackBtn target={homeTarget} name={name} />,
  };
}

// ─── App layout root ──────────────────────────────────────────────────────────
export default function AppLayout() {
  const router      = useRouter();
  const pathname    = usePathname();
  const activeRole  = useAuthStore((s) => s.activeRole) || 'user';
  const isAdmin     = activeRole === 'admin' || activeRole === 'super_admin';
  const homeTarget  = isAdmin ? '/(app)/admin/dashboard' : '/(app)/home';
  const homeSegment = isAdmin ? 'admin/dashboard' : 'home';

  // ── Android hardware / gesture back ────────────────────────────────────────
  // Strategy:
  //   • If we are on a root screen (home / admin dashboard) → exit app
  //   • Otherwise → navigate to the role's home screen
  //
  // This covers BOTH hardware-back-button users AND gesture-back users because
  // expo-router respects BackHandler for gesture navigation on Android as well.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const isRootPath = () => {
      const clean = pathname.replace(/^\//, '');
      return ROOT_SCREENS.has(clean);
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isRootPath()) {
        // Already at root — let Android handle it (exit app)
        return false;
      }
      // Not at root — go to role home
      router.push(homeTarget as any);
      return true; // consumed — prevents default exit
    });

    return () => sub.remove();
  }, [pathname, homeTarget]);

  /**
   * Every screen reachable inside this group has to be registered here, not
   * just the ones in the tab bar — an unregistered route gets no header, which
   * is why several admin pages had no way back to the dashboard.
   */
  const routes = useMemo(() => {
    if (activeRole === 'user') {
      return [
        ...USER_VISIBLE,
        'feedback', 'poll-history', 'rider', 'broadcast',
        'dua/category/[id]', 'dua/bookmarks',
      ];
    }
    const visible = activeRole === 'super_admin' ? SUPER_ADMIN_VISIBLE : ADMIN_VISIBLE;
    return [
      ...visible,
      'admin/chat/[id]', 'admin/chat/create', 'admin/tracking',
      'admin/feedback', 'admin/donation-history', 'admin/special-cases',
      // Reached from dashboard tiles rather than the tab bar. `poll-history`
      // is a tab for zone admins but not for super admins, so it needs listing
      // here too.
      'admin/profile-edit-requests', 'admin/broadcast', 'admin/sync-data',
      'admin/ramadan', 'admin/places',
      'admin/poll-history',
      'feedback', 'poll-history', 'rider', 'broadcast',
    ];
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
      {[...new Set(routes)].map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={getHeaderOptions(name, homeTarget)}
        />
      ))}
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundCard,
    borderTopColor: COLORS.border,
    borderTopWidth: 0.5,
    paddingTop: 4,
    // Height is set dynamically via paddingBottom in render, but give a min
    minHeight: RESPONSIVE.isSmall ? 56 : 60,
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
    paddingVertical: 2,
  },
  label: {
    fontSize: RESPONSIVE.isSmall ? 9 : 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  labelActive: { color: COLORS.primary },
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
  tabEmoji:       { fontSize: RESPONSIVE.isSmall ? 15 : 17 },
  tabEmojiActive: { fontSize: RESPONSIVE.isSmall ? 17 : 19 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
});
