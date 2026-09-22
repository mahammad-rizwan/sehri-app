import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { isExpoGo, EXPO_GO_LIMITATIONS } from '../../utils/runtime';

/**
 * Shown only inside Expo Go. Several features are unavailable there by design,
 * and without this testers report them as app bugs.
 *
 * Renders nothing in a real build, so it is safe to mount unconditionally.
 */
export default function ExpoGoNotice() {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  if (!isExpoGo || dismissed) return null;

  return (
    <>
      <TouchableOpacity style={st.bar} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <Ionicons name="information-circle-outline" size={15} color={COLORS.accentOrange} />
        <Text style={st.barTxt}>Running in Expo Go — some features are limited</Text>
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={15} color={COLORS.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={st.bg}>
          <View style={st.card}>
            <View style={st.head}>
              <Text style={st.title}>Expo Go limitations</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={st.note}>
              Expo Go ships a fixed set of native modules and ignores this project's native
              configuration. These behave differently here — they all work correctly in a real
              build.
            </Text>

            <ScrollView style={{ maxHeight: 280 }}>
              {EXPO_GO_LIMITATIONS.map((l) => (
                <View key={l.feature} style={st.item}>
                  <Text style={st.itemTitle}>• {l.feature}</Text>
                  <Text style={st.itemDetail}>{l.detail}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={st.footer}>
              Everything else — login, polls, donations, chat, Quran, Duas and the map view — works
              normally.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,152,0,0.13)',
    borderWidth: 1, borderColor: 'rgba(255,152,0,0.4)',
    borderRadius: SIZES.radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    marginHorizontal: SIZES.spacing.base, marginTop: SIZES.spacing.sm,
  },
  barTxt: { color: COLORS.accentOrange, fontSize: 11.5, flex: 1, fontWeight: '600' },
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 22 },
  card: {
    backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SIZES.spacing.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  note: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 19, marginTop: 10, marginBottom: 6 },
  item: { marginTop: 12 },
  itemTitle: { color: COLORS.accentOrange, fontSize: 13, fontWeight: '700' },
  itemDetail: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  footer: { color: COLORS.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 16 },
});
