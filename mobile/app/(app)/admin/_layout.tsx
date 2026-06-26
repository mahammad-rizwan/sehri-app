import { useState, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../../src/constants/theme';
import { useAuthStore } from '../../../src/store/authStore';

export default function AdminLayout() {
  const { user, activeRole, logout, switchRole } = useAuthStore();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const btnRef = useRef<View>(null);

  const handleSwitchToUser = async () => {
    setMenuVisible(false);
    try {
      await switchRole('user');
      router.replace('/(app)/home');
    } catch {}
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    await logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="users" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="tracking" />
        <Stack.Screen name="manage-admins" />
        <Stack.Screen name="poll-history" />
      </Stack>

      {/* Profile icon — matches user tab icon look */}
      <TouchableOpacity
        style={styles.profileBtn}
        onPress={() => setMenuVisible((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={[styles.profileIcon, menuVisible && styles.profileIconActive]}>
          <Text style={styles.profileEmoji}>👤</Text>
        </View>
      </TouchableOpacity>

      {/* Top-right dropdown menu */}
      {menuVisible && (
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.dropdown}>
            <Text style={styles.dropdownName}>{user?.name || 'Admin'}</Text>
            <Text style={styles.dropdownRole}>
              {activeRole === 'super_admin' ? 'Super Admin' : 'Admin'}
            </Text>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleSwitchToUser} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
              <Text style={styles.menuItemText}>Switch to User Mode</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={18} color="#EF5350" />
              <Text style={[styles.menuItemText, { color: '#EF5350' }]}>Logout</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  profileBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 999,
    elevation: 10,
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIconActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  profileEmoji: {
    fontSize: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  dropdown: {
    position: 'absolute',
    top: 94,
    right: 16,
    backgroundColor: '#0D1B2A',
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  dropdownName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dropdownRole: {
    color: '#C9A84C',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.15)',
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
