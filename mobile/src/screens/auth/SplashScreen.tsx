import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, RESPONSIVE, SHADOWS } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { CrescentMoon, IslamicGeometric } from '../../components/ui/IslamicPattern';

const { width, height } = Dimensions.get('window');

const STARS = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  left: Math.random() * width,
  top: Math.random() * height,
  size: 1 + Math.random() * 4,
  delay: Math.random() * 2500,
  duration: 1200 + Math.random() * 2500,
}));

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const moonAnim = useRef(new Animated.Value(-150)).current;
  const moonGlow = useRef(new Animated.Value(0)).current;
  const bismillahFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(50)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const dividerScale = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const footerFade = useRef(new Animated.Value(0)).current;
  const starAnims = useRef(STARS.map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(moonAnim, { toValue: 0, tension: 35, friction: 7, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(moonGlow, { toValue: 1, duration: 1800, useNativeDriver: true }),
            Animated.timing(moonGlow, { toValue: 0.3, duration: 1800, useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowPulse, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
            Animated.timing(glowPulse, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
          ])
        ),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 45, friction: 6, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(bismillahFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.back as any), useNativeDriver: true }),
      ]),
      Animated.timing(taglineFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(dividerScale, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
      Animated.timing(subtitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(footerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    starAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: STARS[i].duration, delay: STARS[i].delay, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.1, duration: STARS[i].duration, useNativeDriver: true }),
        ])
      ).start();
    });

    const boot = async () => {
      await useAuthStore.getState().initialize();
      const { isAuthenticated: authed, userRole } = useAuthStore.getState();
      setTimeout(() => {
        if (authed) {
          if (userRole === 'super_admin' || userRole === 'admin') {
            router.replace('/(app)/admin/dashboard');
          } else {
            router.replace('/(app)/home');
          }
        } else {
          router.replace('/(auth)/welcome');
        }
      }, 3000);
    };

    boot();
  }, []);

  const spinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#020810', '#0A1628', '#0D1B2A', '#152336']}
      style={styles.container}
    >
      {STARS.map((star, i) => (
        <Animated.View
          key={star.id}
          style={[
            styles.star,
            {
              left: star.left, top: star.top, width: star.size, height: star.size,
              borderRadius: star.size / 2,
              opacity: starAnims[i],
            },
          ]}
        />
      ))}

      <Animated.View style={[styles.geometricContainer, { transform: [{ rotate: spinInterpolation }] }]}>
        <IslamicGeometric opacity={0.12} size={width * 1.5} />
      </Animated.View>

      <Animated.View style={[styles.moonContainer, { transform: [{ translateY: moonAnim }] }]}>
        <Animated.View
          style={[
            styles.moonGlow,
            {
              opacity: moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] }),
              transform: [{ scale: moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.3] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.moonGlowOuter,
            { opacity: glowPulse, transform: [{ scale: glowPulse.interpolate({ inputRange: [0.3, 0.8], outputRange: [1, 1.4] }) }] },
          ]}
        />
        <CrescentMoon size={90} color={COLORS.primary} />
      </Animated.View>

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }] },
        ]}
      >
        <Animated.Text style={[styles.bismillah, { opacity: bismillahFade }]}>
          بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
        </Animated.Text>

        <Animated.Text
          style={[
            styles.appName,
            { opacity: titleFade, transform: [{ translateY: titleSlide }] },
          ]}
        >
          Sehri Connect
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: taglineFade }]}>
          🌙 Ramzan Sehri Food Distribution
        </Animated.Text>

        <Animated.View
          style={[styles.divider, { transform: [{ scaleX: dividerScale }] }]}
        >
          <View style={styles.dividerLine} />
          <Text style={styles.dividerStar}>✦</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        <Animated.Text style={[styles.subtitle, { opacity: subtitleFade }]}>
          Feeding the Ummah, One Sehri at a Time
        </Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: footerFade }]}>
        <Text style={styles.footerText}>✨ Ramzan Mubarak ✨</Text>
        <Text style={styles.footerSubtext}>1446 AH - 2025</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  star: { position: 'absolute', backgroundColor: COLORS.primary },
  geometricContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  moonContainer: {
    marginBottom: SIZES.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonGlow: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
  },
  moonGlowOuter: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(201, 168, 76, 0.05)',
  },
  content: { alignItems: 'center', paddingHorizontal: SIZES.spacing.xxxl },
  bismillah: {
    color: COLORS.primary, fontSize: SIZES.lg,
    marginBottom: SIZES.spacing.md, fontStyle: 'italic',
  },
  appName: {
    color: COLORS.textPrimary,
    fontSize: Math.min(SIZES.display, width * 0.11),
    fontWeight: '800', letterSpacing: 3,
    marginBottom: SIZES.spacing.sm,
    textShadowColor: 'rgba(201, 168, 76, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  tagline: {
    color: COLORS.textSecondary, fontSize: SIZES.sm,
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: SIZES.spacing.lg,
  },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    width: '70%', marginVertical: SIZES.spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerStar: { color: COLORS.primary, marginHorizontal: 12, fontSize: 16 },
  subtitle: {
    color: COLORS.textSecondary, fontSize: SIZES.sm,
    textAlign: 'center', fontStyle: 'italic',
    marginTop: SIZES.spacing.xs,
  },
  footer: {
    position: 'absolute', bottom: RESPONSIVE.hp(6),
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.primary, fontSize: SIZES.md,
    letterSpacing: 2, fontWeight: '600',
  },
  footerSubtext: {
    color: COLORS.textMuted, fontSize: SIZES.xs,
    marginTop: 6, letterSpacing: 1,
  },
});
