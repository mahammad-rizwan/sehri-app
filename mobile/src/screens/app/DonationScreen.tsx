import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Linking, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { COLORS, SIZES } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import PremiumCard from '../../components/ui/PremiumCard';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import Toast from 'react-native-toast-message';

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export default function DonationScreen() {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const selectPreset = (val: number) => {
    setSelectedPreset(val);
    setAmount(val.toString());
  };

  const handleDonate = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 1) {
      Toast.show({ type: 'error', text1: 'Enter a valid donation amount (min ₹1)' });
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.post(ENDPOINTS.CREATE_ORDER, {
        amount: amountNum,
        message,
        is_anonymous: isAnonymous,
        donor_name: isAnonymous ? undefined : user?.name,
        donor_phone: isAnonymous ? undefined : user?.phone,
      });

      const { orderId: oId, key, amount: orderAmount, currency } = data.data;
      setOrderId(oId);

      // Build Razorpay checkout URL
      // In production, use react-native-razorpay or embedded webview
      const checkoutHtml = buildRazorpayHtml({
        key,
        orderId: oId,
        amount: orderAmount,
        currency,
        name: isAnonymous ? 'Anonymous Donor' : (user?.name || 'Donor'),
        phone: isAnonymous ? '' : (user?.phone || ''),
        description: 'Sehri Food Distribution Donation',
      });

      setPaymentUrl(checkoutHtml);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to create payment' });
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'payment_success') {
        await api.post(ENDPOINTS.VERIFY_PAYMENT, {
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        });
        setPaymentUrl(null);
        Toast.show({ type: 'success', text1: 'JazakAllahu Khayran! 🤲', text2: 'Your donation has been received.' });
        setAmount(''); setSelectedPreset(null); setMessage(''); setIsAnonymous(false);
      } else if (data.type === 'payment_failed') {
        setPaymentUrl(null);
        Toast.show({ type: 'error', text1: 'Payment failed. Please try again.' });
      } else if (data.type === 'payment_dismissed') {
        setPaymentUrl(null);
      }
    } catch {}
  };

  if (paymentUrl) {
    return (
      <View style={styles.webviewContainer}>
        <View style={styles.webviewHeader}>
          <TouchableOpacity onPress={() => setPaymentUrl(null)}>
            <Text style={styles.cancelText}>✕ Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.webviewTitle}>Secure Payment</Text>
          <View style={{ width: 60 }} />
        </View>
        <WebView
          source={{ html: paymentUrl }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          style={styles.webview}
        />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🤲</Text>
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

          {/* Preset Amounts */}
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>Select Amount</Text>
            <View style={styles.presetsGrid}>
              {PRESET_AMOUNTS.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.presetBtn, selectedPreset === val && styles.presetBtnActive]}
                  onPress={() => selectPreset(val)}
                >
                  <Text style={[styles.presetText, selectedPreset === val && styles.presetTextActive]}>
                    ₹{val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Or enter custom amount</Text>
            <View style={styles.amountInput}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amountField}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                value={amount}
                onChangeText={(t) => { setAmount(t.replace(/[^0-9.]/g, '')); setSelectedPreset(null); }}
                keyboardType="decimal-pad"
              />
            </View>

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

            <TouchableOpacity
              style={[styles.anonymousToggle, isAnonymous && styles.anonymousToggleActive]}
              onPress={() => setIsAnonymous(!isAnonymous)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, isAnonymous && styles.checkboxActive]}>
                {isAnonymous && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.anonymousTitle}>Send as anonymous</Text>
                <Text style={styles.anonymousDesc}>Hide your name and phone from donation history.</Text>
              </View>
            </TouchableOpacity>
          </PremiumCard>

          {/* Payment Methods Info */}
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>Payment Methods</Text>
            <Text style={styles.paymentSubtitle}>Secure payment via Razorpay</Text>
            <View style={styles.paymentMethods}>
              {['📱 PhonePe', '💚 Google Pay', '🟠 Paytm', '🏦 Net Banking', '💳 Cards', '📲 UPI'].map((m) => (
                <View key={m} style={styles.methodChip}>
                  <Text style={styles.methodText}>{m}</Text>
                </View>
              ))}
            </View>
          </PremiumCard>

          <GoldButton
            title={`Donate ₹${amount || '0'} Now`}
            onPress={handleDonate}
            loading={loading}
            disabled={!amount || parseFloat(amount) < 1}
            size="lg"
            style={styles.donateBtn}
          />

          <Text style={styles.secureNote}>
            🔒 100% Secure Payment • SSL Encrypted
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function buildRazorpayHtml({ key, orderId, amount, currency, name, phone, description }: any) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="background:#0D1B2A;display:flex;align-items:center;justify-content:center;height:100vh;">
  <script>
    var options = {
      key: '${key}',
      amount: '${amount}',
      currency: '${currency}',
      order_id: '${orderId}',
      name: 'Sehri Connect',
      description: '${description}',
      image: '',
      prefill: { name: '${name}', contact: '${phone}' },
      theme: { color: '#C9A84C' },
      modal: { ondismiss: function() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_dismissed' })); } },
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'payment_success',
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        }));
      }
    };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_failed', error: response.error }));
    });
    rzp.open();
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SIZES.spacing.xl, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: SIZES.spacing.xl },
  headerEmoji: { fontSize: 48, marginBottom: SIZES.spacing.sm },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '700' },
  subtitle: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },
  hadithCard: { borderRadius: SIZES.radius.lg, padding: SIZES.spacing.base, marginBottom: SIZES.spacing.md, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  hadithText: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontStyle: 'italic', textAlign: 'center' },
  card: { marginBottom: SIZES.spacing.md },
  cardTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.sm },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SIZES.spacing.md },
  presetBtn: { paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.sm, borderRadius: SIZES.radius.full, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary },
  presetBtnActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.15)' },
  presetText: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontWeight: '600' },
  presetTextActive: { color: COLORS.primary },
  label: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginBottom: 8, marginTop: SIZES.spacing.md },
  amountInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.primary, paddingHorizontal: SIZES.spacing.md },
  rupee: { color: COLORS.primary, fontSize: SIZES.xl, fontWeight: '700', marginRight: 4 },
  amountField: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700', paddingVertical: SIZES.spacing.md },
  messageInput: { backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: SIZES.spacing.md, paddingVertical: SIZES.spacing.sm, color: COLORS.textPrimary, fontSize: SIZES.base, textAlignVertical: 'top' },
  anonymousToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: SIZES.spacing.md, padding: SIZES.spacing.md, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary },
  anonymousToggleActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.12)' },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  checkboxTick: { color: COLORS.textOnPrimary, fontSize: SIZES.sm, fontWeight: '700' },
  anonymousTitle: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '700' },
  anonymousDesc: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  paymentSubtitle: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginBottom: SIZES.spacing.sm },
  paymentMethods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: { backgroundColor: COLORS.backgroundElevated, borderRadius: SIZES.radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  methodText: { color: COLORS.textSecondary, fontSize: SIZES.xs },
  donateBtn: { width: '100%', marginTop: SIZES.spacing.sm },
  secureNote: { color: COLORS.textMuted, fontSize: SIZES.xs, textAlign: 'center', marginTop: SIZES.spacing.md },
  webviewContainer: { flex: 1, backgroundColor: COLORS.background },
  webviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SIZES.spacing.base, paddingTop: 60, backgroundColor: COLORS.backgroundCard, borderBottomWidth: 1, borderColor: COLORS.border },
  cancelText: { color: COLORS.accentRed, fontSize: SIZES.base },
  webviewTitle: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '600' },
  webview: { flex: 1 },
});
