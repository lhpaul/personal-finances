import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../../components/ui';

/** Decorative glyph, not user-facing copy (Decision 10). */
const SEARCH_ICON = '🔎';

/** `.mu-empty` (implementation plan for issue #15, Decision 10) — one state, with the drawn
 * copy, whatever produced it (no search results or a filter that matches nothing). */
export function TransactionsEmptyState() {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={SEARCH_ICON}
      title={t('transactions.empty_title')}
      description={t('transactions.empty_description')}
    />
  );
}
