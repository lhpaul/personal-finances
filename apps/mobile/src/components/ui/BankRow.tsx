import type { ReactNode } from 'react';
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
  /**
   * Additive extension for the connect-a-bank picker (implementation plan for issue #9,
   * Resolution R4, Decision 12, AC9). When set and `onPress` is absent, the row renders as a
   * non-pressable `View` marked `accessible`, whose accessible name is
   * `"<name>, <unavailableLabel>"`, with no `accessibilityRole="button"` and no trailing chevron
   * or accessory — a coming-soon bank must announce as unavailable, never as a dead button.
   * Ignored when `onPress` is set.
   */
  unavailableLabel?: string;
  /**
   * Additive extension (issue #9): a trailing accessory rendered in place of the default chevron
   * — e.g. a "Disponible" badge on a pressable row, or a success mark on a completed connection's
   * row. Ignored when `unavailableLabel` produces the non-pressable/unavailable rendering (that
   * state draws no trailing accessory at all, per Decision 12). Every existing call site (the
   * home screen's `ConnectedBanksCard`) omits this prop and keeps its current chevron.
   */
  trailingAccessory?: ReactNode;
  /**
   * Additive extension (issue #20, Decision 4): overrides the pressable row's computed
   * accessibility name (`"<name>, <subLabel>"`) when provided. `settings-banks` needs its row's
   * accessible name to carry the status word (`"Al día"` / `"Error"`) rather than the visible
   * relative-time `subLabel` a screen reader would otherwise read verbatim — the visible glyph
   * badge (`trailingAccessory`) is not independently announced when it sits inside a `Pressable`
   * with an explicit `accessibilityLabel`, so the status has to reach the accessible name this
   * way instead. Ignored when `unavailableLabel` produces the non-pressable/unavailable
   * rendering. Every existing call site (the home screen's `ConnectedBanksCard`, the connect-a-
   * bank picker) omits this prop and keeps the default `"<name>, <subLabel>"` computation.
   */
  accessibilityLabel?: string;
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
  unavailableLabel,
  trailingAccessory,
  accessibilityLabel,
}: BankRowProps) {
  const touchMetrics = TOUCH_METRICS.bankRow;
  const isUnavailable = onPress === undefined && unavailableLabel !== undefined;

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

  const trailing = isUnavailable ? null : (trailingAccessory ?? (
    <Text
      tone="tertiary"
      style={{ fontSize: componentMetrics.bankRow.chevronFontSize, flexShrink: 0 }}
    >
      {CHEVRON_GLYPH}
    </Text>
  ));

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
      {trailing}
    </>
  );

  if (isUnavailable) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={`${name}, ${unavailableLabel}`}>
        {content}
      </View>
    );
  }

  if (onPress === undefined) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${name}, ${subLabel}`}
      onPress={onPress}
      hitSlop={touchMetrics.hitSlop}
      style={rowStyle}
    >
      {content}
    </Pressable>
  );
}
