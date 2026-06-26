import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, SIZES } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  gradient?: boolean;
  golden?: boolean;
}

export default function PremiumCard({ children, style, gradient = false, golden = false }: Props) {
  if (golden) {
    return (
      <LinearGradient
        colors={['#2A1F00', '#1E1600', '#2A1F00']}
        style={[styles.card, styles.goldenBorder, style]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.goldenInner}>{children}</View>
      </LinearGradient>
    );
  }

  if (gradient) {
    return (
      <LinearGradient
        colors={[COLORS.backgroundCard, COLORS.backgroundSecondary]}
        style={[styles.card, style]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  goldenBorder: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  goldenInner: {
    flex: 1,
  },
});
