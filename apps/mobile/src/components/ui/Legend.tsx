import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { Text } from './Text';

export type LegendItem = {
  color: string;
  label: string;
  /** `.mu-legend__val` (dashboard implementation plan for issue #17, Decision 8). When present on
   * *any* item, every row in this `Legend` renders the column shape (`.mu-legend` /
   * `.mu-legend__row` — name flex-1 + right-aligned value); when absent from every item, the
   * layout is byte-unchanged from item #12's horizontal dot + label row. */
  value?: string;
};

export type LegendProps = {
  items: LegendItem[];
};

/**
 * `.mu-legend`, `__row`, `__dot`, `__name`, `__val` (home-screen implementation plan for issue
 * #12, Decision 5; widened additively by the dashboard implementation plan for issue #17,
 * Decision 8). Two shapes, chosen by whether any item carries a `value`:
 *
 * - No `value` on any item (item #12's shape): a single horizontal row of coloured-dot + label
 *   pairs, unchanged from the original implementation — every existing call site (`home`'s trend
 *   and spending legends) omits `value` and renders exactly as before.
 * - At least one item carries a `value` (`#17`'s category-report legend): a vertical column of
 *   full-width rows (`.mu-legend`'s `flex-direction: column`), each with the dot, the label
 *   (`flex: 1`, truncated) and the value right-aligned — the shape
 *   `docs/best-practices/.../design-tokens.md`'s `.mu-legend__row` CSS draws.
 */
export function Legend({ items }: LegendProps) {
  const hasValues = items.some((item) => item.value !== undefined);

  if (!hasValues) {
    return (
      <View style={{ flexDirection: 'row', gap: theme.space['4'] }}>
        {items.map((item) => (
          <View
            key={item.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['2'] }}
          >
            <View
              style={{
                width: componentMetrics.legend.dotSize,
                height: componentMetrics.legend.dotSize,
                borderRadius: componentMetrics.legend.dotRadius,
                backgroundColor: item.color,
              }}
            />
            <Text variant="xs">{item.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'column', gap: theme.space['2'], flex: 1, minWidth: 0 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['2'] }}
        >
          <View
            style={{
              width: componentMetrics.legend.dotSize,
              height: componentMetrics.legend.dotSize,
              borderRadius: componentMetrics.legend.dotRadius,
              backgroundColor: item.color,
              flexShrink: 0,
            }}
          />
          <Text variant="small" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
            {item.label}
          </Text>
          {item.value !== undefined && (
            <Text
              variant="small"
              style={{
                fontVariant: ['tabular-nums'],
                fontWeight: fontWeight(theme.typography.weight.bold),
              }}
            >
              {item.value}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
