import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Alert, Modal, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, ZONE_CONFIG } from '../../../constants/theme';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../constants/api';
import { useAuthStore } from '../../../store/authStore';
import Toast from 'react-native-toast-message';

const STATUS_OPTIONS = [
  { key: 'all',      label: 'All Statuses',  color: '#8892A0' },
  { key: 'pending',  label: 'Pending',        color: '#FF9800' },
  { key: 'approved', label: 'Approved',       color: '#4CAF50' },
  { key: 'rejected', label: 'Rejected',       color: '#EF5350' },
];

const ZONE_OPTIONS = [
  { key: 'all',          label: 'All Zones',        emoji: '' },
  { key: 'masjid',       label: 'Masjid Zone',       emoji: '🕌' },
  { key: 'boys_hostel', label: 'Boys Hostel Zone',  emoji: '🏠' },
  { key: 'stanza',       label: 'Stanza Zone',       emoji: '🏡' },
  { key: 'girls',        label: 'Girls Zone',        emoji: '🌸' },

];

export default function UserManagement() {
  const { user: currentUser, activeRole } = useAuthStore();
  const isSuperAdmin = activeRole === 'super_admin';

  const [users, setUsers]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Filter state
  const [filterVisible, setFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [zoneFilter, setZoneFilter]     = useState('all');
  // Temp filter state (inside the filter modal before Apply)
  const [tempZone, setTempZone]         = useState('all');

  const openFilter = () => { setTempZone(zoneFilter); setFilterVisible(true); };
  const applyFilter = () => { setZoneFilter(tempZone); setFilterVisible(false); };
  const resetFilter = () => { setTempZone('all'); };

  const loadUsers = useCallback(async (p = 1) => {
    try {
      if (p === 1) setLoading(true);
      const params: any = { page: p, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (isSuperAdmin && zoneFilter !== 'all') params.zone = zoneFilter;
      if (search) params.search = search;
      const { data } = await api.get(ENDPOINTS.USERS, params);
      setUsers(p === 1 ? data.data : (prev: any[]) => [...prev, ...data.data]);
      setTotalPages(data.pagination?.pages || 1);
      setPage(p);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter, zoneFilter, search, isSuperAdmin]);

  useEffect(() => { loadUsers(1); }, [statusFilter, zoneFilter]);

  const activeFilterCount = zoneFilter !== 'all' ? 1 : 0;

  const handleStatus = async (userId: string, status: string) => {
    const label = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Set Pending';
    Alert.alert(label + ' User', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: status === 'rejected' ? 'destructive' : 'default', onPress: async () => {
        try {
          setActionLoading(userId + status);
          await api.patch(ENDPOINTS.USER_STATUS(userId), { status });
          Toast.show({ type: 'success', text1: 'User ' + status });
          setSelectedUser(null); loadUsers(1);
        } catch { Toast.show({ type: 'error', text1: 'Action failed' }); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const handleDelete = async (userId: string, name: string) => {
    Alert.alert('Delete User', 'Permanently delete ' + name + '? Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setActionLoading(userId + 'del');
          await api.delete(ENDPOINTS.USER_DELETE(userId));
          Toast.show({ type: 'success', text1: 'User deleted' });
          setSelectedUser(null); loadUsers(1);
        } catch { Toast.show({ type: 'error', text1: 'Delete failed' }); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const statusColor = (st: string) =>
    st === 'approved' ? '#4CAF50' : st === 'rejected' ? '#EF5350' : '#FF9800';

  const renderUser = ({ item }: any) => {
    const zone = ZONE_CONFIG[item.zone as keyof typeof ZONE_CONFIG];
    return (
      <TouchableOpacity
        style={[u.card, { borderLeftColor: statusColor(item.status) }]}
        onPress={() => setSelectedUser(item)}
        activeOpacity={0.85}
      >
        <View style={u.cardRow}>
          <View style={[u.avatar, { borderColor: zone?.color || COLORS.primary }]}>
            <Text style={[u.avatarText, { color: zone?.color || COLORS.primary }]}>
              {item.name?.charAt(0)?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={u.userName} numberOfLines={1}>{item.name}</Text>
              <Text style={[u.statusPill, { color: statusColor(item.status), borderColor: statusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <Text style={u.userPhone}>+91 {item.phone}</Text>
            {zone && <Text style={[u.zonePill, { color: zone.color }]}>{zone.emoji} {zone.label}</Text>}
            {item.address ? <Text style={u.addrText} numberOfLines={1}>📍 {item.address}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={u.container}>
      {/* ── Header ── */}
      <View style={u.header}>
        <Text style={u.title}>User Management</Text>
        {!isSuperAdmin && currentUser?.zone && (
          <Text style={u.zoneTag}>
            {ZONE_CONFIG[currentUser.zone as keyof typeof ZONE_CONFIG]?.emoji}{' '}
            {ZONE_CONFIG[currentUser.zone as keyof typeof ZONE_CONFIG]?.label}
          </Text>
        )}
      </View>

      {/* ── Search + Zone Filter ── */}
      <View style={u.searchBar}>
        <Ionicons name='search-outline' size={16} color='#8892A0' />
        <TextInput
          style={u.searchInput}
          placeholder='Search name or phone...'
          placeholderTextColor='#8892A0'
          value={search}
          onChangeText={(t) => { setSearch(t); if (t.length > 2 || !t) loadUsers(1); }}
        />
        {isSuperAdmin && (
          <TouchableOpacity style={u.filterBtn} onPress={openFilter} activeOpacity={0.8}>
            <Ionicons name='options-outline' size={18} color={activeFilterCount > 0 ? '#C9A84C' : '#8892A0'} />
            {activeFilterCount > 0 && (
              <View style={u.filterBadge}><Text style={u.filterBadgeText}>{activeFilterCount}</Text></View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Status tabs (always visible) ── */}
      <View style={u.statusTabRow}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[u.statusTab, statusFilter === opt.key && { borderColor: opt.color, backgroundColor: opt.color + '18' }]}
            onPress={() => setStatusFilter(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[u.statusTabText, statusFilter === opt.key && { color: opt.color, fontWeight: '700' }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Active zone pill — super admin only */}
      {isSuperAdmin && zoneFilter !== 'all' && (
        <View style={u.activePills}>
          <View style={[u.pill, { borderColor: '#C9A84C' }]}>
            <Text style={[u.pillText, { color: '#C9A84C' }]}>
              {ZONE_OPTIONS.find(z => z.key === zoneFilter)?.emoji} {ZONE_OPTIONS.find(z => z.key === zoneFilter)?.label}
            </Text>
            <TouchableOpacity onPress={() => setZoneFilter('all')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name='close' size={12} color='#C9A84C' />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── User list ── */}
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={u.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsers(1); }} tintColor='#C9A84C' />}
        onEndReached={() => { if (page < totalPages) loadUsers(page + 1); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={!loading ? (
          <View style={u.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
            <Text style={u.emptyText}>No users found</Text>
            <Text style={u.emptyHint}>Try changing filters</Text>
          </View>
        ) : null}
      />

      {/* ── Zone Filter Modal (super admin only) ── */}
      <Modal visible={filterVisible} animationType='slide' transparent onRequestClose={() => setFilterVisible(false)}>
        <View style={u.modalOverlay}>
          <View style={u.filterSheet}>
            <View style={u.filterHdr}>
              <Text style={u.filterTitle}>Filter by Zone</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Ionicons name='close' size={22} color='#8892A0' />
              </TouchableOpacity>
            </View>

            {/* Zone checkboxes */}
            {ZONE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={u.checkRow}
                onPress={() => setTempZone(opt.key)}
                activeOpacity={0.75}
              >
                <View style={[u.checkbox, tempZone === opt.key && { borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.15)' }]}>
                  {tempZone === opt.key && <Ionicons name='checkmark' size={14} color='#C9A84C' />}
                </View>
                <Text style={[u.checkLabel, tempZone === opt.key && { color: '#C9A84C', fontWeight: '700' }]}>
                  {opt.emoji} {opt.label}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Buttons */}
            <View style={u.filterActions}>
              <TouchableOpacity style={u.resetBtn} onPress={resetFilter} activeOpacity={0.8}>
                <Text style={u.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={u.applyBtn} onPress={applyFilter} activeOpacity={0.8}>
                <Text style={u.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── User Detail Modal ── */}
      <Modal visible={!!selectedUser} animationType='slide' transparent onRequestClose={() => setSelectedUser(null)}>
        <View style={u.modalOverlay}>
          <LinearGradient colors={['#0D1B2A', '#152336']} style={u.detailSheet}>
            {selectedUser && (() => {
              const zone = ZONE_CONFIG[selectedUser.zone as keyof typeof ZONE_CONFIG];
              const al = actionLoading;
              return (
                <>
                  <View style={u.detailHdr}>
                    <Text style={u.detailTitle}>User Details</Text>
                    <TouchableOpacity onPress={() => setSelectedUser(null)}>
                      <Ionicons name='close' size={22} color='#8892A0' />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Profile */}
                    <View style={u.profileRow}>
                      <View style={[u.bigAvatar, { borderColor: zone?.color || '#C9A84C' }]}>
                        <Text style={[u.bigAvatarText, { color: zone?.color || '#C9A84C' }]}>
                          {selectedUser.name?.charAt(0)?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={u.bigName}>{selectedUser.name}</Text>
                        <Text style={u.bigPhone}>+91 {selectedUser.phone}</Text>
                        <Text style={[u.bigStatus, { color: statusColor(selectedUser.status) }]}>
                          {selectedUser.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Info grid */}
                    <View style={u.infoCard}>
                      {[
                        { icon: 'home-outline',     label: 'PG / Address', value: selectedUser.address || 'Not provided' },
                        { icon: 'location-outline', label: 'Zone',         value: zone ? zone.emoji + ' ' + zone.label : selectedUser.zone },
                        { icon: 'map-outline',      label: 'Area',         value: selectedUser.area || '—' },
                        { icon: 'business-outline', label: 'City',         value: selectedUser.city || 'Bangalore' },
                        { icon: 'person-outline',   label: 'Gender',       value: selectedUser.gender || '—' },
                        { icon: 'briefcase-outline',label: 'Occupation',   value: selectedUser.occupation || '—' },
                      ].map(({ icon, label, value }) => (
                        <View key={label} style={u.infoRow}>
                          <Ionicons name={icon as any} size={14} color='#8892A0' style={{ width: 18 }} />
                          <Text style={u.infoLabel}>{label}</Text>
                          <Text style={u.infoValue}>{value}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Action buttons */}
                    <View style={u.actionsWrap}>
                      {selectedUser.status !== 'approved' && (
                        <TouchableOpacity style={[u.act, { borderColor: '#4CAF50' }]} onPress={() => handleStatus(selectedUser.id, 'approved')} disabled={!!al}>
                          <Ionicons name='checkmark-circle-outline' size={16} color='#4CAF50' />
                          <Text style={[u.actText, { color: '#4CAF50' }]}>Approve</Text>
                        </TouchableOpacity>
                      )}
                      {selectedUser.status !== 'rejected' && (
                        <TouchableOpacity style={[u.act, { borderColor: '#EF5350' }]} onPress={() => handleStatus(selectedUser.id, 'rejected')} disabled={!!al}>
                          <Ionicons name='close-circle-outline' size={16} color='#EF5350' />
                          <Text style={[u.actText, { color: '#EF5350' }]}>Reject</Text>
                        </TouchableOpacity>
                      )}
                      {selectedUser.status !== 'pending' && (
                        <TouchableOpacity style={[u.act, { borderColor: '#FF9800' }]} onPress={() => handleStatus(selectedUser.id, 'pending')} disabled={!!al}>
                          <Ionicons name='time-outline' size={16} color='#FF9800' />
                          <Text style={[u.actText, { color: '#FF9800' }]}>Pending</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[u.act, { borderColor: '#EF5350', borderStyle: 'dashed' }]} onPress={() => handleDelete(selectedUser.id, selectedUser.name)} disabled={!!al}>
                        <Ionicons name='trash-outline' size={16} color='#EF5350' />
                        <Text style={[u.actText, { color: '#EF5350' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const u = StyleSheet.create({
  container: { flex: 1 },
  // Header
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 10 },
  title: { color: '#F0E6C8', fontSize: 22, fontWeight: '800' },
  zoneTag: { color: '#C9A84C', fontSize: 13, fontWeight: '600', marginTop: 2 },
  // Search bar
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: '#0F2336', borderRadius: 12, borderWidth: 1, borderColor: '#2A3F55', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, color: '#F0E6C8', fontSize: 14 },
  filterBtn: { padding: 6, position: 'relative' },
  filterBadge: { position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#C9A84C', alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: '#0D1B2A', fontSize: 9, fontWeight: '800' },
  // Status tabs row
  statusTabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  statusTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: '#2A3F55', backgroundColor: '#0F2336' },
  statusTabText: { color: '#8892A0', fontSize: 12, fontWeight: '500' },
  // Active pills (zone only)
  activePills: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(201,168,76,0.07)' },
  pillText: { fontSize: 12, fontWeight: '600' },
  // User card
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: '#0F2336', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderLeftWidth: 4, borderColor: '#2A3F55' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1A2E45', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  userName: { color: '#F0E6C8', fontSize: 15, fontWeight: '700', flex: 1 },
  statusPill: { fontSize: 10, fontWeight: '800', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, letterSpacing: 0.5 },
  userPhone: { color: '#A8B8C8', fontSize: 12, marginTop: 3 },
  zonePill: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  addrText: { color: '#6B7C8A', fontSize: 11, marginTop: 3 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#A8B8C8', fontSize: 16, fontWeight: '600' },
  emptyHint: { color: '#6B7C8A', fontSize: 13, marginTop: 4 },
  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  filterSheet: { backgroundColor: '#0D1B2A', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)', maxHeight: '75%' },
  filterHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  filterTitle: { color: '#F0E6C8', fontSize: 18, fontWeight: '700' },
  filterSection: { color: '#C9A84C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#2A3F55', alignItems: 'center', justifyContent: 'center', backgroundColor: '#152336' },
  checkLabel: { color: '#A8B8C8', fontSize: 14, flex: 1 },
  filterActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  resetBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#2A3F55', alignItems: 'center' },
  resetBtnText: { color: '#8892A0', fontSize: 14, fontWeight: '600' },
  applyBtn: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: '#C9A84C', alignItems: 'center' },
  applyBtnText: { color: '#0D1B2A', fontSize: 14, fontWeight: '800' },
  // Detail modal
  detailSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: '90%', borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)', paddingHorizontal: 20, paddingBottom: 40 },
  detailHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  detailTitle: { color: '#F0E6C8', fontSize: 18, fontWeight: '700' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  bigAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1A2E45', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  bigAvatarText: { fontSize: 24, fontWeight: '800' },
  bigName: { color: '#F0E6C8', fontSize: 17, fontWeight: '700' },
  bigPhone: { color: '#A8B8C8', fontSize: 13, marginTop: 2 },
  bigStatus: { fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  infoCard: { backgroundColor: '#0A1929', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1A2E45', gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoLabel: { color: '#8892A0', fontSize: 12, width: 90 },
  infoValue: { color: '#F0E6C8', fontSize: 13, fontWeight: '600', flex: 1 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, backgroundColor: 'rgba(0,0,0,0.15)' },
  actText: { fontSize: 13, fontWeight: '600' },
});
