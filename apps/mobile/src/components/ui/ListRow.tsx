import type { ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

/** Decorative glyph, not user-facing copy — the chevron is language-independent (same rationale
 * as `BankRow.tsx`'s `CHEVRON_GLYPH`). */
const CHEVRON_GLYPH = '›';

export type ListRowProps = {
  /** A single emoji glyph, passed in by the caller (Decision 3 — this primitive contains no
   * copy or decorative-glyph literal of its own). */
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPress?: (event: GestureResponderEvent) => void;
  /** Defaults to `true` — every `.mu-item` in the mockup draws a chevron, including the three
   * inert `settings-about` rows that have no `onPress` (implementation plan for issue #19,
   * Decision 8). Set `false` only for a row that should render with no trailing accessory at
   * all. */
  chevron?: boolean;
};

/**
 * `.mu-item`, `__icon`, `__title` (implementation plan for issue #19, Decision 12) — plus the
 * shared `.mu-item__chev`, `__sub`, `__txt` (jointly owned with `CategoryRow`/`BankRow` since
 * items #9/#12). A single row inside a `ListGroup`.
 *
 * With no `onPress`, renders a non-pressable `View` with `accessibilityState={{ disabled: true
 * }}` (Decision 8) — the settings-about screen's three inert rows render visually identical to
 * every pressable row, but announce as disabled to assistive tech and never navigate.
 */
export function ListRow({ icon, title, subtitle, onPress, chevron = true }: ListRowProps) {
  const touchMetrics = TOUCH_METRICS.listRow;
  const isDisabled = onPress === undefined;
  const accessibilityLabel = subtitle !== undefined ? `${title}, ${subtitle}` : title;

  const content = (
    <>
      <View
        style={{
          width: componentMetrics.listRow.iconSize,
          height: componentMetrics.listRow.iconSize,
          borderRadius: theme.radius.md,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface3,
        }}
      >
        <Text style={{ fontSize: componentMetrics.listRow.iconGlyphSize }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: componentMetrics.listRow.titleFontSize,
            fontWeight: fontWeight(theme.typography.weight.semibold),
          }}
        >
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text
            variant="small"
            style={{ marginTop: componentMetrics.bankRow.subMarginTop }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {chevron && (
        <Text
          tone="tertiary"
          style={{ fontSize: componentMetrics.bankRow.chevronFontSize, flexShrink: 0 }}
        >
          {CHEVRON_GLYPH}
        </Text>
      )}
    </>
  );

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.space['3'],
    width: '100%' as const,
    paddingVertical: theme.space['4'],
    paddingHorizontal: theme.space['5'],
  };

  if (isDisabled) {
    return (
      <View style={rowStyle} accessible accessibilityState={{ disabled: true }} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={touchMetrics.hitSlop}
      style={rowStyle}
    >
      {content}
    </Pressable>
  );
}
