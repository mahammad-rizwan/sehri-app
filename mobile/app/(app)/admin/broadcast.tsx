import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES, ZONE_CONFIG } from '../../../src/constants/theme';
import api from '../../../src/services/api';
import { ENDPOINTS } from '../../../src/constants/api';
import { useAuthStore } from '../../../src/store/authStore';
import { markBroadcastsSeen } from '../../../src/services/broadcastBadge';

type Sent = {
  id: string; zones: string[]; body: string; links: string[];
  sender_name: string; sender_role: 'admin' | 'super_admin'; created_at: string;
  /** Server-decided: super admins may delete anything, admins only their own. */
  can_delete?: boolean;
};

const MAX = 2000;

export default function AdminBroadcast() {
  const activeRole = useAuthStore((s) => s.activeRole);
  const isSuperAdmin = activeRole === 'super_admin';

  /** Zones this account is allowed to address. An admin gets exactly one. */
  const [allowedZones, setAllowedZones] = useState<string[]>([]);
  const [canPickZones, setCanPickZones] = useState(false);
  const [pickedZones, setPickedZones] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const [sent, setSent] = useState<Sent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [chRes, listRes] = await Promise.all([
        api.get(ENDPOINTS.BROADCAST_CHANNELS),
        api.get(ENDPOINTS.BROADCASTS),
      ]);
      const zones: string[] = chRes.data.data.zones || [];
      const canPick = !!chRes.data.data.canPickZones;
      setAllowedZones(zones);
      setCanPickZones(canPick);
      // A zone admin has no choice to make, so their single zone is the target.
      if (!canPick) setPickedZones(zones);
      const list = listRes.data.data || [];
      setSent(list);
      // An admin opening this screen has seen the announcements in it, so the
      // dashboard badge should clear the same way the user feed clears it.
      if (list.length) markBroadcastsSeen(list[0].created_at);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not load zones' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const targetZones = pickedZones;
  const canSend = body.trim().length >= 2 && targetZones.length > 0 && !sending;

  const toggleZone = (z: string) => {
    setPickedZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };

  const allSelected = canPickZones && allowedZones.length > 0
    && allowedZones.every((z) => pickedZones.includes(z));

  const send = () => {
    const zoneLabels = targetZones
      .map((z) => (ZONE_CONFIG as any)[z]?.label || z)
      .join(', ');

    Alert.alert(
      'Send announcement?',
      `This goes to everyone in: ${zoneLabels}.\n\nThey will all get a push notification. Announcements are one-way — nobody can reply.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              setSending(true);
              const res = await api.post(ENDPOINTS.BROADCASTS, {
                body: body.trim(),
                zones: pickedZones,
              });
              Toast.show({ type: 'success', text1: 'Announcement sent', text2: res.data?.message });
              setBody('');
              // A zone admin's target is fixed, so keep it selected.
              if (canPickZones) setPickedZones([]);
              load();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not send' });
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  const remove = (m: Sent) => {
    Alert.alert('Delete announcement?', 'It disappears from everyone\'s feed. The notification already sent cannot be recalled.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(ENDPOINTS.BROADCAST_DELETE(m.id));
            setSent((prev) => prev.filter((x) => x.id !== m.id));
            Toast.show({ type: 'success', text1: 'Deleted' });
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Delete failed' });
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={[st.container, st.center]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={st.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        >
          <Text style={st.title}>📢 Broadcast</Text>
          <Text style={st.subtitle}>
            {isSuperAdmin
              ? 'Pick the zones that should receive this, then write your message.'
              : 'Send an announcement to everyone in your zone.'}
          </Text>

          {/* Audience — zones are picked directly, there are no presets */}
          <Text style={st.label}>{canPickZones ? 'Send to' : 'Your zone'}</Text>

          {allowedZones.length === 0 ? (
            <Text style={st.warn}>Your account has no zone, so there is nothing to broadcast to.</Text>
          ) : canPickZones ? (
            <>
              <View style={st.chipWrap}>
                {allowedZones.map((z) => {
                  const cfg = (ZONE_CONFIG as any)[z];
                  const on = pickedZones.includes(z);
                  return (
                    <TouchableOpacity
                      key={z}
                      onPress={() => toggleZone(z)}
                      style={[
                        st.chip,
                        on && { borderColor: cfg?.color, backgroundColor: (cfg?.color || COLORS.primary) + '22' },
                      ]}
                      activeOpacity={0.85}
                    >
                      <Text style={[st.chipTxt, on && { color: cfg?.color, fontWeight: '700' }]}>
                        {on ? '✓ ' : ''}{cfg?.emoji} {cfg?.label || z}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={() => setPickedZones(allSelected ? [] : [...allowedZones])}
                activeOpacity={0.75}
                style={{ marginTop: 10 }}
              >
                <Text style={st.selectAll}>
                  {allSelected ? 'Clear all' : 'Select all zones'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            /* A zone admin cannot choose — show what they will reach. */
            <View style={st.fixedZone}>
              <Text style={st.fixedZoneTxt}>
                {(ZONE_CONFIG as any)[allowedZones[0]]?.emoji}{' '}
                {(ZONE_CONFIG as any)[allowedZones[0]]?.label || allowedZones[0]}
              </Text>
              <Text style={st.fixedZoneSub}>You can only broadcast to your own zone.</Text>
            </View>
          )}

          {/* Message */}
          <Text style={st.label}>Message</Text>
          <TextInput
            style={st.input}
            value={body}
            onChangeText={setBody}
            placeholder="Type your announcement. Paste Google Maps or YouTube links and they become tappable."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={MAX}
            textAlignVertical="top"
          />
          <View style={st.counterRow}>
            <Text style={st.counterHint}>Text and links only — no photos or videos.</Text>
            <Text style={st.counter}>{body.length}/{MAX}</Text>
          </View>

          {targetZones.length > 0 && (
            <Text style={st.audience}>
              Goes to {targetZones.map((z) => (ZONE_CONFIG as any)[z]?.label || z).join(', ')}
            </Text>
          )}

          <TouchableOpacity
            style={[st.sendBtn, !canSend && { opacity: 0.45 }]}
            onPress={send}
            disabled={!canSend}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color={COLORS.textOnPrimary} />
              : <><Ionicons name="megaphone-outline" size={17} color={COLORS.textOnPrimary} />
                  <Text style={st.sendTxt}>Send Announcement</Text></>}
          </TouchableOpacity>

          {/* Already sent */}
          <Text style={[st.label, { marginTop: 26 }]}>Sent</Text>
          {sent.length === 0 ? (
            <Text style={st.hint}>Nothing sent yet.</Text>
          ) : (
            sent.map((m) => (
              <View key={m.id} style={st.sentCard}>
                <View style={st.sentTop}>
                  {/* Staff still see the audience — they need to check what
                      went where. Readers never do. */}
                  <Text style={st.sentChannel} numberOfLines={1}>
                    {(m.zones || [])
                      .map((z) => (ZONE_CONFIG as any)[z]?.label || z)
                      .join(' · ') || 'Announcement'}
                  </Text>
                  {m.can_delete && (
                    <TouchableOpacity onPress={() => remove(m)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="trash-outline" size={15} color={COLORS.accentRed} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={st.sentBody} numberOfLines={4}>{m.body}</Text>
                {m.links.length > 0 && (
                  <Text style={st.sentLinks}>🔗 {m.links.length} link{m.links.length > 1 ? 's' : ''}</Text>
                )}
                <Text style={st.sentMeta}>
                  {m.sender_name}{m.sender_role === 'super_admin' ? ' (Organiser)' : ''} · {new Date(m.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  selectAll: { color: COLORS.primary, fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
  fixedZone: {
    marginTop: 10, borderRadius: SIZES.radius.md, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  fixedZoneTxt: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '700' },
  fixedZoneSub: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 4 },
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SIZES.spacing.base, paddingTop: 16, paddingBottom: 60 },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 5, lineHeight: 17 },
  label: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '700', marginTop: 20 },
  hint: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 8, lineHeight: 17 },
  clear: { color: COLORS.primary, textDecorationLine: 'underline' },
  warn: { color: COLORS.accentOrange, fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary,
  },
  chipOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.15)' },
  chipTxt: { color: COLORS.textSecondary, fontSize: 12.5 },
  chipTxtOn: { color: COLORS.primary, fontWeight: '700' },
  input: {
    backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: SIZES.radius.md, color: COLORS.textPrimary,
    padding: 14, fontSize: 14.5, minHeight: 140, marginTop: 10,
  },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  counterHint: { color: COLORS.textMuted, fontSize: 11, flex: 1 },
  counter: { color: COLORS.textMuted, fontSize: 11 },
  audience: {
    color: COLORS.primary, fontSize: 12, fontWeight: '600',
    marginTop: 14, textAlign: 'center',
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius.md,
    paddingVertical: 14, marginTop: 12,
  },
  sendTxt: { color: COLORS.textOnPrimary, fontSize: 14.5, fontWeight: '700' },
  sentCard: {
    backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.md, marginTop: SIZES.spacing.sm,
  },
  sentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sentChannel: { color: COLORS.primary, fontSize: 11.5, fontWeight: '700', flex: 1, marginRight: 8 },
  sentBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  sentLinks: { color: COLORS.textMuted, fontSize: 11, marginTop: 6 },
  sentMeta: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 8 },
});
