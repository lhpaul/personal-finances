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

  return (
    <View style={{ marginTop: theme.space['4'] }}>
      <Steps total={total} current={current} />
      <Text variant="small" center style={{ marginTop: theme.space['3'] }}>
        {t('categorize.progress', { current, total })}
      </Text>
    </View>
  );
}
