import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Text } from './Text';

export type LegendItem = {
  color: string;
  label: string;
};

export type LegendProps = {
  items: LegendItem[];
};

/** `.mu-legend`, `__row`, `__dot` (home-screen implementation plan for issue #12, Decision 5).
 * Renders a horizontal row of coloured-dot + label pairs — the shape `home`'s trend card draws.
 * `.mu-legend__name` / `__val` stay deferred to #17 (Dashboard charts), which needs the
 * column-list variant this screen does not draw. */
export function Legend({ items }: LegendProps) {
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
