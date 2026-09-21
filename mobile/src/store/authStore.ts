import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';
import { ENDPOINTS } from '../constants/api';
import { registerForPushNotifications } from '../services/notificationService';

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

interface AuthState {
  user: User | null;
  userRole: 'user' | 'admin' | 'super_admin' | null;
  /** The current active mode (may differ from userRole after switching) */
  activeRole: 'user' | 'admin' | 'super_admin' | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;
  sendOTP: (phone: string, purpose: string) => Promise<any>;
  login: (phone: string, password: string, role: string) => Promise<User>;
  register: (data: RegisterData) => Promise<any>;
  logout: () => Promise<void>;
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
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const savedRole = await SecureStore.getItemAsync('userRole');
      const savedActiveRole = await SecureStore.getItemAsync('activeRole');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      const { data } = await api.get(ENDPOINTS.ME);
      const activeRole = (savedActiveRole || savedRole || data.data?.role) as 'user' | 'admin' | 'super_admin' | null;
      set({
        user: data.data,
        userRole: (savedRole as 'user' | 'admin' | 'super_admin') || data.data?.role || null,
        activeRole,
        isAuthenticated: true,
        isLoading: false,
      });
      registerForPushNotifications().catch(err => console.warn('[Push] Registration error (initialize):', err));
    } catch {
      await api.clearTokens();
      set({ user: null, userRole: null, activeRole: null, isAuthenticated: false, isLoading: false });
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
    set({
      user: data.data.user,
      userRole: role as 'user' | 'admin' | 'super_admin',
      activeRole: role as 'user' | 'admin' | 'super_admin',
      isAuthenticated: true,
    });
    registerForPushNotifications().catch(err => console.warn('[Push] Registration error (login):', err));
    return data.data.user;
  },

  register: async (registerData: RegisterData) => {
    const { data } = await api.post(ENDPOINTS.REGISTER, registerData, OTP_TIMEOUT_MS);
    return data;
  },

  logout: async () => {
    await api.clearTokens();
    await SecureStore.deleteItemAsync('userRole');
    await SecureStore.deleteItemAsync('activeRole');
    set({ user: null, userRole: null, activeRole: null, isAuthenticated: false });
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
