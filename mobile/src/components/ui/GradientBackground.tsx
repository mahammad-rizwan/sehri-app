import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  colors?: string[];
}

export default function GradientBackground({
  children,
  style,
  colors = [COLORS.background, COLORS.backgroundSecondary, '#0A1520'],
}: Props) {
  return (
    <LinearGradient
      colors={colors as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.3, y: 1 }}
      style={[styles.container, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
