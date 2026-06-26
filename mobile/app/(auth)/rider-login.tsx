import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../src/constants/theme';
import GoldButton from '../../src/components/ui/GoldButton';
import { CrescentMoon } from '../../src/components/ui/IslamicPattern';
import api from '../../src/services/api';
import { ENDPOINTS } from '../../src/constants/api';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

export default function RiderLoginScreen() {
  const [phone, setPhone]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const router = useRouter();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const moonGlow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.back as any), useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(moonGlow, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(moonGlow, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
    ])).start();
  }, []);

  const handleLogin = async () => {
    if (phone.length !== 10) {
      Toast.show({ type: 'error', text1: 'Enter a valid 10-digit phone number' });
      return;
    }
    if (!password || password.length < 4) {
      Toast.show({ type: 'error', text1: 'Enter your password' });
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.post(ENDPOINTS.RIDER_LOGIN, { phone, password });
      // Save tokens
      await SecureStore.setItemAsync('accessToken',  data.data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
      await SecureStore.setItemAsync('userRole',     'rider');
      await SecureStore.setItemAsync('riderId',      data.data.rider.id);
      router.replace('/(rider)/broadcast' as any);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

          {/* Back */}
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
            <Text style={st.backTxt}>Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <Animated.View style={[st.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Animated.View style={[st.moonGlow, {
              opacity: moonGlow.interpolate({ inputRange:[0,1], outputRange:[0.2,0.7] }),
              transform:[{ scale: moonGlow.interpolate({ inputRange:[0,1], outputRange:[0.8,1.2] }) }],
            }]} />
            <CrescentMoon size={50} color={COLORS.primary} />
            <Text style={st.title}>Rider Login</Text>
            <Text style={st.sub}>🛵 Delivery personnel only</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={[st.form, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={st.formHeader}>
              <View style={st.line} />
              <Text style={st.formTitle}>RIDER CREDENTIALS</Text>
              <View style={st.line} />
            </View>

            <Text style={st.label}>Phone Number</Text>
            <View style={st.phoneRow}>
              <View style={st.cc}><Text style={st.ccTxt}>🇮🇳 +91</Text></View>
              <TextInput
                style={st.phoneInput}
                placeholder="10-digit mobile number"
                placeholderTextColor={COLORS.textMuted}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>

            <Text style={[st.label, { marginTop: SIZES.spacing.md }]}>Password</Text>
            <View style={st.passRow}>
              <TextInput
                style={st.passInput}
                placeholder="Enter password given by admin"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity style={st.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={st.hint}>🔒 Use the credentials provided by the super admin</Text>

            <GoldButton
              title="Login as Rider"
              onPress={handleLogin}
              loading={loading}
              disabled={phone.length !== 10 || password.length < 4}
              size="lg"
              style={{ marginTop: SIZES.spacing.md }}
            />
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1 },
  scroll:  { padding: SIZES.spacing.xl, paddingTop: 60, paddingBottom: 40 },
  backBtn: { flexDirection:'row', alignItems:'center', gap:6, marginBottom: SIZES.spacing.xl },
  backTxt: { color: COLORS.primary, fontSize: SIZES.base, fontWeight:'500' },

  header: { alignItems:'center', marginBottom: SIZES.spacing.xl },
  moonGlow: {
    position:'absolute', width:100, height:100, borderRadius:50,
    backgroundColor:'rgba(201,168,76,0.12)', top:40,
  },
  title: { color:COLORS.textPrimary, fontSize:SIZES.xxl, fontWeight:'700', marginTop:SIZES.spacing.md },
  sub:   { color:COLORS.textSecondary, fontSize:SIZES.sm, marginTop:4 },

  form: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.xl,
    padding: SIZES.spacing.xl,
    borderWidth: 1, borderColor: COLORS.border,
  },
  formHeader: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:SIZES.spacing.lg },
  line:       { flex:1, height:1, backgroundColor:COLORS.border },
  formTitle:  { color:COLORS.primary, fontSize:SIZES.xs, fontWeight:'600', letterSpacing:1 },

  label: { color:COLORS.textSecondary, fontSize:SIZES.sm, marginBottom:6, fontWeight:'500' },
  hint:  { color:COLORS.textMuted, fontSize:SIZES.xs, marginBottom:SIZES.spacing.md },

  phoneRow:  { flexDirection:'row', borderRadius:SIZES.radius.md, borderWidth:1.5, borderColor:COLORS.border, backgroundColor:COLORS.backgroundSecondary, overflow:'hidden', marginBottom:4 },
  cc:        { paddingHorizontal:SIZES.spacing.md, justifyContent:'center', borderRightWidth:1, borderColor:COLORS.border, backgroundColor:COLORS.backgroundElevated },
  ccTxt:     { color:COLORS.textPrimary, fontSize:SIZES.base },
  phoneInput:{ flex:1, paddingHorizontal:SIZES.spacing.md, paddingVertical:SIZES.spacing.md, color:COLORS.textPrimary, fontSize:SIZES.base },

  passRow:   { flexDirection:'row', borderRadius:SIZES.radius.md, borderWidth:1.5, borderColor:COLORS.border, backgroundColor:COLORS.backgroundSecondary, overflow:'hidden', alignItems:'center', marginBottom:4 },
  passInput: { flex:1, paddingHorizontal:SIZES.spacing.md, paddingVertical:SIZES.spacing.md, color:COLORS.textPrimary, fontSize:SIZES.base },
  eyeBtn:    { paddingHorizontal:SIZES.spacing.md, justifyContent:'center' },
});
