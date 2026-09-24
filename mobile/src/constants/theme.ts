import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const scale = SCREEN_WIDTH / 390;

export function responsiveSize(size: number) {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export const RESPONSIVE = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: SCREEN_WIDTH < 360,
  isMedium: SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 400,
  isLarge: SCREEN_WIDTH >= 400,
  isTablet: SCREEN_WIDTH >= 768,
  scale,
  wp: (percent: number) => (SCREEN_WIDTH * percent) / 100,
  hp: (percent: number) => (SCREEN_HEIGHT * percent) / 100,
};

export const COLORS = {
  primary: '#C9A84C',
  primaryLight: '#E8C97A',
  primaryDark: '#A07C30',
  primaryGlow: 'rgba(201, 168, 76, 0.25)',

  background: '#0D1B2A',
  backgroundSecondary: '#152336',
  backgroundCard: '#1A2E45',
  backgroundElevated: '#1F3654',

  surface: '#1A2E45',
  surfaceLight: '#223348',

  textPrimary: '#F0E6C8',
  textSecondary: '#A8B8C8',
  textMuted: '#6B7C8A',
  textOnPrimary: '#0D1B2A',

  accent: '#4FC3F7',
  accentGreen: '#4CAF50',
  accentRed: '#EF5350',
  accentOrange: '#FF9800',
  accentPurple: '#AB47BC',
  accentPink: '#EC407A',

  zonesMasjid: '#C9A84C',
  zonesBoysHostel: '#4FC3F7',
  zonesStanza: '#AB47BC',
  zonesGirls: '#EC407A',

  border: '#2A3F55',
  borderLight: '#334D66',

  overlay: 'rgba(13, 27, 42, 0.85)',
  overlayLight: 'rgba(13, 27, 42, 0.5)',

  gradientPrimary: ['#0D1B2A', '#1A3050'],
  gradientGold: ['#C9A84C', '#E8C97A'],
  gradientCard: ['#1A2E45', '#152336'],
  gradientSunset: ['#0D1B2A', '#1A2E45', '#152336'],
  gradientDeep: ['#020810', '#0D1B2A', '#152336'],
};

export const FONTS = {
  regular: Platform.OS === 'ios' ? 'System' : 'System',
  medium: Platform.OS === 'ios' ? 'System' : 'System',
  bold: Platform.OS === 'ios' ? 'System' : 'System',
};

export const SIZES = {
  xs: responsiveSize(11),
  sm: responsiveSize(13),
  base: responsiveSize(15),
  md: responsiveSize(17),
  lg: responsiveSize(19),
  xl: responsiveSize(22),
  xxl: responsiveSize(26),
  xxxl: responsiveSize(32),
  display: responsiveSize(40),
  spacing: {
    xs: responsiveSize(4),
    sm: responsiveSize(8),
    md: responsiveSize(12),
    base: responsiveSize(16),
    lg: responsiveSize(20),
    xl: responsiveSize(24),
    xxl: responsiveSize(32),
    xxxl: responsiveSize(48),
  },
  radius: {
    sm: responsiveSize(8),
    md: responsiveSize(12),
    lg: responsiveSize(16),
    xl: responsiveSize(20),
    round: responsiveSize(50),
    full: 999,
  },
  icon: {
    sm: responsiveSize(16),
    md: responsiveSize(20),
    lg: responsiveSize(24),
    xl: responsiveSize(32),
  },
  tabBar: {
    height: RESPONSIVE.isSmall ? 60 : RESPONSIVE.isMedium ? 65 : 70,
    iconSize: RESPONSIVE.isSmall ? 18 : 20,
  },
};

export const SHADOWS = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
  gold: { shadowColor: '#C9A84C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  glow: { shadowColor: '#C9A84C', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 },
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.44, shadowRadius: 10.32, elevation: 16 },
};

export const ZONE_CONFIG = {
  masjid: { label: 'Masjid Zone', color: COLORS.zonesMasjid, icon: 'mosque', emoji: '🕌' },
  boys_hostel: { label: 'Boys Hostel Zone', color: COLORS.zonesBoysHostel, icon: 'building', emoji: '🏠' },
  stanza: { label: 'Stanza Zone', color: COLORS.zonesStanza, icon: 'home', emoji: '🏡' },
  girls: { label: 'Girls Zone', color: COLORS.zonesGirls, icon: 'heart', emoji: '🌸' },
} as const;

export const AREA_CONFIG = {
  kengeri: { label: 'Kengeri', emoji: '📍' },
  nayandahalli: { label: 'Nayandahalli', emoji: '📍' },
  nagarabavi: { label: 'Nagarabavi', emoji: '📍' },
  uttarahalli: { label: 'Uttarahalli', emoji: '📍' },
} as const;

export const BANGALORE_AREAS = {
  south: { label: 'South Bangalore', emoji: '📍', localities: ['kengeri', 'nayandahalli'] },
  north: { label: 'North Bangalore', emoji: '📍', localities: ['nagarabavi'] },
  east: { label: 'East Bangalore', emoji: '📍', localities: [] },
  west: { label: 'West Bangalore', emoji: '📍', localities: ['uttarahalli'] },
} as const;

export const LOCALITY_COLLEGES: Record<string, { key: string; label: string }[]> = {
  kengeri: [{ key: 'rv_college', label: 'RV College' }, { key: 'donbosco', label: 'Don Bosco' }, { key: 'rr_college', label: 'RR College' }],
  nayandahalli: [],
  nagarabavi: [],
  uttarahalli: [],
};

export const COLLEGE_ZONES: Record<string, { key: string; label: string; emoji: string; color: string }[]> = {
  rv_college: [
    { key: 'masjid', label: 'Masjid Zone', emoji: '🕌', color: '#C9A84C' },
    { key: 'stanza', label: 'Stanza Zone', emoji: '🏡', color: '#AB47BC' },
    { key: 'boys_hostel', label: 'Boys Hostel Zone', emoji: '🏠', color: '#4FC3F7' },
    { key: 'girls', label: 'Girls Zone', emoji: '🌸', color: '#EC407A' },
  ],
  donbosco: [],
  rr_college: [],
};

// Addresses used to live here as a hardcoded list. They are now rows in
// `zone_addresses`, managed by a super admin under Zone & Map, and fetched
// by the registration and profile screens via `services/places.ts`.

export const OCCUPATIONS = {
  student: { label: 'Student', emoji: '📚' },
  employee: { label: 'Employee', emoji: '💼' },
  others: { label: 'Other', emoji: '👤' },
} as const;

export type ZoneKey = keyof typeof ZONE_CONFIG;
export type AreaKey = keyof typeof AREA_CONFIG;
export type BangaloreAreaKey = keyof typeof BANGALORE_AREAS;
export type OccupationKey = keyof typeof OCCUPATIONS;
export type Role = 'user' | 'admin' | 'super_admin';

/**
 * expo-linear-gradient requires at least two stops, so its `colors` prop is a
 * tuple rather than a plain array. Use this for any value passed to it.
 */
export type GradientColors = readonly [string, string, ...string[]];
