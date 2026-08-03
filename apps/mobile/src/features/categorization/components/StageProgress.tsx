import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Steps, Text } from '../../../components/ui';
import { theme } from '../../../theme';

export interface StageProgressProps {
  /** 1-based. */
  current: number;
  total: number;
}

/**
 * `mu-steps` + the "Transacción X de N" line (spec UX Rules → Categorization). Both derive from
 * the same batch, so they stay truthful when the batch is shorter than `STAGE_BATCH_SIZE`
 * (Assumption A14, AC3).
 */
export function StageProgress({ current, total }: StageProgressProps) {
  const { t } = useTranslation();

  // `accessible` collapses this View into a single accessibility element on both iOS and
  // Android, so its `accessibilityLabel` replaces — not supplements — the `Steps` accessibility
  // value and the visible "Transacción X de N" text underneath (React Native 0.81 accessibility
  // model). The label must therefore carry the interpolated progress itself
  // (`categorize.progress`), not the static `categorize.progress_a11y` string, or a screen
  // reader announces a group with no progress information at all (CodeRabbit finding on PR #79).
  const progressLabel = t('categorize.progress', { current, total });

  return (
    <View style={{ marginTop: theme.space['4'] }} accessible accessibilityLabel={progressLabel}>
      <Steps total={total} current={current} />
      <Text variant="small" center style={{ marginTop: theme.space['3'] }}>
        {progressLabel}
      </Text>
    </View>
  );
}
