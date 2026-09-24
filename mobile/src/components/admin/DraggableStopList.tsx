import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Long-press-and-drag reordering, the way LinkedIn reorders skills.
 *
 * Built directly on the Gesture Handler and Reanimated already in the app
 * rather than pulling in react-native-draggable-flatlist, which has no reliable
 * Reanimated 4 support yet — and a new native dependency would mean another
 * build before this could be used at all.
 *
 * Rows are absolutely positioned on a fixed pitch so the drop index is exact
 * arithmetic (`round(dy / ROW_PITCH)`) rather than a measurement guess. Three
 * shared values drive every row's transform, so adding a stop costs no extra
 * animation state.
 */
export const ROW_H = 60;
const GAP = 7;
export const ROW_PITCH = ROW_H + GAP;

/** How long to hold before the row picks up. Matches the platform feel. */
const HOLD_MS = 300;

export default function DraggableStopList<T extends { id: string }>({
  items,
  renderItem,
  onReorder,
  onDragStateChange,
  disabled,
}: {
  items: T[];
  renderItem: (item: T, index: number, dragging: boolean) => React.ReactNode;
  /** Called once on drop, with the full reordered list. */
  onReorder: (next: T[]) => void;
  /** Lets the parent freeze its ScrollView while a row is in the air. */
  onDragStateChange?: (dragging: boolean) => void;
  disabled?: boolean;
}) {
  // -1 when nothing is held. Shared so every row's style can read it.
  const activeIndex = useSharedValue(-1);
  const targetIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  // A JS mirror, only for things that cannot read a shared value: zIndex and
  // telling the parent to stop scrolling.
  const [activeJs, setActiveJs] = useState(-1);

  const begin = (i: number) => {
    setActiveJs(i);
    onDragStateChange?.(true);
  };

  const finish = (from: number, to: number) => {
    setActiveJs(-1);
    onDragStateChange?.(false);
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <View style={{ height: items.length * ROW_PITCH }}>
      {items.map((item, index) => (
        <Row
          key={item.id}
          index={index}
          count={items.length}
          activeIndex={activeIndex}
          targetIndex={targetIndex}
          dragY={dragY}
          isActive={activeJs === index}
          disabled={disabled}
          onBegin={begin}
          onFinish={finish}
        >
          {renderItem(item, index, activeJs === index)}
        </Row>
      ))}
    </View>
  );
}

function Row({
  index, count, activeIndex, targetIndex, dragY,
  isActive, disabled, onBegin, onFinish, children,
}: {
  index: number;
  count: number;
  activeIndex: SharedValue<number>;
  targetIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  isActive: boolean;
  disabled?: boolean;
  onBegin: (i: number) => void;
  onFinish: (from: number, to: number) => void;
  children: React.ReactNode;
}) {
  /**
   * `activateAfterLongPress` is the whole interaction: until the hold completes
   * the gesture never claims the touch, so taps still hit the buttons in the
   * row and the parent ScrollView still scrolls normally.
   */
  const pan = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .enabled(!disabled)
    .onStart(() => {
      activeIndex.value = index;
      targetIndex.value = index;
      dragY.value = 0;
      runOnJS(onBegin)(index);
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      // Where it would land if released now, clamped to the list.
      const slots = Math.round(e.translationY / ROW_PITCH);
      targetIndex.value = Math.max(0, Math.min(count - 1, index + slots));
    })
    .onEnd(() => {
      const to = targetIndex.value;
      // Settle into the slot it is being dropped in, so the commit does not jump.
      dragY.value = withSpring((to - index) * ROW_PITCH, { damping: 20, stiffness: 220 });
      activeIndex.value = -1;
      targetIndex.value = -1;
      runOnJS(onFinish)(index, to);
    });

  const style = useAnimatedStyle(() => {
    const from = activeIndex.value;

    // Nothing held: sit in the slot the list order says.
    if (from === -1) {
      return { transform: [{ translateY: 0 }, { scale: 1 }], opacity: 1 };
    }

    // The held row follows the finger and lifts.
    if (from === index) {
      return {
        transform: [{ translateY: dragY.value }, { scale: 1.03 }],
        opacity: 0.96,
      };
    }

    // Everything between the origin and the target shifts by one slot to open
    // the gap, which is what makes the drop position readable.
    const to = targetIndex.value;
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -ROW_PITCH;
    else if (from > to && index >= to && index < from) shift = ROW_PITCH;

    return {
      transform: [{ translateY: withSpring(shift, { damping: 22, stiffness: 260 }) }, { scale: 1 }],
      opacity: 1,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          st.row,
          { top: index * ROW_PITCH, height: ROW_H },
          // A lifted row has to paint above its neighbours, and zIndex cannot
          // come from an animated style.
          isActive && st.lifted,
          style,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const st = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0 },
  lifted: {
    zIndex: 999,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
});
