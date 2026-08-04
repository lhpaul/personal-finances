import { useTranslation } from 'react-i18next';

import { Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import { theme } from '../../../theme';

export interface SearchSummaryProps {
  term: string;
  count: number;
}

/** `.mu-tx-group`'s search-mode content (implementation plan for issue #15, Decision 8):
 * `{count} resultados para «{term}»`, replacing the month headers while a search term is
 * active. Singular/plural chosen the same way `home.summary_movement_count_single/plural` is. */
export function SearchSummary({ term, count }: SearchSummaryProps) {
  const { t } = useTranslation();
  const key = count === 1 ? 'transactions.search_summary_single' : 'transactions.search_summary_plural';

  return (
    <Text
      style={{
        marginTop: theme.space['5'],
        marginBottom: theme.space['3'],
        fontSize: theme.typography.size.sm,
        fontWeight: fontWeight(theme.typography.weight.bold),
        color: theme.colors.textSecondary,
      }}
    >
      {t(key, { count, term })}
    </Text>
  );
}
