import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../../src/constants/theme';
import GoldButton from '../../../src/components/ui/GoldButton';
import api from '../../../src/services/api';
import { ENDPOINTS } from '../../../src/constants/api';
import Toast from 'react-native-toast-message';

export default function AdminTracking() {
  const [riders, setRiders]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const emptyForm = {
    rider_phone: '', rider_password: '',
  };
  const [form, setForm]         = useState(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(ENDPOINTS.ALL_RIDERS);
      setRiders(data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addRider = async () => {
    if (form.rider_phone.length !== 10) { Toast.show({ type:'error', text1:'Enter valid 10-digit phone' }); return; }
    if (!form.rider_password.trim()) { Toast.show({ type:'error', text1:'Password is required' }); return; }

    try {
      setSubmitting(true);
      await api.post('/tracking', {
        rider_name:     form.rider_phone,
        rider_phone:    form.rider_phone,
        rider_password: form.rider_password,
      });
      Toast.show({ type:'success', text1:'✅ Rider added!' });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err: any) {
      Toast.show({ type:'error', text1: err?.response?.data?.message || 'Failed to add rider' });
    } finally { setSubmitting(false); }
  };

  const toggleRider = async (id: string) => {
    try {
      await api.patch(`/tracking/${id}/toggle`, {});
      Toast.show({ type:'success', text1:'Rider status toggled' });
      load();
    } catch { Toast.show({ type:'error', text1:'Failed' }); }
  };

  const deleteRider = (id: string, name: string) => {
    Alert.alert(
      'Delete Rider',
      `Are you sure you want to delete rider "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(ENDPOINTS.DELETE_RIDER(id));
              Toast.show({ type:'success', text1:'Rider deleted' });
              load();
            } catch { Toast.show({ type:'error', text1:'Failed to delete' }); }
          },
        },
      ],
    );
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.root}>
      <View style={st.header}>
        <Text style={st.title}>🛵 Rider Management</Text>
        <GoldButton
          title={showForm ? '✕ Close' : '+ Add Rider'}
          onPress={() => setShowForm((v) => !v)}
          size="sm"
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {showForm && (
          <View style={st.form}>
            <Text style={st.section}>Phone Number</Text>
            <TextInput style={st.input} placeholder="10-digit phone number *"
              placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad"
              value={form.rider_phone}
              onChangeText={(t) => setForm({ ...form, rider_phone: t.replace(/\D/g, '').slice(0, 10) })} />

            <Text style={st.section}>Password</Text>
            <View style={st.passRow}>
              <TextInput
                style={[st.input, { flex: 1 }]}
                placeholder="Set password for rider *"
                placeholderTextColor={COLORS.textMuted}
                value={form.rider_password}
                onChangeText={(t) => setForm({ ...form, rider_password: t })}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity style={st.eyeBtn} onPress={() => setShowPass((v) => !v)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={st.formActions}>
              <GoldButton title="Cancel" onPress={() => setShowForm(false)} variant="outline" style={{ flex: 1 }} />
              <GoldButton title="Add Rider" onPress={addRider} loading={submitting} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {riders.map((item) => (
          <View key={item.id} style={st.card}>
            <View style={st.cardHeader}>
              <View style={st.cardLeft}>
                <View style={[st.dot, { backgroundColor: item.is_active ? COLORS.accentGreen : COLORS.accentRed }]} />
                <Text style={st.cardName}>🛵 {item.rider_name}</Text>
              </View>
              <TouchableOpacity
                style={[st.toggleBtn, { backgroundColor: item.is_active ? 'rgba(76,175,80,0.15)' : 'rgba(239,83,80,0.15)' }]}
                onPress={() => toggleRider(item.id)}
              >
                <Text style={{ color: item.is_active ? COLORS.accentGreen : COLORS.accentRed, fontSize: SIZES.xs, fontWeight: '600' }}>
                  {item.is_active ? '🟢 Active' : '🔴 Inactive'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={st.meta}>📞 {item.rider_phone}</Text>

            <View style={st.credBox}>
              <Ionicons name="key-outline" size={13} color={COLORS.primary} />
              <Text style={st.credTxt}>
                📞 {item.rider_phone}  ·  Password set by admin
              </Text>
              <TouchableOpacity style={st.deleteBtn} onPress={() => deleteRider(item.id, item.rider_name)}>
                <Ionicons name="trash-outline" size={16} color={COLORS.accentRed} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {!loading && riders.length === 0 && (
          <View style={st.empty}>
            <Text style={st.emptyEmoji}>🛵</Text>
            <Text style={st.emptyTxt}>No riders yet. Add one above.</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: 12, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700', flex: 1 },

  form: {
    marginHorizontal: SIZES.spacing.base, backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg, padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.md, borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  section: { color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  eyeBtn:  {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1, borderLeftWidth: 0, borderColor: COLORS.border,
    borderTopRightRadius: SIZES.radius.sm, borderBottomRightRadius: SIZES.radius.sm,
    paddingHorizontal: 10, paddingVertical: 10,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: SIZES.radius.sm, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SIZES.spacing.sm, paddingVertical: 9,
    color: COLORS.textPrimary, fontSize: SIZES.sm,
  },
  formActions: { flexDirection: 'row', gap: 8, marginTop: SIZES.spacing.sm },

  card: {
    marginHorizontal: SIZES.spacing.base, backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg, padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm, borderWidth: 1, borderColor: COLORS.border, gap: 5,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  cardName:    { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700' },
  toggleBtn:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: SIZES.radius.sm },
  meta:        { color: COLORS.textSecondary, fontSize: SIZES.xs },

  credBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderRadius: SIZES.radius.sm, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
    paddingHorizontal: 10, paddingVertical: 6,
  },
  credTxt: { color: COLORS.textSecondary, fontSize: SIZES.xs, flex: 1 },

  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(239,83,80,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(239,83,80,0.3)',
  },

  empty:      { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTxt:   { color: COLORS.textMuted, fontSize: SIZES.sm },
});
