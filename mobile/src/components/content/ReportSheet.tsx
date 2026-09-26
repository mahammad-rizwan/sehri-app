import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../constants/theme';
import { REPORT_REASONS, REPORT_DESC_MIN, type ReportReason } from '../../constants/reports';
import { submitReport, type ReportTarget } from '../../services/reports';

const DESC_MAX = 1000;

/**
 * Reporting an announcement or chat message: pick a reason, describe what is
 * wrong, submit. Both are required — a reason alone gives a reviewer too little
 * to act on. The outcome shows up later on the reporter's My Reports page.
 */
export default function ReportSheet({
  visible,
  targetType,
  targetId,
  preview,
  onClose,
}: {
  visible: boolean;
  targetType: ReportTarget;
  targetId: string | null;
  preview: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  // Fresh form each time it opens.
  useEffect(() => {
    if (visible) { setReason(null); setDescription(''); }
  }, [visible]);

  const trimmed = description.trim();
  const ready = !!reason && trimmed.length >= REPORT_DESC_MIN && !sending;

  const submit = async () => {
    if (!targetId || !reason) return;
    try {
      setSending(true);
      const res = await submitReport({ target_type: targetType, target_id: targetId, reason, description: trimmed });
      Toast.show({ type: 'success', text1: 'Report submitted', text2: res?.message || 'You can follow it under My Reports.' });
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      Toast.show({
        type: status === 409 ? 'info' : 'error',
        text1: status === 409 ? 'Already reported'
          : status === 404 && !err?.response?.data?.message ? 'Server needs updating'
          : 'Could not submit',
        text2: err?.response?.data?.message || (status === 404 ? 'Reporting needs the latest backend deployed.' : undefined),
      });
      if (status === 409) onClose();
    } finally {
      setSending(false);
    }
  };

  const what = targetType === 'broadcast' ? 'announcement' : 'message';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.head}>
            <Ionicons name="flag" size={18} color={COLORS.accentOrange} />
            <Text style={st.title}>Report {what}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={st.preview} numberOfLines={3}>{preview}</Text>

            <Text style={st.label}>WHAT'S WRONG? *</Text>
            {REPORT_REASONS.map((r) => {
              const on = reason === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[st.reason, on && st.reasonOn]}
                  onPress={() => setReason(r.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={on ? COLORS.accentOrange : COLORS.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.reasonTxt, on && { color: COLORS.textPrimary }]}>{r.label}</Text>
                    <Text style={st.reasonHint}>{r.hint}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={st.label}>DESCRIBE THE PROBLEM *</Text>
            <TextInput
              style={st.input}
              value={description}
              onChangeText={(t) => setDescription(t.slice(0, DESC_MAX))}
              placeholder="What is wrong with it, and why should it be reviewed?"
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />
            <Text style={[st.counter, trimmed.length > 0 && trimmed.length < REPORT_DESC_MIN && { color: COLORS.accentOrange }]}>
              {trimmed.length < REPORT_DESC_MIN
                ? `At least ${REPORT_DESC_MIN} characters (${trimmed.length}/${REPORT_DESC_MIN})`
                : `${trimmed.length}/${DESC_MAX}`}
            </Text>

            <Text style={st.privacy}>
              Your report goes to the organisers, not to the person who posted it.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[st.submit, !ready && st.submitOff]}
            onPress={submit}
            disabled={!ready}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : <Text style={[st.submitTxt, !ready && { color: COLORS.textMuted }]}>Submit Report</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#0D1B2A',
    borderTopLeftRadius: SIZES.radius.xl, borderTopRightRadius: SIZES.radius.xl,
    borderTopWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.lg, paddingBottom: Platform.OS === 'ios' ? 34 : SIZES.spacing.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700' },
  preview: {
    color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 18,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: SIZES.radius.md,
    padding: 10, borderLeftWidth: 3, borderLeftColor: COLORS.accentOrange,
  },
  label: {
    color: COLORS.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6,
    marginTop: 16, marginBottom: 8,
  },
  reason: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 9, paddingHorizontal: 10, marginBottom: 5,
    borderRadius: SIZES.radius.md, borderWidth: 1, borderColor: COLORS.border,
  },
  reasonOn: { borderColor: COLORS.accentOrange, backgroundColor: 'rgba(255,152,0,0.08)' },
  reasonTxt: { color: COLORS.textSecondary, fontSize: 13.5, fontWeight: '600' },
  reasonHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  input: {
    minHeight: 96, backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radius.md,
    padding: 12, color: COLORS.textPrimary, fontSize: 14,
  },
  counter: { color: COLORS.textMuted, fontSize: 11, marginTop: 5, textAlign: 'right' },
  privacy: { color: COLORS.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 },
  submit: {
    marginTop: 12, paddingVertical: 14, borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.accentOrange, alignItems: 'center',
  },
  submitOff: { backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  submitTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
