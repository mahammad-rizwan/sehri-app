import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle,
  ActivityIndicator, View,
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
}

export default function GoldButton({
  title, onPress, loading = false, disabled = false,
  style, textStyle, variant = 'solid', size = 'md', icon,
}: Props) {
  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: SIZES.sm },
    md: { paddingVertical: 14, paddingHorizontal: 24, fontSize: SIZES.base },
    lg: { paddingVertical: 18, paddingHorizontal: 32, fontSize: SIZES.md },
  };

  const isDisabled = disabled || loading;

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[
          styles.outline,
          { paddingVertical: sizeStyles[size].paddingVertical, paddingHorizontal: sizeStyles[size].paddingHorizontal },
          isDisabled && styles.disabled,
          style,
        ]}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="small" />
        ) : (
          <View style={styles.row}>
            {icon && <View style={styles.iconWrap}>{icon}</View>}
            <Text style={[styles.outlineText, { fontSize: sizeStyles[size].fontSize }, textStyle]}>
              {title}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.ghost, isDisabled && styles.disabled, style]}
        activeOpacity={0.6}
      >
        <Text style={[styles.ghostText, { fontSize: sizeStyles[size].fontSize }, textStyle]}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[isDisabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={isDisabled ? ['#555', '#444'] : [COLORS.primary, COLORS.primaryLight, COLORS.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.button,
          { paddingVertical: sizeStyles[size].paddingVertical, paddingHorizontal: sizeStyles[size].paddingHorizontal },
          SHADOWS.gold,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
        ) : (
          <View style={styles.row}>
            {icon && <View style={styles.iconWrap}>{icon}</View>}
            <Text style={[styles.text, { fontSize: sizeStyles[size].fontSize }, textStyle]}>
              {title}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: SIZES.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  outline: {
    borderRadius: SIZES.radius.full,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  ghost: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  ghostText: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    marginRight: 8,
  },
});
