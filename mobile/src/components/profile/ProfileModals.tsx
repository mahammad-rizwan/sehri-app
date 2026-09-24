import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  COLORS, SIZES, ZONE_CONFIG, OCCUPATIONS, OccupationKey,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import GoldButton from '../ui/GoldButton';
import { fetchAddresses, type ZoneAddress } from '../../services/places';

/* ────────────────────────────────────────────────────────────────────────────
 * Request Profile Edit
 *
 * Only genuinely changed fields are sent. Submitting flips the account back to
 * `pending` server-side, so the caller signs the user out immediately after.
 * ──────────────────────────────────────────────────────────────────────────── */
export function EditProfileRequestModal({
  visible, user, onClose, onSubmitted,
}: {
  visible: boolean;
  user: any;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { requestProfileEdit } = useAuthStore();
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [occupation, setOccupation] = useState('');
  const [zone, setZone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-seed from the live profile every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setName(user?.name || '');
    setGender(user?.gender || '');
    setOccupation(user?.occupation || '');
    setZone(user?.zone || '');
    setAddress(user?.address || '');
  }, [visible, user]);

  // Same source as registration — addresses come from the server, not a
  // hardcoded table, so this list stays correct as PGs are added or retired.
  const [addressRows, setAddressRows] = useState<ZoneAddress[]>([]);

  useEffect(() => {
    if (!visible || !zone) { setAddressRows([]); return; }
    let cancelled = false;
    fetchAddresses(zone)
      .then((rows) => { if (!cancelled) setAddressRows(rows); })
      .catch(() => { if (!cancelled) setAddressRows([]); });
    return () => { cancelled = true; };
  }, [visible, zone]);

  const addressOptions = addressRows.map((a) => ({ key: a.id, label: a.name }));

  const changed = {
    name: name.trim() !== (user?.name || ''),
    gender: gender !== (user?.gender || ''),
    occupation: occupation !== (user?.occupation || ''),
    zone: zone !== (user?.zone || ''),
    address: address.trim() !== (user?.address || ''),
  };
  const changedCount = Object.values(changed).filter(Boolean).length;

  const submit = () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name cannot be empty' });
      return;
    }
    if (!changedCount) {
      Toast.show({ type: 'error', text1: 'Nothing has changed yet' });
      return;
    }

    Alert.alert(
      'Submit for approval?',
      `${changedCount} change${changedCount > 1 ? 's' : ''} will be sent to your zone admin and the super admin.\n\n` +
        'Your account goes back to pending and you will be signed out. You can log in again once your changes are approved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit & Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await requestProfileEdit({
                ...(changed.name ? { name: name.trim() } : {}),
                ...(changed.gender ? { gender } : {}),
                ...(changed.occupation ? { occupation } : {}),
                ...(changed.zone ? { zone } : {}),
                ...(changed.address ? { address: address.trim() } : {}),
              });
              Alert.alert(
                'Request Submitted',
                'Your zone admin and the super admin have been notified. You are being signed out — log in again once your changes are approved.',
                [{ text: 'OK', onPress: onSubmitted }],
              );
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: err?.response?.data?.message || 'Could not submit request',
              });
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const Tag = () => <Text style={st.changedTag}>CHANGED</Text>;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.bg}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={st.sheet}
        >
          <View style={st.header}>
            <Text style={st.title}>Request Profile Edit</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={st.note}>
              Your zone admin and the super admin review these changes. Only the fields you
              actually change are sent.
            </Text>

            <View style={st.fieldRow}>
              <Text style={st.label}>Full Name</Text>
              {changed.name && <Tag />}
            </View>
            <TextInput
              style={st.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={st.fieldRow}>
              <Text style={st.label}>Gender</Text>
              {changed.gender && <Tag />}
            </View>
            <View style={st.chipRow}>
              {['male', 'female'].map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGender(g)}
                  style={[st.chip, gender === g && st.chipOn]}
                  activeOpacity={0.8}
                >
                  <Text style={[st.chipTxt, gender === g && st.chipTxtOn]}>
                    {g === 'male' ? 'Male' : 'Female'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.fieldRow}>
              <Text style={st.label}>Occupation</Text>
              {changed.occupation && <Tag />}
            </View>
            <View style={st.chipRow}>
              {(Object.keys(OCCUPATIONS) as OccupationKey[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  onPress={() => setOccupation(k)}
                  style={[st.chip, occupation === k && st.chipOn]}
                  activeOpacity={0.8}
                >
                  <Text style={[st.chipTxt, occupation === k && st.chipTxtOn]}>
                    {OCCUPATIONS[k].emoji} {OCCUPATIONS[k].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.fieldRow}>
              <Text style={st.label}>Zone</Text>
              {changed.zone && <Tag />}
            </View>
            <View style={st.chipRow}>
              {(Object.keys(ZONE_CONFIG) as (keyof typeof ZONE_CONFIG)[]).map((z) => (
                <TouchableOpacity
                  key={z}
                  onPress={() => {
                    setZone(z);
                    setAddress('');
                  }}
                  style={[
                    st.chip,
                    zone === z && {
                      backgroundColor: ZONE_CONFIG[z].color + '26',
                      borderColor: ZONE_CONFIG[z].color,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      st.chipTxt,
                      zone === z && { color: ZONE_CONFIG[z].color, fontWeight: '700' },
                    ]}
                  >
                    {ZONE_CONFIG[z].emoji} {ZONE_CONFIG[z].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.fieldRow}>
              <Text style={st.label}>PG / Address</Text>
              {changed.address && <Tag />}
            </View>
            {addressOptions.length > 0 && (
              <View style={st.chipRow}>
                {addressOptions.map((a) => (
                  <TouchableOpacity
                    key={a.key}
                    onPress={() => setAddress(a.label)}
                    style={[st.chip, address === a.label && st.chipOn]}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.chipTxt, address === a.label && st.chipTxtOn]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              style={st.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Or type your address"
              placeholderTextColor={COLORS.textMuted}
            />

            <GoldButton
              title={changedCount ? `Submit ${changedCount} Change${changedCount > 1 ? 's' : ''}` : 'Submit'}
              onPress={submit}
              loading={saving}
              size="lg"
              style={{ marginTop: 18, marginBottom: 28 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Change Password — instant, no approval, no OTP.
 * ──────────────────────────────────────────────────────────────────────────── */
export function ChangePasswordModal({
  visible, onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { changePassword } = useAuthStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setReveal(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!current) {
      Toast.show({ type: 'error', text1: 'Enter your current password' });
      return;
    }
    if (next.length < 8) {
      Toast.show({ type: 'error', text1: 'New password must be at least 8 characters' });
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(next)) {
      Toast.show({ type: 'error', text1: 'New password needs at least 1 special character' });
      return;
    }
    if (next !== confirm) {
      Toast.show({ type: 'error', text1: 'Passwords do not match' });
      return;
    }
    if (next === current) {
      Toast.show({ type: 'error', text1: 'New password must be different' });
      return;
    }

    try {
      setSaving(true);
      await changePassword(current, next);
      Toast.show({
        type: 'success',
        text1: 'Password changed',
        text2: 'Use your new password next time you log in.',
      });
      onClose();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || 'Could not change password',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.bg}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={st.sheet}
        >
          <View style={st.header}>
            <Text style={st.title}>Change Password</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={st.note}>
              This takes effect right away. No admin approval and no OTP — your current password
              is the confirmation.
            </Text>

            <Text style={st.label}>Current Password</Text>
            <TextInput
              style={st.input}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              placeholder="Current password"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={st.label}>New Password</Text>
            <Text style={st.hint}>Min 8 characters, at least 1 special character</Text>
            <TextInput
              style={st.input}
              value={next}
              onChangeText={setNext}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              placeholder="New password"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={st.label}>Confirm New Password</Text>
            <TextInput
              style={st.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              placeholder="Re-enter new password"
              placeholderTextColor={COLORS.textMuted}
            />
            {confirm.length > 0 && next !== confirm && (
              <Text style={st.error}>Passwords do not match</Text>
            )}

            <TouchableOpacity onPress={() => setReveal(!reveal)} style={st.revealRow} activeOpacity={0.7}>
              <Ionicons name={reveal ? 'eye-off' : 'eye'} size={16} color={COLORS.textSecondary} />
              <Text style={st.revealTxt}>{reveal ? 'Hide' : 'Show'} passwords</Text>
            </TouchableOpacity>

            <GoldButton
              title="Update Password"
              onPress={submit}
              loading={saving}
              size="lg"
              style={{ marginTop: 18, marginBottom: 28 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '700' },
  note: {
    color: COLORS.textSecondary,
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: 18,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  label: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '600', marginTop: 14 },
  hint: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 2 },
  changedTag: {
    color: COLORS.background,
    backgroundColor: COLORS.accentOrange,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 14,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius.md,
    color: COLORS.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 14.5,
    marginTop: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
  },
  chipOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.15)' },
  chipTxt: { color: COLORS.textSecondary, fontSize: 12.5 },
  chipTxtOn: { color: COLORS.primary, fontWeight: '700' },
  error: { color: COLORS.accentRed, fontSize: 11.5, marginTop: 6 },
  revealRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  revealTxt: { color: COLORS.textSecondary, fontSize: 12.5 },
});
