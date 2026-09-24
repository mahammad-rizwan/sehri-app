import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ScrollView, Animated, Easing,
  TouchableOpacity, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RESPONSIVE, SHADOWS } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import { useAuthStore } from '../../store/authStore';
import { CrescentMoon, IslamicGeometric, StarDivider } from '../../components/ui/IslamicPattern';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48 - 12) / 2;

const features = [
  { icon: '🕌', title: 'Community', desc: 'Connect your masjid zone', color: '#C9A84C' },
  { icon: '🗳️', title: 'Daily Poll', desc: 'Sehri voting every night', color: '#4FC3F7' },
  { icon: '🎁', title: 'Donate', desc: 'Support via UPI / GPay', color: '#4CAF50' },
  { icon: '🛵', title: 'Live Track', desc: 'Track food rider real-time', color: '#FF9800' },
  { icon: '📖', title: 'Al-Quran', desc: 'Read Quran anytime', color: '#9C27B0' },
  { icon: '🤲', title: 'Duas', desc: 'Daily Islamic supplications', color: '#00BCD4' },
];

// ─── Name Info Modal ───────────────────────────────────────────────────────────
function NameInfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={nm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={nm.card}>
          <LinearGradient colors={['#0D1B2A', '#152336', '#1A2E45']} style={nm.gradient}>
            {/* Close */}
            <TouchableOpacity style={nm.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Arabic */}
            <Text style={nm.arabic}>لَا إِلٰهَ إِلَّا اللّٰهُ</Text>
            <Text style={nm.arabicSub}>مُحَمَّدٌ رَسُولُ اللّٰهِ</Text>

            {/* Divider */}
            <View style={nm.divider} />

            {/* Title */}
            <Text style={nm.title}>Why "One Message"?</Text>

            {/* Body */}
            <Text style={nm.body}>
              The name <Text style={nm.highlight}>One Message</Text> carries a profound meaning —
              it refers to the most powerful declaration in Islam:
            </Text>

            <LinearGradient
              colors={['rgba(201,168,76,0.15)', 'rgba(201,168,76,0.04)']}
              style={nm.shahada}
            >
              <Text style={nm.shahadaArabic}>لَا إِلٰهَ إِلَّا اللّٰهُ</Text>
              <Text style={nm.shahadaEng}>
                "There is no god but Allah,{'\n'}and Muhammad is the Messenger of Allah."
              </Text>
            </LinearGradient>

            <Text style={nm.body}>
              This <Text style={nm.highlight}>one message</Text> — the Shahada — is the core of
              Islam. Every Muslim across the world, regardless of language, culture or country,
              unites upon this single declaration.
            </Text>

            <Text style={nm.body}>
              Our app is built on the spirit of that unity — bringing a Muslim community together
              for Sehri distribution, prayer, Quran, and more. All centred around the <Text style={nm.highlight}>One Message</Text>.
            </Text>

            <View style={nm.footer}>
              <Text style={nm.footerText}>🤲 May Allah accept our efforts. Ameen.</Text>
            </View>

            <GoldButton title="Understood" onPress={onClose} size="md" style={{ marginTop: 16 }} />
          </LinearGradient>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Welcome Screen ───────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const { continueAsGuest } = useAuthStore();
  const router = useRouter();
  const [nameInfoVisible, setNameInfoVisible] = useState(false);

  // Animation refs
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(40)).current;
  const featureFades  = useRef(features.map(() => new Animated.Value(0))).current;
  const featureScales = useRef(features.map(() => new Animated.Value(0.85))).current;
  const hadithFade  = useRef(new Animated.Value(0)).current;
  const hadithSlide = useRef(new Animated.Value(30)).current;
  const buttonFade  = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const geoRotate   = useRef(new Animated.Value(0)).current;
  const starTwinkle = useRef(
    Array.from({ length: 18 }, () => new Animated.Value(Math.random()))
  ).current;

  // Rider easter-egg
  const riderTapRef   = useRef(0);
  const riderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Entrance sequence
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade,  { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 800, easing: Easing.out(Easing.back as any), useNativeDriver: true }),
      ]),
      Animated.stagger(100, featureFades.map((f, i) =>
        Animated.parallel([
          Animated.timing(f, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.spring(featureScales[i], { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        ])
      )),
      Animated.parallel([
        Animated.timing(hadithFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(hadithSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(buttonFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Crescent pulse
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Slow geometric rotation
    Animated.loop(
      Animated.timing(geoRotate, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Islamic star twinkle (gentle, not "black magic")
    starTwinkle.forEach((anim, i) => {
      const delay = i * 300;
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1,   duration: 2000 + i * 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 2000 + i * 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    });
  }, []);

  const geoSpin = geoRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handleRiderTap = () => {
    riderTapRef.current += 1;
    if (riderTimerRef.current) clearTimeout(riderTimerRef.current);
    if (riderTapRef.current >= 5) {
      riderTapRef.current = 0;
      router.push('/(auth)/rider-login');
      return;
    }
    riderTimerRef.current = setTimeout(() => { riderTapRef.current = 0; }, 2000);
  };

  // Star positions (fixed so they don't re-randomise on re-render)
  const STARS = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      left: (i * 57 + 23) % (width - 10),
      top:  (i * 83 + 47) % 700,
      size: 2 + (i % 4),
    }))
  ).current;

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>

      {/* Soft Islamic star field — gentle gold dots, NOT black magic */}
      {STARS.map((star, i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            {
              left: star.left,
              top:  star.top,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: starTwinkle[i],
            },
          ]}
        />
      ))}

      {/* Slow rotating Islamic geometry background */}
      <Animated.View style={[styles.geometricBg, { transform: [{ rotate: geoSpin }] }]}>
        <IslamicGeometric opacity={0.05} size={width * 1.5} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── Header ─── */}
        <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <CrescentMoon size={70} color={COLORS.primary} />
          </Animated.View>

          {/* Arabic Bismillah */}
          <Text style={styles.bismillah}>بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</Text>

          {/* App name — tappable to show name info */}
          <TouchableOpacity onPress={() => setNameInfoVisible(true)} activeOpacity={0.8} style={styles.nameTouchable}>
            <Text style={styles.appName}>One Message</Text>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} style={styles.infoIcon} />
          </TouchableOpacity>

          {/* Arabic Shahada slogan */}
          <Text style={styles.shahadaArabic}>لَا إِلٰهَ إِلَّا اللّٰهُ</Text>
          <Text style={styles.shahadaEng}>There is no god but Allah</Text>
        </Animated.View>

        <StarDivider />

        {/* ─── Community purpose banner ─── */}
        <Animated.View style={[styles.purposeBanner, { opacity: hadithFade }]}>
          <LinearGradient
            colors={['rgba(201,168,76,0.12)', 'rgba(201,168,76,0.03)']}
            style={styles.purposeGradient}
          >
            <Text style={styles.purposeTitle}>🕌 More Than Sehri</Text>
            <Text style={styles.purposeText}>
              One Message is a Muslim community platform — Sehri food distribution,
              daily polls, live Quran, duas, donations and community chat. All in one place,
              all for the sake of Allah.
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ─── Features grid ─── */}
        <View style={styles.featuresGrid}>
          {features.map((f, i) => {
            const isRider = i === 3;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.featureCard,
                  {
                    opacity: featureFades[i],
                    transform: [
                      { translateY: featureFades[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                      { scale: featureScales[i] },
                    ],
                    borderColor: `${f.color}35`,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={isRider ? handleRiderTap : undefined}
                  activeOpacity={isRider ? 0.7 : 1}
                  style={styles.featureCardInner}
                >
                  <LinearGradient
                    colors={[`${f.color}28`, `${f.color}08`]}
                    style={[styles.featureIconBg, { borderColor: `${f.color}40` }]}
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

        {/* ─── Hadith banner ─── */}
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

        {/* ─── Action buttons ─── */}
        <Animated.View style={[styles.actions, { opacity: buttonFade }]}>
          <GoldButton
            title="Login with Phone"
            onPress={() => router.push('/(auth)/login')}
            size="lg"
            style={styles.actionBtn}
            glow
          />
          <GoldButton
            title="Register as New User"
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
            size="lg"
            style={styles.actionBtn}
          />
          {/* Guest entry — Quran, Duas and prayer timings need no account */}
          <TouchableOpacity
            onPress={async () => {
              await continueAsGuest();
              router.replace('/(app)/home');
            }}
            activeOpacity={0.75}
            style={styles.guestLink}
          >
            <Ionicons name="book-outline" size={15} color={COLORS.textSecondary} />
            <Text style={styles.guestLinkText}>Continue as Guest</Text>
          </TouchableOpacity>
          <Text style={styles.guestHint}>Read Quran, Duas & prayer timings — no account needed</Text>

          <TouchableOpacity onPress={() => setNameInfoVisible(true)} activeOpacity={0.75} style={styles.whyLink}>
            <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
            <Text style={styles.whyLinkText}>Why "One Message"?</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: RESPONSIVE.hp(4) }} />
      </ScrollView>

      <NameInfoModal visible={nameInfoVisible} onClose={() => setNameInfoVisible(false)} />
    </LinearGradient>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  guestLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 14, paddingVertical: 8,
  },
  guestLinkText: {
    color: COLORS.textSecondary, fontSize: 14,
    fontWeight: '600', textDecorationLine: 'underline',
  },
  guestHint: {
    color: COLORS.textMuted, fontSize: 11,
    textAlign: 'center', marginTop: 2,
  },
  container: { flex: 1 },
  geometricBg: { position: 'absolute', top: -80, alignSelf: 'center' },
  star: { position: 'absolute', backgroundColor: COLORS.primary },
  scroll: {
    paddingHorizontal: SIZES.spacing.xl,
    paddingTop: RESPONSIVE.hp(7),
    paddingBottom: 40,
  },
  header: { alignItems: 'center', marginBottom: SIZES.spacing.lg },
  bismillah: {
    color: COLORS.primary,
    fontSize: SIZES.md,
    marginTop: SIZES.spacing.md,
    marginBottom: SIZES.spacing.xs,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  nameTouchable: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  appName: {
    color: COLORS.textPrimary,
    fontSize: SIZES.xxl,
    fontWeight: '800',
    letterSpacing: 2,
    textShadowColor: 'rgba(201,168,76,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  infoIcon: { marginTop: 4 },
  shahadaArabic: {
    color: COLORS.primary,
    fontSize: SIZES.lg,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
    textAlign: 'center',
  },
  shahadaEng: {
    color: COLORS.textSecondary,
    fontSize: SIZES.xs,
    marginTop: 4,
    letterSpacing: 1,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  purposeBanner: { marginBottom: SIZES.spacing.lg },
  purposeGradient: {
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  purposeTitle: { color: COLORS.primary, fontSize: SIZES.md, fontWeight: '700', marginBottom: 8 },
  purposeText: { color: COLORS.textSecondary, fontSize: SIZES.sm, lineHeight: 22 },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: SIZES.spacing.lg,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureIcon: { fontSize: 24 },
  featureTitle: {
    color: COLORS.textPrimary,
    fontSize: SIZES.xs,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  featureDesc: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  hadithBanner: {
    borderRadius: SIZES.radius.lg,
    padding: SIZES.spacing.base,
    marginBottom: SIZES.spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    alignItems: 'center',
  },
  hadithIcon: { fontSize: 26, marginBottom: 8 },
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
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  actions: {
    marginTop: SIZES.spacing.md,
    gap: 14,
    alignItems: 'center',
  },
  actionBtn: { width: '100%' },
  whyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    marginTop: 4,
  },
  whyLinkText: {
    color: COLORS.primary,
    fontSize: SIZES.sm,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

const nm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: { width: '100%', borderRadius: 24, overflow: 'hidden' },
  gradient: {
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 24,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  arabic: {
    color: COLORS.primary,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 4,
  },
  arabicSub: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.25)',
    marginBottom: 16,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'center',
  },
  highlight: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  shahada: {
    borderRadius: 14,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    alignItems: 'center',
    gap: 8,
  },
  shahadaArabic: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  shahadaEng: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(201,168,76,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
