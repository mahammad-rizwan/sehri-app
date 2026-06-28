import React, { useRef } from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle,
  ActivityIndicator, View, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  glow?: boolean;
}

export default function GoldButton({
  title, onPress, loading = false, disabled = false,
  style, textStyle, variant = 'solid', size = 'md', icon, glow = false,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const sizeStyles = {
    sm: { py: 8, px: 16, fs: SIZES.sm },
    md: { py: 14, px: 24, fs: SIZES.base },
    lg: { py: 18, px: 32, fs: SIZES.md },
  };

  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, tension: 150, friction: 5, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 5, useNativeDriver: true }).start();
  };

  const s = sizeStyles[size];

  if (variant === 'outline') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onPress}
          disabled={isDisabled}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.85}
          style={[
            styles.outline,
            { paddingVertical: s.py, paddingHorizontal: s.px },
            isDisabled && styles.disabled,
            glow && styles.outlineGlow,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <View style={styles.row}>
              {icon && <View style={styles.iconWrap}>{icon}</View>}
              <Text style={[styles.outlineText, { fontSize: s.fs }, textStyle]}>{title}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (variant === 'ghost') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onPress}
          disabled={isDisabled}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
          style={[styles.ghost, isDisabled && styles.disabled, style]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <View style={styles.row}>
              {icon && <View style={styles.iconWrap}>{icon}</View>}
              <Text style={[styles.ghostText, { fontSize: s.fs }, textStyle]}>{title}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], ...(glow ? SHADOWS.glow : {}) }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={[isDisabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={isDisabled ? ['#555', '#444'] : [COLORS.primary, COLORS.primaryLight, COLORS.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.button,
            { paddingVertical: s.py, paddingHorizontal: s.px },
            SHADOWS.gold,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
          ) : (
            <View style={styles.row}>
              {icon && <View style={styles.iconWrap}>{icon}</View>}
              <Text style={[styles.text, { fontSize: s.fs }, textStyle]}>{title}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: SIZES.radius.full, alignItems: 'center', justifyContent: 'center' },
  text: { color: COLORS.textOnPrimary, fontWeight: '700', letterSpacing: 0.5 },
  outline: {
    borderRadius: SIZES.radius.full, borderWidth: 1.5, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  outlineGlow: { borderColor: COLORS.primaryLight, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  outlineText: { color: COLORS.primary, fontWeight: '600' },
  ghost: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  ghostText: { color: COLORS.primary, fontWeight: '500' },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { marginRight: 8 },
});
