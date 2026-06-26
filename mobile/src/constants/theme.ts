// 🌙 Sehri Connect Premium Islamic Theme

export const COLORS = {
  // Primary palette - Deep Night Sky
  primary: '#C9A84C',         // Islamic Gold
  primaryLight: '#E8C97A',    // Light Gold
  primaryDark: '#A07C30',     // Deep Gold

  // Background shades - Night gradient
  background: '#0D1B2A',      // Deep Navy Night
  backgroundSecondary: '#152336', // Lighter Navy
  backgroundCard: '#1A2E45',  // Card background
  backgroundElevated: '#1F3654', // Elevated card

  // Surface
  surface: '#1A2E45',
  surfaceLight: '#223348',

  // Text
  textPrimary: '#F0E6C8',     // Warm White (parchment)
  textSecondary: '#A8B8C8',   // Muted blue-grey
  textMuted: '#6B7C8A',       // Very muted
  textOnPrimary: '#0D1B2A',   // Dark text on gold buttons

  // Accents
  accent: '#4FC3F7',          // Sky Blue accent
  accentGreen: '#4CAF50',     // Success green
  accentRed: '#EF5350',       // Error red
  accentOrange: '#FF9800',    // Warning orange

  // Zone colors
  zonesMasjid: '#C9A84C',     // Gold for Masjid
  zonesBoysHostel: '#4FC3F7',     // Blue for Boys Hostel
  zonesStanza: '#AB47BC',     // Purple for Stanza
  zonesGirls: '#EC407A', // Pink for Girls

  // Border
  border: '#2A3F55',
  borderLight: '#334D66',

  // Overlay
  overlay: 'rgba(13, 27, 42, 0.85)',
  overlayLight: 'rgba(13, 27, 42, 0.5)',

  // Gradients defined below
  gradientPrimary: ['#0D1B2A', '#1A3050'],
  gradientGold: ['#C9A84C', '#E8C97A'],
  gradientCard: ['#1A2E45', '#152336'],
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  light: 'System',
};

export const SIZES = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 19,
  xl: 22,
  xxl: 26,
  xxxl: 32,
  display: 40,

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },

  // Border radius
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    round: 50,
    full: 999,
  },

  // Icon sizes
  icon: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  gold: {
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const ZONE_CONFIG = {
  masjid:      { label: 'Masjid Zone',     color: COLORS.zonesMasjid,     icon: 'mosque',   emoji: '🕌' },
  boys_hostel: { label: 'Boys Hostel Zone', color: COLORS.zonesBoysHostel, icon: 'building', emoji: '🏠' },
  stanza:      { label: 'Stanza Zone',     color: COLORS.zonesStanza,     icon: 'home',     emoji: '🏡' },
  girls:       { label: 'Girls Zone',      color: COLORS.zonesGirls,      icon: 'heart',    emoji: '🌸' },
} as const;

export const AREA_CONFIG = {
  kengeri:       { label: 'Kengeri',      emoji: '📍' },
  nayandahalli:  { label: 'Nayandahalli', emoji: '📍' },
  nagarabavi:    { label: 'Nagarabavi',   emoji: '📍' },
  uttarahalli:   { label: 'Uttarahalli',  emoji: '📍' },
} as const;

export const BANGALORE_AREAS = {
  south: { label: 'South Bangalore', emoji: '📍', localities: ['kengeri', 'nayandahalli'] },
  north: { label: 'North Bangalore', emoji: '📍', localities: ['nagarabavi'] },
  east:  { label: 'East Bangalore',  emoji: '📍', localities: [] },
  west:  { label: 'West Bangalore',  emoji: '📍', localities: ['uttarahalli'] },
} as const;

// Colleges available per locality
export const LOCALITY_COLLEGES: Record<string, { key: string; label: string }[]> = {
  kengeri: [
    { key: 'rv_college',  label: 'RV College' },
    { key: 'donbosco',    label: 'Don Bosco' },
    { key: 'rr_college',  label: 'RR College' },
  ],
  // Other localities — future expansion
  nayandahalli: [],
  nagarabavi:   [],
  uttarahalli:  [],
};

// Internal zones per college — keys match backend DB zone ENUM values
export const COLLEGE_ZONES: Record<string, { key: string; label: string; emoji: string; color: string }[]> = {
  rv_college: [
    { key: 'masjid',      label: 'Masjid Zone',     emoji: '🕌', color: '#C9A84C' },
    { key: 'stanza',      label: 'Stanza Zone',     emoji: '🏡', color: '#AB47BC' },
    { key: 'boys_hostel', label: 'Boys Hostel Zone', emoji: '🏠', color: '#4FC3F7' },
    { key: 'girls',       label: 'Girls Zone',      emoji: '🌸', color: '#EC407A' },
  ],
  donbosco:   [],
  rr_college: [],
};

// PG / address options per zone — keys match COLLEGE_ZONES keys
export const ZONE_ADDRESSES: Record<string, { key: string; label: string }[]> = {
  masjid: [
    { key: 'maruthi_pg',     label: 'Maruthi PG' },
    { key: 'infront_masjid', label: 'Infront of Masjid' },
    { key: 'dubasipalya',    label: 'Dubasipalya' },
    { key: 'others',         label: 'Others' },
  ],
  boys_hostel: [
    { key: 'cauvery_hostel', label: 'Cauvery Hostel' },
    { key: 'sir_mv_hostel',  label: 'Sir MV Hostel' },
    { key: 'krishna_hostel', label: 'Krishna Hostel' },
    { key: 'chamundi',       label: 'Chamundi' },
    { key: 'others',         label: 'Others' },
  ],
  stanza: [
    { key: 'lasya_pg',          label: 'Lasya PG' },
    { key: 'shiva_sai_pg',      label: 'Shiva Sai PG' },
    { key: 'stanza_huelva',     label: 'Stanza Living (Huelva House)' },
    { key: 'global_vista',      label: 'Global Vista' },
    { key: 'ss_luxury_pg',      label: 'SS Luxury PG' },
    { key: 'good_lands_pg',     label: 'Good Lands PG' },
    { key: 'millennial_blue',   label: 'Millenial Blue Opal' },
    { key: 'paras_global',      label: 'Paras Global Kutir' },
    { key: 'kings_queens',      label: 'Kings and Queens PG' },
    { key: 'stanza_cordoba',    label: 'Stanza Living (Cordoba)' },
    { key: 'target_pg',         label: 'Target PG' },
    { key: 'rr_luxury_pg',      label: 'RR Luxury PG' },
    { key: 'krishna_villa',     label: 'Krishna Villa Apartments' },
    { key: 'balaji_pg',         label: 'Balaji PG for Gents' },
    { key: 'others',            label: 'Others' },
  ],
  girls: [
    { key: 'chaitrashree',      label: 'Chaitrashree Comforts' },
    { key: 'chiguru',           label: 'Chiguru PG for Ladies' },
    { key: 'global_residency',  label: 'Global Residency' },
    { key: 'global_vista_apt',  label: 'Global Vista Apartment' },
    { key: 'goodlands_ladies',  label: 'Goodlands Luxury Ladies PG' },
    { key: 'habitat_illuminar', label: 'Habitat Illuminar' },
    { key: 'jv_queens',         label: 'JV Queens PG' },
    { key: 'jv_queens_prime',   label: 'JV Queens Prime PG' },
    { key: 'krishna_global',    label: 'Krishna Global Villaments' },
    { key: 'new_sl_ladies',     label: 'New SL Ladies PG' },
    { key: 'rvce_dj_hostel',    label: 'RVCE Girls DJ Hostel' },
    { key: 'rvce_krishna',      label: 'RVCE Girls Krishna Garden Hostel' },
    { key: 'sai_ram_luxury',    label: 'Sai Ram Luxury PG for Ladies' },
    { key: 'samruddhi',         label: 'Samruddhi PG for Ladies' },
    { key: 'sl_grand_luxury',   label: 'SL Grand Luxury Ladies PG' },
    { key: 'sl_prime',          label: 'SL Prime PG for Ladies' },
    { key: 'sln_grand',         label: 'SLN Grand' },
    { key: 'sri_ladies',        label: 'Sri Ladies PG' },
    { key: 'sri_sai_durga',     label: 'Sri Sai Durga Ladies PG' },
    { key: 'sri_vengamamba',    label: 'Sri Vengamamba PG' },
    { key: 'ss_homestay',       label: 'SS Home Stay' },
    { key: 'ssr_pg',            label: 'SSR PG for Ladies' },
    { key: 'stanza_granada',    label: 'Stanza Living Granada House' },
    { key: 'stanza_nome',       label: 'Stanza Living Nome House' },
    { key: 'stay_luxe',         label: 'Stay Luxe Inn' },
    { key: 'millennial_topaz1', label: 'The Millennial Topaz 1' },
    { key: 'millennial_topaz2', label: 'The Millennial Topaz 2' },
    { key: 'others',            label: 'Others' },
  ],
};

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
