import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatClp } from '@finanzas/shared-utils';

import { Card, Progress, StatTile, Text } from '../../../components/ui';
import { screenMetrics, theme } from '../../../theme';
import type { MonthOverMonthDirection, StageOutcome } from '../completion';

/** Decorative placeholder for the rare "no previous month to compare against" branch
 * (Assumption P2's "no-previous-month branch") — a numeric-display glyph, not prose, so it is
 * not a catalogue entry (the same treatment `Amount`/`StatTile` give numeric values). */
const NO_PREVIOUS_MONTH_GLYPH = '—';

/**
 * Every branch calls the translation function with a literal key argument, per this codebase's
 * established pattern (`ready.tsx`'s `translateReminderDayKey`) — required by `i18next.d.ts`'s
 * compile-time key union. `'unknown'` (no previous-month data, Assumption P2) reuses the "same
 * as last month" copy rather than inventing a fourth tile variant the mockup does not draw.
 */
function changeSubLabel(t: ReturnType<typeof useTranslation>['t'], direction: MonthOverMonthDirection): string {
  switch (direction) {
    case 'less':
      return t('categorize_complete.tile_change_sub_less');
    case 'more':
      return t('categorize_complete.tile_change_sub_more');
    case 'same':
    case 'unknown':
      return t('categorize_complete.tile_change_sub_same');
  }
}

export interface CompletionSummaryProps {
  outcome: StageOutcome;
  resolved: number;
  total: number;
  ratio: number;
  dailyAverageMinorUnits: number;
  changeDirection: MonthOverMonthDirection;
  changePercentLabel: string | null;
}

/**
 * The completion screen's shared content (spec UX Rules → Completion): the celebration icon, the
 * outcome-specific heading and lead, the counter + progress bar, the two summary tiles (Decision
 * 11) and the closing line. `partial` vs `done` differ only in which heading/lead/counter is
 * shown — everything else renders identically (spec Use Cases 8, 9).
 */
export function CompletionSummary({
  outcome,
  resolved,
  total,
  ratio,
  dailyAverageMinorUnits,
  changeDirection,
  changePercentLabel,
}: CompletionSummaryProps) {
  const { t } = useTranslation();
  const isDone = outcome === 'done';

  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: screenMetrics.categorization.completionCelebrationGlyphSize }}>
          {t('categorize_complete.celebration_icon')}
        </Text>
        <Text variant="h1" center style={{ marginTop: theme.space['4'] }}>
          {isDone ? t('categorize_complete.heading_done') : t('categorize_complete.heading_partial')}
        </Text>
        <Text variant="bodyLead" center style={{ marginTop: theme.space['3'] }}>
          {isDone ? t('categorize_complete.lead_done') : t('categorize_complete.lead_partial')}
        </Text>
      </View>

      <Card>
        <View style={{ alignItems: 'center' }}>
          <Text variant="small">{t('categorize_complete.counter_label')}</Text>
          <Text variant="h1" tone="brand" style={{ marginTop: theme.space['1'] }}>
            {isDone
              ? t('categorize_complete.counter_done', { total })
              : t('categorize_complete.counter_partial', { resolved, total })}
          </Text>
          <Text variant="xs">{t('categorize_complete.counter_sub')}</Text>
        </View>
        <View style={{ marginTop: theme.space['4'] }}>
          <Progress value={ratio} accessibilityLabel={t('categorize_complete.progress_a11y')} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['4'] }}>
        <View style={{ flex: 1 }}>
          <StatTile
            tone="expense"
            label={t('categorize_complete.tile_daily_label')}
            value={formatClp(dailyAverageMinorUnits, { signDisplay: 'never' })}
            sub={t('categorize_complete.tile_daily_sub')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            tone="income"
            label={t('categorize_complete.tile_change_label')}
            value={changePercentLabel ?? NO_PREVIOUS_MONTH_GLYPH}
            sub={changeSubLabel(t, changeDirection)}
          />
        </View>
      </View>

      <Text variant="xs" center style={{ marginTop: theme.space['3'] }}>
        {t('categorize_complete.closing')}
      </Text>
    </View>
  );
}
