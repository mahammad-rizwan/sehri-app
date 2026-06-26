import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES } from '../../constants/theme';
import GoldButton from '../../components/ui/GoldButton';
import PremiumCard from '../../components/ui/PremiumCard';
import api from '../../services/api';
import { ENDPOINTS } from '../../constants/api';
import Toast from 'react-native-toast-message';

const CATEGORIES = [
  { key: 'general', label: 'General', icon: '💬' },
  { key: 'food_quality', label: 'Food Quality', icon: '🍱' },
  { key: 'distribution', label: 'Distribution', icon: '🛵' },
  { key: 'suggestion', label: 'Suggestion', icon: '💡' },
  { key: 'complaint', label: 'Complaint', icon: '⚠️' },
];

export default function FeedbackScreen() {
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (message.trim().length < 5) {
      Toast.show({ type: 'error', text1: 'Please write at least 5 characters' });
      return;
    }
    try {
      setLoading(true);
      await api.post(ENDPOINTS.FEEDBACK, {
        message: message.trim(),
        category,
        rating: rating || null,
      });
      setSubmitted(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to submit' });
    } finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🤲</Text>
          <Text style={styles.successTitle}>JazakAllahu Khayran!</Text>
          <Text style={styles.successDate}>Submitted on {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={styles.successText}>
            Your feedback has been received. We appreciate your time and effort
            in helping us improve the Sehri distribution service.
          </Text>
          <GoldButton
            title="Submit Another Feedback"
            onPress={() => { setSubmitted(false); setMessage(''); setRating(0); setCategory('general'); }}
            style={styles.anotherBtn}
          />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>💬</Text>
            <Text style={styles.title}>Share Feedback</Text>
            <Text style={styles.subtitle}>Help us serve you better</Text>
          </View>

          {/* Category */}
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catChip, category === c.key && styles.catChipActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={styles.catIcon}>{c.icon}</Text>
                  <Text style={[styles.catLabel, category === c.key && { color: COLORS.primary }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </PremiumCard>

          {/* Rating */}
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>Rating (optional)</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(rating === star ? 0 : star)}>
                  <Text style={[styles.star, rating >= star && styles.starActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.ratingLabel}>
                {['', 'Very Poor 😞', 'Poor 😕', 'Average 😊', 'Good 👍', 'Excellent 🌟'][rating]}
              </Text>
            )}
          </PremiumCard>

          {/* Message */}
          <PremiumCard style={styles.card}>
            <Text style={styles.cardTitle}>Your Feedback *</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Write your feedback here... (min 5 characters)"
              placeholderTextColor={COLORS.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{message.length}/1000</Text>
          </PremiumCard>

          <GoldButton
            title="Submit Feedback 🤲"
            onPress={handleSubmit}
            loading={loading}
            disabled={message.length < 5}
            size="lg"
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SIZES.spacing.xl, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: SIZES.spacing.xl },
  headerEmoji: { fontSize: 48, marginBottom: SIZES.spacing.sm },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '700' },
  subtitle: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },
  card: { marginBottom: SIZES.spacing.md },
  cardTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.sm },
  catScroll: { marginTop: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: SIZES.radius.full, borderWidth: 1.5, borderColor: COLORS.border, marginRight: 8, backgroundColor: COLORS.backgroundSecondary },
  catChipActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.12)' },
  catIcon: { fontSize: 16, marginRight: 6 },
  catLabel: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontWeight: '500' },
  stars: { flexDirection: 'row', gap: 8, marginVertical: SIZES.spacing.sm },
  star: { fontSize: 36, color: COLORS.border },
  starActive: { color: COLORS.primary },
  ratingLabel: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },
  messageInput: { backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md, borderWidth: 1.5, borderColor: COLORS.border, padding: SIZES.spacing.md, color: COLORS.textPrimary, fontSize: SIZES.base, minHeight: 130 },
  charCount: { color: COLORS.textMuted, fontSize: SIZES.xs, textAlign: 'right', marginTop: 4 },
  submitBtn: { width: '100%', marginTop: SIZES.spacing.sm },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SIZES.spacing.xxxl },
  successEmoji: { fontSize: 80, marginBottom: SIZES.spacing.lg },
  successTitle: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '700', marginBottom: SIZES.spacing.sm },
  successDate: { color: COLORS.textMuted, fontSize: SIZES.xs, marginBottom: SIZES.spacing.md },
  successText: { color: COLORS.textSecondary, fontSize: SIZES.base, textAlign: 'center', lineHeight: 26 },
  anotherBtn: { marginTop: SIZES.spacing.xxl, width: '100%' },
});
