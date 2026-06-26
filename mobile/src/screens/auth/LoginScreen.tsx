import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Animated, Dimensions, Easing,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import { CrescentMoon, IslamicGeometric } from '../../components/ui/IslamicPattern';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

const STARS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: Math.random() * width,
  top: Math.random() * height,
  size: 2 + Math.random() * 4,
  delay: Math.random() * 2000,
  duration: 1500 + Math.random() * 2000,
}));

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [pendingInfo, setPendingInfo] = useState<{ phone: string; zone: string; name: string; address?: string; gender?: string; occupation?: string; area?: string } | null>(null);
  const router = useRouter();
  const { login } = useAuthStore();

  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(40)).current;
  const quoteFade   = useRef(new Animated.Value(0)).current;
  const formFade    = useRef(new Animated.Value(0)).current;
  const formSlide   = useRef(new Animated.Value(60)).current;
  const moonGlow    = useRef(new Animated.Value(0)).current;
  const rotateAnim  = useRef(new Animated.Value(0)).current;
  const starAnims   = useRef(STARS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.back as any), useNativeDriver: true }),
      ]),
      Animated.timing(quoteFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(formFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(formSlide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(moonGlow, { toValue: 1,   duration: 1500, useNativeDriver: true }),
      Animated.timing(moonGlow, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
    ])).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    starAnims.forEach((anim, i) => {
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: STARS[i].duration, delay: STARS[i].delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: STARS[i].duration, useNativeDriver: true }),
      ])).start();
    });
  }, []);

  const handleLogin = async () => {
    if (phone.length !== 10) {
      Toast.show({ type: 'error', text1: 'Enter a valid 10-digit phone number' });
      return;
    }
    if (!password || password.length < 8) {
      Toast.show({ type: 'error', text1: 'Password must be at least 8 characters' });
      return;
    }
    try {
      setLoading(true);
      await login(phone, password, 'user');
      router.replace('/(app)/home');
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      const extras = err?.response?.data?.errors;
      // 403 with status=pending → show pending approval screen instead of toast
      if (httpStatus === 403 && extras?.status === 'pending') {
        setPendingInfo({ phone: extras.phone || phone, zone: extras.zone || '', name: extras.name || '', address: extras.address, gender: extras.gender, occupation: extras.occupation, area: extras.area });
        return;
      }
      Toast.show({ type: 'error', text1: err?.response?.data?.message || err?.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={s.container}>
      {STARS.map((star, i) => (
        <Animated.View key={star.id} style={[s.star, { left: star.left, top: star.top, width: star.size, height: star.size, borderRadius: star.size / 2, opacity: starAnims[i] }]} />
      ))}

      <Animated.View style={[s.geometricBg, { transform: [{ rotate: spin }] }]}>
        <IslamicGeometric opacity={0.06} size={width * 1.3} />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <Animated.View style={[s.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color="#C9A84C" />
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>
            <Animated.View style={[s.moonGlow, {
              opacity: moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] }),
              transform: [{ scale: moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
            }]} />
            <CrescentMoon size={50} color="#C9A84C" />
            <Text style={s.title}>Login</Text>
            <Text style={s.subtitle}>Sign in to your account</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={[s.form, { opacity: formFade, transform: [{ translateY: formSlide }] }]}>
            <View style={s.formHeader}>
              <View style={s.formLine} />
              <Text style={s.formTitle}>User Credentials</Text>
              <View style={s.formLine} />
            </View>

            {/* Phone */}
            <Text style={[s.label, { marginTop: 12 }]}>Phone Number</Text>
            <View style={s.phoneRow}>
              <View style={s.cc}><Text style={s.ccTxt}>+91</Text></View>
              <TextInput
                style={s.phoneInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#8892A0"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>

            {/* Password */}
            <Text style={[s.label, { marginTop: 12 }]}>Password</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={s.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#8892A0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8892A0" />
              </TouchableOpacity>
            </View>

            <Text style={s.hint}>Login with your registered password</Text>

            {/* Forgot Password */}
            <TouchableOpacity style={s.forgotBtn} onPress={() => setForgotVisible(true)} activeOpacity={0.7}>
              <Text style={s.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <GoldButton
              title="Login"
              onPress={handleLogin}
              loading={loading}
              disabled={phone.length !== 10 || password.length < 8}
              size="lg"
              style={s.actionBtn}
            />

            <GoldButton
              title="Don't have an account? Register"
              onPress={() => router.replace('/(auth)/register')}
              variant="ghost"
            />
          </Animated.View>

          {/* Quote */}
          <Animated.View style={[s.quoteBox, { opacity: quoteFade }]}>
            <Text style={s.quoteIcon}>&#128214;</Text>
            <Text style={s.quote}>
              "The blessed month of Ramzan has come to you. Allah has made fasting obligatory upon you..." - Bukhari
            </Text>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      <ForgotPasswordModal visible={forgotVisible} onClose={() => setForgotVisible(false)} />

      {/* Pending Approval overlay */}
      {pendingInfo && (
        <PendingApprovalOverlay
          name={pendingInfo.name}
          zone={pendingInfo.zone}
          onEdit={() => {
            const p = pendingInfo;
            setPendingInfo(null);
            router.push(`/(auth)/register?edit=1&phone=${p?.phone || ''}&name=${encodeURIComponent(p?.name || '')}&zone=${p?.zone || ''}&gender=${p?.gender || ''}&occupation=${p?.occupation || ''}&address=${encodeURIComponent(p?.address || '')}&area=${encodeURIComponent(p?.area || '')}`);
          }}
          onDismiss={() => setPendingInfo(null)}
        />
      )}
    </LinearGradient>
  );
}

// Fix the title prop - using string concat since template literals may corrupt
// (line 228 fix is handled inline below via the append)

const s = StyleSheet.create({
  container: { flex: 1 },
  kav: { flex: 1 },
  star: { position: 'absolute', backgroundColor: '#C9A84C', zIndex: 0 },
  geometricBg: { position: 'absolute', top: -50, alignSelf: 'center', zIndex: 0 },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20, zIndex: 1 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: '#C9A84C', fontSize: 15, fontWeight: '500' },
  moonGlow: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(201,168,76,0.12)', top: 40 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', marginTop: 12 },
  subtitle: { color: '#8892A0', fontSize: 14, marginTop: 4 },
  form: { backgroundColor: '#0F2336', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', zIndex: 1 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  formLine: { flex: 1, height: 1, backgroundColor: 'rgba(201,168,76,0.2)' },
  formTitle: { color: '#C9A84C', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  label: { color: '#8892A0', fontSize: 14, marginBottom: 8, fontWeight: '500' },
  dropdownBtn: { borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#0A1929', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dropdownSel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownTxtWrap: { flex: 1 },
  dropdownLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  dropdownDesc: { color: '#8892A0', fontSize: 11, marginTop: 2 },
  dropdownMenu: { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#0A1929', overflow: 'hidden', marginBottom: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.1)' },
  dropdownItemActive: { backgroundColor: '#C9A84C' },
  dropdownItemLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dropdownItemLabelActive: { color: '#0D1B2A' },
  dropdownItemDesc: { color: '#8892A0', fontSize: 11, marginTop: 2 },
  dropdownItemDescActive: { color: '#0D1B2A' },
  phoneRow: { flexDirection: 'row', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#0A1929', overflow: 'hidden', marginBottom: 8 },
  cc: { paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#071522' },
  ccTxt: { color: '#FFFFFF', fontSize: 15 },
  phoneInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: '#FFFFFF', fontSize: 15 },
  passwordRow: { flexDirection: 'row', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#0A1929', overflow: 'hidden', marginBottom: 8, alignItems: 'center' },
  passwordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: '#FFFFFF', fontSize: 15 },
  eyeBtn: { paddingHorizontal: 12, justifyContent: 'center' },
  hint: { color: '#8892A0', fontSize: 11, marginBottom: 8 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 8, paddingVertical: 4, paddingHorizontal: 2 },
  forgotText: { color: '#C9A84C', fontSize: 14, fontWeight: '600' },
  actionBtn: { marginTop: 8 },
  quoteBox: { marginTop: 20, padding: 12, borderLeftWidth: 3, borderLeftColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.05)', borderRadius: 4, flexDirection: 'row', gap: 8, zIndex: 1 },
  quoteIcon: { fontSize: 16, marginTop: 2 },
  quote: { color: '#8892A0', fontSize: 11, fontStyle: 'italic', lineHeight: 20, flex: 1 },
});

// =============================================================================
// Forgot Password Modal
// =============================================================================
type FPStep = 'phone' | 'otp' | 'password' | 'success';
const OTP_LENGTH = 4;

function ForgotPasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { forgotPasswordSendOTP, forgotPasswordVerifyOTP, forgotPasswordReset } = useAuthStore();
  const [step, setStep] = useState<FPStep>('phone');
  const [fpPhone, setFpPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (visible) {
      setStep('phone'); setFpPhone('');
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setNewPassword(''); setConfirmPassword(''); setResendCooldown(0);
    }
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [visible]);

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 200);
  }, [step]);

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => { if (c <= 1) { clearInterval(cooldownRef.current!); return 0; } return c - 1; });
    }, 1000);
  };

  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otpDigits]; next[index] = digit; setOtpDigits(next);
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKey = (key: string, index: number) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      const next = [...otpDigits]; next[index - 1] = ''; setOtpDigits(next);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const otp = otpDigits.join('');

  const handleSend = async () => {
    if (fpPhone.length !== 10) { Toast.show({ type: 'error', text1: 'Enter a valid 10-digit phone number' }); return; }
    try {
      setLoading(true);
      await forgotPasswordSendOTP(fpPhone);
      Toast.show({ type: 'success', text1: 'OTP sent to your phone' });
      setOtpDigits(Array(OTP_LENGTH).fill('')); setStep('otp'); startCooldown();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to send OTP. Check if phone is registered.' });
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      setLoading(true);
      await forgotPasswordSendOTP(fpPhone);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
      Toast.show({ type: 'success', text1: 'OTP resent' }); startCooldown();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to resend OTP' });
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) { Toast.show({ type: 'error', text1: 'Enter the complete 4-digit OTP' }); return; }
    try {
      setLoading(true);
      await forgotPasswordVerifyOTP(fpPhone, otp);
      setStep('password');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Invalid OTP. Please try again.' });
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (newPassword.length < 8) { Toast.show({ type: 'error', text1: 'Password must be at least 8 characters' }); return; }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) { Toast.show({ type: 'error', text1: 'Need at least one special character' }); return; }
    if (newPassword !== confirmPassword) { Toast.show({ type: 'error', text1: 'Passwords do not match' }); return; }
    try {
      setLoading(true);
      await forgotPasswordReset(fpPhone, newPassword);
      setStep('success');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to reset password' });
    } finally { setLoading(false); }
  };

  const TITLES: Record<FPStep, string> = { phone: 'Forgot Password', otp: 'Verify OTP', password: 'New Password', success: 'Done!' };
  const SUBS: Record<FPStep, string>   = { phone: 'Enter your registered phone number', otp: 'OTP sent to +91 ' + fpPhone, password: 'Set your new password', success: 'Password updated successfully' };
  const IDX:  Record<FPStep, number>   = { phone: 0, otp: 1, password: 2, success: 3 };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={fp.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={fp.kav}>
          <LinearGradient colors={['#0D1B2A', '#152336']} style={fp.sheet}>
            <View style={fp.hdr}>
              {step !== 'phone' && step !== 'success'
                ? <TouchableOpacity onPress={() => setStep(step === 'password' ? 'otp' : 'phone')} style={fp.hdrBtn} activeOpacity={0.7}><Ionicons name="arrow-back" size={20} color="#C9A84C" /></TouchableOpacity>
                : <View style={fp.hdrBtn} />}
              <View style={fp.titleWrap}>
                <Text style={fp.title}>{TITLES[step]}</Text>
                <Text style={fp.subtitle}>{SUBS[step]}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={fp.hdrBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#8892A0" />
              </TouchableOpacity>
            </View>

            {step !== 'success' && (
              <View style={fp.dots}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[fp.dot, i < IDX[step] && fp.dotDone, i === IDX[step] && fp.dotActive]} />
                ))}
              </View>
            )}

            <ScrollView contentContainerStyle={fp.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {step === 'phone' && (
                <View>
                  <View style={fp.infoBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#C9A84C" />
                    <Text style={fp.infoTxt}>Password reset is only available for registered users.</Text>
                  </View>
                  <Text style={fp.lbl}>Phone Number</Text>
                  <View style={fp.phoneRow}>
                    <View style={fp.cc}><Text style={fp.ccTxt}>+91</Text></View>
                    <TextInput style={fp.phoneInput} placeholder="10-digit mobile number" placeholderTextColor="#8892A0" value={fpPhone} onChangeText={(t) => setFpPhone(t.replace(/[^0-9]/g, '').slice(0, 10))} keyboardType="phone-pad" maxLength={10} autoFocus />
                  </View>
                  <GoldButton title="Send OTP" onPress={handleSend} loading={loading} disabled={fpPhone.length !== 10} size="lg" style={{ marginTop: 20 }} />
                </View>
              )}

              {step === 'otp' && (
                <View>
                  <View style={fp.otpHint}>
                    <Ionicons name="chatbubble-ellipses-outline" size={36} color="#C9A84C" />
                    <Text style={fp.otpHintTxt}>Enter the 4-digit OTP</Text>
                  </View>
                  <View style={fp.otpRow}>
                    {otpDigits.map((digit, idx) => (
                      <TextInput
                        key={idx}
                        ref={(r) => { otpRefs.current[idx] = r; }}
                        style={[fp.otpBox, digit.length > 0 && fp.otpBoxFilled]}
                        value={digit}
                        onChangeText={(t) => handleOtpChange(t, idx)}
                        onKeyPress={({ nativeEvent }) => handleOtpKey(nativeEvent.key, idx)}
                        keyboardType="numeric"
                        maxLength={1}
                        selectTextOnFocus
                        textContentType="oneTimeCode"
                      />
                    ))}
                  </View>
                  <TouchableOpacity style={[fp.resendBtn, resendCooldown > 0 && fp.resendOff]} onPress={handleResend} disabled={resendCooldown > 0 || loading} activeOpacity={0.7}>
                    <Ionicons name="refresh-outline" size={13} color={resendCooldown > 0 ? '#8892A0' : '#C9A84C'} />
                    <Text style={[fp.resendTxt, resendCooldown > 0 && fp.resendTxtOff]}>
                      {resendCooldown > 0 ? 'Resend in ' + resendCooldown + 's' : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                  <GoldButton title="Verify OTP" onPress={handleVerify} loading={loading} disabled={otp.length < OTP_LENGTH} size="lg" style={{ marginTop: 12 }} />
                </View>
              )}

              {step === 'password' && (
                <View>
                  <View style={fp.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={15} color="#4CAF50" />
                    <Text style={fp.verifiedTxt}>OTP Verified</Text>
                  </View>
                  <Text style={fp.lbl}>New Password</Text>
                  <View style={fp.pwdRow}>
                    <TextInput style={fp.pwdInput} placeholder="Min 8 chars + 1 special char" placeholderTextColor="#8892A0" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showNew} autoCapitalize="none" autoFocus />
                    <TouchableOpacity style={fp.eyeBtn} onPress={() => setShowNew((v) => !v)}>
                      <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8892A0" />
                    </TouchableOpacity>
                  </View>
                  <Text style={[fp.lbl, { marginTop: 12 }]}>Confirm Password</Text>
                  <View style={fp.pwdRow}>
                    <TextInput style={fp.pwdInput} placeholder="Re-enter new password" placeholderTextColor="#8892A0" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} autoCapitalize="none" />
                    <TouchableOpacity style={fp.eyeBtn} onPress={() => setShowConfirm((v) => !v)}>
                      <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8892A0" />
                    </TouchableOpacity>
                  </View>
                  <View style={fp.hints}>
                    {[
                      { label: '8+ characters',      ok: newPassword.length >= 8 },
                      { label: 'Uppercase letter',   ok: /[A-Z]/.test(newPassword) },
                      { label: 'Lowercase letter',   ok: /[a-z]/.test(newPassword) },
                      { label: 'Number',             ok: /[0-9]/.test(newPassword) },
                      { label: 'Special char',       ok: /[!@#\$%^&*(),.?":{}|<>]/.test(newPassword) },
                    ].map((h) => (
                      <View key={h.label} style={fp.hintRow}>
                        <Ionicons name={h.ok ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={h.ok ? '#4CAF50' : '#8892A0'} />
                        <Text style={[fp.hintTxt, h.ok && fp.hintTxtOk]}>{h.label}</Text>
                      </View>
                    ))}
                  </View>
                  <GoldButton
                    title="Reset Password"
                    onPress={handleReset}
                    loading={loading}
                    disabled={newPassword.length < 8 || newPassword !== confirmPassword || !/[!@#\$%^&*(),.?":{}|<>]/.test(newPassword)}
                    size="lg"
                    style={{ marginTop: 20 }}
                  />
                </View>
              )}

              {step === 'success' && (
                <View style={fp.success}>
                  <View style={fp.successIcon}><Ionicons name="checkmark-circle" size={64} color="#4CAF50" /></View>
                  <Text style={fp.successTitle}>Password Reset!</Text>
                  <Text style={fp.successMsg}>Your password has been updated. Login with your new password.</Text>
                  <GoldButton title="Back to Login" onPress={onClose} size="lg" style={{ marginTop: 24 }} />
                </View>
              )}

            </ScrollView>
          </LinearGradient>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const fp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  kav: { justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '92%', borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  hdr: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  hdrBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#8892A0', fontSize: 12, marginTop: 3, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(201,168,76,0.2)' },
  dotDone: { backgroundColor: 'rgba(201,168,76,0.5)' },
  dotActive: { backgroundColor: '#C9A84C', width: 24, borderRadius: 4 },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  infoTxt: { color: '#C9A84C', fontSize: 12, flex: 1, lineHeight: 18 },
  lbl: { color: '#8892A0', fontSize: 14, marginBottom: 8, fontWeight: '500' },
  phoneRow: { flexDirection: 'row', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#0A1929', overflow: 'hidden', marginBottom: 8 },
  cc: { paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#071522' },
  ccTxt: { color: '#FFFFFF', fontSize: 15 },
  phoneInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: '#FFFFFF', fontSize: 15 },
  otpHint: { alignItems: 'center', gap: 10, marginVertical: 16 },
  otpHintTxt: { color: '#8892A0', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  otpBox: { width: 58, height: 64, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(201,168,76,0.3)', backgroundColor: '#0A1929', color: '#FFFFFF', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  otpBoxFilled: { borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.1)' },
  resendBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12 },
  resendOff: { opacity: 0.5 },
  resendTxt: { color: '#C9A84C', fontSize: 13, fontWeight: '600' },
  resendTxtOff: { color: '#8892A0' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 8, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)' },
  verifiedTxt: { color: '#4CAF50', fontSize: 13, fontWeight: '600' },
  pwdRow: { flexDirection: 'row', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#0A1929', overflow: 'hidden', alignItems: 'center', marginBottom: 8 },
  pwdInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: '#FFFFFF', fontSize: 15 },
  eyeBtn: { paddingHorizontal: 12, justifyContent: 'center' },
  hints: { gap: 6, backgroundColor: '#071522', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', marginTop: 8 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hintTxt: { color: '#8892A0', fontSize: 12 },
  hintTxtOk: { color: '#4CAF50' },
  success: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(76,175,80,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(76,175,80,0.3)', marginBottom: 8 },
  successTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  successMsg: { color: '#8892A0', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
// ── Zone contacts (shared between register success and login pending) ─────────
const ZONE_CONTACTS_DATA = [
  { key: 'masjid',      label: 'Masjid Zone',     emoji: '🕌', color: '#C9A84C', phone: '9483384972' },
  { key: 'stanza',      label: 'Stanza Zone',     emoji: '🏡', color: '#AB47BC', phone: '9483382876' },
  { key: 'boys_hostel', label: 'Boys Hostel Zone', emoji: '🏠', color: '#4FC3F7', phone: '9876543210' },
  { key: 'girls',       label: 'Girls Zone',      emoji: '🌸', color: '#EC407A', phone: '9876543201' },
];

function PendingApprovalOverlay({
  name, zone, onEdit, onDismiss,
}: { name: string; zone: string; onEdit: () => void; onDismiss: () => void }) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={pa.overlay}>
        <LinearGradient colors={['#0D1B2A', '#152336']} style={pa.sheet}>
          {/* Header */}
          <View style={pa.hdr}>
            <TouchableOpacity onPress={onDismiss} style={pa.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#8892A0" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={pa.body} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: 12 }}>⏳</Text>
            <Text style={pa.title}>Account Pending Approval</Text>
            {name ? <Text style={pa.name}>Hello, {name}!</Text> : null}
            <Text style={pa.subtitle}>
              Your registration is complete. Your account is waiting for approval from your zone admin.
            </Text>

            {/* Zone contacts */}
            <View style={pa.contactsCard}>
              <Text style={pa.contactsTitle}>Contact Your Zone Admin</Text>
              {ZONE_CONTACTS_DATA.filter((z) => z.key === zone).map((z) => (
                <View key={z.key} style={[pa.contactRow, { borderLeftColor: z.color }]}>
                  <Text style={pa.contactEmoji}>{z.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[pa.contactLabel, { color: z.color }]}>{z.label}</Text>
                    <Text style={pa.contactPhone}>{z.phone}</Text>
                  </View>
                  <Ionicons name="call-outline" size={16} color={z.color} />
                </View>
              ))}
            </View>

            {/* Edit option */}
            <TouchableOpacity style={pa.editBtn} onPress={onEdit} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={15} color="#C9A84C" />
              <Text style={pa.editBtnText}>Edit My Details Before Approval</Text>
            </TouchableOpacity>

            <TouchableOpacity style={pa.backBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={pa.backBtnText}>Back to Login</Text>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const pa = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '92%', borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  hdr: { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 12 },
  closeBtn: { padding: 6 },
  body: { paddingHorizontal: 20, paddingBottom: 44 },
  title: { color: '#F0E6C8', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  name: { color: '#C9A84C', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#A8B8C8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  contactsCard: { backgroundColor: '#071522', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', padding: 14, gap: 10, marginBottom: 16 },
  contactsTitle: { color: '#C9A84C', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 10, borderLeftWidth: 3, paddingVertical: 6 },
  contactEmoji: { fontSize: 20, width: 28 },
  contactLabel: { fontSize: 11, fontWeight: '700' },
  contactPhone: { color: '#F0E6C8', fontSize: 16, fontWeight: '800', marginTop: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.35)', backgroundColor: 'rgba(201,168,76,0.06)', marginBottom: 10 },
  editBtnText: { color: '#C9A84C', fontSize: 14, fontWeight: '600' },
  backBtn: { alignItems: 'center', paddingVertical: 10 },
  backBtnText: { color: '#8892A0', fontSize: 13 },
});
