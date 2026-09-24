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

type Channel = {
  key: string; name: string; emoji: string; description: string; zones: string[];
};

type Sent = {
  id: string; channel_name: string; channel_emoji: string; zones: string[];
  body: string; links: string[]; sender_name: string;
  sender_role: 'admin' | 'super_admin'; created_at: string;
};

const MAX = 2000;

export default function AdminBroadcast() {
  const activeRole = useAuthStore((s) => s.activeRole);
  const isSuperAdmin = activeRole === 'super_admin';

  const [channels, setChannels] = useState<Channel[]>([]);
  const [canPickZones, setCanPickZones] = useState(false);
  const [channelKey, setChannelKey] = useState<string | null>(null);
  /** Super admin only: hand-picked zones, which override the preset. */
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
      const list: Channel[] = chRes.data.data.channels || [];
      setChannels(list);
      setCanPickZones(!!chRes.data.data.canPickZones);
      // A zone admin has exactly one channel, so pre-select it.
      setChannelKey((prev) => prev ?? (list.length === 1 ? list[0].key : null));
      setSent(listRes.data.data || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not load channels' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const usingPickedZones = canPickZones && pickedZones.length > 0;
  const targetChannel = channels.find((c) => c.key === channelKey);
  const targetZones = usingPickedZones ? pickedZones : (targetChannel?.zones || []);
  const canSend = body.trim().length >= 2 && targetZones.length > 0 && !sending;

  const toggleZone = (z: string) => {
    setPickedZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };

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
              const payload: any = { body: body.trim() };
              if (usingPickedZones) payload.zones = pickedZones;
              else payload.channelKey = channelKey;

              const res = await api.post(ENDPOINTS.BROADCASTS, payload);
              Toast.show({ type: 'success', text1: 'Announcement sent', text2: res.data?.message });
              setBody('');
              setPickedZones([]);
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
              ? 'Send an announcement to any channel, or pick zones yourself.'
              : 'Send an announcement to your zone.'}
          </Text>

          {/* Channel */}
          <Text style={st.label}>Channel</Text>
          {channels.length === 0 ? (
            <Text style={st.warn}>Your account has no zone, so there is nothing to broadcast to.</Text>
          ) : (
            <View style={st.chipWrap}>
              {channels.map((c) => {
                const on = !usingPickedZones && channelKey === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => { setChannelKey(c.key); setPickedZones([]); }}
                    style={[st.chip, on && st.chipOn]}
                    activeOpacity={0.85}
                  >
                    <Text style={[st.chipTxt, on && st.chipTxtOn]}>{c.emoji} {c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {targetChannel && !usingPickedZones && (
            <Text style={st.hint}>{targetChannel.description}</Text>
          )}

          {/* Super admin can bypass the presets entirely */}
          {canPickZones && (
            <>
              <Text style={st.label}>Or pick zones</Text>
              <View style={st.chipWrap}>
                {(Object.keys(ZONE_CONFIG) as (keyof typeof ZONE_CONFIG)[]).map((z) => {
                  const on = pickedZones.includes(z);
                  return (
                    <TouchableOpacity
                      key={z}
                      onPress={() => toggleZone(z)}
                      style={[
                        st.chip,
                        on && { borderColor: ZONE_CONFIG[z].color, backgroundColor: ZONE_CONFIG[z].color + '22' },
                      ]}
                      activeOpacity={0.85}
                    >
                      <Text style={[st.chipTxt, on && { color: ZONE_CONFIG[z].color, fontWeight: '700' }]}>
                        {ZONE_CONFIG[z].emoji} {ZONE_CONFIG[z].label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {usingPickedZones && (
                <Text style={st.hint}>
                  Using your picked zones instead of a channel.{' '}
                  <Text style={st.clear} onPress={() => setPickedZones([])}>Clear</Text>
                </Text>
              )}
            </>
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
                  <Text style={st.sentChannel}>{m.channel_emoji} {m.channel_name}</Text>
                  <TouchableOpacity onPress={() => remove(m)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={15} color={COLORS.accentRed} />
                  </TouchableOpacity>
                </View>
                <Text style={st.sentBody} numberOfLines={4}>{m.body}</Text>
                {m.links.length > 0 && (
                  <Text style={st.sentLinks}>🔗 {m.links.length} link{m.links.length > 1 ? 's' : ''}</Text>
                )}
                <Text style={st.sentMeta}>
                  {m.sender_name} · {new Date(m.created_at).toLocaleString('en-IN', {
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
  sentChannel: { color: COLORS.primary, fontSize: 11.5, fontWeight: '700' },
  sentBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  sentLinks: { color: COLORS.textMuted, fontSize: 11, marginTop: 6 },
  sentMeta: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 8 },
});
