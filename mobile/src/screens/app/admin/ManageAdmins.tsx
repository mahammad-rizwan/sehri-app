import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, ZONE_CONFIG } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import PremiumCard from '../../../components/ui/PremiumCard';
import GoldButton from '../../../components/ui/GoldButton';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';

interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'super_admin';
  zone: string;
  created_at: string;
}

export default function ManageAdmins() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState<'admin' | 'super_admin' | null>(null);
  const [form, setForm] = useState({ phone: '', zone: 'masjid' });
  const [submitting, setSubmitting] = useState(false);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const res = await api.get(ENDPOINTS.LIST_ADMINS);
      setAdmins(res.data.data || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to load admins' });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAdmins(); }, []);

  const handleCreate = async () => {
    if (!form.phone.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter phone number' });
      return;
    }
    if (form.phone.length !== 10) {
      Toast.show({ type: 'error', text1: 'Phone must be 10 digits' });
      return;
    }

    try {
      setSubmitting(true);
      const endpoint = showForm === 'super_admin' ? ENDPOINTS.CREATE_SUPER_ADMIN : ENDPOINTS.CREATE_ADMIN;
      const payload = showForm === 'super_admin'
        ? { phone: form.phone }
        : { phone: form.phone, zone: form.zone };

      await api.post(endpoint, payload);
      Toast.show({ type: 'success', text1: `${showForm === 'super_admin' ? 'Super Admin' : 'Admin'} created successfully!` });
      setShowForm(null);
      setForm({ phone: '', zone: 'masjid' });
      loadAdmins();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to create admin' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = (admin: AdminUser) => {
    Alert.alert(
      `Delete ${admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}`,
      `Are you sure you want to remove ${admin.name} (${admin.phone})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const endpoint = admin.role === 'super_admin'
                ? ENDPOINTS.DELETE_SUPER_ADMIN(admin.id)
                : ENDPOINTS.DELETE_ADMIN(admin.id);
              await api.delete(endpoint);
              Toast.show({ type: 'success', text1: `${admin.role === 'super_admin' ? 'Super Admin' : 'Admin'} deleted` });
              loadAdmins();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to delete' });
            }
          },
        },
      ]
    );
  };

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Manage Admins</Text>
          <Text style={styles.subtitle}>
            {isSuperAdmin ? 'Create and manage admin accounts' : 'View admin accounts'}
          </Text>
        </View>

        {/* Create Admin Buttons (super_admin only) */}
        {isSuperAdmin && !showForm && (
          <View style={styles.createActions}>
            <GoldButton
              title="Add Admin"
              onPress={() => setShowForm('admin')}
              style={styles.createBtn}
            />
            <GoldButton
              title="Add Super Admin"
              onPress={() => setShowForm('super_admin')}
              style={styles.createBtn}
            />
          </View>
        )}

        {/* Create Form */}
        {showForm && (
          <PremiumCard style={styles.formCard}>
            <Text style={styles.formTitle}>
              {showForm === 'super_admin' ? 'Create Super Admin' : 'Create Admin'}
            </Text>

            <Text style={styles.label}>Phone Number (user must already exist & be approved)</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(t) => setForm({ ...form, phone: t.replace(/[^0-9]/g, '').slice(0, 10) })}
              placeholder="10-digit mobile number"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
            />

            {showForm === 'admin' && (
              <>
                <Text style={styles.label}>Zone</Text>
                <View style={styles.zonesRow}>
                  {Object.entries(ZONE_CONFIG).map(([key, cfg]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.zoneChip, form.zone === key && { borderColor: cfg.color, backgroundColor: `${cfg.color}15` }]}
                      onPress={() => setForm({ ...form, zone: key })}
                    >
                      <Text style={styles.zoneEmoji}>{cfg.emoji}</Text>
                      <Text style={[styles.zoneLabel, form.zone === key && { color: cfg.color }]}>
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.formActions}>
              <GoldButton title="Cancel" onPress={() => setShowForm(null)} variant="outline" style={{ flex: 1 }} />
              <GoldButton title="Create" onPress={handleCreate} loading={submitting} style={{ flex: 1 }} />
            </View>
          </PremiumCard>
        )}

        {/* Admins List */}
        <Text style={styles.sectionTitle}>
          {admins.length > 0 ? `All Admins (${admins.length})` : 'No admins found'}
        </Text>

        {admins.map((admin) => {
          const zoneInfo = ZONE_CONFIG[admin.zone as keyof typeof ZONE_CONFIG];
          return (
            <PremiumCard key={admin.id} style={styles.adminCard}>
              <View style={styles.adminRow}>
                <LinearGradient
                  colors={admin.role === 'super_admin' ? ['#FF6B35', '#E85D2C'] : ['#4FC3F7', '#29B6F6']}
                  style={styles.adminAvatar}
                >
                  <Text style={styles.adminAvatarText}>{admin.name.charAt(0)}</Text>
                </LinearGradient>
                <View style={styles.adminInfo}>
                  <Text style={styles.adminName}>{admin.name}</Text>
                  <Text style={styles.adminPhone}>+91 {admin.phone}</Text>
                  <View style={styles.adminMeta}>
                    <View style={[styles.roleBadge, {
                      backgroundColor: admin.role === 'super_admin' ? 'rgba(255,107,53,0.15)' : 'rgba(79,195,247,0.15)',
                      borderColor: admin.role === 'super_admin' ? '#FF6B35' : '#4FC3F7',
                    }]}>
                      <Text style={[styles.roleText, {
                        color: admin.role === 'super_admin' ? '#FF6B35' : '#4FC3F7',
                      }]}>
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </Text>
                    </View>
                    {zoneInfo && (
                      <View style={[styles.zoneBadge, { borderColor: zoneInfo.color }]}>
                        <Text style={styles.zoneBadgeEmoji}>{zoneInfo.emoji}</Text>
                        <Text style={[styles.zoneBadgeText, { color: zoneInfo.color }]}>{zoneInfo.label}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {isSuperAdmin && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(admin)}
                  >
                    <Text style={styles.deleteText}>Del</Text>
                  </TouchableOpacity>
                )}
              </View>
            </PremiumCard>
          );
        })}

        {loading && (
          <Text style={styles.loadingText}>Loading admins...</Text>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: SIZES.spacing.xl, paddingTop: 60, paddingBottom: 60 },
  header: { marginBottom: SIZES.spacing.xl },
  backBtn: { marginBottom: SIZES.spacing.md },
  backText: { color: COLORS.primary, fontSize: SIZES.base },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 4 },
  createActions: { flexDirection: 'row', gap: 10, marginBottom: SIZES.spacing.xl },
  createBtn: { flex: 1 },
  formCard: { marginBottom: SIZES.spacing.xl },
  formTitle: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '700', marginBottom: SIZES.spacing.md },
  label: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginBottom: 8, marginTop: SIZES.spacing.md },
  input: {
    backgroundColor: COLORS.backgroundSecondary, borderRadius: SIZES.radius.md,
    borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: SIZES.spacing.md,
    paddingVertical: SIZES.spacing.sm, color: COLORS.textPrimary, fontSize: SIZES.base,
  },
  zonesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  zoneChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: SIZES.radius.full, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
  },
  zoneEmoji: { fontSize: 14, marginRight: 4 },
  zoneLabel: { color: COLORS.textSecondary, fontSize: SIZES.xs, fontWeight: '500' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: SIZES.spacing.xl },
  sectionTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.md },
  adminCard: { marginBottom: SIZES.spacing.sm },
  adminRow: { flexDirection: 'row', alignItems: 'center' },
  adminAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: SIZES.spacing.md },
  adminAvatarText: { color: '#fff', fontSize: SIZES.lg, fontWeight: '700' },
  adminInfo: { flex: 1 },
  adminName: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '600' },
  adminPhone: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 2 },
  adminMeta: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: SIZES.radius.full, borderWidth: 1 },
  roleText: { fontSize: SIZES.xs, fontWeight: '600' },
  zoneBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: SIZES.radius.full, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  zoneBadgeEmoji: { fontSize: 10, marginRight: 3 },
  zoneBadgeText: { fontSize: 10, fontWeight: '600' },
  deleteBtn: { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: SIZES.radius.sm, backgroundColor: 'rgba(244,67,54,0.15)', borderWidth: 1, borderColor: '#F44336' },
  deleteText: { color: '#F44336', fontSize: SIZES.xs, fontWeight: '700' },
  loadingText: { color: COLORS.textMuted, fontSize: SIZES.sm, textAlign: 'center', marginTop: SIZES.spacing.xl },
});
