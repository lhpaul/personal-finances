import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import { theme } from '../../../theme';

/** Decorative glyph, not user-facing copy (Decision 10). */
const CALENDAR_ICON = '📅';

export interface MonthHeaderProps {
  label: string;
  count: number;
}

/** `.mu-tx-group` (implementation plan for issue #15, Decision 8, Decision 11 — `utility`,
 * composed directly from `theme` here, screen-local). `📅 {month} ({count})`. */
export function MonthHeader({ label, count }: MonthHeaderProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space['1'],
        marginTop: theme.space['5'],
        marginBottom: theme.space['3'],
      }}
    >
      <Text
        style={{
          fontSize: theme.typography.size.sm,
          fontWeight: fontWeight(theme.typography.weight.bold),
          color: theme.colors.textSecondary,
        }}
      >
        {CALENDAR_ICON}
      </Text>
      <Text
        style={{
          fontSize: theme.typography.size.sm,
          fontWeight: fontWeight(theme.typography.weight.bold),
          color: theme.colors.textSecondary,
        }}
      >
        {t('transactions.month_header_count', { month: label, count })}
      </Text>
    </View>
  );
}
