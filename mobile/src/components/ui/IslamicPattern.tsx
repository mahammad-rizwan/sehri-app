import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { COLORS } from '../../constants/theme';

interface Props {
  opacity?: number;
  size?: number;
}

// Decorative Islamic geometric pattern for header/backgrounds
export function IslamicGeometric({ opacity = 0.08, size = 200 }: Props) {
  return (
    <View style={[styles.container, { width: size, height: size, opacity }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Outer circle */}
        <Circle cx="50" cy="50" r="45" stroke={COLORS.primary} strokeWidth="0.5" fill="none" />
        {/* Inner geometric star pattern */}
        <Path
          d="M50 10 L60 35 L90 35 L67 52 L76 78 L50 62 L24 78 L33 52 L10 35 L40 35 Z"
          stroke={COLORS.primary}
          strokeWidth="0.7"
          fill="none"
        />
        <Path
          d="M50 20 L57 38 L78 38 L62 50 L68 68 L50 56 L32 68 L38 50 L22 38 L43 38 Z"
          stroke={COLORS.primaryLight}
          strokeWidth="0.4"
          fill="none"
        />
        {/* Center circle */}
        <Circle cx="50" cy="50" r="8" stroke={COLORS.primary} strokeWidth="0.5" fill="none" />
        {/* Lines */}
        <Line x1="50" y1="5" x2="50" y2="95" stroke={COLORS.primary} strokeWidth="0.3" />
        <Line x1="5" y1="50" x2="95" y2="50" stroke={COLORS.primary} strokeWidth="0.3" />
        <Line x1="15" y1="15" x2="85" y2="85" stroke={COLORS.primary} strokeWidth="0.3" />
        <Line x1="85" y1="15" x2="15" y2="85" stroke={COLORS.primary} strokeWidth="0.3" />
      </Svg>
    </View>
  );
}

// Crescent moon decoration
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

// Bismillah text separator
export function GoldenDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <View style={styles.dividerDiamond} />
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerDiamond: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.primary,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 12,
  },
});
