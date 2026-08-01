import { View, type TextStyle } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Text } from './Text';

export type StatTileTone = 'income' | 'expense';
export type StatTileArrow = 'up' | 'down';

export type StatTileProps = {
  tone: StatTileTone;
  label: string;
  value: string;
  sub?: string;
  arrow?: StatTileArrow;
};

const TONE_GRADIENT = { income: theme.gradients.income, expense: theme.gradients.expense };
const ARROW_GLYPH: Record<StatTileArrow, string> = { up: '↑', down: '↓' };

/** `.mu-stat`, `--in`, `--out`, `__label`, `__value`, `__sub`, `__arrow`.
 *
 * Uses a flat `theme.gradients.<tone>.from` fill — see `Hero`'s doc comment for why this item
 * has no gradient renderer. */
export function StatTile({ tone, label, value, sub, arrow }: StatTileProps) {
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        padding: theme.space['4'],
        backgroundColor: TONE_GRADIENT[tone].from,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Text tone="inverse" style={{ fontSize: theme.typography.size.base, opacity: 0.92 }}>
        {label}
      </Text>
      <Text
        tone="inverse"
        style={{
          fontSize: theme.typography.scale.amount.stat.fontSize,
          fontWeight: String(
            theme.typography.scale.amount.stat.fontWeight,
          ) as TextStyle['fontWeight'],
          letterSpacing: theme.typography.scale.amount.stat.letterSpacing,
          marginTop: componentMetrics.statTile.valueMarginTop,
        }}
      >
        {value}
      </Text>
      {sub !== undefined && (
        <Text
          tone="inverse"
          style={{
            fontSize: theme.typography.size.sm,
            opacity: 0.85,
            marginTop: componentMetrics.statTile.subMarginTop,
          }}
        >
          {sub}
        </Text>
      )}
      {arrow !== undefined && (
        <Text
          tone="inverse"
          style={{
            position: 'absolute',
            top: theme.space['4'],
            right: theme.space['4'],
            fontSize: componentMetrics.statTile.arrowFontSize,
            opacity: 0.9,
          }}
        >
          {ARROW_GLYPH[arrow]}
        </Text>
      )}
    </View>
  );
}
