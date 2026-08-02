import { View } from 'react-native';

import { Badge, Text } from '../../../components/ui';
import { screenMetrics, theme } from '../../../theme';

export type ReadySummaryRowProps = {
  glyph: string;
  title: string;
  /** Omitted (not rendered) when the caller has no well-formed subtitle to show — e.g. the
   * reminders row renders with title only when `reminder_time`/`reminder_days` are missing or
   * malformed (implementation plan Decision 7, Decision 8). */
  subtitle?: string;
  badgeLabel: string;
  /** `true` for the first row in the card (no top margin) — mirrors `index.html:1101-1102`'s
   * `.mu-row` (no margin) / `.mu-row.mu-mt4` (second row) pair. */
  isFirst?: boolean;
};

/**
 * A screen-local composition (glyph + title + subtitle + `Badge tone="ok"`) inside
 * `onboarding-ready`'s summary `Card` — **not** a new `components/ui/` primitive (implementation
 * plan Decision 12). `mu-item__*` stays deferred to #19 (Settings hub); this row is built from
 * existing primitives (`Text`, `Badge`) plus a plain `View`, so `MU_CLASS_MAP` is left unchanged.
 */
export function ReadySummaryRow({ glyph, title, subtitle, badgeLabel, isFirst = false }: ReadySummaryRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space['3'],
        marginTop: isFirst ? 0 : theme.space['4'],
      }}
    >
      <Text style={{ fontSize: screenMetrics.onboarding.summaryGlyphSize }}>{glyph}</Text>
      <View style={{ flex: 1 }}>
        <Text variant="body">{title}</Text>
        {subtitle !== undefined && <Text variant="small">{subtitle}</Text>}
      </View>
      <Badge tone="ok" label={badgeLabel} />
    </View>
  );
}
