import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Linking, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SIZES } from '../../src/constants/theme';
import api from '../../src/services/api';
import { ENDPOINTS } from '../../src/constants/api';

type Broadcast = {
  id: string;
  body: string;
  links: string[];
  sender_name: string;
  sender_role: 'admin' | 'super_admin';
  created_at: string;
};

/** Last-seen marker lives on the device — no server state needed for a badge. */
export const LAST_SEEN_KEY = 'broadcast_last_seen';

/** A known link type gets a clearer label than a raw URL. */
function describeLink(url: string) {
  const u = url.toLowerCase();
  if (u.includes('google.com/maps') || u.includes('maps.app.goo.gl') || u.includes('goo.gl/maps')) {
    return { icon: 'location-outline' as const, label: 'Open in Maps' };
  }
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    return { icon: 'logo-youtube' as const, label: 'Watch on YouTube' };
  }
  try {
    return { icon: 'link-outline' as const, label: new URL(url).hostname.replace(/^www\./, '') };
  } catch {
    return { icon: 'link-outline' as const, label: 'Open link' };
  }
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function BroadcastFeed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(ENDPOINTS.BROADCASTS);
      const list: Broadcast[] = data.data || [];
      setItems(list);
      // Opening the feed counts as reading it.
      if (list.length) await AsyncStorage.setItem(LAST_SEEN_KEY, list[0].created_at);
    } catch {
      // Leave whatever is already on screen rather than blanking it.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error('unsupported');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open link', url);
    }
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.container}>
      <View style={[st.topBar, { paddingTop: insets.top, height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]}>
        <View style={st.topBarContent}>
          <TouchableOpacity onPress={() => router.push('/(app)/home' as any)} style={st.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={st.backTxt}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={st.header}>
        <Text style={st.title}>📢 Announcements</Text>
        <Text style={st.subtitle}>Updates from your zone admin and the organisers</Text>
      </View>

      <ScrollView
        contentContainerStyle={st.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : items.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 42 }}>📭</Text>
            <Text style={st.emptyTitle}>No announcements yet</Text>
            <Text style={st.emptySub}>
              Anything your zone admin posts will show up here, and you'll get a notification.
            </Text>
          </View>
        ) : (
          items.map((m) => (
            <View key={m.id} style={st.card}>
              {/* No channel or zone shown — to the reader this is simply an
                  announcement, not a bucket they were sorted into. */}
              <View style={st.cardTop}>
                <Text style={st.announceTag}>📢 Announcement</Text>
                <Text style={st.time}>{relative(m.created_at)}</Text>
              </View>

              <Text style={st.body}>{m.body}</Text>

              {m.links.map((l) => {
                const d = describeLink(l);
                return (
                  <TouchableOpacity key={l} style={st.link} onPress={() => open(l)} activeOpacity={0.8}>
                    <Ionicons name={d.icon} size={15} color={COLORS.primary} />
                    <Text style={st.linkTxt} numberOfLines={1}>{d.label}</Text>
                    <Ionicons name="open-outline" size={13} color={COLORS.textMuted} />
                  </TouchableOpacity>
                );
              })}

              <Text style={st.sender}>
                {m.sender_name} · {m.sender_role === 'super_admin' ? 'Organiser' : 'Zone Admin'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  topBar: { justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topBarContent: { flexDirection: 'row', alignItems: 'center', height: Platform.OS === 'ios' ? 44 : 56, paddingHorizontal: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  backTxt: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },

  header: { paddingTop: 14, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.sm },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 5 },

  list: { padding: SIZES.spacing.base, paddingBottom: 60 },
  card: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    padding: SIZES.spacing.base,
    marginBottom: SIZES.spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  announceTag: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  time: { color: COLORS.textMuted, fontSize: 10.5 },
  body: { color: COLORS.textPrimary, fontSize: 14.5, lineHeight: 22, marginTop: 10 },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
  },
  linkTxt: { color: COLORS.primary, fontSize: 13, fontWeight: '600', flex: 1 },
  sender: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 12 },

  empty: { alignItems: 'center', paddingVertical: 70, gap: 10 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  emptySub: {
    color: COLORS.textMuted, fontSize: 12.5, textAlign: 'center',
    lineHeight: 19, paddingHorizontal: 40,
  },
});
