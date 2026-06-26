import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Linking, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../../src/constants/theme';
import GoldButton from '../../../src/components/ui/GoldButton';
import api from '../../../src/services/api';
import { ENDPOINTS } from '../../../src/constants/api';
import Toast from 'react-native-toast-message';

const ZONES = ['all', 'masjid', 'boys_hostel', 'stanza', 'girls'];

export default function AdminTracking() {
  const [riders, setRiders]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const emptyForm = {
    rider_phone: '', rider_password: '',
    track_date: today, zone: 'all',
    latitude: '', longitude: '',
  };
  const [form, setForm]         = useState(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(ENDPOINTS.ALL_RIDERS);
      setRiders(data.data || []);
    } catch {
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addRider = async () => {
    if (form.rider_phone.length !== 10) { Toast.show({ type:'error', text1:'Enter valid 10-digit phone' }); return; }
    if (!form.rider_password.trim()) { Toast.show({ type:'error', text1:'Password is required' });      return; }

    try {
      setSubmitting(true);
      await api.post('/tracking', {
        rider_name:     form.rider_phone,
        rider_phone:    form.rider_phone,
        rider_password: form.rider_password,
        track_date:     form.track_date,
        zone:           form.zone,
        latitude:       form.latitude  || undefined,
        longitude:      form.longitude || undefined,
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
      {/* Header */}
      <View style={st.header}>
        <Text style={st.title}>🛵 Rider Management</Text>
        <GoldButton
          title={showForm ? '✕ Close' : '+ Add Rider'}
          onPress={() => setShowForm((v) => !v)}
          size="sm"
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {/* ── Add Rider Form ── */}
        {showForm && (
          <View style={st.form}>
            <Text style={st.section}>Rider Login</Text>
            <Text style={st.hint}>Phone number is used as both login ID and rider name</Text>

            <View style={st.row}>
              <TextInput style={[st.input, { flex: 1 }]} placeholder="Phone (10 digits) *"
                placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad"
                value={form.rider_phone}
                onChangeText={(t) => setForm({ ...form, rider_phone: t.replace(/\D/g, '').slice(0, 10) })} />
              <TextInput style={[st.input, { flex: 1 }]} placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={COLORS.textMuted}
                value={form.track_date} onChangeText={(t) => setForm({ ...form, track_date: t })} />
            </View>

            {/* Password */}
            <Text style={st.section}>Login Password</Text>
            <Text style={st.hint}>Rider will use this phone + password to login to the app</Text>
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

            {/* Zone */}
            <Text style={st.section}>Zone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {ZONES.map((z) => (
                <TouchableOpacity
                  key={z}
                  style={[st.zoneBtn, form.zone === z && st.zoneBtnOn]}
                  onPress={() => setForm({ ...form, zone: z })}
                >
                  <Text style={[st.zoneTxt, form.zone === z && st.zoneTxtOn]}>
                    {z === 'all' ? '🌐 All' : z.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Coords (optional — rider broadcasts live, but an initial pin helps) */}
            <Text style={st.section}>Starting Coordinates (optional)</Text>
            <Text style={st.hint}>Helps show the initial pin before the rider starts broadcasting</Text>
            <View style={st.row}>
              <TextInput style={[st.input, { flex: 1 }]} placeholder="Latitude" placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad" value={form.latitude}
                onChangeText={(t) => setForm({ ...form, latitude: t })} />
              <TextInput style={[st.input, { flex: 1 }]} placeholder="Longitude" placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad" value={form.longitude}
                onChangeText={(t) => setForm({ ...form, longitude: t })} />
            </View>

            <View style={st.formActions}>
              <GoldButton title="Cancel" onPress={() => setShowForm(false)} variant="outline" style={{ flex: 1 }} />
              <GoldButton title="Add Rider" onPress={addRider} loading={submitting} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* ── Riders List ── */}
        {riders.map((item) => (
          <View key={item.id} style={st.card}>
            {/* Card header */}
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

            <Text style={st.meta}>📞 {item.rider_phone}  •  Zone: {item.zone}  •  {item.track_date || 'Today'}</Text>
            <Text style={st.meta}>Status: {item.status}{item.eta_minutes != null ? `  •  ETA: ${item.eta_minutes} min` : ''}</Text>
            {item.latitude
              ? <Text style={st.coords}>📍 {item.latitude}, {item.longitude}</Text>
              : <Text style={st.noCoords}>⚠️ No coordinates — rider will broadcast live GPS</Text>}

            {/* Action buttons row */}
            <View style={st.actionRow}>
              <View style={st.credBox}>
                <Ionicons name="key-outline" size={13} color={COLORS.primary} />
                <Text style={st.credTxt}>
                  📞 {item.rider_phone}  ·  Password set by admin
                </Text>
              </View>
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
    paddingTop: 60, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },

  form: {
    marginHorizontal: SIZES.spacing.base, backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg, padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.md, borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  section: { color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  hint:    { color: COLORS.textMuted, fontSize: SIZES.xs, lineHeight: 18 },
  row:     { flexDirection: 'row', gap: 8 },
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
  zoneBtn:   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary, marginRight: 8 },
  zoneBtnOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.1)' },
  zoneTxt:   { color: COLORS.textSecondary, fontSize: SIZES.xs, fontWeight: '600', textTransform: 'capitalize' },
  zoneTxtOn: { color: COLORS.primary },
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
  meta:        { color: COLORS.textSecondary, fontSize: SIZES.xs, textTransform: 'capitalize' },
  coords:      { color: COLORS.textMuted, fontSize: SIZES.xs },
  noCoords:    { color: COLORS.accentOrange, fontSize: SIZES.xs },

  credBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderRadius: SIZES.radius.sm, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
    paddingHorizontal: 10, paddingVertical: 6,
  },
  credTxt: { color: COLORS.textSecondary, fontSize: SIZES.xs, flex: 1 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
