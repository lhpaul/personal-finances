import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, TextField } from '../../../components/ui';
import { componentMetrics, theme } from '../../../theme';

/** Decorative glyph, not user-facing copy (Decision 10). */
const SEARCH_ICON = '🔍';

export interface TransactionsSearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
}

/**
 * `.mu-input` search box (implementation plan for issue #15, Decision 5). Item #9 (which was to
 * add `TextField`'s `icon` slot) has not merged at implementation time — the recorded fallback
 * applies: the 🔍 glyph is composed as a sibling `Text` next to `TextField`, rather than inside
 * its input row, and this is flagged as a visual deviation from the mockup's single input box in
 * the PR body. `TextField` already announces the field by its `placeholder` (never the emoji),
 * satisfying the runbook's accessibility step regardless.
 */
export function TransactionsSearchBar({ value, onChangeText }: TransactionsSearchBarProps) {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['2'] }}>
      <Text style={{ fontSize: componentMetrics.textField.fontSize }}>{SEARCH_ICON}</Text>
      <View style={{ flex: 1 }}>
        <TextField
          value={value}
          onChangeText={onChangeText}
          placeholder={t('transactions.search_placeholder')}
        />
      </View>
    </View>
  );
}
