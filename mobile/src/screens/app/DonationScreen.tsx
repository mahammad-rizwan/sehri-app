import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { COLORS, SIZES } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import PremiumCard from '../../components/ui/PremiumCard';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import Toast from 'react-native-toast-message';

const UPI_ID   = '9632716392@axl';
const QR_IMAGE = require('../../../assets/donation-qr.jpeg');

export default function DonationScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [donorName,   setDonorName]   = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [amount,      setAmount]      = useState('');
  const [message,     setMessage]     = useState('');
  const [proofUri,    setProofUri]    = useState<string | null>(null);
  const [proofName,   setProofName]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  // ── Copy UPI ──────────────────────────────────────────────────────────────
  const copyUpiId = async () => {
    await Clipboard.setStringAsync(UPI_ID);
    Toast.show({ type: 'success', text1: 'UPI ID copied', text2: UPI_ID });
  };

  // ── Download QR ──────────────────────────────────────────────────────────
  const downloadQr = async () => {
    // Check if running in Expo Go
    if (Constants.appOwnership === 'expo') {
      Alert.alert(
        'Feature Unavailable',
        'QR download requires a custom build. Please use the production app or take a screenshot of the QR code.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to save the QR code.');
        return;
      }

      // Load the asset from bundle
      const [asset] = await Asset.loadAsync(QR_IMAGE);
      
      // Ensure asset is downloaded to local storage
      if (!asset.downloaded) {
        await asset.downloadAsync();
      }

      const sourceUri = asset.localUri ?? asset.uri;
      
      if (!sourceUri) {
        Toast.show({ type: 'error', text1: 'Could not locate QR image' });
        console.error('[QR Download] No source URI found');
        return;
      }

      console.log('[QR Download] Source URI:', sourceUri);

      // Create destination path in cache
      const destUri = `${FileSystem.cacheDirectory}donation-qr-${Date.now()}.jpeg`;
      console.log('[QR Download] Dest URI:', destUri);

      // Copy or download the file
      if (sourceUri.startsWith('file://') || sourceUri.startsWith('/')) {
        const cleanSource = sourceUri.startsWith('file://') ? sourceUri : `file://${sourceUri}`;
        await FileSystem.copyAsync({ from: cleanSource, to: destUri });
        console.log('[QR Download] Copied from local file');
      } else {
        const result = await FileSystem.downloadAsync(sourceUri, destUri);
        console.log('[QR Download] Download result:', result.status);
        if (result.status !== 200) {
          Toast.show({ type: 'error', text1: 'Failed to fetch QR image' });
          return;
        }
      }

      // Verify the file exists
      const info = await FileSystem.getInfoAsync(destUri);
      console.log('[QR Download] File exists:', info.exists, 'Size:', (info as any).size);
      
      if (!info.exists) {
        Toast.show({ type: 'error', text1: 'QR file not found after download' });
        return;
      }

      // Save to gallery
      const mediaAsset = await MediaLibrary.createAssetAsync(destUri);
      console.log('[QR Download] Media asset created:', mediaAsset.id);
      
      // Try to create album, but don't fail if it already exists
      try {
        await MediaLibrary.createAlbumAsync('Sehri Connect', mediaAsset, false);
      } catch (albumErr) {
        // Album might already exist, that's fine
        console.log('[QR Download] Album creation note:', albumErr);
      }

      Toast.show({ type: 'success', text1: 'QR code saved to gallery ✅' });
    } catch (err: any) {
      console.error('[QR Download] Error:', err);
      Toast.show({ 
        type: 'error', 
        text1: 'Could not save QR code', 
        text2: err?.message || 'Unknown error' 
      });
    }
  };

  // ── Pick proof image ──────────────────────────────────────────────────────
  const pickProof = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to upload payment proof.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        const picked = result.assets[0];
        const fileName = picked.fileName || 'payment-proof.jpg';
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (!ext || !['png', 'jpeg', 'jpg'].includes(ext)) {
          Toast.show({ type: 'error', text1: 'Only PNG/JPEG/JPG allowed' });
          return;
        }
        setProofUri(picked.uri);
        setProofName(fileName);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not pick image' });
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    console.log("amount"+amount);
    if (!isAnonymous && !donorName.trim()) {
      Toast.show({ type: 'error', text1: 'Enter your name or choose anonymous' });
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid donation amount' });
      return;
    }
    if (!proofUri) {
      Toast.show({ type: 'error', text1: 'Upload your payment proof screenshot' });
      return;
    }

    try {
      setLoading(true);

      const ext      = proofName?.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

      // ⚠️ Text fields MUST come before the file field so multer
      //    can populate req.body before it processes the file stream.
      const formData = new FormData();
      formData.append('is_anonymous', String(isAnonymous));
      formData.append('donor_name',   isAnonymous ? '' : donorName.trim());
      formData.append('amount',       amount.trim());
      formData.append('message',      message.trim());
      formData.append('proof', {
        uri:  proofUri,
        name: proofName || 'payment-proof.jpg',
        type: mimeType,
      } as any);

      await api.postForm(ENDPOINTS.SUBMIT_DONATION, formData);

      Toast.show({
        type:  'success',
        text1: 'JazakAllahu Khayran! 🎁',
        text2: 'Your donation has been submitted for verification.',
      });

      // Reset form
      setDonorName('');
      setAmount('');
      setMessage('');
      setIsAnonymous(false);
      setProofUri(null);
      setProofName(null);

    } catch (err: any) {
      const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout');
      if (isTimeout) {
        Toast.show({
          type:  'info',
          text1: 'Upload is taking long…',
          text2: 'Your donation may have been submitted. Check history.',
        });
      } else {
        Toast.show({
          type:  'error',
          text1: err?.response?.data?.message || 'Failed to submit donation',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.container}>
      {/* Top bar */}
      <View style={[st.topBar, { paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={st.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/home' as any)} style={st.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={st.backBtnText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={st.header}>
            <Text style={st.headerEmoji}>🎁</Text>
            <Text style={st.title}>Make a Donation</Text>
            <Text style={st.subtitle}>Support Sehri food distribution</Text>
          </View>

          {/* Hadith */}
          <LinearGradient colors={['rgba(201,168,76,0.15)', 'rgba(201,168,76,0.03)']} style={st.hadithCard}>
            <Text style={st.hadithText}>
              "Charity does not decrease wealth." — Prophet Muhammad ﷺ (Muslim)
            </Text>
          </LinearGradient>

          {/* ── Your Details ── */}
          <PremiumCard style={st.card}>
            <Text style={st.cardTitle}>Your Details</Text>

            <Text style={st.label}>Name</Text>
            <TextInput
              style={[st.input, isAnonymous && st.inputDisabled]}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textMuted}
              value={donorName}
              onChangeText={setDonorName}
              editable={!isAnonymous}
            />

            <TouchableOpacity
              style={[st.anonToggle, isAnonymous && st.anonToggleActive]}
              onPress={() => setIsAnonymous(!isAnonymous)}
              activeOpacity={0.8}
            >
              <View style={[st.checkbox, isAnonymous && st.checkboxActive]}>
                {isAnonymous && <Text style={st.checkTick}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.anonTitle}>Donate anonymously</Text>
                <Text style={st.anonDesc}>Your name is hidden publicly but stored for admin verification.</Text>
              </View>
            </TouchableOpacity>

            <Text style={st.label}>Amount Paid (₹) <Text style={st.required}>*</Text></Text>
            <TextInput
              style={st.input}
              placeholder="e.g. 500"
              placeholderTextColor={COLORS.textMuted}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
            />

            <Text style={st.label}>Message (optional)</Text>
            <TextInput
              style={st.messageInput}
              placeholder="Add a note with your donation..."
              placeholderTextColor={COLORS.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={2}
            />
          </PremiumCard>

          {/* ── Payment ── */}
          <PremiumCard style={st.card}>
            <Text style={st.cardTitle}>Payment</Text>

            <Text style={st.label}>Pay to UPI ID</Text>
            <TouchableOpacity style={st.upiBox} onPress={copyUpiId} activeOpacity={0.8}>
              <Text style={[st.upiText, { flex: 1 }]}>{UPI_ID}</Text>
              <View style={st.copyBtn}>
                <Ionicons name="copy-outline" size={16} color={COLORS.textOnPrimary} />
                <Text style={st.copyText}>Copy</Text>
              </View>
            </TouchableOpacity>
            <Text style={st.helperText}>Tap to copy the UPI ID</Text>

            <Text style={st.label}>Or scan the QR code</Text>
            <View style={st.qrWrap}>
              <Image source={QR_IMAGE} style={st.qrImage} resizeMode="contain" />
            </View>
            <TouchableOpacity style={st.downloadBtn} onPress={downloadQr} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={18} color={COLORS.primary} />
              <Text style={st.downloadText}>Save QR Code</Text>
            </TouchableOpacity>
          </PremiumCard>

          {/* ── Proof Upload ── */}
          <PremiumCard style={st.card}>
            <Text style={st.cardTitle}>Upload Payment Proof <Text style={st.required}>*</Text></Text>
            <Text style={st.helperText}>Screenshot of the payment confirmation (PNG/JPEG/JPG only)</Text>

            {proofUri ? (
              <View style={st.proofPreview}>
                <Image source={{ uri: proofUri }} style={st.proofImage} resizeMode="cover" />
                <Text style={st.proofName} numberOfLines={1}>{proofName}</Text>
                <TouchableOpacity style={st.removeBtn} onPress={() => { setProofUri(null); setProofName(null); }} activeOpacity={0.8}>
                  <Ionicons name="close-circle" size={20} color={COLORS.accentRed} />
                  <Text style={st.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={st.uploadBox} onPress={pickProof} activeOpacity={0.8}>
                <Ionicons name="cloud-upload-outline" size={36} color={COLORS.primary} />
                <Text style={st.uploadTitle}>Tap to upload proof</Text>
                <Text style={st.uploadSub}>PNG, JPEG, JPG only</Text>
              </TouchableOpacity>
            )}
          </PremiumCard>

          <GoldButton
            title="Submit Donation"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            size="lg"
            style={st.submitBtn}
          />

          <Text style={st.secureNote}>🔒 Your proof is only used to verify your donation.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  container:   { flex: 1 },
  topBar:      { justifyContent: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, backgroundColor: COLORS.background },
  topBarContent: { flexDirection: 'row', alignItems: 'center', height: Platform.OS === 'ios' ? 44 : 56, paddingHorizontal: 4 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
  scroll:      { padding: SIZES.spacing.xl, paddingTop: 16, paddingBottom: 40 },
  header:      { alignItems: 'center', marginBottom: SIZES.spacing.xl },
  headerEmoji: { fontSize: 48, marginBottom: SIZES.spacing.sm },
  title:       { color: COLORS.textPrimary,   fontSize: SIZES.xxl, fontWeight: '700' },
  subtitle:    { color: COLORS.textSecondary, fontSize: SIZES.sm,  marginTop: 4 },
  hadithCard:  { borderRadius: SIZES.radius.lg, padding: SIZES.spacing.base, marginBottom: SIZES.spacing.md, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  hadithText:  { color: COLORS.textSecondary, fontSize: SIZES.sm, fontStyle: 'italic', textAlign: 'center' },
  card:        { marginBottom: SIZES.spacing.md },
  cardTitle:   { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.sm },
  label:       { color: COLORS.textSecondary, fontSize: SIZES.sm, marginBottom: 8, marginTop: SIZES.spacing.md },
  required:    { color: COLORS.accentRed },
  input:       { backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.md, color: COLORS.textPrimary, fontSize: SIZES.base },
  inputDisabled: { opacity: 0.45 },
  messageInput:  { backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.sm, color: COLORS.textPrimary, fontSize: SIZES.base, textAlignVertical: 'top', minHeight: 60 },
  anonToggle:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: SIZES.spacing.md, padding: SIZES.spacing.md, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary },
  anonToggleActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.12)' },
  checkbox:    { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  checkTick:   { color: COLORS.textOnPrimary, fontSize: SIZES.sm, fontWeight: '700' },
  anonTitle:   { color: COLORS.textPrimary,   fontSize: SIZES.sm, fontWeight: '700' },
  anonDesc:    { color: COLORS.textMuted,      fontSize: SIZES.xs, marginTop: 2 },
  upiBox:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.primary, paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.md },
  upiText:     { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700' },
  copyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, borderRadius: SIZES.radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  copyText:    { color: COLORS.textOnPrimary, fontSize: SIZES.xs, fontWeight: '700' },
  helperText:  { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 6 },
  qrWrap:      { alignItems: 'center', marginTop: SIZES.spacing.sm },
  qrImage:     { width: 220, height: 220, borderRadius: SIZES.radius.md, backgroundColor: '#fff' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginTop: SIZES.spacing.sm, paddingHorizontal: SIZES.spacing.md, paddingVertical: 10, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: SIZES.radius.full },
  downloadText:{ color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '700' },
  uploadBox:   { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, borderRadius: SIZES.radius.md, paddingVertical: SIZES.spacing.xl, marginTop: SIZES.spacing.sm },
  uploadTitle: { color: COLORS.textPrimary,   fontSize: SIZES.base, fontWeight: '700', marginTop: 8 },
  uploadSub:   { color: COLORS.textMuted,      fontSize: SIZES.xs,  marginTop: 4 },
  proofPreview:{ marginTop: SIZES.spacing.sm },
  proofImage:  { width: '100%', height: 160, borderRadius: SIZES.radius.md },
  proofName:   { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 6 },
  removeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 6 },
  removeBtnText: { color: COLORS.accentRed, fontSize: SIZES.xs, fontWeight: '600' },
  submitBtn:   { width: '100%', marginTop: SIZES.spacing.sm },
  secureNote:  { color: COLORS.textMuted, fontSize: SIZES.xs, textAlign: 'center', marginTop: SIZES.spacing.md },
});
