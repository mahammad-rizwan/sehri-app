import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { CrescentMoon, IslamicGeometric } from '../../components/ui/IslamicPattern';

const { width, height } = Dimensions.get('window');
const STARS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: Math.random() * width,
  top: Math.random() * height,
  size: 2 + Math.random() * 4,
  delay: Math.random() * 2000,
  duration: 1500 + Math.random() * 2000,
}));

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const moonAnim = useRef(new Animated.Value(-120)).current;
  const moonGlow = useRef(new Animated.Value(0)).current;
  const bismillahFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const dividerScale = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const footerFade = useRef(new Animated.Value(0)).current;
  const starAnims = useRef(STARS.map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      // Crescent moon slides down with glow
      Animated.parallel([
        Animated.spring(moonAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(moonGlow, { toValue: 1, duration: 1500, useNativeDriver: true }),
            Animated.timing(moonGlow, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
          ])
        ),
      ]),
      // Content fades in with scale
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      ]),
      // Bismillah
      Animated.timing(bismillahFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      // Title slides up
      Animated.timing(titleSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.back as any), useNativeDriver: true }),
      // Tagline
      Animated.timing(taglineFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      // Divider scales
      Animated.spring(dividerScale, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      // Subtitle
      Animated.timing(subtitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      // Footer
      Animated.timing(footerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Pulsing animation for the entire content
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Continuous slow rotation for geometric pattern
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Animate stars twinkling
    starAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: STARS[i].duration, delay: STARS[i].delay, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration: STARS[i].duration, useNativeDriver: true }),
        ])
      ).start();
    });

    // Boot sequence
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
      }, 2800);
    };

    boot();
  }, []);

  const spinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#020810', '#0D1B2A', '#152336', '#0D1B2A']}
      style={styles.container}
    >
      {/* Twinkling stars */}
      {STARS.map((star, i) => (
        <Animated.View
          key={star.id}
          style={[
            styles.star,
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: starAnims[i],
            },
          ]}
        />
      ))}

      {/* Rotating geometric pattern */}
      <Animated.View style={[styles.geometricContainer, { transform: [{ rotate: spinInterpolation }] }]}>
        <IslamicGeometric opacity={0.15} size={width * 1.4} />
      </Animated.View>

      {/* Crescent moon with glow */}
      <Animated.View style={[styles.moonContainer, { transform: [{ translateY: moonAnim }] }]}>
        <Animated.View
          style={[
            styles.moonGlow,
            {
              opacity: moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
              transform: [{ scale: moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
            },
          ]}
        />
        <CrescentMoon size={80} color={COLORS.primary} />
      </Animated.View>

      {/* Main content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
          },
        ]}
      >
        <Animated.Text style={[styles.bismillah, { opacity: bismillahFade }]}>
          بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
        </Animated.Text>

        <Animated.Text
          style={[
            styles.appName,
            {
              opacity: bismillahFade,
              transform: [{ translateY: titleSlide }],
            },
          ]}
        >
          Sehri Connect
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: taglineFade }]}>
          🌙 Ramzan Sehri Food Distribution
        </Animated.Text>

        <Animated.View
          style={[
            styles.divider,
            {
              transform: [{ scaleX: dividerScale }],
            },
          ]}
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
        <Text style={styles.footerText}>Ramzan Mubarak 🌙</Text>
        <Text style={styles.footerSubtext}>✨ 1446 AH - 2025 ✨</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
    backgroundColor: COLORS.primary,
  },
  geometricContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonContainer: {
    marginBottom: SIZES.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SIZES.spacing.xxxl,
  },
  bismillah: {
    color: COLORS.primary,
    fontSize: SIZES.lg,
    marginBottom: SIZES.spacing.md,
    fontStyle: 'italic',
  },
  appName: {
    color: COLORS.textPrimary,
    fontSize: Math.min(SIZES.xxxl, width * 0.1),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: SIZES.spacing.sm,
    textShadowColor: 'rgba(201, 168, 76, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SIZES.spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginVertical: SIZES.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerStar: {
    color: COLORS.primary,
    marginHorizontal: 12,
    fontSize: 14,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: SIZES.spacing.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.primary,
    fontSize: SIZES.sm,
    letterSpacing: 2,
  },
  footerSubtext: {
    color: COLORS.textMuted,
    fontSize: SIZES.xs,
    marginTop: 4,
    letterSpacing: 1,
  },
});
