import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ScrollView, Animated, Easing, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RESPONSIVE, SHADOWS } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import { CrescentMoon, IslamicGeometric, GoldenDivider, StarDivider } from '../../components/ui/IslamicPattern';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48 - 12) / 2;

const features = [
  { icon: '🕌', title: 'Zone-Based', desc: 'Masjid, Hostel, Stanza & Girls', color: '#C9A84C' },
  { icon: '🗳️', title: 'Daily Poll', desc: 'Tell us your Sehri need', color: '#4FC3F7' },
  { icon: '🎁', title: 'Easy Donate', desc: 'Support via PhonePe/GPay', color: '#4CAF50' },
  { icon: '🛵', title: 'Live Track', desc: 'Track food rider in real-time', color: '#FF9800' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(40)).current;
  const featureFades = useRef(features.map(() => new Animated.Value(0))).current;
  const featureScales = useRef(features.map(() => new Animated.Value(0.8))).current;
  const hadithFade = useRef(new Animated.Value(0)).current;
  const hadithSlide = useRef(new Animated.Value(30)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const geometricRotate = useRef(new Animated.Value(0)).current;

  const riderTapCountRef = useRef(0);
  const riderTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 700, easing: Easing.out(Easing.back as any), useNativeDriver: true }),
      ]),
      Animated.stagger(120, featureFades.map((f, i) =>
        Animated.parallel([
          Animated.timing(f, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(featureScales[i], { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        ])
      )),
      Animated.parallel([
        Animated.timing(hadithFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(hadithSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(buttonFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(geometricRotate, { toValue: 1, duration: 50000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

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
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      <Animated.View style={[styles.geometricBg, { transform: [{ rotate: geoSpin }] }]}>
        <IslamicGeometric opacity={0.06} size={width * 1.4} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          <TouchableOpacity activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <CrescentMoon size={65} color={COLORS.primary} />
            </Animated.View>
          </TouchableOpacity>
          <Text style={styles.bismillah}>بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</Text>
          <Text style={styles.appName}>Sehri Connect</Text>
          <Text style={styles.subtitle}>✨ Ramzan Sehri Food Distribution ✨</Text>
        </Animated.View>

        <StarDivider />

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>About The App</Text>
          <Text style={styles.aboutText}>
            Sehri Connect is a comprehensive platform for managing Ramzan Sehri
            food distribution across multiple zones. Our mission is to ensure every
            fasting Muslim receives their blessed meal before Fajr.
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          {features.map((f, i) => {
            const isRiderCard = i === 3;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.featureCard,
                  {
                    opacity: featureFades[i],
                    transform: [
                      { translateY: featureFades[i].interpolate({ inputRange: [0, 1], outputRange: [25, 0] }) },
                      { scale: featureScales[i] },
                    ],
                    borderColor: `${f.color}30`,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={isRiderCard ? handleRiderCardPress : undefined}
                  activeOpacity={isRiderCard ? 0.7 : 1}
                  style={styles.featureCardInner}
                >
                  <LinearGradient
                    colors={[`${f.color}25`, `${f.color}08`]}
                    style={[styles.featureIconBg, { borderColor: `${f.color}35` }]}
                  >
                    <Text style={styles.featureIcon}>{f.icon}</Text>
                  </LinearGradient>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View style={{ opacity: hadithFade, transform: [{ translateY: hadithSlide }] }}>
          <LinearGradient
            colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']}
            style={styles.hadithBanner}
          >
            <Text style={styles.hadithIcon}>📖</Text>
            <Text style={styles.hadithText}>
              "Whoever feeds a fasting person will have a reward like that of the
              fasting person, without any reduction in his reward."
            </Text>
            <Text style={styles.hadithSource}>— Tirmidhi</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: buttonFade }]}>
          <GoldButton
            title="📱  Login with Phone"
            onPress={() => router.push('/(auth)/login')}
            size="lg"
            style={styles.actionBtn}
            glow
          />
          <GoldButton
            title="📝  Register as New User"
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
            size="lg"
            style={styles.actionBtn}
          />
        </Animated.View>

        <View style={{ height: RESPONSIVE.hp(4) }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  geometricBg: { position: 'absolute', top: -60, alignSelf: 'center' },
  scroll: {
    paddingHorizontal: SIZES.spacing.xl,
    paddingTop: RESPONSIVE.hp(7),
    paddingBottom: 40,
  },
  header: { alignItems: 'center', marginBottom: SIZES.spacing.xl },
  bismillah: {
    color: COLORS.primary, fontSize: SIZES.md,
    marginTop: SIZES.spacing.md, marginBottom: SIZES.spacing.sm,
    fontStyle: 'italic',
  },
  appName: {
    color: COLORS.textPrimary, fontSize: SIZES.xxl,
    fontWeight: '800', letterSpacing: 2.5,
    textShadowColor: 'rgba(201,168,76,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: COLORS.textSecondary, fontSize: SIZES.sm,
    marginTop: 6, letterSpacing: 1.5, fontWeight: '500',
  },
  about: {
    marginVertical: SIZES.spacing.lg,
    backgroundColor: 'rgba(26,46,69,0.5)',
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.12)',
  },
  aboutTitle: {
    color: COLORS.primary, fontSize: SIZES.md,
    fontWeight: '700', marginBottom: SIZES.spacing.sm,
  },
  aboutText: {
    color: COLORS.textSecondary, fontSize: SIZES.sm,
    lineHeight: 22, marginBottom: SIZES.spacing.sm,
  },
  featuresGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, marginVertical: SIZES.spacing.lg,
  },
  featureCard: {
    width: CARD_W,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.md,
    borderWidth: 1,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  featureCardInner: { alignItems: 'center', width: '100%' },
  featureIconBg: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1, alignItems: 'center',
    justifyContent: 'center', marginBottom: 10,
  },
  featureIcon: { fontSize: 26 },
  featureTitle: {
    color: COLORS.textPrimary, fontSize: SIZES.xs,
    fontWeight: '700', textAlign: 'center', marginBottom: 4,
  },
  featureDesc: {
    color: COLORS.textMuted, fontSize: 10,
    textAlign: 'center', lineHeight: 14,
  },
  hadithBanner: {
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.base,
    marginVertical: SIZES.spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    alignItems: 'center',
  },
  hadithIcon: { fontSize: 28, marginBottom: 8 },
  hadithText: {
    color: COLORS.textPrimary, fontSize: SIZES.sm,
    fontStyle: 'italic', lineHeight: 22, textAlign: 'center',
  },
  hadithSource: {
    color: COLORS.primary, fontSize: SIZES.xs,
    textAlign: 'right', marginTop: 8, fontWeight: '600',
  },
  actions: {
    marginTop: SIZES.spacing.xl,
    gap: 14,
    alignItems: 'center',
  },
  actionBtn: { width: '100%' },
});
