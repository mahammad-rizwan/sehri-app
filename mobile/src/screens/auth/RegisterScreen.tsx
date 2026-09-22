import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Animated, Dimensions, Easing, BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS, SIZES, OCCUPATIONS, OccupationKey,
  BANGALORE_AREAS, AREA_CONFIG, LOCALITY_COLLEGES,
  COLLEGE_ZONES, ZONE_ADDRESSES, RESPONSIVE, SHADOWS,
} from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import OTPInput from '../../components/ui/OTPInput';
import PremiumCard from '../../components/ui/PremiumCard';
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

type Step = 'location' | 'details' | 'otp' | 'success';
const PASSWORD_REGEX = /^(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

// ── Zone contact numbers ──────────────────────────────────────────────────────
const ZONE_CONTACTS = [
  { key: 'masjid',      label: 'Masjid Zone',     emoji: '🕌', color: '#C9A84C', phone: '9483384972' },
  { key: 'stanza',      label: 'Stanza Zone',     emoji: '🏡', color: '#AB47BC', phone: '9483382876' },
  { key: 'boys_hostel', label: 'Boys Hostel Zone', emoji: '🏠', color: '#4FC3F7', phone: '9876543210' },
  { key: 'girls',       label: 'Girls Zone',      emoji: '🌸', color: '#EC407A', phone: '9876543201' },
];

function ZoneContactsCard({ zone }: { zone: string }) {
  const contact = ZONE_CONTACTS.find((z) => z.key === zone);
  if (!contact) return null;
  return (
    <View style={s.zoneContactsCard}>
      <Text style={s.zoneContactsTitle}>Contact Your Zone Admin for Approval</Text>
      <View key={contact.key} style={[s.zoneContactRow, { borderLeftColor: contact.color }]}>
        <Text style={s.zoneContactEmoji}>{contact.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.zoneContactLabel, { color: contact.color }]}>{contact.label}</Text>
          <Text style={s.zoneContactPhone}>{contact.phone}</Text>
        </View>
        <Ionicons name="call-outline" size={16} color={contact.color} />
      </View>
    </View>
  );
}

// ── Reusable Dropdown component ──────────────────────────────────────────────
function Dropdown({
  label, value, options, onSelect, placeholder,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onSelect: (key: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={[s.dropBtn, open && { borderColor: COLORS.primary }]}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.85}
      >
        <Text style={selected ? s.dropVal : s.dropPlaceholder}>
          {selected ? selected.label : (placeholder || 'Select...')}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={s.dropMenu}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[s.dropItem, value === opt.key && s.dropItemActive]}
              onPress={() => { onSelect(opt.key); setOpen(false); }}
              activeOpacity={0.8}
            >
              <Text style={[s.dropItemText, value === opt.key && s.dropItemTextActive]}>
                {opt.label}
              </Text>
              {value === opt.key && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const params = useLocalSearchParams<{ edit?: string; phone?: string; name?: string; zone?: string; gender?: string; occupation?: string; address?: string; area?: string }>();
  const [step, setStep] = useState<Step>(params.edit === '1' ? 'details' : 'location');

  // ── Location chain ──
  const [bangaloreArea, setBangaloreArea] = useState('south');
  const [locality, setLocality]           = useState('kengeri');
  const [college, setCollege]             = useState('rv_college');
  const [internalZone, setInternalZone]   = useState('masjid');
  const [pgAddress, setPgAddress]         = useState('');
  const [othersText, setOthersText]       = useState('');

  // Cascading resets
  const handleBangaloreArea = (v: string) => {
    setBangaloreArea(v);
    const locs = (BANGALORE_AREAS as any)[v]?.localities || [];
    setLocality(locs[0] || '');
    setCollege(''); setInternalZone(''); setPgAddress(''); setOthersText('');
  };
  const handleLocality = (v: string) => {
    setLocality(v);
    const cols = LOCALITY_COLLEGES[v] || [];
    setCollege(cols[0]?.key || '');
    setInternalZone(''); setPgAddress(''); setOthersText('');
  };
  const handleCollege = (v: string) => {
    setCollege(v);
    const zones = COLLEGE_ZONES[v] || [];
    setInternalZone(zones[0]?.key || '');
    setPgAddress(''); setOthersText('');
  };
  const handleInternalZone = (v: string) => {
    setInternalZone(v); setPgAddress(''); setOthersText('');
  };

  // ── Personal details ──
  const [form, setForm] = useState({
    name: params.name || '',
    phone: params.phone || '',
    gender: (params.gender as 'male' | 'female') || 'male',
    occupation: (params.occupation as OccupationKey) || 'student',
    password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword]           = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading]                     = useState(false);
  const [resendTimer, setResendTimer]             = useState(0);
  const [passwordError, setPasswordError]         = useState('');
  const router = useRouter();
  const { sendOTP, register, updatePendingRegistration, pendingEditToken } = useAuthStore();

  /**
   * Editing a registration that is still awaiting approval. The phone number is
   * not changing and was already verified once, so there is nothing for a second
   * OTP to prove — the edit token carries the proof instead. If the token is
   * missing or expired we fall back to the original OTP flow rather than
   * letting an unauthenticated edit through.
   */
  const [editingAfterRegister, setEditingAfterRegister] = useState(false);
  const [wasResubmitted, setWasResubmitted] = useState(false);
  const isEditMode = (params.edit === '1' || editingAfterRegister) && !!pendingEditToken;

  // ── Derived options (cascade) ──
  const localityOptions = ((BANGALORE_AREAS as any)[bangaloreArea]?.localities || []).map(
    (k: string) => ({ key: k, label: (AREA_CONFIG as any)[k]?.label || k })
  );
  const collegeOptions  = LOCALITY_COLLEGES[locality] || [];
  const zoneOptions     = COLLEGE_ZONES[college] || [];
  const addressOptions  = ZONE_ADDRESSES[internalZone] || [];

  // ── Pre-fill from edit params ──
  useEffect(() => {
    if (params.edit === '1') {
      if (params.area) {
        setLocality(params.area);
        // Find which bangaloreArea contains this locality
        for (const [ba, baData] of Object.entries(BANGALORE_AREAS)) {
          const locs = (baData as any).localities || [];
          if (locs.includes(params.area)) {
            setBangaloreArea(ba);
            break;
          }
        }
      }
      if (params.zone) {
        setInternalZone(params.zone);
        // Find which college maps to this zone
        for (const [collegeKey, zones] of Object.entries(COLLEGE_ZONES as any)) {
          const zList = (zones || []) as { key: string }[];
          if (zList.some((z) => z.key === params.zone)) {
            setCollege(collegeKey);
            break;
          }
        }
      }
      // Try to match address to a known pgAddress option
      if (params.address && params.zone) {
        const addrs = ZONE_ADDRESSES[params.zone] || [];
        const match = addrs.find((a: any) => a.label === params.address);
        if (match) setPgAddress(match.key);
      }
    }
  }, []);

  // ── Animations ──
  const pageFade  = useRef(new Animated.Value(0)).current;
  const pageSlide = useRef(new Animated.Value(30)).current;
  const contentFade = useRef(new Animated.Value(1)).current;
  const moonGlow  = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const starAnims = useRef(STARS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pageFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(pageSlide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
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

  const transitionToStep = (newStep: Step) => {
    contentFade.setValue(0);
    Animated.timing(contentFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    setStep(newStep);
  };

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendTimer(60);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const validatePassword = (pw: string) => {
    if (!pw) return '';
    if (pw.length < 8) return 'Password must be at least 8 characters';
    if (!PASSWORD_REGEX.test(pw)) return 'Password must include at least 1 special character';
    return '';
  };

  // Final address value
  const finalAddress = pgAddress === 'others' ? othersText.trim() : (addressOptions.find(a => a.key === pgAddress)?.label || '');

  const canProceedLocation = bangaloreArea && locality && college && internalZone && pgAddress
    && (pgAddress !== 'others' || othersText.trim().length > 0);

  const handleSendOTP = async () => {
    if (!form.name.trim()) { Toast.show({ type: 'error', text1: 'Please enter your full name' }); return; }
    if (form.phone.length !== 10) { Toast.show({ type: 'error', text1: 'Enter valid 10-digit phone number' }); return; }
    if (!form.password) { Toast.show({ type: 'error', text1: 'Please enter a password' }); return; }
    const pwErr = validatePassword(form.password);
    if (pwErr) { Toast.show({ type: 'error', text1: pwErr }); return; }
    if (form.password !== form.confirmPassword) { Toast.show({ type: 'error', text1: 'Passwords do not match' }); return; }
    try {
      setLoading(true);
      await sendOTP(form.phone, 'register');
      Toast.show({ type: 'success', text1: 'OTP sent to your phone number!' });
      transitionToStep('otp');
      startTimer();
    } catch (err: any) {
      // A timeout is not a failure — the backend has very likely already handed
      // the SMS to MessageCentral. Dropping the user back to the details step
      // here is what made a delivered OTP look like the app going backwards.
      const timedOut = err?.code === 'ECONNABORTED' || !err?.response;
      if (timedOut) {
        Toast.show({
          type: 'info',
          text1: 'Taking longer than usual',
          text2: 'If the OTP arrives, enter it below — otherwise tap Resend.',
          visibilityTime: 6000,
        });
        transitionToStep('otp');
        startTimer();
      } else {
        Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to send OTP' });
      }
    } finally { setLoading(false); }
  };

  const handleSaveEdit = async () => {
    if (!form.name.trim()) { Toast.show({ type: 'error', text1: 'Please enter your full name' }); return; }
    // Password is optional here — blank means "keep the one I already have".
    if (form.password) {
      const pwErr = validatePassword(form.password);
      if (pwErr) { Toast.show({ type: 'error', text1: pwErr }); return; }
      if (form.password !== form.confirmPassword) { Toast.show({ type: 'error', text1: 'Passwords do not match' }); return; }
    }
    try {
      setLoading(true);
      const res = await updatePendingRegistration({
        name: form.name,
        gender: form.gender,
        occupation: form.occupation,
        city: 'Bangalore',
        area: locality,
        zone: internalZone,
        address: finalAddress,
        ...(form.password ? { password: form.password } : {}),
      });
      // The backend flags a resubmission after a rejection, which is a
      // meaningfully different outcome from tidying up a pending registration.
      setWasResubmitted(!!res?.data?.resubmitted);
      Toast.show({
        type: 'success',
        text1: res?.data?.resubmitted ? 'Resubmitted for approval' : 'Details updated',
      });
      transitionToStep('success');
    } catch (err: any) {
      if (err?.message === 'NO_EDIT_TOKEN' || err?.response?.status === 401) {
        Toast.show({
          type: 'error',
          text1: 'Your edit session expired',
          text2: 'Please log in again to edit your details.',
        });
        router.replace('/(auth)/login');
        return;
      }
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not save your details' });
    } finally { setLoading(false); }
  };

  const handleRegister = async (enteredOtp: string) => {
    try {
      setLoading(true);
      await register({
        name: form.name,
        phone: form.phone,
        gender: form.gender,
        zone: internalZone,
        address: finalAddress,
        password: form.password,
        city: 'Bangalore',
        area: locality,
        occupation: form.occupation,
        otp: enteredOtp,
      });
      transitionToStep('success');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Registration failed' });
    } finally { setLoading(false); }
  };

  // Walk back through the steps rather than abandoning the whole registration.
  const handleBack = () => {
    if (step === 'otp') return transitionToStep('details');
    if (step === 'details') return transitionToStep('location');
    router.back();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'otp' || step === 'details') { handleBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // ── Step 1: Location ─────────────────────────────────────────────────────
  const renderLocationStep = () => (
    <View>
      <Text style={s.stepTitle}>Select Your Location</Text>
      <Text style={s.stepSubtitle}>Choose your location in Bangalore</Text>

      {/* City — fixed */}
      <Text style={s.label}>City</Text>
      <View style={s.fixedField}>
        <Ionicons name="location" size={15} color={COLORS.primary} />
        <Text style={s.fixedText}>Bangalore</Text>
        <Text style={s.fixedNote}>(Only city supported currently)</Text>
      </View>

      {/* Bangalore Area */}
      <Dropdown
        label="Bangalore Area"
        value={bangaloreArea}
        options={Object.entries(BANGALORE_AREAS).map(([k, v]) => ({ key: k, label: (v as any).label }))}
        onSelect={handleBangaloreArea}
      />

      {/* Locality — filtered by area */}
      {localityOptions.length > 0 ? (
        <Dropdown
          label="Locality / Area"
          value={locality}
          options={localityOptions}
          onSelect={handleLocality}
          placeholder="Select locality"
        />
      ) : (
        <View style={s.comingSoon}>
          <Ionicons name="construct-outline" size={14} color={COLORS.textMuted} />
          <Text style={s.comingSoonText}>No localities added yet for this area — coming soon</Text>
        </View>
      )}

      {/* College — filtered by locality */}
      {locality && collegeOptions.length > 0 ? (
        <Dropdown
          label="College Zone"
          value={college}
          options={collegeOptions}
          onSelect={handleCollege}
          placeholder="Select college"
        />
      ) : locality && collegeOptions.length === 0 ? (
        <View style={s.comingSoon}>
          <Ionicons name="construct-outline" size={14} color={COLORS.textMuted} />
          <Text style={s.comingSoonText}>No colleges added for this locality yet — coming soon</Text>
        </View>
      ) : null}

      {/* Internal Zone — filtered by college */}
      {college && zoneOptions.length > 0 && (
        <>
          <Text style={s.label}>Internal Zone</Text>
          <View style={s.zoneGrid}>
            {zoneOptions.map((z) => (
              <TouchableOpacity
                key={z.key}
                style={[s.zoneCard, internalZone === z.key && { borderColor: z.color }]}
                onPress={() => handleInternalZone(z.key)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={internalZone === z.key
                    ? [`${z.color}30`, `${z.color}10`]
                    : ['#1F3654', '#1A2E45']}
                  style={s.zoneGradient}
                >
                  <Text style={s.zoneEmoji}>{z.emoji}</Text>
                  <Text style={[s.zoneLabel, internalZone === z.key && { color: z.color }]}>{z.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* PG / Address options — filtered by zone */}
      {internalZone && addressOptions.length > 0 && (
        <>
          <Dropdown
            label="Your PG / Address"
            value={pgAddress}
            options={addressOptions}
            onSelect={setPgAddress}
            placeholder="Select your PG or address"
          />
          {pgAddress === 'others' && (
            <TextInput
              style={s.input}
              placeholder="Enter your PG name or address"
              placeholderTextColor={COLORS.textMuted}
              value={othersText}
              onChangeText={setOthersText}
            />
          )}
        </>
      )}

      <GoldButton
        title="Continue to Personal Details"
        onPress={() => transitionToStep('details')}
        size="lg"
        disabled={!canProceedLocation}
        style={{ marginTop: 20 }}
      />
    </View>
  );

  // ── Step 2: Personal Details ──────────────────────────────────────────────
  const renderDetailsStep = () => (
    <View>
      <TouchableOpacity onPress={() => transitionToStep('location')}>
        <Text style={s.backLink}>← Change Location</Text>
      </TouchableOpacity>
      <Text style={s.stepTitle}>Your Details</Text>
      <Text style={s.stepSubtitle}>
        {(BANGALORE_AREAS as any)[bangaloreArea]?.label} · {(AREA_CONFIG as any)[locality]?.label || locality}
        {college ? ` · ${(LOCALITY_COLLEGES[locality] || []).find(c => c.key === college)?.label || college}` : ''}
        {internalZone ? ` · ${(COLLEGE_ZONES[college] || []).find(z => z.key === internalZone)?.label || internalZone}` : ''}
      </Text>

      {/* Full Name */}
      <Text style={s.label}>Full Name *</Text>
      <TextInput
        style={s.input}
        placeholder="Enter your full name"
        placeholderTextColor={COLORS.textMuted}
        value={form.name}
        onChangeText={(t) => setForm({ ...form, name: t })}
      />

      {/* Phone */}
      <Text style={s.label}>Phone Number *</Text>
      <View style={s.phoneRow}>
        <View style={s.countryCode}><Text style={s.ccText}>+91</Text></View>
        <TextInput
          style={[s.input, s.phoneField]}
          placeholder="10-digit number"
          placeholderTextColor={COLORS.textMuted}
          value={form.phone}
          onChangeText={(t) => setForm({ ...form, phone: t.replace(/\D/g, '').slice(0, 10) })}
          keyboardType="phone-pad"
        />
      </View>

      {/* Gender */}
      <Text style={s.label}>Gender *</Text>
      <View style={s.toggleGroup}>
        {(['male', 'female'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            style={[s.toggleBtn, form.gender === g && s.toggleSelected]}
            onPress={() => setForm({ ...form, gender: g })}
          >
            <Ionicons name={g === 'male' ? 'man' : 'woman'} size={16} color={form.gender === g ? COLORS.primary : COLORS.textMuted} />
            <Text style={[s.toggleText, form.gender === g && s.toggleTextSelected]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Occupation */}
      <Text style={s.label}>Occupation *</Text>
      <View style={s.toggleGroup}>
        {(Object.entries(OCCUPATIONS) as [OccupationKey, { label: string; emoji: string }][]).map(([key, cfg]) => (
          <TouchableOpacity
            key={key}
            style={[s.toggleBtn, form.occupation === key && s.toggleSelected]}
            onPress={() => setForm({ ...form, occupation: key })}
          >
            <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
            <Text style={[s.toggleText, form.occupation === key && s.toggleTextSelected]}>{cfg.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Password */}
      <Text style={s.label}>{isEditMode ? 'New Password' : 'Password *'}</Text>
      <Text style={s.hint}>
        {isEditMode
          ? 'Leave blank to keep your current password'
          : 'Min 8 characters, at least 1 special character'}
      </Text>
      <View style={s.pwdRow}>
        <TextInput
          style={[s.input, s.pwdField]}
          placeholder={isEditMode ? 'Leave blank to keep current' : 'Create a password'}
          placeholderTextColor={COLORS.textMuted}
          value={form.password}
          onChangeText={(t) => { setForm({ ...form, password: t }); setPasswordError(validatePassword(t)); }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
      {passwordError ? <Text style={s.fieldError}>{passwordError}</Text> : null}

      {/* Confirm Password */}
      <Text style={s.label}>{isEditMode ? 'Confirm New Password' : 'Confirm Password *'}</Text>
      <View style={s.pwdRow}>
        <TextInput
          style={[s.input, s.pwdField]}
          placeholder="Re-enter password"
          placeholderTextColor={COLORS.textMuted}
          value={form.confirmPassword}
          onChangeText={(t) => setForm({ ...form, confirmPassword: t })}
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
          <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
      {form.confirmPassword && form.password !== form.confirmPassword
        ? <Text style={s.fieldError}>Passwords do not match</Text> : null}

      <GoldButton
        title={isEditMode ? 'Save Changes' : 'Get OTP'}
        onPress={isEditMode ? handleSaveEdit : handleSendOTP}
        loading={loading}
        size="lg"
        style={{ marginTop: 20 }}
      />
    </View>
  );

  // ── Step 3: OTP ───────────────────────────────────────────────────────────
  const renderOTPStep = () => (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.stepTitle}>Verify Phone</Text>
      <Text style={s.stepSubtitle}>OTP sent to +91 {form.phone}</Text>
      <OTPInput length={4} onComplete={handleRegister} disabled={loading} />
      {resendTimer > 0
        ? <Text style={s.timerText}>Resend in {resendTimer}s</Text>
        : <GoldButton title="Resend OTP" onPress={handleSendOTP} variant="ghost" loading={loading} />}
    </View>
  );

  // ── Step 4: Success ───────────────────────────────────────────────────────
  const renderSuccessStep = () => (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>
        {wasResubmitted ? '🔁' : '🌙'}
      </Text>
      <Text style={[s.stepTitle, { textAlign: 'center' }]}>
        {wasResubmitted ? 'Resubmitted for Approval' : 'Registration Submitted!'}
      </Text>
      <Text style={[s.stepSubtitle, { textAlign: 'center', marginBottom: 20 }]}>
        {wasResubmitted ? (
          <>
            Your corrections have been sent back to your zone admin.{'\n'}
            You'll be able to log in once they approve.
          </>
        ) : (
          <>
            JazakAllahu Khayran! Your registration is complete.{'\n'}
            Contact your zone admin below for approval.
          </>
        )}
      </Text>

      <ZoneContactsCard zone={internalZone} />

      {/* Edit details option */}
      <TouchableOpacity
        style={s.editBtn}
        onPress={() => { setEditingAfterRegister(true); transitionToStep('details'); }}
        activeOpacity={0.8}
      >
        <Ionicons name="create-outline" size={16} color="#C9A84C" />
        <Text style={s.editBtnText}>Edit My Details Before Approval</Text>
      </TouchableOpacity>

      <GoldButton
        title="Go to Login"
        onPress={() => router.replace('/(auth)/login')}
        size="lg"
        style={{ marginTop: 12, width: '100%' }}
      />
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={s.container}>
      {STARS.map((star, i) => (
        <Animated.View key={star.id} style={[s.star, { left: star.left, top: star.top, width: star.size, height: star.size, borderRadius: star.size / 2, opacity: starAnims[i] }]} />
      ))}
      <Animated.View style={[s.geometricBg, { transform: [{ rotate: spin }] }]}>
        <IslamicGeometric opacity={0.06} size={width * 1.3} />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <Animated.View style={[s.header, { opacity: pageFade, transform: [{ translateY: pageSlide }] }]}>
            <TouchableOpacity onPress={handleBack} style={s.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
              <Text style={s.backBtnText}>Back</Text>
            </TouchableOpacity>
            <Animated.View style={[s.moonGlow, {
              opacity: moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] }),
              transform: [{ scale: moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
            }]} />
            <CrescentMoon size={40} color={COLORS.primary} />
            <Text style={s.headerTitle}>Join Sehri Connect</Text>
          </Animated.View>

          {/* Step dots */}
          {step !== 'success' && (
            <Animated.View style={[s.stepIndicators, { opacity: pageFade }]}>
              {(isEditMode ? ['location', 'details'] : ['location', 'details', 'otp']).map((st, i, arr) => {
                const current = arr.indexOf(step);
                return (
                  <View key={st} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[s.stepDot, current >= i && s.stepDotActive]}>
                      <Text style={s.stepDotText}>{i + 1}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={[s.stepLine, current > i && s.stepLineActive]} />}
                  </View>
                );
              })}
            </Animated.View>
          )}

          <Animated.View style={{ opacity: contentFade }}>
            <PremiumCard style={s.card}>
              {step === 'location' && renderLocationStep()}
              {step === 'details' && renderDetailsStep()}
              {step === 'otp'      && renderOTPStep()}
              {step === 'success'  && renderSuccessStep()}
            </PremiumCard>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  star: { position: 'absolute', backgroundColor: COLORS.primary, zIndex: 0 },
  geometricBg: { position: 'absolute', top: -50, alignSelf: 'center', zIndex: 0 },
  scroll: { padding: RESPONSIVE.wp(5), paddingTop: RESPONSIVE.hp(7), paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20, zIndex: 1 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '500' },
  moonGlow: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.primaryGlow, top: 36 },
  headerTitle: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700', marginTop: 8 },
  stepIndicators: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, zIndex: 1 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.backgroundCard, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.2)' },
  stepDotText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  stepLine: { width: 40, height: 2, backgroundColor: COLORS.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: COLORS.primary },
  card: { padding: SIZES.spacing.lg },
  stepTitle: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700', marginBottom: 4 },
  stepSubtitle: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },
  label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 14, fontWeight: '500' },
  hint: { color: COLORS.textMuted, fontSize: 11, marginBottom: 6, marginTop: -8 },
  backLink: { color: COLORS.primary, fontSize: 13, marginBottom: 12 },
  timerText: { color: COLORS.textMuted, fontSize: 13, marginVertical: 8 },
  fieldError: { color: COLORS.accentRed, fontSize: 11, marginTop: 4 },
  // Fixed field
  fixedField: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.25)', padding: 12, marginBottom: 4 },
  fixedText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  fixedNote: { color: COLORS.textMuted, fontSize: 11 },
  // Dropdown
  dropBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 4 },
  dropVal: { color: COLORS.textPrimary, fontSize: 15 },
  dropPlaceholder: { color: COLORS.textMuted, fontSize: 15 },
  dropMenu: { backgroundColor: COLORS.background, borderRadius: SIZES.radius.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 4 },
  dropItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.backgroundCard },
  dropItemActive: { backgroundColor: 'rgba(201,168,76,0.1)' },
  dropItemText: { color: COLORS.textSecondary, fontSize: 14 },
  dropItemTextActive: { color: COLORS.primary, fontWeight: '600' },
  // Coming soon
  comingSoon: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,152,0,0.06)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,152,0,0.2)', marginTop: 10, marginBottom: 4 },
  comingSoonText: { color: COLORS.accentOrange, fontSize: 12, flex: 1 },
  // Zone grid
  zoneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  zoneCard: { width: '47%', borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, overflow: 'hidden', ...SHADOWS.sm },
  zoneGradient: { padding: 14, alignItems: 'center' },
  zoneEmoji: { fontSize: 28, marginBottom: 6 },
  zoneLabel: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  // Input
  input: { backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.textPrimary, fontSize: 15, marginBottom: 4 },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryCode: { backgroundColor: COLORS.backgroundElevated, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 12, justifyContent: 'center' },
  ccText: { color: COLORS.textPrimary, fontSize: 13 },
  phoneField: { flex: 1 },
  // Toggle
  toggleGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10 },
  toggleSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.1)' },
  toggleText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  toggleTextSelected: { color: COLORS.primary },
  // Password
  pwdRow: { flexDirection: 'row', alignItems: 'center' },
  pwdField: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: { backgroundColor: COLORS.backgroundSecondary, borderWidth: 1.5, borderLeftWidth: 0, borderColor: COLORS.border, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 14, paddingVertical: 13, justifyContent: 'center' },
  // Success
  successNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: SIZES.radius.md, padding: 14, marginTop: 20, width: '100%', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  // Zone contacts
  zoneContactsCard: { backgroundColor: '#0A1929', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', padding: 14, gap: 10 },
  zoneContactsTitle: { color: COLORS.primary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  zoneContactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 10, borderLeftWidth: 3, paddingVertical: 6 },
  zoneContactEmoji: { fontSize: 20, width: 28 },
  zoneContactLabel: { fontSize: 12, fontWeight: '700' },
  zoneContactPhone: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 1 },
  // Edit button
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.35)', backgroundColor: 'rgba(201,168,76,0.06)' },
  editBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});
