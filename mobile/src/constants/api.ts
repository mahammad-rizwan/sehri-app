// API Configuration
// For Android emulator use: http://10.0.2.2:5000/api
// For iOS simulator use:    http://localhost:5000/api
// For physical device use:  http://10.140.44.133:5000/api
export const API_BASE_URL = __DEV__
  ? 'http://10.71.183.133:5000/api'    // Your machine's LAN IP for device testing
  : 'https://api.sehriconnect.com/api'; // Production URL

export const API_TIMEOUT = 15000; // 15 seconds

export const ENDPOINTS = {
  // Auth
  SEND_OTP: '/auth/send-otp',
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  REFRESH_TOKEN: '/auth/refresh',
  FCM_TOKEN: '/auth/fcm-token',
  CREATE_ADMIN: '/auth/create-admin',
  CREATE_SUPER_ADMIN: '/auth/create-super-admin',
  LIST_ADMINS: '/auth/list-admins',
  DELETE_ADMIN: (id: string) => `/auth/admins/${id}`,
  DELETE_SUPER_ADMIN: (id: string) => `/auth/super-admins/${id}`,
  SWITCH_ROLE: '/auth/switch-role',
  ZONE_ADMIN: '/auth/zone-admin',
  FORGOT_PASSWORD_SEND_OTP: '/auth/forgot-password/send-otp',
  FORGOT_PASSWORD_VERIFY_OTP: '/auth/forgot-password/verify-otp',
  FORGOT_PASSWORD_RESET: '/auth/forgot-password/reset',

  // Users
  ME: '/users/me',
  USERS: '/users',
  USER_STATUS: (id: string) => `/users/${id}/status`,
  USER_DELETE: (id: string) => `/users/${id}`,
  REQUEST_PROFILE_EDIT: '/users/request-profile-edit',
  PROFILE_EDIT_REQUESTS: '/users/profile-edit-requests',

  // Polls
  ACTIVE_POLL: '/polls/active',
  ACTIVE_POLL_STATS: '/polls/active/stats',
  ACTIVE_POLL_TOGGLE: '/polls/active/toggle',
  TODAY_POLL: '/polls/active',
  TOMORROW_POLL: '/polls/active',
  TOMORROW_POLL_STATS: '/polls/active/stats',
  TODAY_POLL_STATS: '/polls/active/stats',
  POLL_RESPOND: (id: string) => `/polls/${id}/respond`,
  POLL_SPECIAL_CASE: (id: string) => `/polls/${id}/special-case`,
  POLL_SPECIAL_CASE_UNDO: (id: string) => `/polls/${id}/special-case/undo`,
  POLL_STATS: (id: string) => `/polls/${id}/stats`,
  POLL_HISTORY: '/polls/history',
  MY_POLL_HISTORY: '/polls/my-responses',
  POLL_DATE_STATS: (date: string) => `/polls/date/${date}/stats`,
  POLL_ZONE_VOTERS: (id: string) => `/polls/${id}/zone-voters`,

  // Donations
  CREATE_ORDER: '/donations/create-order',
  VERIFY_PAYMENT: '/donations/verify-payment',
  DONATION_HISTORY: '/donations/history',
  DONATION_SUMMARY: '/donations/summary',

  // Feedback
  FEEDBACK: '/feedback',
  MY_FEEDBACK: '/feedback/my',

  // Tracking
  ACTIVE_TRACKING: '/tracking/active',
  ALL_RIDERS: '/tracking/all',
  RIDER_LOGIN: '/tracking/rider-login',
  PUSH_LOCATION: (id: string) => `/tracking/${id}/push-location`,
  DELETE_RIDER: (id: string) => `/tracking/${id}`,

  // Chat
  CHAT_GROUPS: '/chat/groups',
  CHAT_GROUP_DETAIL: (id: string) => `/chat/groups/${id}`,
  CHAT_GROUP_MEMBERS: (id: string) => `/chat/groups/${id}/members`,
  CHAT_GROUP_MEMBER_DELETE: (groupId: string, userId: string) => `/chat/groups/${groupId}/members/${userId}`,
  CHAT_GROUP_MESSAGES: (id: string) => `/chat/groups/${id}/messages`,
  CHAT_SEND_MESSAGE: (id: string) => `/chat/groups/${id}/messages`,
  CHAT_DELETE_MESSAGE: (groupId: string, msgId: string) => `/chat/groups/${groupId}/messages/${msgId}`,
  CHAT_ADMINS: '/chat/admins',
  CHAT_DELETE_GROUP: (id: string) => `/chat/groups/${id}`,
  CHAT_MARK_READ: (id: string) => `/chat/groups/${id}/read`,
};
