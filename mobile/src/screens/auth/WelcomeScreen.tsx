import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, Animated, Easing, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import { CrescentMoon, IslamicGeometric, GoldenDivider } from '../../components/ui/IslamicPattern';

const { width } = Dimensions.get('window');


const features = [
  { icon: '🕌', title: 'Zone-Based Distribution', desc: 'Masjid, Hostel, Stanza & Girls zones' },
  { icon: '🗳️', title: 'Daily Sehri Poll', desc: 'Tell us if you need food today' },
  { icon: '🤲', title: 'Easy Donation', desc: 'Support via PhonePe, GPay & more' },
  { icon: '🛵', title: 'Live Tracking', desc: 'Track your food rider in real-time' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(40)).current;
  const featureFades = useRef(features.map(() => new Animated.Value(0))).current;
  const hadithFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const geometricRotate = useRef(new Animated.Value(0)).current;

  // Rider hidden access via tap counter on Live Tracking feature card
  const riderTapCountRef = useRef(0);
  const riderTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Staggered entrance
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.back as any), useNativeDriver: true }),
      ]),
      Animated.stagger(150, featureFades.map((f) =>
        Animated.timing(f, { toValue: 1, duration: 400, useNativeDriver: true })
      )),
      Animated.timing(hadithFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(buttonFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Pulse animation for the crescent
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Slow rotation for geometric background
    Animated.loop(
      Animated.timing(geometricRotate, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  // Hidden rider tap handler — 5 taps on the 🛵 Live Tracking card
  const handleRiderCardPress = () => {
    riderTapCountRef.current += 1;
    if (riderTapTimerRef.current) clearTimeout(riderTapTimerRef.current);
    if (riderTapCountRef.current >= 5) {
      riderTapCountRef.current = 0;
      router.push('/(auth)/rider-login');
      return;
    }
    riderTapTimerRef.current = setTimeout(() => {
      riderTapCountRef.current = 0;
    }, 2000);
  };

  const geoSpin = geometricRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#050D16', '#0D1B2A', '#152336']}
      style={styles.container}
    >
      <Animated.View style={[styles.geometricBg, { transform: [{ rotate: geoSpin }] }]}>
        <IslamicGeometric opacity={0.07} size={width * 1.3} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with hidden super admin tap target */}
        <Animated.View
          style={[
            styles.header,
            { opacity: headerFade, transform: [{ translateY: headerSlide }] },
          ]}
        >
          <TouchableOpacity activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <CrescentMoon size={60} color={COLORS.primary} />
            </Animated.View>
          </TouchableOpacity>
          <Text style={styles.bismillah}>بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</Text>
          <Text style={styles.appName}>Sehri Connect</Text>
          <Text style={styles.subtitle}>Ramzan Sehri Food Distribution</Text>
        </Animated.View>

        <GoldenDivider />

        {/* About Section */}
        <View style={styles.about}>
          <Text style={styles.aboutTitle}>About The App</Text>
          <Text style={styles.aboutText}>
            Sehri Connect is a comprehensive platform for managing Ramzan Sehri
            (pre-dawn meal) food distribution across multiple zones. Our mission is to
            ensure every fasting Muslim receives their blessed meal before Fajr.
          </Text>
          <Text style={styles.aboutText}>
            The app enables seamless coordination between volunteers, admins,
            and recipients — from daily headcounts to live delivery tracking and
            community donations.
          </Text>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresGrid}>
          {features.map((f, i) => {
            // 🛵 Live Tracking card (index 3) — 5 taps opens rider login
            const isRiderCard = i === 3;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.featureCard,
                  { opacity: featureFades[i], transform: [{ translateY: featureFades[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
                ]}
              >
                <TouchableOpacity
                  onPress={isRiderCard ? handleRiderCardPress : undefined}
                  activeOpacity={isRiderCard ? 0.7 : 1}
                  style={styles.featureCardInner}
                >
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Hadith Banner */}
        <Animated.View style={{ opacity: hadithFade }}>
          <LinearGradient
            colors={['rgba(201,168,76,0.15)', 'rgba(201,168,76,0.05)']}
            style={styles.hadithBanner}
          >
            <Text style={styles.hadithText}>
              "Whoever feeds a fasting person will have a reward like that of the fasting
              person, without any reduction in his reward."
            </Text>
            <Text style={styles.hadithSource}>— Tirmidhi</Text>
          </LinearGradient>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[styles.actions, { opacity: buttonFade }]}>
          <GoldButton
            title="Login with Phone"
            onPress={() => router.push('/(auth)/login')}
            size="lg"
            style={styles.loginBtn}
          />
          <GoldButton
            title="Register as New User"
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
            size="lg"
            style={styles.registerBtn}
          />
        </Animated.View>

        {/* Bottom padding */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  geometricBg: { position: 'absolute', top: -50, alignSelf: 'center' },
  scroll: {
    paddingHorizontal: SIZES.spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.spacing.xl,
  },
  bismillah: {
    color: COLORS.primary,
    fontSize: SIZES.md,
    marginTop: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm,
  },
  appName: {
    color: COLORS.textPrimary,
    fontSize: SIZES.xxl,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    marginTop: 4,
    letterSpacing: 1,
  },
  about: {
    marginVertical: SIZES.spacing.lg,
  },
  aboutTitle: {
    color: COLORS.primary,
    fontSize: SIZES.lg,
    fontWeight: '700',
    marginBottom: SIZES.spacing.sm,
  },
  aboutText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    lineHeight: 22,
    marginBottom: SIZES.spacing.sm,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: SIZES.spacing.lg,
  },
  featureCard: {
    width: (width - SIZES.spacing.xl * 2 - 12) / 2,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.md,
    padding: SIZES.spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  featureCardInner: {
    alignItems: 'center',
    width: '100%',
  },
  featureIcon: { fontSize: 28, marginBottom: 8 },
  featureTitle: {
    color: COLORS.textPrimary,
    fontSize: SIZES.xs,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  featureDesc: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  hadithBanner: {
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.base,
    marginVertical: SIZES.spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  hadithText: {
    color: COLORS.textPrimary,
    fontSize: SIZES.sm,
    fontStyle: 'italic',
    lineHeight: 22,
    textAlign: 'center',
  },
  hadithSource: {
    color: COLORS.primary,
    fontSize: SIZES.xs,
    textAlign: 'right',
    marginTop: 8,
  },
  actions: {
    marginTop: SIZES.spacing.xl,
    gap: 12,
    alignItems: 'center',
  },
  loginBtn: { width: '100%' },
  registerBtn: { width: '100%' },
});
