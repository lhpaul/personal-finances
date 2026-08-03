import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Amount } from './Amount';
import { Text } from './Text';

export type CategoryRowProps = {
  emoji: string;
  label: string;
  /** Already-formatted CLP string (`$279K`) — this component performs no money arithmetic
   * (mirroring `Amount`'s own contract). */
  amountFormatted: string;
  /** 0-1, relative to the largest bucket in the same list. */
  ratio: number;
  fillColor: string;
  /** `"5 transacciones · 20,6%"` — already composed by the caller (i18n interpolation lives at
   * the screen tier, not in this primitive). */
  meta: string;
  onPress?: (event: GestureResponderEvent) => void;
};

/**
 * `.mu-cat-row`, `__icon`, `__bar`, `__fill` (home-screen implementation plan for issue #12,
 * Decision 5). Renders no divider of its own — a list of `CategoryRow`s sits inside a container
 * that draws the `+ .mu-cat-row` border between consecutive rows (mirroring how `Card` composes
 * its own children rather than each row managing its neighbours).
 */
export function CategoryRow({
  emoji,
  label,
  amountFormatted,
  ratio,
  fillColor,
  meta,
  onPress,
}: CategoryRowProps) {
  const touchMetrics = TOUCH_METRICS.categoryRow;
  const clampedRatio = Math.min(1, Math.max(0, ratio));

  const content = (
    <>
      <Text
        style={{
          fontSize: componentMetrics.categoryRow.iconFontSize,
          width: componentMetrics.categoryRow.iconWidth,
          textAlign: 'center',
        }}
      >
        {emoji}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="small" style={{ fontWeight: fontWeight(theme.typography.weight.bold) }}>
            {label}
          </Text>
          <Amount size="md" formatted={amountFormatted} />
        </View>
        <View
          style={{
            height: componentMetrics.categoryRow.barHeight,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surface3,
            marginTop: componentMetrics.categoryRow.barMarginTop,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${clampedRatio * 100}%`,
              borderRadius: theme.radius.pill,
              backgroundColor: fillColor,
            }}
          />
        </View>
        <Text variant="xs">{meta}</Text>
      </View>
    </>
  );

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.space['3'],
    width: '100%' as const,
    paddingVertical: componentMetrics.categoryRow.paddingVertical,
  };

  if (onPress === undefined) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${amountFormatted}, ${meta}`}
      onPress={onPress}
      hitSlop={touchMetrics.hitSlop}
      style={rowStyle}
    >
      {content}
    </Pressable>
  );
}
