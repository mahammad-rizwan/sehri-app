import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Platform, ActivityIndicator, Alert, Modal, Keyboard,
  Animated, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import Toast from 'react-native-toast-message';

interface ReplyTo {
  id: string;
  message: string;
  sender: string;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_type: string;
  message: string;
  reply_to_id: string | null;
  reply_to_message: string | null;
  reply_to_sender: string | null;
  createdAt: string;
}

interface Member {
  id: string;
  user_id: string;
  user_type: string;
  name: string;
  zone?: string;
}

const ZONE_LABELS: Record<string, string> = {
  masjid: '🕌 Masjid', boys_hostel: '🏠 Boys Hostel',
  stanza: '🏡 Stanza', girls: '🌸 Girls', all: '⭐ All Zones',
};

type ListItem = { type: 'date'; label: string; id: string } | { type: 'msg'; data: Message };

const normalizeDate = (s: string) => new Date(s.replace(' ', 'T'));
const formatTime = (d: string) => normalizeDate(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const toDateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const formatDateLabel = (d: string) => {
  const date = normalizeDate(d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const buildListItems = (msgs: Message[]): ListItem[] => {
  const items: ListItem[] = [];
  let lastKey = '';
  for (const m of msgs) {
    const key = toDateKey(normalizeDate(m.createdAt));
    if (key !== lastKey) {
      items.push({ type: 'date', label: formatDateLabel(m.createdAt), id: `date-${key}` });
      lastKey = key;
    }
    items.push({ type: 'msg', data: m });
  }
  return items;
};

const SWIPE_THRESHOLD = 80;

function SwipeableMessage({ item, mine, onReply, onLongPress, children }: any) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5,
      onPanResponderMove: (_, g) => {
        translateX.setValue(Math.max(0, Math.min(g.dx, SWIPE_THRESHOLD)));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) { onReply(item); }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <View style={styles.swipeWrap}>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          activeOpacity={0.95}
          onLongPress={() => onLongPress(item)}
          delayLongPress={400}
          style={[styles.msgRow, mine && styles.msgRowMine]}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function ChatScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user, activeRole } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const listItems = useMemo(() => buildListItems(messages), [messages]);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberModal, setMemberModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [addingMember, setAddingMember] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [keyboardH, setKeyboardH] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    api.post(ENDPOINTS.CHAT_MARK_READ(groupId!)).catch(() => {});
  }, [groupId]);

  const loadMessages = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await api.get(ENDPOINTS.CHAT_GROUP_MESSAGES(groupId!), { params: { page: pageNum, limit: 50 } });
      const data = res.data.data || [];
      setMessages(append ? (prev) => [...data, ...prev] : data);
      const pag = res.data.pagination;
      if (pag) setHasMore(pageNum < pag.pages);
    } catch { Toast.show({ type: 'error', text1: 'Failed to load messages' }); }
    finally { setLoading(false); }
  }, [groupId]);

  const loadGroup = useCallback(async () => {
    try { const res = await api.get(ENDPOINTS.CHAT_GROUP_DETAIL(groupId!)); setGroupName(res.data.data.name || 'Chat'); setMembers(res.data.data.members || []); } catch {}
  }, [groupId]);

  useEffect(() => { loadMessages(); loadGroup(); }, [loadMessages, loadGroup]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const msgText = text.trim();
    const reply = replyTo;
    setText(''); setReplyTo(null);
    try {
      const body: any = { message: msgText };
      if (reply) { body.reply_to_id = reply.id; body.reply_to_message = reply.message; body.reply_to_sender = reply.sender; }
      const res = await api.post(ENDPOINTS.CHAT_SEND_MESSAGE(groupId!), body);
      setMessages((prev) => [...prev, res.data.data]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { Toast.show({ type: 'error', text1: 'Failed to send' }); setText(msgText); setReplyTo(reply); }
    finally { setSending(false); }
  };

  const loadMore = () => { if (!hasMore || loading) return; const np = page + 1; setPage(np); loadMessages(np, true); };

  // ─── Swipe → reply ───
  const handleReply = (msg: Message) => {
    setReplyTo({ id: msg.id, message: msg.message, sender: msg.sender_name });
  };

  // ─── Long press → delete ───
  const handleLongPress = (msg: Message) => {
    const canDelete = isSuperAdmin || (msg.sender_id === user?.id && msg.sender_type === user?.role);
    if (!canDelete) return;
    const isOwn = msg.sender_id === user?.id;
    Alert.alert(
      'Delete Message',
      isOwn ? 'Delete your message?' : `Delete ${msg.sender_name}'s message?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(ENDPOINTS.CHAT_DELETE_MESSAGE(groupId!, msg.id));
              setMessages((prev) => prev.filter((m) => m.id !== msg.id));
              Toast.show({ type: 'success', text1: 'Message deleted' });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to delete' });
            }
          },
        },
      ],
    );
  };

  // ─── Member management ───
  const openAddModal = async () => {
    try {
      const res = await api.get(ENDPOINTS.CHAT_ADMINS);
      const all = res.data.data || [];
      const existing = new Set(members.map((m) => m.user_id));
      setAvailableAdmins(all.filter((a: any) => !existing.has(a.id)));
      setAddSelected(new Set());
      setAddModal(true);
    } catch { Toast.show({ type: 'error', text1: 'Failed to load admins' }); }
  };

  const handleAddMembers = async () => {
    if (addSelected.size === 0) return;
    setAddingMember(true);
    try {
      const ids = Array.from(addSelected).map((id) => {
        const a = availableAdmins.find((av: any) => av.id === id)!;
        return { user_id: id, user_type: a.user_type || 'admin' };
      });
      await api.post(ENDPOINTS.CHAT_GROUP_MEMBERS(groupId!), { member_ids: ids });
      Toast.show({ type: 'success', text1: 'Members added' });
      setAddModal(false);
      loadGroup();
    } catch (err: any) { Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed' }); }
    finally { setAddingMember(false); }
  };

  const handleRemoveMember = (m: Member) => {
    Alert.alert('Remove Member', `Remove ${m.name} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.delete(ENDPOINTS.CHAT_GROUP_MEMBER_DELETE(groupId!, m.user_id)); Toast.show({ type: 'success', text1: `${m.name} removed` }); loadGroup(); }
        catch (err: any) { Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed' }); }
      }},
    ]);
  };

  // ─── Renderers ───
  const isOwnMessage = (msg: Message) => msg.sender_id === user?.id;

  const renderListItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>{item.label}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }
    const msg = item.data;
    const mine = isOwnMessage(msg);
    const bubble = (
      <View style={[styles.msgBubble, mine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
        {msg.reply_to_sender && (
          <View style={styles.replyPreview}>
            <View style={styles.replyLine} />
            <View style={styles.replyContent}>
              <Text style={styles.replySender}>{msg.reply_to_sender}</Text>
              <Text style={styles.replyText}>{msg.reply_to_message}</Text>
            </View>
          </View>
        )}
        {!mine && <Text style={styles.msgSender}>{msg.sender_name}</Text>}
        <Text style={styles.msgText}>{msg.message}</Text>
        <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>{formatTime(msg.createdAt)}</Text>
      </View>
    );
    return (
      <SwipeableMessage item={msg} mine={mine} onReply={handleReply} onLongPress={handleLongPress}>
        {bubble}
      </SwipeableMessage>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#0A1A2E']} style={styles.container}>
      <TouchableOpacity style={styles.headerBar} onPress={() => setMemberModal(true)} activeOpacity={0.8}>
        <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{groupName?.charAt(0)?.toUpperCase() || '#'}</Text>
        </LinearGradient>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{groupName || 'Chat'}</Text>
          <Text style={styles.headerMeta}>{members.length} members</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>

      <View style={{ flex: 1, paddingBottom: keyboardH }}>
        <FlatList
          ref={flatListRef}
          data={listItems}
          keyExtractor={(item) => item.type === 'date' ? item.id : item.data.id}
          renderItem={renderListItem}
          style={{ flex: 1 }}
          contentContainerStyle={styles.msgList}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}><Text style={styles.emptyIcon}>💬</Text><Text style={styles.emptyText}>No messages yet. Say something!</Text></View>
          }
        />

        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarContent}>
              <Text style={styles.replyBarLabel}>Replying to {replyTo.sender}</Text>
              <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.message}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} activeOpacity={0.7} style={styles.replyClose}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={[styles.input, replyTo && styles.inputWithReply]}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            value={text} onChangeText={setText} multiline maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={20} color={text.trim() && !sending ? COLORS.textOnPrimary : COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Member list modal */}
      <Modal visible={memberModal} animationType="slide" transparent onRequestClose={() => setMemberModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{groupName} — Members ({members.length})</Text>
              <TouchableOpacity onPress={() => setMemberModal(false)} activeOpacity={0.7}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
            </View>
            <FlatList
              data={members} keyExtractor={(m) => m.id} style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item: m }) => (
                <View style={styles.memberRow}>
                  <LinearGradient colors={[`${COLORS.primary}20`, `${COLORS.primary}05`]} style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{m.name?.charAt(0)?.toUpperCase()}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    <Text style={styles.memberZone}>{m.user_type === 'super_admin' ? '👑 Super Admin' : ZONE_LABELS[m.zone || ''] || m.zone || 'Admin'}</Text>
                  </View>
                  {isSuperAdmin && m.user_type !== 'super_admin' && (
                    <TouchableOpacity onPress={() => handleRemoveMember(m)} activeOpacity={0.7} style={styles.removeBtn}>
                      <Ionicons name="remove-circle-outline" size={22} color={COLORS.accentRed} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              ListFooterComponent={isSuperAdmin ? (
                <TouchableOpacity style={styles.addMemberBtn} onPress={openAddModal} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.addMemberText}>Add Members</Text>
                </TouchableOpacity>
              ) : null}
            />
          </View>
        </View>
      </Modal>

      {/* Add members modal */}
      <Modal visible={addModal} animationType="slide" transparent onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Members ({addSelected.size})</Text>
              <TouchableOpacity onPress={() => setAddModal(false)} activeOpacity={0.7}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
            </View>
            {availableAdmins.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>No more admins to add</Text></View>
            ) : (
              <FlatList
                data={availableAdmins} keyExtractor={(a) => a.id} style={{ maxHeight: 400 }}
                renderItem={({ item }) => {
                  const sel = addSelected.has(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.memberRow, sel && { backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: 8, paddingHorizontal: 4 }]}
                      onPress={() => setAddSelected((prev) => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.checkbox, sel && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                        {sel && <Ionicons name="checkmark" size={16} color={COLORS.textOnPrimary} />}
                      </View>
                      <LinearGradient colors={[`${COLORS.primary}20`, `${COLORS.primary}05`]} style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>{item.name?.charAt(0)?.toUpperCase()}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{item.name}</Text>
                        <Text style={styles.memberZone}>{item.user_type === 'super_admin' ? '👑 Super Admin' : ZONE_LABELS[item.zone] || item.zone}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={
                  <TouchableOpacity
                    style={[styles.addMemberBtn, addSelected.size === 0 && { opacity: 0.5 }]}
                    onPress={handleAddMembers} disabled={addSelected.size === 0 || addingMember} activeOpacity={0.8}
                  >
                    {addingMember ? <ActivityIndicator color={COLORS.primary} size="small" /> : (
                      <><Ionicons name="checkmark-circle-outline" size={20} color={COLORS.primary} /><Text style={styles.addMemberText}>Add Selected</Text></>
                    )}
                  </TouchableOpacity>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIZES.spacing.base, paddingVertical: SIZES.spacing.sm, backgroundColor: COLORS.backgroundCard, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerAvatarText: { color: COLORS.textOnPrimary, fontSize: 18, fontWeight: '800' },
  headerInfo: { flex: 1 },
  headerName: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700' },
  headerMeta: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 1 },
  swipeWrap: { overflow: 'hidden', marginBottom: 10, borderRadius: 16 },
  msgList: { paddingHorizontal: SIZES.spacing.base, paddingVertical: SIZES.spacing.sm },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  msgBubbleMine: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: 'rgba(201,168,76,0.3)', borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: COLORS.backgroundCard, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  msgSender: { color: COLORS.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  msgText: { color: COLORS.textPrimary, fontSize: SIZES.sm, lineHeight: 20 },
  msgTime: { color: COLORS.textMuted, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMine: { color: 'rgba(240,230,200,0.6)' },
  replyPreview: { flexDirection: 'row', marginBottom: 6, backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: 8, padding: 6, overflow: 'hidden' },
  replyLine: { width: 3, backgroundColor: COLORS.primary, borderRadius: 2, marginRight: 8 },
  replyContent: { flexShrink: 1 },
  replySender: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  replyText: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  replyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundElevated, paddingHorizontal: SIZES.spacing.base, paddingVertical: SIZES.spacing.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  replyBarContent: { flex: 1 },
  replyBarLabel: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  replyBarText: { color: COLORS.textMuted, fontSize: 12, marginTop: 1 },
  replyClose: { padding: 4 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  dateLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dateText: { color: COLORS.textMuted, fontSize: 12, marginHorizontal: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: COLORS.textMuted, fontSize: SIZES.sm, textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SIZES.spacing.base, paddingVertical: SIZES.spacing.sm, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.backgroundCard },
  input: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: COLORS.textPrimary, fontSize: SIZES.sm, maxHeight: 100, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  inputWithReply: { borderColor: COLORS.primary },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 44, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', flex: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  memberAvatarText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  memberName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  memberZone: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  removeBtn: { padding: 4 },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 8, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', borderRadius: 12, borderStyle: 'dashed' },
  addMemberText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
});
