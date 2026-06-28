import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Polygon } from 'react-native-svg';
import { COLORS } from '../../constants/theme';

interface Props {
  opacity?: number;
  size?: number;
}

export function IslamicGeometric({ opacity = 0.08, size = 200 }: Props) {
  return (
    <View style={[styles.container, { width: size, height: size, opacity }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="45" stroke={COLORS.primary} strokeWidth="0.5" fill="none" />
        <Path
          d="M50 10 L60 35 L90 35 L67 52 L76 78 L50 62 L24 78 L33 52 L10 35 L40 35 Z"
          stroke={COLORS.primary} strokeWidth="0.7" fill="none"
        />
        <Path
          d="M50 20 L57 38 L78 38 L62 50 L68 68 L50 56 L32 68 L38 50 L22 38 L43 38 Z"
          stroke={COLORS.primaryLight} strokeWidth="0.4" fill="none"
        />
        <Circle cx="50" cy="50" r="8" stroke={COLORS.primary} strokeWidth="0.5" fill="none" />
        <Line x1="50" y1="5" x2="50" y2="95" stroke={COLORS.primary} strokeWidth="0.3" />
        <Line x1="5" y1="50" x2="95" y2="50" stroke={COLORS.primary} strokeWidth="0.3" />
        <Line x1="15" y1="15" x2="85" y2="85" stroke={COLORS.primary} strokeWidth="0.3" />
        <Line x1="85" y1="15" x2="15" y2="85" stroke={COLORS.primary} strokeWidth="0.3" />
      </Svg>
    </View>
  );
}

export function CrescentMoon({ size = 40, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path
        d="M20 5 C10 5 5 12 5 20 C5 28 10 35 20 35 C16 35 14 30 14 25 C14 15 18 8 28 7 C26 6 23 5 20 5 Z"
        fill={color}
      />
      <Circle cx="28" cy="10" r="2" fill={color} />
    </Svg>
  );
}

export function GoldenDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <View style={styles.dividerDiamond} />
      <View style={styles.dividerLine} />
    </View>
  );
}

export function StarDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <View style={styles.star}>
        <Svg width="16" height="16" viewBox="0 0 16 16">
          <Polygon
            points="8,0 10,5.5 16,6 11.5,10 13,16 8,12.5 3,16 4.5,10 0,6 6,5.5"
            fill={COLORS.primary}
          />
        </Svg>
      </View>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function MosqueIcon({ size = 60, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Path d="M30 5 L30 15" stroke={color} strokeWidth="2" />
      <Path d="M20 10 L30 3 L40 10" stroke={color} strokeWidth="2" fill="none" />
      <Circle cx="30" cy="8" r="2" fill={color} />
      <Rect x="15" y="15" width="30" height="30" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      <Rect x="10" y="40" width="40" height="15" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      <Path d="M15 15 L15 40" stroke={color} strokeWidth="1" />
      <Path d="M45 15 L45 40" stroke={color} strokeWidth="1" />
      <Path d="M22 15 Q22 10 26 12" stroke={color} strokeWidth="1" fill="none" />
      <Path d="M38 15 Q38 10 34 12" stroke={color} strokeWidth="1" fill="none" />
    </Svg>
  );
}

export function CornerDecoration({ size = 50, color = COLORS.primaryLight }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 50 50">
      <Path
        d="M5 45 L5 5 L45 5"
        stroke={color}
        strokeWidth="1"
        fill="none"
        opacity={0.5}
      />
      <Path
        d="M15 35 L15 15 L35 15"
        stroke={color}
        strokeWidth="0.5"
        fill="none"
        opacity={0.3}
      />
      <Circle cx="5" cy="5" r="2" fill={color} opacity={0.6} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerDiamond: {
    width: 8, height: 8, backgroundColor: COLORS.primary,
    transform: [{ rotate: '45deg' }], marginHorizontal: 12,
  },
  star: { marginHorizontal: 10 },
});
