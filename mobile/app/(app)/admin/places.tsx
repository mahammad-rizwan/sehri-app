import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../../src/constants/theme';
import { SYMBOL_META, SYMBOL_KEYS, type MapSymbol } from '../../../src/constants/mapData';
import MapPicker from '../../../src/components/admin/MapPicker';
import { SymbolBadge } from '../../../src/components/map/MapPin';
import {
  fetchAddresses, createAddress, updateAddress, deleteAddress,
  fetchMapMarkers, createMarker, updateMarker, deleteMarker, reorderMarkers,
  fetchRoute, regenerateRoute,
  type ZoneAddress, type MapMarkerRow, type DeliveryRoute,
} from '../../../src/services/places';

/**
 * Loaded defensively, not imported.
 *
 * The draggable list needs Gesture Handler + Reanimated worklets. Where the
 * worklets runtime is unavailable that import throws at module scope — and
 * because Expo Router imports every route file to build its route tree, a throw
 * here stops the entire app from opening, not just this screen. So try it, and
 * fall back to the arrow buttons if it is not there.
 */
let DraggableStopList: any = null;
let ROW_H = 60;
try {
  const mod = require('../../../src/components/admin/DraggableStopList');
  DraggableStopList = mod.default;
  ROW_H = mod.ROW_H ?? 60;
} catch (e: any) {
  // Print the real reason — a bare "unavailable" hides whether this is a missing
  // Babel transform, a missing native module, or something else entirely.
  console.warn('[Places] Drag-to-reorder unavailable — using the arrow buttons. Reason:', e?.message || e);
}

const ZONES: { key: string; label: string }[] = [
  { key: 'masjid', label: 'Masjid Zone' },
  { key: 'boys_hostel', label: 'Boys Hostel' },
  { key: 'stanza', label: 'Stanza' },
  { key: 'girls', label: 'Girls Zone' },
];
const zoneLabel = (k?: string | null) => ZONES.find((z) => z.key === k)?.label || '—';

type Tab = 'addresses' | 'markers';
type Source = 'address' | 'zone' | 'custom';

export default function PlacesManagement() {
  const [tab, setTab] = useState<Tab>('addresses');
  const [addresses, setAddresses] = useState<ZoneAddress[]>([]);
  const [markers, setMarkers] = useState<MapMarkerRow[]>([]);
  const [route, setRoute] = useState<DeliveryRoute | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // `true` pulls deactivated rows too — this screen is where they get
      // restored, so hiding them here would strand them.
      const [a, m, r] = await Promise.all([
        fetchAddresses(undefined, true),
        fetchMapMarkers(true),
        // The path is secondary — an older server without it must not take
        // the pins and addresses down with it.
        fetchRoute().catch(() => null),
      ]);
      setAddresses(a);
      setMarkers(m);
      setRoute(r);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not load' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Address editor ─────────────────────────────────────────────────── */
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrEditing, setAddrEditing] = useState<ZoneAddress | null>(null);
  const [addrName, setAddrName] = useState('');
  const [addrZone, setAddrZone] = useState('masjid');
  const [saving, setSaving] = useState(false);

  const openAddress = (row?: ZoneAddress) => {
    setAddrEditing(row || null);
    setAddrName(row?.name || '');
    setAddrZone(row?.zone || 'masjid');
    setAddrOpen(true);
  };

  const saveAddress = async () => {
    const name = addrName.trim();
    if (!name) {
      Toast.show({ type: 'error', text1: 'Address name is required' });
      return;
    }
    try {
      setSaving(true);
      const res = addrEditing
        ? await updateAddress(addrEditing.id, { name, zone: addrZone })
        : await createAddress(name, addrZone);
      Toast.show({ type: 'success', text1: res?.message || 'Saved' });
      setAddrOpen(false);
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = (row: ZoneAddress) => {
    Alert.alert(
      'Delete address?',
      `"${row.name}" will no longer be offered at registration.\n\nIf anyone is already registered there it is hidden instead of deleted, so their record stays intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteAddress(row.id);
              Toast.show({ type: 'success', text1: res?.message || 'Deleted' });
              await load();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not delete' });
            }
          },
        },
      ],
    );
  };

  const restoreAddress = async (row: ZoneAddress) => {
    try {
      await updateAddress(row.id, { is_active: true });
      Toast.show({ type: 'success', text1: 'Address restored' });
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not restore' });
    }
  };

  /* ── Marker editor ──────────────────────────────────────────────────── */
  const [pinOpen, setPinOpen] = useState(false);
  const [pinEditing, setPinEditing] = useState<MapMarkerRow | null>(null);
  const [source, setSource] = useState<Source>('address');
  const [srcAddress, setSrcAddress] = useState<string | null>(null);
  const [srcZone, setSrcZone] = useState('masjid');
  const [customName, setCustomName] = useState('');
  const [symbol, setSymbol] = useState<MapSymbol>('masjid');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const activeAddresses = useMemo(() => addresses.filter((a) => a.is_active), [addresses]);

  const openMarker = (row?: MapMarkerRow) => {
    setPinEditing(row || null);
    setSource(row?.source || 'address');
    setSrcAddress(row?.address_id || null);
    setSrcZone(row?.zone || 'masjid');
    setCustomName(row?.source === 'custom' ? row.label : '');
    setSymbol((row?.symbol as MapSymbol) || 'masjid');
    setCoords(row ? { latitude: row.latitude, longitude: row.longitude } : null);
    setPinOpen(true);
  };

  const saveMarker = async () => {
    if (source === 'address' && !srcAddress) {
      Toast.show({ type: 'error', text1: 'Pick an address for the name' });
      return;
    }
    if (source === 'custom' && !customName.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a name for this pin' });
      return;
    }
    if (!coords) {
      Toast.show({ type: 'error', text1: 'Set the location on the map' });
      return;
    }
    try {
      setSaving(true);
      const body = {
        source,
        addressId: source === 'address' ? srcAddress : null,
        zone: source === 'zone' ? srcZone : null,
        label: source === 'custom' ? customName.trim() : undefined,
        symbol,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      const res = pinEditing ? await updateMarker(pinEditing.id, body) : await createMarker(body);
      Toast.show({ type: 'success', text1: res?.message || 'Saved' });
      setPinOpen(false);
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const removeMarker = (row: MapMarkerRow) => {
    Alert.alert('Delete pin?', `"${row.label}" will disappear from the delivery map.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMarker(row.id);
            Toast.show({ type: 'success', text1: 'Pin deleted' });
            await load();
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not delete' });
          }
        },
      },
    ]);
  };

  const toggleMarker = async (row: MapMarkerRow) => {
    try {
      await updateMarker(row.id, { is_active: !row.is_active });
      Toast.show({ type: 'success', text1: row.is_active ? 'Pin hidden from the map' : 'Pin shown on the map' });
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Could not update' });
    }
  };

  /**
   * Moves a stop one place up or down the route.
   *
   * The list is reordered locally first so the tap feels instant, then the whole
   * order is sent and the server renumbers. On failure we reload, which snaps
   * back to the truth rather than leaving the screen lying.
   */
  const [savingOrder, setSavingOrder] = useState(false);
  const [pinSearch, setPinSearch] = useState('');
  const [dragging, setDragging] = useState(false);

  /**
   * Commits a whole new order at once, which is what a drag produces. Shares the
   * optimistic-then-verify path with the arrows: renumber locally so the badges
   * update with the drop, then send; on failure reload rather than leave the
   * screen showing an order the server rejected.
   */
  const commitOrder = async (next: MapMarkerRow[]) => {
    setMarkers((prev) => {
      const bySeq = new Map(next.map((m, i) => [m.id, i + 1]));
      return prev.map((m) => (bySeq.has(m.id) ? { ...m, sequence: bySeq.get(m.id)! } : m));
    });
    try {
      setSavingOrder(true);
      await reorderMarkers(next.map((m) => m.id));
    } catch (err: any) {
      const stale = err?.response?.status === 404;
      Toast.show({
        type: 'error',
        text1: stale ? 'Server needs updating' : (err?.response?.data?.message || 'Could not save the order'),
        text2: stale ? 'Delivery order needs the latest backend deployed. Nothing was changed.' : undefined,
      });
      await load();
    } finally {
      setSavingOrder(false);
    }
  };

  /**
   * Rebuilds the drawn path from the pins in their current order. Worth doing
   * after any pin is moved, added, hidden or reordered — the card says when.
   */
  const onRegenerate = async () => {
    try {
      setRegenerating(true);
      const res = await regenerateRoute();
      const warning = res?.data?.warning;
      if (warning) {
        // Straight lines were saved instead of a road route. Say why plainly,
        // because the fix (a server key) is not something this screen can do.
        Alert.alert('Path saved with straight lines', warning);
      } else {
        Toast.show({ type: 'success', text1: res?.message || 'Path generated' });
      }
      setRoute(await fetchRoute().catch(() => null));
    } catch (err: any) {
      const stale = err?.response?.status === 404;
      Toast.show({
        type: 'error',
        text1: stale ? 'Server needs updating' : (err?.response?.data?.message || 'Could not generate the path'),
        text2: stale ? 'The map path needs the latest backend deployed.' : undefined,
      });
    } finally {
      setRegenerating(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={[st.container, st.center]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </LinearGradient>
    );
  }

  const byZone = ZONES.map((z) => ({ ...z, rows: addresses.filter((a) => a.zone === z.key) }));

  // The run starts at the distribution point(s); everything else is a numbered
  // stop on the route, in the order the rider visits them.
  const startPoints = markers.filter((m) => m.symbol === 'distributor');
  const stops = markers
    .filter((m) => m.symbol !== 'distributor')
    .sort((a, b) => a.sequence - b.sequence);

  /**
   * Search narrows what is listed, but `stops` above stays whole — the delivery
   * order is a property of the full route, so positions and reordering are both
   * worked out against it, never against the filtered view.
   */
  const pinQuery = pinSearch.trim().toLowerCase();
  const matches = (m: MapMarkerRow) => !pinQuery || m.label.toLowerCase().includes(pinQuery);
  const shownStarts = startPoints.filter(matches);
  const shownStops = stops.filter(matches);

  return (
    <LinearGradient colors={['#050D16', '#0D1B2A', '#152336']} style={st.container}>
      <View style={st.header}>
        <Text style={st.title}>📍 Zone & Map</Text>
        <Text style={st.subtitle}>
          Addresses offered at registration, and the pins drawn on the delivery map.
        </Text>
      </View>

      <View style={st.tabs}>
        {([
          { key: 'addresses' as Tab, label: 'Addresses', count: addresses.length },
          { key: 'markers' as Tab, label: 'Map Pins', count: markers.length },
        ]).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[st.tab, tab === t.key && st.tabOn]}
            activeOpacity={0.85}
          >
            <Text style={[st.tabTxt, tab === t.key && st.tabTxtOn]}>{t.label} ({t.count})</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        // A row in the air must not fight the scroll view for the gesture.
        scrollEnabled={!dragging}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
        }
      >
        {tab === 'addresses' ? (
          <>
            <TouchableOpacity style={st.addBtn} onPress={() => openAddress()} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color={COLORS.background} />
              <Text style={st.addBtnTxt}>Add Address</Text>
            </TouchableOpacity>

            {byZone.map((z) => (
              <View key={z.key} style={{ marginTop: SIZES.spacing.lg }}>
                <Text style={st.section}>{z.label} · {z.rows.length}</Text>
                {z.rows.length === 0 ? (
                  <Text style={st.empty}>No addresses in this zone yet.</Text>
                ) : z.rows.map((a) => (
                  <View key={a.id} style={[st.row, !a.is_active && st.rowOff]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowName, !a.is_active && { color: COLORS.textMuted }]}>{a.name}</Text>
                      {!a.is_active && <Text style={st.hiddenTag}>Hidden from registration</Text>}
                    </View>
                    {a.is_active ? (
                      <>
                        <TouchableOpacity style={st.iconBtn} onPress={() => openAddress(a)}>
                          <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={st.iconBtn} onPress={() => removeAddress(a)}>
                          <Ionicons name="trash-outline" size={18} color={COLORS.accentRed} />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={st.restoreBtn} onPress={() => restoreAddress(a)}>
                        <Text style={st.restoreTxt}>Restore</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ))}

            <Text style={st.footNote}>
              These are exactly what the registration screen offers. Deleting an address that
              people are already registered at only hides it — nobody's record is touched.
            </Text>
          </>
        ) : (
          <>
            <TouchableOpacity style={st.addBtn} onPress={() => openMarker()} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color={COLORS.background} />
              <Text style={st.addBtnTxt}>Add Map Pin</Text>
            </TouchableOpacity>

            {/* Search — same bar as User Management / Manage Admins */}
            {markers.length > 3 && (
              <View style={[st.searchBar, { marginHorizontal: 0, marginTop: SIZES.spacing.md }]}>
                <Ionicons name="search-outline" size={16} color="#8892A0" />
                <TextInput
                  style={st.searchInput}
                  placeholder="Search pins by name..."
                  placeholderTextColor="#8892A0"
                  value={pinSearch}
                  onChangeText={setPinSearch}
                  autoCorrect={false}
                />
                {pinSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setPinSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#8892A0" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {markers.length === 0 ? (
              <Text style={[st.empty, { marginTop: SIZES.spacing.lg }]}>
                No pins yet. The delivery map will be empty until you add some.
              </Text>
            ) : pinQuery && !shownStarts.length && !shownStops.length ? (
              <Text style={[st.empty, { marginTop: SIZES.spacing.lg }]}>
                No pin matches “{pinSearch.trim()}”.
              </Text>
            ) : (
              <>
                {/* Where the run begins */}
                {shownStarts.length > 0 && (
                  <View style={{ marginTop: SIZES.spacing.lg }}>
                    <Text style={st.section}>START · DISTRIBUTION POINT</Text>
                    {shownStarts.map((m) => (
                      <MarkerRow
                        key={m.id} m={m} badge="◉"
                        onToggle={() => toggleMarker(m)}
                        onEdit={() => openMarker(m)}
                        onDelete={() => removeMarker(m)}
                      />
                    ))}
                  </View>
                )}

                {/* The route, in the order the rider drives it */}
                {shownStops.length > 0 && (
                  <View style={{ marginTop: SIZES.spacing.lg }}>
                    <Text style={st.section}>
                      DELIVERY ORDER · {pinQuery ? `${shownStops.length} OF ${stops.length}` : `${stops.length} STOPS`}
                    </Text>
                    <Text style={st.orderHint}>
                      {pinQuery
                        ? 'Showing matches only. Numbers are the real position on the route — clear the search to change the order.'
                        : DraggableStopList
                          ? 'Press and hold a stop, then drag it where you want it.'
                          : 'Reordering is unavailable on this device — reload the app to try again.'}
                    </Text>

                    {pinQuery || !DraggableStopList ? (
                      /* Filtered: read-only order. Dragging or stepping a stop
                         past hidden neighbours would renumber a subset of the
                         route and there would be no way to see what moved. */
                      shownStops.map((m) => {
                        const i = stops.findIndex((x) => x.id === m.id);
                        return (
                          <MarkerRow
                            key={m.id} m={m} badge={String(i + 1)}
                            onToggle={() => toggleMarker(m)}
                            onEdit={() => openMarker(m)}
                            onDelete={() => removeMarker(m)}
                          />
                        );
                      })
                    ) : (
                      <DraggableStopList
                        items={stops}
                        onReorder={commitOrder}
                        onDragStateChange={setDragging}
                        disabled={savingOrder}
                        renderItem={(m: MapMarkerRow, i: number, isDragging: boolean) => (
                          <MarkerRow
                            m={m} badge={String(i + 1)} height={ROW_H} grip
                            dragging={isDragging}
                            onToggle={() => toggleMarker(m)}
                            onEdit={() => openMarker(m)}
                            onDelete={() => removeMarker(m)}
                          />
                        )}
                      />
                    )}
                  </View>
                )}
              </>
            )}

            {/* Delivery path — below every pin, as the last step after ordering */}
            {stops.length > 0 && (
              <View style={st.pathCard}>
                <Text style={st.section}>DELIVERY PATH</Text>

                {route ? (
                  <>
                    <View style={st.pathRow}>
                      <Ionicons
                        name={route.source === 'directions' ? 'git-branch-outline' : 'remove-outline'}
                        size={16}
                        color={route.stale ? COLORS.accentOrange : COLORS.accentGreen}
                      />
                      <Text style={st.pathTitle}>
                        {route.source === 'directions' ? 'Follows the roads' : 'Straight lines between stops'}
                        {' · '}{route.stop_count} stops
                        {route.distance_m ? ` · ${(route.distance_m / 1000).toFixed(1)} km` : ''}
                        {route.duration_s ? ` · ~${Math.round(route.duration_s / 60)} min` : ''}
                      </Text>
                    </View>
                    <Text style={st.pathMeta}>
                      Generated {new Date(route.generated_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                      {route.generated_by ? ` by ${route.generated_by}` : ''}
                    </Text>
                    {route.stale && (
                      <View style={st.staleBox}>
                        <Ionicons name="warning-outline" size={14} color={COLORS.accentOrange} />
                        <Text style={st.staleTxt}>
                          Pins or their order changed since this path was made. The map is showing
                          straight lines until you regenerate.
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={st.pathMeta}>
                    No path yet. Until you generate one, the map joins the stops with straight
                    lines.
                  </Text>
                )}

                <TouchableOpacity
                  style={[st.regenBtn, (regenerating || dragging) && { opacity: 0.6 }]}
                  onPress={onRegenerate}
                  disabled={regenerating || dragging}
                  activeOpacity={0.85}
                >
                  {regenerating ? (
                    <ActivityIndicator color={COLORS.background} />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={17} color={COLORS.background} />
                      <Text style={st.regenTxt}>{route ? 'Regenerate Map Path' : 'Generate Map Path'}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={st.pathHint}>
                  Starts at the distribution point and visits every stop in the order above.
                  Generate it once and every map reuses it, so riders and users never cost a
                  Google call.
                </Text>
              </View>
            )}

            <Text style={st.footNote}>
              The delivery map shows these pins and nothing else. Tapping one shows its name —
              no zone, no address, no coordinates. The order here is the route the rider drives
              every night, so it only needs setting once.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ── Address modal ─────────────────────────────────────────────── */}
      <Modal visible={addrOpen} transparent animationType="slide" onRequestClose={() => setAddrOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
          <View style={st.sheet}>
            <Text style={st.sheetTitle}>{addrEditing ? 'Edit Address' : 'New Address'}</Text>

            <Text style={st.label}>ADDRESS NAME *</Text>
            <TextInput
              style={st.input}
              value={addrName}
              onChangeText={setAddrName}
              placeholder="e.g. Al Noor PG, Block A"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />

            <Text style={st.label}>ZONE</Text>
            <View style={st.chips}>
              {ZONES.map((z) => (
                <TouchableOpacity
                  key={z.key}
                  style={[st.chip, addrZone === z.key && st.chipOn]}
                  onPress={() => setAddrZone(z.key)}
                >
                  <Text style={[st.chipTxt, addrZone === z.key && st.chipTxtOn]}>{z.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.sheetBar}>
              <TouchableOpacity style={[st.btn, st.cancel]} onPress={() => setAddrOpen(false)}>
                <Text style={st.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btn, st.save]} onPress={saveAddress} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.background} /> : <Text style={st.saveTxt}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Marker modal ──────────────────────────────────────────────── */}
      <Modal visible={pinOpen} transparent animationType="slide" onRequestClose={() => setPinOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
          <View style={[st.sheet, { maxHeight: '88%' }]}>
            <Text style={st.sheetTitle}>{pinEditing ? 'Edit Map Pin' : 'New Map Pin'}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={st.label}>NAME FROM</Text>
              <View style={st.chips}>
                {([
                  { key: 'address' as Source, label: 'An address' },
                  { key: 'zone' as Source, label: 'A zone' },
                  { key: 'custom' as Source, label: 'Others' },
                ]).map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={[st.chip, source === s.key && st.chipOn]}
                    onPress={() => setSource(s.key)}
                  >
                    <Text style={[st.chipTxt, source === s.key && st.chipTxtOn]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {source === 'address' && (
                activeAddresses.length === 0 ? (
                  <Text style={st.empty}>No addresses yet — add one on the Addresses tab first.</Text>
                ) : (
                  <View style={st.pickList}>
                    <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled>
                      {activeAddresses.map((a) => (
                        <TouchableOpacity
                          key={a.id}
                          style={[st.pickRow, srcAddress === a.id && st.pickRowOn]}
                          onPress={() => setSrcAddress(a.id)}
                        >
                          <Ionicons
                            name={srcAddress === a.id ? 'radio-button-on' : 'radio-button-off'}
                            size={16}
                            color={srcAddress === a.id ? COLORS.primary : COLORS.textMuted}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={st.pickTxt}>{a.name}</Text>
                            <Text style={st.pickSub}>{zoneLabel(a.zone)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )
              )}

              {source === 'zone' && (
                <View style={st.chips}>
                  {ZONES.map((z) => (
                    <TouchableOpacity
                      key={z.key}
                      style={[st.chip, srcZone === z.key && st.chipOn]}
                      onPress={() => setSrcZone(z.key)}
                    >
                      <Text style={[st.chipTxt, srcZone === z.key && st.chipTxtOn]}>{z.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {source === 'custom' && (
                <TextInput
                  style={st.input}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="e.g. Main Kitchen"
                  placeholderTextColor={COLORS.textMuted}
                />
              )}

              <Text style={st.label}>SYMBOL</Text>
              <View style={st.chips}>
                {SYMBOL_KEYS.map((k) => {
                  const meta = SYMBOL_META[k];
                  const on = symbol === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[st.chip, on && { borderColor: meta.color, backgroundColor: `${meta.color}22` }]}
                      onPress={() => setSymbol(k)}
                    >
                      <Text style={[st.chipTxt, on && { color: meta.color, fontWeight: '700' }]}>
                        {meta.emoji} {meta.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={st.label}>LOCATION *</Text>
              <TouchableOpacity style={st.mapBtn} onPress={() => setMapOpen(true)} activeOpacity={0.85}>
                <Ionicons name="map-outline" size={18} color={COLORS.primary} />
                <Text style={st.mapBtnTxt}>
                  {coords
                    ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
                    : 'View map & drop the pin'}
                </Text>
                {coords && <Ionicons name="checkmark-circle" size={18} color={COLORS.accentGreen} />}
              </TouchableOpacity>
              {!coords && <Text style={st.reqNote}>A pin is required — the map is where this marker appears.</Text>}
            </ScrollView>

            <View style={st.sheetBar}>
              <TouchableOpacity style={[st.btn, st.cancel]} onPress={() => setPinOpen(false)}>
                <Text style={st.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btn, st.save]} onPress={saveMarker} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.background} /> : <Text style={st.saveTxt}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <MapPicker
        visible={mapOpen}
        initial={coords}
        symbol={symbol}
        onCancel={() => setMapOpen(false)}
        onPick={(p) => { setCoords(p); setMapOpen(false); }}
      />
    </LinearGradient>
  );
}

/**
 * One marker row. Used for both the distribution point and the numbered stops,
 * so the reorder arrows are optional — the start point has no position to move.
 */
function MarkerRow({
  m, badge, onToggle, onEdit, onDelete,
  height, grip, dragging,
}: {
  m: MapMarkerRow;
  badge: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Fixed height, required when the row sits in the draggable list. */
  height?: number;
  /** Shows the grab handle, hinting the row can be held and dragged. */
  grip?: boolean;
  dragging?: boolean;
}) {
  const meta = SYMBOL_META[m.symbol as MapSymbol] || SYMBOL_META.distributor;

  return (
    <View
      style={[
        st.row,
        height ? { height, marginTop: 0 } : { marginTop: SIZES.spacing.sm },
        !m.is_active && st.rowOff,
        dragging && st.rowDragging,
      ]}
    >
      {grip && <Ionicons name="reorder-three-outline" size={17} color={COLORS.textMuted} />}
      <Text style={st.seqBadge}>{badge}</Text>

      <SymbolBadge symbol={m.symbol as MapSymbol} size={30} />

      <View style={{ flex: 1 }}>
        <Text style={[st.rowName, !m.is_active && { color: COLORS.textMuted }]} numberOfLines={1}>
          {m.label}
        </Text>
        <Text style={st.rowMeta}>
          {meta.label} · {m.source === 'address' ? 'to the door' : m.symbol === 'distributor' ? 'pickup' : 'zone point'}
        </Text>
      </View>

      <TouchableOpacity style={st.iconBtn} onPress={onToggle}>
        <Ionicons
          name={m.is_active ? 'eye-outline' : 'eye-off-outline'}
          size={18}
          color={m.is_active ? COLORS.accentGreen : COLORS.textMuted}
        />
      </TouchableOpacity>
      <TouchableOpacity style={st.iconBtn} onPress={onEdit}>
        <Ionicons name="create-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={st.iconBtn} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color={COLORS.accentRed} />
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 16, paddingHorizontal: SIZES.spacing.xl, paddingBottom: SIZES.spacing.md },
  title: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 6, lineHeight: 17 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: SIZES.spacing.base, marginBottom: SIZES.spacing.md },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary, alignItems: 'center',
  },
  tabOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.14)' },
  tabTxt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTxtOn: { color: COLORS.primary, fontWeight: '700' },

  scroll: { paddingHorizontal: SIZES.spacing.base, paddingBottom: 60 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius.md, paddingVertical: 13,
  },
  addBtnTxt: { color: COLORS.background, fontSize: 14, fontWeight: '800' },

  section: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.4 },
  empty: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: 4 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 11, paddingHorizontal: 13, marginBottom: 7,
  },
  rowOff: { opacity: 0.6, borderStyle: 'dashed' },
  rowDragging: { borderColor: COLORS.primary, backgroundColor: '#15243A' },
  rowName: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '600' },
  rowMeta: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 3 },
  hiddenTag: { color: COLORS.accentOrange, fontSize: 10, marginTop: 3 },
  iconBtn: { padding: 6 },
  restoreBtn: {
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radius.sm,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  restoreTxt: { color: COLORS.primary, fontSize: 11.5, fontWeight: '700' },

  seqBadge: {
    color: COLORS.primary, fontSize: 12, fontWeight: '800',
    minWidth: 18, textAlign: 'center',
  },
  orderHint: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 6 },
  pathCard: {
    marginTop: SIZES.spacing.xl,
    backgroundColor: COLORS.backgroundCard, borderRadius: SIZES.radius.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SIZES.spacing.md,
  },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pathTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  pathMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 5, lineHeight: 16 },
  staleBox: {
    flexDirection: 'row', gap: 7, marginTop: 9, padding: 9,
    borderRadius: SIZES.radius.sm, backgroundColor: 'rgba(255,152,0,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,152,0,0.35)',
  },
  staleTxt: { flex: 1, color: COLORS.accentOrange, fontSize: 11.5, lineHeight: 16 },
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius.md,
    paddingVertical: 13, marginTop: SIZES.spacing.md,
  },
  regenTxt: { color: COLORS.background, fontSize: 14, fontWeight: '800' },
  pathHint: { color: COLORS.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SIZES.spacing.base, marginBottom: SIZES.spacing.sm,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: SIZES.radius.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#F0E6C8', fontSize: 14 },

  footNote: { color: COLORS.textMuted, fontSize: 11.5, lineHeight: 18, marginTop: 22, paddingHorizontal: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0D1B2A',
    borderTopLeftRadius: SIZES.radius.xl, borderTopRightRadius: SIZES.radius.xl,
    borderTopWidth: 1, borderColor: COLORS.border,
    padding: SIZES.spacing.lg, paddingBottom: Platform.OS === 'ios' ? 34 : SIZES.spacing.lg,
  },
  sheetTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: SIZES.spacing.md },
  label: {
    color: COLORS.textMuted, fontSize: 10.5, fontWeight: '700',
    letterSpacing: 0.6, marginTop: SIZES.spacing.md, marginBottom: 7,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: SIZES.radius.md, paddingHorizontal: 13, paddingVertical: 11,
    color: COLORS.textPrimary, fontSize: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.backgroundSecondary,
  },
  chipOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(201,168,76,0.16)' },
  chipTxt: { color: COLORS.textSecondary, fontSize: 12 },
  chipTxtOn: { color: COLORS.primary, fontWeight: '700' },

  pickList: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.backgroundSecondary, overflow: 'hidden',
  },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  pickRowOn: { backgroundColor: 'rgba(201,168,76,0.10)' },
  pickTxt: { color: COLORS.textPrimary, fontSize: 13 },
  pickSub: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 2 },

  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed',
    borderRadius: SIZES.radius.md, paddingVertical: 13, paddingHorizontal: 13,
  },
  mapBtnTxt: { flex: 1, color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  reqNote: { color: COLORS.textMuted, fontSize: 10.5, marginTop: 6 },

  sheetBar: { flexDirection: 'row', gap: 10, marginTop: SIZES.spacing.lg },
  btn: { flex: 1, paddingVertical: 13, borderRadius: SIZES.radius.md, alignItems: 'center' },
  cancel: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary },
  cancelTxt: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  save: { backgroundColor: COLORS.primary },
  saveTxt: { color: COLORS.background, fontSize: 14, fontWeight: '800' },
});
