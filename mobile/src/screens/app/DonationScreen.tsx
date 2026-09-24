import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
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

type MyDonation = {
  id: string;
  amount: string | null;
  status: 'pending' | 'paid' | 'rejected';
  message: string | null;
  is_anonymous: boolean;
  created_at: string | null;
};

const STATUS_META = {
  pending:  { label: 'Awaiting verification', color: COLORS.accentOrange, icon: '⏳' },
  paid:     { label: 'Verified',              color: COLORS.accentGreen,  icon: '✅' },
  rejected: { label: 'Not accepted',          color: COLORS.accentRed,    icon: '❌' },
} as const;

export default function DonationScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [tab, setTab] = useState<'give' | 'mine'>('give');
  const [mine, setMine] = useState<MyDonation[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [refreshingMine, setRefreshingMine] = useState(false);
  const { user, isGuest } = useAuthStore();

  const [donorName,   setDonorName]   = useState('');
  // Guests have no account, so their number is the only way to reach them.
  const [donorPhone,  setDonorPhone]  = useState('');
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
  const loadMine = useCallback(async () => {
    // No account means no history to look up.
    if (isGuest) { setLoadingMine(false); return; }
    try {
      const { data } = await api.get(ENDPOINTS.DONATION_HISTORY);
      setMine(data.data || []);
    } catch {
      // Non-fatal — the give form still works without the history.
    } finally {
      setLoadingMine(false);
      setRefreshingMine(false);
    }
  }, [isGuest]);

  useEffect(() => { loadMine(); }, [loadMine]);

  const totalGiven = mine
    .filter((d) => d.status === 'paid')
    .reduce((sum, d) => sum + (parseFloat(d.amount || '0') || 0), 0);

  const handleSubmit = async () => {
    console.log("amount"+amount);
    if (isGuest && !/^[6-9]\d{9}$/.test(donorPhone.trim())) {
      Toast.show({ type: 'error', text1: 'Enter a valid 10-digit mobile number' });
      return;
    }
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
      if (isGuest) formData.append('donor_phone', donorPhone.trim());
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

      // Signed-in users can watch it land as pending; guests have no history,
      // so they just stay on the form with the toast as confirmation.
      if (!isGuest) {
        loadMine();
        setTab('mine');
      }

      // Reset form
      setDonorName('');
      setDonorPhone('');
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

      {/* Give / My Donations — a guest has no account, so no history to show.
          With only one tab left there is nothing to switch between, so the
          whole strip is hidden rather than left as a single dead button. */}
      {!isGuest && (
        <View style={st.tabs}>
          <TouchableOpacity
            style={[st.tab, tab === 'give' && st.tabOn]}
            onPress={() => setTab('give')}
            activeOpacity={0.85}
          >
            <Text style={[st.tabTxt, tab === 'give' && st.tabTxtOn]}>🎁 Donate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.tab, tab === 'mine' && st.tabOn]}
            onPress={() => setTab('mine')}
            activeOpacity={0.85}
          >
            <Text style={[st.tabTxt, tab === 'mine' && st.tabTxtOn]}>
              📜 My Donations{mine.length ? ` (${mine.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'mine' && !isGuest ? (
        <ScrollView
          contentContainerStyle={st.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshingMine}
              onRefresh={() => { setRefreshingMine(true); loadMine(); }}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Running total of everything actually verified */}
          <LinearGradient colors={['rgba(201,168,76,0.18)', 'rgba(201,168,76,0.04)']} style={st.totalCard}>
            <Text style={st.totalLabel}>YOUR VERIFIED CONTRIBUTION</Text>
            <Text style={st.totalValue}>₹{totalGiven.toLocaleString('en-IN')}</Text>
            <Text style={st.totalSub}>
              {mine.filter((d) => d.status === 'paid').length} verified
              {mine.some((d) => d.status === 'pending')
                ? ` • ${mine.filter((d) => d.status === 'pending').length} awaiting verification`
                : ''}
            </Text>
          </LinearGradient>

          {loadingMine ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : mine.length === 0 ? (
            <View style={st.empty}>
              <Text style={{ fontSize: 40 }}>🤲</Text>
              <Text style={st.emptyTitle}>No donations yet</Text>
              <Text style={st.emptySub}>Your contributions will appear here once you submit one.</Text>
              <TouchableOpacity onPress={() => setTab('give')} style={{ marginTop: 14 }} activeOpacity={0.7}>
                <Text style={st.emptyLink}>Make your first donation</Text>
              </TouchableOpacity>
            </View>
          ) : (
            mine.map((d) => {
              const meta = STATUS_META[d.status] || STATUS_META.pending;
              return (
                <View key={d.id} style={[st.mineCard, { borderLeftColor: meta.color }]}>
                  <View style={st.mineTop}>
                    <Text style={st.mineAmount}>
                      {d.amount ? `₹${parseFloat(d.amount).toLocaleString('en-IN')}` : 'Amount pending'}
                    </Text>
                    <View style={[st.statusPill, { borderColor: meta.color, backgroundColor: meta.color + '22' }]}>
                      <Text style={[st.statusTxt, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
                    </View>
                  </View>

                  {d.message ? <Text style={st.mineMsg}>"{d.message}"</Text> : null}

                  <View style={st.mineFooter}>
                    <Text style={st.mineDate}>
                      {d.created_at
                        ? new Date(d.created_at.replace(' ', 'T')).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </Text>
                    {d.is_anonymous && <Text style={st.anonBadge}>Anonymous</Text>}
                  </View>

                  {d.status === 'pending' && (
                    <Text style={st.mineHint}>
                      A super admin is checking your payment proof. This usually takes a few hours.
                    </Text>
                  )}
                  {d.status === 'rejected' && (
                    <Text style={[st.mineHint, { color: COLORS.accentRed }]}>
                      The proof could not be verified. Contact your zone admin if you think this is wrong.
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
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

          {/* ── Step 1: Pay ── */}
          <PremiumCard style={st.card}>
            <View style={st.stepRow}>
              <View style={st.stepBadge}><Text style={st.stepNum}>1</Text></View>
              <Text style={st.cardTitle}>Pay via UPI</Text>
            </View>

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

          {/* ── Step 2: Tell us about it ── */}
          <PremiumCard style={st.card}>
            <View style={st.stepRow}>
              <View style={st.stepBadge}><Text style={st.stepNum}>2</Text></View>
              <Text style={st.cardTitle}>Your Details</Text>
            </View>

            <Text style={st.label}>Name</Text>
            <TextInput
              style={[st.input, isAnonymous && st.inputDisabled]}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textMuted}
              value={donorName}
              onChangeText={setDonorName}
              editable={!isAnonymous}
            />

            {/* A signed-in donor's number comes off their account. A guest has
                no account, so we ask — it is the only way to contact them
                about their donation. */}
            {isGuest && (
              <>
                <Text style={st.label}>Mobile Number <Text style={st.required}>*</Text></Text>
                <TextInput
                  style={st.input}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={COLORS.textMuted}
                  value={donorPhone}
                  onChangeText={(t) => setDonorPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <Text style={st.helperText}>
                  Used only to confirm your donation. Not shared publicly.
                </Text>
              </>
            )}

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

          {/* ── Step 3: Proof ── */}
          <PremiumCard style={st.card}>
            <View style={st.stepRow}>
              <View style={st.stepBadge}><Text style={st.stepNum}>3</Text></View>
              <Text style={st.cardTitle}>Upload Payment Proof <Text style={st.required}>*</Text></Text>
            </View>
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
      )}
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  tabs:  { flexDirection: 'row', gap: 8, paddingHorizontal: SIZES.spacing.base, paddingVertical: SIZES.spacing.sm },
  tab:   {
    flex: 1, paddingVertical: 9, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary, alignItems: 'center',
  },
  tabOn:    { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.14)' },
  tabTxt:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTxtOn: { color: COLORS.primary, fontWeight: '700' },

  totalCard:  { borderRadius: SIZES.radius.lg, padding: SIZES.spacing.lg, alignItems: 'center', marginBottom: SIZES.spacing.base },
  totalLabel: { color: COLORS.textMuted, fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },
  totalValue: { color: COLORS.primary, fontSize: 32, fontWeight: '800', marginTop: 6 },
  totalSub:   { color: COLORS.textSecondary, fontSize: 11.5, marginTop: 4 },

  mineCard: {
    backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.lg,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3,
    padding: SIZES.spacing.base, marginBottom: SIZES.spacing.sm,
  },
  mineTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mineAmount: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt:  { fontSize: 9.5, fontWeight: '700' },
  mineMsg:    { color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic', marginTop: 8, lineHeight: 19 },
  mineFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  mineDate:   { color: COLORS.textMuted, fontSize: 10.5 },
  anonBadge:  {
    color: COLORS.textMuted, fontSize: 9, fontWeight: '700',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden',
  },
  mineHint:   { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 },

  empty:      { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  emptySub:   { color: COLORS.textMuted, fontSize: 12.5, textAlign: 'center', paddingHorizontal: 30 },
  emptyLink:  { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  stepRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SIZES.spacing.sm },
  stepBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum:   { color: COLORS.textOnPrimary, fontSize: 12, fontWeight: '800' },
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
