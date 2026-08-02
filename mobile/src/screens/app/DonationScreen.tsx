import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { COLORS, SIZES } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import PremiumCard from '../../components/ui/PremiumCard';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import Toast from 'react-native-toast-message';

const UPI_ID = '9632716392@axl';
const QR_IMAGE = require('../../../assets/donation-qr.jpeg');

export default function DonationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [donorName, setDonorName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const copyUpiId = async () => {
    await Clipboard.setStringAsync(UPI_ID);
    Toast.show({ type: 'success', text1: 'UPI ID copied', text2: UPI_ID });
  };

  const downloadQr = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to save the QR code.');
        return;
      }
      const asset = await MediaLibrary.createAssetAsync(Image.resolveAssetSource(QR_IMAGE).uri);
      await MediaLibrary.createAlbumAsync('Sehri Connect', asset, false);
      Toast.show({ type: 'success', text1: 'QR code saved to your gallery' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save QR code' });
    }
  };

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
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setProofUri(asset.uri);
        setProofName(asset.fileName || 'payment-proof.jpg');
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not pick image' });
    }
  };

  const removeProof = () => {
    setProofUri(null);
    setProofName(null);
  };

  const handleSubmit = async () => {
    if (!isAnonymous && !donorName.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter your name or choose anonymous' });
      return;
    }
    if (!proofUri) {
      Toast.show({ type: 'error', text1: 'Please upload the payment proof' });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      const ext = proofName?.split('.').pop() || 'jpg';
      formData.append('proof', {
        uri: proofUri,
        name: proofName || 'payment-proof.jpg',
        type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      } as any);
      formData.append('is_anonymous', String(isAnonymous));
      formData.append('donor_name', isAnonymous ? '' : donorName.trim());
      formData.append('message', message.trim());

      await api.postForm(ENDPOINTS.SUBMIT_DONATION, formData);

      Toast.show({ type: 'success', text1: 'JazakAllahu Khayran! 🎁', text2: 'Your donation has been submitted.' });
      setDonorName(''); setMessage(''); setIsAnonymous(false); setProofUri(null); setProofName(null);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to submit donation' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/home' as any)} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🎁</Text>
            <Text style={styles.title}>Make a Donation</Text>
            <Text style={styles.subtitle}>Support Sehri food distribution</Text>
          </View>

          {/* Hadith about Sadaqah */}
          <LinearGradient
            colors={['rgba(201,168,76,0.15)', 'rgba(201,168,76,0.03)']}
            style={styles.hadithCard}
          >
            <Text style={styles.hadithText}>
              "Charity does not decrease wealth." — Prophet Muhammad ﷺ (Muslim)
            </Text>
          </LinearGradient>

          {/* Donor Details */}
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>Your Details</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, isAnonymous && styles.inputDisabled]}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textMuted}
              value={donorName}
              onChangeText={setDonorName}
              editable={!isAnonymous}
            />

            <TouchableOpacity
              style={[styles.anonymousToggle, isAnonymous && styles.anonymousToggleActive]}
              onPress={() => setIsAnonymous(!isAnonymous)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, isAnonymous && styles.checkboxActive]}>
                {isAnonymous && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.anonymousTitle}>Donate anonymously</Text>
                <Text style={styles.anonymousDesc}>Hide your name from donation records.</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.label}>Message (optional)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Add a message with your donation..."
              placeholderTextColor={COLORS.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={2}
            />
          </PremiumCard>

          {/* Payment Details */}
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>Payment</Text>

            {/* UPI ID */}
            <Text style={styles.label}>Pay to UPI ID</Text>
            <TouchableOpacity style={styles.upiBox} onPress={copyUpiId} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={styles.upiText}>{UPI_ID}</Text>
              </View>
              <View style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={16} color={COLORS.textOnPrimary} />
                <Text style={styles.copyText}>Copy</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.helperText}>Tap the UPI ID to copy it</Text>

            {/* QR Code */}
            <Text style={styles.label}>Or scan the QR code</Text>
            <View style={styles.qrWrap}>
              <Image source={QR_IMAGE} style={styles.qrImage} resizeMode="contain" />
            </View>
            <TouchableOpacity style={styles.downloadBtn} onPress={downloadQr} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={18} color={COLORS.primary} />
              <Text style={styles.downloadText}>Download QR Code</Text>
            </TouchableOpacity>
          </PremiumCard>

          {/* Upload Proof */}
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>Upload Payment Proof</Text>
            <Text style={styles.helperText}>
              After making the payment, upload a screenshot or photo of the payment confirmation.
            </Text>

            {proofUri ? (
              <View style={styles.proofPreview}>
                <Image source={{ uri: proofUri }} style={styles.proofImage} resizeMode="cover" />
                <Text style={styles.proofName} numberOfLines={1}>{proofName}</Text>
                <TouchableOpacity style={styles.removeProofBtn} onPress={removeProof} activeOpacity={0.8}>
                  <Ionicons name="close-circle" size={20} color={COLORS.accentRed} />
                  <Text style={styles.removeProofText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={pickProof} activeOpacity={0.8}>
                <Ionicons name="cloud-upload-outline" size={36} color={COLORS.primary} />
                <Text style={styles.uploadTitle}>Upload proof</Text>
                <Text style={styles.uploadSubtitle}>Screenshots and all image types supported</Text>
              </TouchableOpacity>
            )}
          </PremiumCard>

          <GoldButton
            title="Submit Donation"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            size="lg"
            style={styles.donateBtn}
          />

          <Text style={styles.secureNote}>
            🔒 Your payment proof is only used to verify your donation.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    justifyContent: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  topBarContent: {
    flexDirection: 'row', alignItems: 'center',
    height: Platform.OS === 'ios' ? 44 : 56,
    paddingHorizontal: 4,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '500' },
  scroll: { padding: SIZES.spacing.xl, paddingTop: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: SIZES.spacing.xl },
  headerEmoji: { fontSize: 48, marginBottom: SIZES.spacing.sm },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '700' },
  subtitle: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },
  hadithCard: { borderRadius: SIZES.radius.lg, padding: SIZES.spacing.base, marginBottom: SIZES.spacing.md, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  hadithText: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontStyle: 'italic', textAlign: 'center' },
  card: { marginBottom: SIZES.spacing.md },
  cardTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.sm },
  label: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginBottom: 8, marginTop: SIZES.spacing.md },
  input: { backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.md, color: COLORS.textPrimary, fontSize: SIZES.base },
  inputDisabled: { opacity: 0.5 },
  anonymousToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: SIZES.spacing.md, padding: SIZES.spacing.md, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary },
  anonymousToggleActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.12)' },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  checkboxTick: { color: COLORS.textOnPrimary, fontSize: SIZES.sm, fontWeight: '700' },
  anonymousTitle: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '700' },
  anonymousDesc: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  messageInput: { backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.sm, color: COLORS.textPrimary, fontSize: SIZES.base, textAlignVertical: 'top' },
  upiBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.primary, paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.md },
  upiText: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, borderRadius: SIZES.radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  copyText: { color: COLORS.textOnPrimary, fontSize: SIZES.xs, fontWeight: '700' },
  helperText: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 6 },
  qrWrap: { alignItems: 'center', marginTop: SIZES.spacing.sm },
  qrImage: { width: 220, height: 220, borderRadius: SIZES.radius.md, backgroundColor: '#FFFFFF' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginTop: SIZES.spacing.sm, paddingHorizontal: SIZES.spacing.md, paddingVertical: 10, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: SIZES.radius.full },
  downloadText: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '700' },
  uploadBox: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, borderRadius: SIZES.radius.md, paddingVertical: SIZES.spacing.xl, marginTop: SIZES.spacing.sm },
  uploadTitle: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700', marginTop: 8 },
  uploadSubtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 4 },
  proofPreview: { marginTop: SIZES.spacing.sm },
  proofImage: { width: '100%', height: 160, borderRadius: SIZES.radius.md },
  proofName: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 6 },
  removeProofBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 6 },
  removeProofText: { color: COLORS.accentRed, fontSize: SIZES.xs, fontWeight: '600' },
  donateBtn: { width: '100%', marginTop: SIZES.spacing.sm },
  secureNote: { color: COLORS.textMuted, fontSize: SIZES.xs, textAlign: 'center', marginTop: SIZES.spacing.md },
});
