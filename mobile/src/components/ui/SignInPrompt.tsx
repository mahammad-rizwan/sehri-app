import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

/**
 * Shown to guests in place of anything that needs an identity — the Sehri
 * poll, donations, live tracking, feedback, profile.
 *
 * `card` sits inline inside a scroll view; `full` fills a whole tab.
 */
export default function SignInPrompt({
  title = 'Sign in to unlock this',
  message = 'This feature is tied to your account and delivery zone.',
  variant = 'card',
}: {
  title?: string;
  message?: string;
  variant?: 'card' | 'full';
}) {
  const router = useRouter();
  const exitGuest = useAuthStore((s) => s.exitGuest);

  // Leaving guest mode first means the splash screen won't bounce them back
  // into the guest tabs on the next launch.
  const go = async (path: string) => {
    await exitGuest();
    router.replace(path as any);
  };

  return (
    <View style={variant === 'full' ? st.full : undefined}>
      <LinearGradient
        colors={['rgba(201,168,76,0.16)', 'rgba(201,168,76,0.04)']}
        style={st.card}
      >
        <Text style={st.emoji}>🔒</Text>
        <Text style={st.title}>{title}</Text>
        <Text style={st.message}>{message}</Text>

        <TouchableOpacity style={st.primary} onPress={() => go('/(auth)/login')} activeOpacity={0.85}>
          <Text style={st.primaryTxt}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity style={st.secondary} onPress={() => go('/(auth)/register')} activeOpacity={0.8}>
          <Text style={st.secondaryTxt}>Create an account</Text>
        </TouchableOpacity>

        <Text style={st.foot}>
          You can keep reading the Quran, Duas and prayer timings without an account.
        </Text>
      </LinearGradient>
    </View>
  );
}

const st = StyleSheet.create({
  full: { flex: 1, justifyContent: 'center', padding: SIZES.spacing.base },
  card: {
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    padding: SIZES.spacing.lg,
    alignItems: 'center',
    marginHorizontal: SIZES.spacing.base,
    marginVertical: SIZES.spacing.sm,
  },
  emoji: { fontSize: 34 },
  title: {
    color: COLORS.textPrimary, fontSize: 16, fontWeight: '700',
    marginTop: 10, textAlign: 'center',
  },
  message: {
    color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 19,
    textAlign: 'center', marginTop: 6, paddingHorizontal: 6,
  },
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius.md,
    paddingVertical: 12, paddingHorizontal: 40,
    marginTop: 16, minWidth: 180, alignItems: 'center',
  },
  primaryTxt: { color: COLORS.textOnPrimary, fontSize: 14.5, fontWeight: '700' },
  secondary: { marginTop: 12, paddingVertical: 6 },
  secondaryTxt: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  foot: {
    color: COLORS.textMuted, fontSize: 11, lineHeight: 16,
    textAlign: 'center', marginTop: 14, paddingHorizontal: 10,
  },
});
