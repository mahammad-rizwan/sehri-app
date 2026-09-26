import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api, { setSessionExpiredHandler } from '../services/api';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ENDPOINTS } from '../constants/api';
import { registerForPushNotifications } from '../services/notificationService';
import { reconcileContentVersions } from '../services/contentSync';

export interface User {
  id: string;
  name: string;
  phone: string;
  zone: 'masjid' | 'boys_hostel' | 'stanza' | 'girls';
  gender: 'male' | 'female';
  city?: string;
  area?: 'kengeri' | 'nayandahalli' | 'nagarabavi' | 'uttarahalli';
  occupation?: 'student' | 'employee' | 'others';
  profile_picture?: string;
  status: string;
  address?: string;
  last_login_at?: string;
  role?: 'user' | 'admin' | 'super_admin';
  hasAdminRole?: boolean;
  hasSuperAdminRole?: boolean;
}

export interface PendingEditData {
  name?: string;
  gender?: string;
  occupation?: string;
  city?: string;
  area?: string;
  zone?: string;
  address?: string;
  /** Only sent when the user actually wants to change it. */
  password?: string;
}

interface AuthState {
  user: User | null;
  userRole: 'user' | 'admin' | 'super_admin' | null;
  /**
   * Short-lived token that authorises editing a pending registration without
   * a second OTP. Issued on a pending login (password already checked) and
   * after a successful registration (OTP already checked).
   */
  pendingEditToken: string | null;
  /** The current active mode (may differ from userRole after switching) */
  activeRole: 'user' | 'admin' | 'super_admin' | null;
  isAuthenticated: boolean;
  /**
   * Browsing without an account. Guests get the content that needs no
   * identity — Quran, Duas and prayer timings — and are prompted to sign in
   * for anything tied to a person or a zone.
   */
  isGuest: boolean;
  /**
   * Whether Ramadan is running. Everything Sehri — the poll, live tracking and
   * poll history — is hidden outside it, on every role. Defaults to false so a
   * failed fetch hides those features rather than showing a poll that cannot
   * work.
   */
  ramadanActive: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;
  sendOTP: (phone: string, purpose: string) => Promise<any>;
  login: (phone: string, password: string, role: string) => Promise<User>;
  register: (data: RegisterData) => Promise<any>;
  setPendingEditToken: (token: string | null) => void;
  requestProfileEdit: (changes: PendingEditData) => Promise<any>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<any>;
  updatePendingRegistration: (data: PendingEditData) => Promise<any>;
  logout: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  exitGuest: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (targetRole: 'user' | 'admin' | 'super_admin') => Promise<User>;
  forgotPasswordSendOTP: (phone: string) => Promise<any>;
  forgotPasswordVerifyOTP: (phone: string, otp: string) => Promise<any>;
  forgotPasswordReset: (phone: string, newPassword: string) => Promise<any>;
}

export interface RegisterData {
  name: string;
  phone: string;
  gender: string;
  zone: string;
  address: string;
  password: string;
  city: string;
  area: string;
  occupation: string;
  otp: string;
}

/**
 * OTP endpoints wait on MessageCentral, which is slower and less predictable
 * than our own API. The default 15s budget was cutting these off mid-flight —
 * the SMS would arrive but the app had already given up on the request.
 */
const OTP_TIMEOUT_MS = 45000;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userRole: null,
  activeRole: null,
  pendingEditToken: null,
  isAuthenticated: false,
  isGuest: false,
  ramadanActive: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const savedRole = await SecureStore.getItemAsync('userRole');
      const savedActiveRole = await SecureStore.getItemAsync('activeRole');
      if (!token) {
        // No account, but they may have chosen to browse as a guest before.
        const guest = await SecureStore.getItemAsync('guestMode');
        set({ isGuest: guest === '1', isLoading: false });
        // Guests still need this — it decides what the home screen shows.
        get().refreshSettings();
        return;
      }

      const { data } = await api.get(ENDPOINTS.ME);
      const activeRole = (savedActiveRole || savedRole || data.data?.role) as 'user' | 'admin' | 'super_admin' | null;
      set({
        user: data.data,
        userRole: (savedRole as 'user' | 'admin' | 'super_admin') || data.data?.role || null,
        activeRole,
        isAuthenticated: true,
        isGuest: false,
        isLoading: false,
      });
      registerForPushNotifications().catch(err => console.warn('[Push] Registration error (initialize):', err));
      // Rebuilds the Quran/Dua cache if a super admin has triggered a sync.
      reconcileContentVersions();
      get().refreshSettings();
    } catch {
      await api.clearTokens();
      const guest = await SecureStore.getItemAsync('guestMode');
      set({
        user: null, userRole: null, activeRole: null,
        isAuthenticated: false, isGuest: guest === '1', isLoading: false,
      });
    }
  },

  sendOTP: async (phone: string, purpose: string) => {
    const { data } = await api.post(ENDPOINTS.SEND_OTP, { phone, purpose }, OTP_TIMEOUT_MS);
    return data;
  },

  login: async (phone: string, password: string, role: string) => {
    const { data } = await api.post(ENDPOINTS.LOGIN, { phone, password, role });
    await api.saveTokens(data.data.accessToken, data.data.refreshToken);
    await SecureStore.setItemAsync('userRole', role);
    await SecureStore.setItemAsync('activeRole', role);
    await SecureStore.deleteItemAsync('guestMode');
    set({
      user: data.data.user,
      userRole: role as 'user' | 'admin' | 'super_admin',
      activeRole: role as 'user' | 'admin' | 'super_admin',
      isAuthenticated: true,
      isGuest: false,
    });
    registerForPushNotifications().catch(err => console.warn('[Push] Registration error (login):', err));
    reconcileContentVersions();
    get().refreshSettings();
    return data.data.user;
  },

  register: async (registerData: RegisterData) => {
    const { data } = await api.post(ENDPOINTS.REGISTER, registerData, OTP_TIMEOUT_MS);
    if (data?.data?.editToken) set({ pendingEditToken: data.data.editToken });
    return data;
  },

  /** Reads the app-wide switches. Safe to call often; never throws. */
  refreshSettings: async () => {
    try {
      const { data } = await api.get(ENDPOINTS.SETTINGS);
      set({ ramadanActive: !!data?.data?.ramadanActive });
    } catch {
      // Leave the last known value rather than flipping features on a blip.
    }
  },

  setPendingEditToken: (token) => set({ pendingEditToken: token }),

  /**
   * Ask an admin to approve profile changes. The backend flips the account back
   * to `pending`, so the caller must sign the user out afterwards.
   */
  requestProfileEdit: async (changes: PendingEditData) => {
    const { data } = await api.post(ENDPOINTS.REQUEST_PROFILE_EDIT, changes);
    return data;
  },

  /** Self-service, no approval and no OTP — the current password is the proof. */
  changePassword: async (currentPassword: string, newPassword: string) => {
    const { data } = await api.post(ENDPOINTS.CHANGE_PASSWORD, { currentPassword, newPassword });
    return data;
  },

  /**
   * Edit a still-pending registration. No OTP — the phone number is unchanged
   * and was already verified, and the edit token proves who is asking.
   */
  updatePendingRegistration: async (payload: PendingEditData) => {
    const token = get().pendingEditToken;
    if (!token) throw new Error('NO_EDIT_TOKEN');
    const { data } = await api.patch(ENDPOINTS.UPDATE_PENDING_REGISTRATION, payload, token);
    if (data?.data?.editToken) set({ pendingEditToken: data.data.editToken });
    return data;
  },

  /** Browse without an account. Survives restarts until they sign in. */
  continueAsGuest: async () => {
    await SecureStore.setItemAsync('guestMode', '1');
    set({ user: null, userRole: null, activeRole: null, isAuthenticated: false, isGuest: true });
  },

  /** Leave guest mode — used when a guest taps through to sign in. */
  exitGuest: async () => {
    await SecureStore.deleteItemAsync('guestMode');
    set({ isGuest: false });
  },

  logout: async () => {
    await api.clearTokens();
    await SecureStore.deleteItemAsync('userRole');
    await SecureStore.deleteItemAsync('activeRole');
    await SecureStore.deleteItemAsync('guestMode');
    set({
      user: null, userRole: null, activeRole: null,
      pendingEditToken: null, isAuthenticated: false, isGuest: false,
    });
  },

  refreshProfile: async () => {
    try {
      const { data } = await api.get(ENDPOINTS.ME);
      set({ user: data.data });
    } catch {}
  },

  switchRole: async (targetRole: 'user' | 'admin' | 'super_admin') => {
    const { data } = await api.post(ENDPOINTS.SWITCH_ROLE, { targetRole });
    await api.saveTokens(data.data.accessToken, data.data.refreshToken);
    await SecureStore.setItemAsync('userRole', targetRole);
    await SecureStore.setItemAsync('activeRole', targetRole);
    set({
      user: data.data.user,
      userRole: targetRole,
      activeRole: targetRole,
    });
    registerForPushNotifications().catch(err => console.warn('[Push] Registration error (switchRole):', err));
    return data.data.user;
  },

  forgotPasswordSendOTP: async (phone: string) => {
    const { data } = await api.post(ENDPOINTS.FORGOT_PASSWORD_SEND_OTP, { phone }, OTP_TIMEOUT_MS);
    return data;
  },

  forgotPasswordVerifyOTP: async (phone: string, otp: string) => {
    const { data } = await api.post(ENDPOINTS.FORGOT_PASSWORD_VERIFY_OTP, { phone, otp }, OTP_TIMEOUT_MS);
    return data;
  },

  forgotPasswordReset: async (phone: string, newPassword: string) => {
    const { data } = await api.post(ENDPOINTS.FORGOT_PASSWORD_RESET, { phone, newPassword });
    return data;
  },
}));

// When a session can no longer be renewed, sign out properly and say why,
// instead of leaving every screen failing while the app thinks it is signed in.
setSessionExpiredHandler(async () => {
  await useAuthStore.getState().logout();
  Toast.show({ type: 'info', text1: 'Session expired', text2: 'Please sign in again.' });
  try { router.replace('/(auth)/welcome'); } catch { /* navigator not ready yet */ }
});
