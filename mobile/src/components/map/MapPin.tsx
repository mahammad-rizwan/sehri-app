import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SYMBOL_META, MARKER_COLORS, RIDER_EMOJI, type MapSymbol } from '../../constants/mapData';

/**
 * Map pins in the style of Google's own place markers: a round coloured head
 * with the symbol in it, tapering to a point that sits exactly on the spot.
 *
 * Built from a circle plus a triangle, both unrotated, in two layers — a white
 * one for the outline and a coloured one inset on top. An earlier version
 * rotated a square with one sharp corner, but Android draws borders on mixed
 * corner radii badly and rotation made it worse, which left a ragged point.
 * Circles and border-triangles rasterise cleanly on both platforms.
 */

const RIM = 2;            // white outline thickness
const HEAD = 30;          // outer head diameter, about Google's POI pin
const PAD = 2;            // breathing room so Android's snapshot never clips

const BOX_W = HEAD + PAD * 2;
const HEAD_TOP = PAD;
const HEAD_BOTTOM = HEAD_TOP + HEAD;

// White tail: a downward triangle tucked under the head.
const TAIL_HALF = 8;
const TAIL_H = 12;
const TAIL_TOP = HEAD_BOTTOM - 4;
const TIP_Y = TAIL_TOP + TAIL_H;

// Coloured tail: the same triangle inset by the rim on every side.
const INNER_HALF = TAIL_HALF - RIM;
const INNER_H = TAIL_H - RIM - 1;

const BOX_H = TIP_Y + PAD;

/**
 * Pass as the Marker's `anchor` so the point, not the middle of the drawing,
 * lands on the coordinate.
 */
export const PIN_ANCHOR = { x: 0.5, y: TIP_Y / BOX_H };

/** Emoji carry extra font padding on Android that pushes them off-centre. */
const emojiText = (size: number) => ({
  fontSize: size,
  lineHeight: Math.round(size * 1.25),
  textAlign: 'center' as const,
  ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : {}),
});

export function MapPin({ symbol }: { symbol: MapSymbol }) {
  const meta = SYMBOL_META[symbol] || SYMBOL_META.distributor;
  const cx = BOX_W / 2;

  return (
    // collapsable={false}: this root only sets the box size, so Fabric would
    // flatten it away and Android would size the marker bitmap from a child,
    // clipping the pin. Keeping it pins the bitmap to the full box.
    <View style={{ width: BOX_W, height: BOX_H }} collapsable={false}>
      {/* White layer — the outline */}
      <View style={[st.circle, { width: HEAD, height: HEAD, borderRadius: HEAD / 2, left: PAD, top: HEAD_TOP, backgroundColor: '#fff' }]} />
      <View
        style={[st.tri, {
          left: cx - TAIL_HALF, top: TAIL_TOP,
          borderLeftWidth: TAIL_HALF, borderRightWidth: TAIL_HALF, borderTopWidth: TAIL_H,
          borderTopColor: '#fff',
        }]}
      />

      {/* Coloured layer, inset by the rim */}
      <View
        style={[st.circle, {
          width: HEAD - RIM * 2, height: HEAD - RIM * 2, borderRadius: (HEAD - RIM * 2) / 2,
          left: PAD + RIM, top: HEAD_TOP + RIM, backgroundColor: meta.color,
        }]}
      />
      <View
        style={[st.tri, {
          left: cx - INNER_HALF, top: TAIL_TOP,
          borderLeftWidth: INNER_HALF, borderRightWidth: INNER_HALF, borderTopWidth: INNER_H,
          borderTopColor: meta.color,
        }]}
      />

      {/* Symbol, centred in the head */}
      <View style={[st.glyph, { left: PAD, top: HEAD_TOP, width: HEAD, height: HEAD }]}>
        {meta.icon
          ? <MaterialCommunityIcons name={meta.icon} size={16} color="#fff" />
          : <Text style={emojiText(15)}>{meta.emoji}</Text>}
      </View>
    </View>
  );
}

/**
 * The same symbol in a round badge, for lists and the legend — so a stop reads
 * the same on the map and off it.
 */
export function SymbolBadge({
  symbol,
  size = 28,
}: {
  symbol: MapSymbol | 'rider';
  size?: number;
}) {
  const isRider = symbol === 'rider';
  const meta = isRider ? null : (SYMBOL_META[symbol] || SYMBOL_META.distributor);
  const color = meta ? meta.color : MARKER_COLORS.rider;
  const icon = meta ? meta.icon : null;
  const emoji = meta ? meta.emoji : RIDER_EMOJI;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: Math.max(1.5, size / 16), borderColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {icon
        ? <MaterialCommunityIcons name={icon} size={Math.round(size * 0.55)} color="#fff" />
        : <Text style={emojiText(Math.round(size * 0.5))}>{emoji}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  circle: { position: 'absolute' },
  // A triangle drawn with borders: coloured top border, transparent sides.
  tri: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderStyle: 'solid',
  },
  glyph: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});

/** Geometry, exported for the layout check. */
export const PIN_GEOMETRY = { BOX_W, BOX_H, HEAD, HEAD_TOP, TAIL_TOP, TIP_Y, TAIL_HALF, INNER_HALF, INNER_H, RIM };
