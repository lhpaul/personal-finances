import { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  View,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { isOtrosSlug } from '../../../db/repositories/categories';
import type { CategoryWithUsage } from '../../../db/types';
import { ListGroup, ListRow, Text } from '../../../components/ui';
import { componentMetrics, theme } from '../../../theme';
import type { CategoryDirection } from '../direction';
import { moveItem, resolveDropIndex, type RowOffset } from '../reorder';

export type CategoryReorderListProps = {
  direction: CategoryDirection;
  rows: CategoryWithUsage[];
  onRowPress: (categoryId: string) => void;
  onReorder: (orderedIds: readonly string[]) => void;
  /** The parent `ScrollView` sets `scrollEnabled={false}` for the duration of a drag (Decision
   * 10) — this component owns no `ScrollView` of its own. */
  onDragStateChange?: (dragging: boolean) => void;
};

/**
 * The `ListGroup` of `ListRow`s plus the `PanResponder` + `Animated` drag shell (implementation
 * plan for issue #21, Decision 10). The decision logic (`moveItem`, `resolveDropIndex`) is pure
 * and unit-tested (scenario 12) in `../reorder.ts`; this component is the thin, hook-owning
 * gesture wiring around it, so only the shell can be wrong.
 *
 * ✨ Otros (`isOtrosSlug`) renders with no `☰` handle and no `onPress` — Decision 3, Resolution
 * R2: the mockup's uniform `onclick` on every `.mu-item` is navigation boilerplate, not an
 * affordance, and the fallback row is the only one without a handle in the drawing.
 */
export function CategoryReorderList({
  direction,
  rows,
  onRowPress,
  onReorder,
  onDragStateChange,
}: CategoryReorderListProps) {
  const { t } = useTranslation();

  // Refs mirror the latest render's values so the long-lived `PanResponder` callbacks (created
  // once per row id, cached in `respondersRef`) never read a stale closure — the same pattern
  // `useCategoriesSettings`'s `overlayRef`/`directionRef` use for the identical reason.
  const orderRef = useRef<string[]>(rows.map((row) => row.id));
  orderRef.current = rows.map((row) => row.id);
  const movableIdsRef = useRef<string[]>([]);
  movableIdsRef.current = rows.filter((row) => !isOtrosSlug(row.slug)).map((row) => row.id);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;

  const offsetsRef = useRef<RowOffset[]>([]);
  const dragStartIndexRef = useRef(0);
  const respondersRef = useRef<Map<string, GestureResponderHandlers>>(new Map());
  const translateY = useRef(new Animated.Value(0)).current;
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function finishDrag(categoryId: string, translationY: number): void {
    const fromIndex = dragStartIndexRef.current;
    const dropIndex = resolveDropIndex({ offsets: offsetsRef.current, fromIndex, translationY });
    setDraggingId(null);
    translateY.setValue(0);
    onDragStateChangeRef.current?.(false);

    if (dropIndex !== fromIndex) {
      const reorderedAll = moveItem(orderRef.current, fromIndex, dropIndex);
      const reorderedMovable = reorderedAll.filter((id) => movableIdsRef.current.includes(id));
      onReorderRef.current(reorderedMovable);
    }
  }

  function panHandlersFor(categoryId: string): GestureResponderHandlers {
    const cached = respondersRef.current.get(categoryId);
    if (cached) return cached;

    // Bubble-phase (not capture) for both `onStartShouldSetPanResponder` and
    // `onMoveShouldSetPanResponder` (Pass 2 finding, fixed): the handle is the innermost view in
    // its touch path, so bubble-phase negotiation (deepest-first) already lets it claim the
    // responder before `ListRow`'s enclosing `Pressable` does. Mixing capture for one callback and
    // bubble for the other made the negotiation harder to reason about for no behavioural gain.
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        dragStartIndexRef.current = orderRef.current.indexOf(categoryId);
        translateY.setValue(0);
        setDraggingId(categoryId);
        onDragStateChangeRef.current?.(true);
      },
      onPanResponderMove: Animated.event([null, { dy: translateY }], { useNativeDriver: false }),
      onPanResponderRelease: (_event, gesture) => finishDrag(categoryId, gesture.dy),
      onPanResponderTerminate: (_event, gesture) => finishDrag(categoryId, gesture.dy),
    }).panHandlers;

    respondersRef.current.set(categoryId, responder);
    return responder;
  }

  function handleLayout(categoryId: string, event: LayoutChangeEvent): void {
    const index = orderRef.current.indexOf(categoryId);
    if (index === -1) return;
    const { y, height } = event.nativeEvent.layout;
    offsetsRef.current[index] = { top: y, height };
  }

  function moveByOneStep(categoryId: string, step: 1 | -1): void {
    const currentIndex = orderRef.current.indexOf(categoryId);
    const movableIndexes = orderRef.current
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => movableIdsRef.current.includes(id));
    const position = movableIndexes.findIndex((entry) => entry.id === categoryId);
    const targetPosition = position + step;
    if (targetPosition < 0 || targetPosition >= movableIndexes.length) return;

    const targetEntry = movableIndexes[targetPosition];
    if (targetEntry === undefined) return;
    const reorderedAll = moveItem(orderRef.current, currentIndex, targetEntry.index);
    onReorderRef.current(reorderedAll.filter((id) => movableIdsRef.current.includes(id)));
  }

  return (
    <ListGroup>
      {rows.map((row) => {
        const isFallback = isOtrosSlug(row.slug);
        const isDragging = draggingId === row.id;
        const subtitle = isFallback
          ? direction === 'expense'
            ? t('settings.categories.fallback_sub_expense')
            : t('settings.categories.fallback_sub_income')
          : row.monthCount > 0
            ? row.monthCount === 1
              ? t('settings.categories.row_movements_single', { n: row.monthCount })
              : t('settings.categories.row_movements_plural', { n: row.monthCount })
            : undefined;

        return (
          <Animated.View
            key={row.id}
            onLayout={(event) => handleLayout(row.id, event)}
            style={
              isDragging
                ? {
                    transform: [{ translateY }],
                    elevation: componentMetrics.categoryReorderRow.dragElevation,
                    zIndex: 1,
                  }
                : undefined
            }
          >
            <ListRow
              icon={row.emoji ?? ''}
              title={row.name}
              subtitle={subtitle}
              onPress={isFallback ? undefined : () => onRowPress(row.id)}
              chevron={false}
              trailing={
                isFallback ? undefined : (
                  <View
                    {...panHandlersFor(row.id)}
                    accessibilityRole="adjustable"
                    accessibilityLabel={t('settings.categories.reorder_a11y', { category: row.name })}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={(event) => {
                      moveByOneStep(row.id, event.nativeEvent.actionName === 'increment' ? -1 : 1);
                    }}
                    style={{
                      width: componentMetrics.categoryReorderRow.handleSize,
                      height: componentMetrics.categoryReorderRow.handleSize,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text tone="tertiary" style={{ fontSize: theme.typography.size.md }}>
                      {t('settings.categories.reorder_handle')}
                    </Text>
                  </View>
                )
              }
            />
          </Animated.View>
        );
      })}
    </ListGroup>
  );
}
