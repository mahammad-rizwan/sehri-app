import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../constants/theme';

/**
 * The menu behind a long press (or the ⋮ button) on an announcement or a chat
 * message: Copy, Delete and Report, each shown only when it applies.
 *
 *   Copy   — always.
 *   Delete — only where the server would allow it (own post, or super admin).
 *   Report — never on your own post.
 */
export default function MessageActionSheet({
  visible,
  text,
  onClose,
  onDelete,
  onReport,
}: {
  visible: boolean;
  /** The message text — shown as a preview and used by Copy. */
  text: string;
  onClose: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}) {
  const copy = async () => {
    onClose();
    try {
      await Clipboard.setStringAsync(text);
      Toast.show({ type: 'success', text1: 'Copied', visibilityTime: 1200 });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not copy' });
    }
  };

  // Close first so the next dialog (confirm / report form) is not stacked on
  // top of this one — two modals at once misbehave on iOS.
  const then = (fn?: () => void) => () => {
    onClose();
    if (fn) setTimeout(fn, Platform.OS === 'ios' ? 350 : 50);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <Text style={st.preview} numberOfLines={3}>{text}</Text>

          <Row icon="copy-outline" label="Copy" onPress={copy} />
          {onDelete && <Row icon="trash-outline" label="Delete" color={COLORS.accentRed} onPress={then(onDelete)} />}
          {onReport && <Row icon="flag-outline" label="Report" color={COLORS.accentOrange} onPress={then(onReport)} />}

          <TouchableOpacity style={st.cancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={st.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ icon, label, color, onPress }: { icon: any; label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon} size={20} color={color || COLORS.textPrimary} />
      <Text style={[st.rowTxt, color ? { color } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0D1B2A',
    borderTopLeftRadius: SIZES.radius.xl, borderTopRightRadius: SIZES.radius.xl,
    borderTopWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SIZES.spacing.lg, paddingTop: SIZES.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : SIZES.spacing.lg,
  },
  preview: {
    color: COLORS.textSecondary, fontSize: 13, lineHeight: 19,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: SIZES.radius.md,
    padding: 12, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 15, paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  rowTxt: { color: COLORS.textPrimary, fontSize: 15.5, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  cancelTxt: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
});
