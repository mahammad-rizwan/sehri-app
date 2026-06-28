import React, { useRef } from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, SIZES } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  gradient?: boolean;
  golden?: boolean;
  onPress?: () => void;
  pressable?: boolean;
}

export default function PremiumCard({ children, style, gradient = false, golden = false, onPress, pressable = false }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, tension: 200, friction: 8, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }).start();
  };

  const cardContent = () => {
    if (golden) {
      return (
        <LinearGradient
          colors={['#2A1F00', '#1E1600', '#2A1F00']}
          style={[styles.card, styles.goldenBorder, SHADOWS.gold, style]}
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

    return <View style={[styles.card, style]}>{children}</View>;
  };

  const content = cardContent();

  if (pressable || onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.95}
        >
          {content}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return content;
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
  goldenBorder: { borderWidth: 1, borderColor: COLORS.primary },
  goldenInner: { flex: 1 },
});
