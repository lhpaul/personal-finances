import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

/** Decorative glyph, not user-facing copy — the chevron is language-independent (implementation
 * plan Decision 10 precedent from item #2's `CategoryChip`/`Checkbox`). */
const CHEVRON_GLYPH = '›';

export type BankRowSubLabelTone = 'default' | 'danger';

export type BankRowProps = {
  /** A 2-3 letter monogram rendered on `monogramColor` (Assumption A13 — the mockup itself never
   * draws a raster bank logo, only a coloured monogram badge). */
  monogram: string;
  monogramColor: string;
  name: string;
  subLabel: string;
  subLabelTone?: BankRowSubLabelTone;
  onPress?: (event: GestureResponderEvent) => void;
};

/** `.mu-bank`, `__logo`, `__name` plus the shared `.mu-item__txt`, `__sub`, `__chev` (home-screen
 * implementation plan for issue #12, Decision 5). Pressable, optional `onPress` — mirrors
 * `TransactionRow`'s no-handler fallback to a plain `View` (found in review on item #2, applied
 * here from the start). */
export function BankRow({
  monogram,
  monogramColor,
  name,
  subLabel,
  subLabelTone = 'default',
  onPress,
}: BankRowProps) {
  const touchMetrics = TOUCH_METRICS.bankRow;

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.space['3'],
    width: '100%' as const,
    paddingVertical: theme.space['3'],
    paddingHorizontal: theme.space['4'],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface1,
    borderWidth: componentMetrics.borderWidth.hairline,
    borderColor: theme.colors.border,
  };

  const content = (
    <>
      <View
        style={{
          width: componentMetrics.bankRow.logoSize,
          height: componentMetrics.bankRow.logoSize,
          borderRadius: theme.radius.md,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: monogramColor,
        }}
      >
        <Text
          tone="inverse"
          style={{
            fontSize: theme.typography.size.sm,
            fontWeight: fontWeight(theme.typography.weight.extrabold),
            letterSpacing: componentMetrics.bankRow.monogramLetterSpacing,
          }}
        >
          {monogram}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: componentMetrics.bankRow.nameFontSize,
            fontWeight: fontWeight(theme.typography.weight.semibold),
          }}
        >
          {name}
        </Text>
        <Text
          variant="small"
          tone={subLabelTone === 'danger' ? 'danger' : 'secondary'}
          style={{ marginTop: componentMetrics.bankRow.subMarginTop }}
        >
          {subLabel}
        </Text>
      </View>
      <Text
        tone="tertiary"
        style={{ fontSize: componentMetrics.bankRow.chevronFontSize, flexShrink: 0 }}
      >
        {CHEVRON_GLYPH}
      </Text>
    </>
  );

  if (onPress === undefined) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${subLabel}`}
      onPress={onPress}
      hitSlop={touchMetrics.hitSlop}
      style={rowStyle}
    >
      {content}
    </Pressable>
  );
}
