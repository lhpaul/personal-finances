import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/ui';
import { theme } from '../../../theme';
import type { DetailAction } from '../detail-state';

export interface DetailActionsProps {
  actions: readonly DetailAction[];
  /** `true` while a write is in flight (implementation plan concurrent-event-source addendum:
   * "every action button renders disabled while a write is in flight"). Defaults to `false` so
   * every existing call shape keeps working; `TransactionDetailScreen` is the only caller and
   * always passes it explicitly. */
  disabled?: boolean;
  onCategorize: () => void;
  onChangeCategory: () => void;
  onMerchant: () => void;
  onExclude: () => void;
  onReinclude: () => void;
}

/**
 * The drawn action button stack (`.mu-btn-stack`, a utility class — composed locally, no
 * `MU_CLASS_MAP` change). `actions` is `resolveActionSet`'s pure output (Decision 4); this
 * component only maps each action kind to its button variant and label. Every button shares the
 * same `disabled` flag — there is exactly one write in flight at a time for this screen (the
 * single-flight guard in `use-transaction-detail-actions.ts`), never one per action.
 */
export function DetailActions({
  actions,
  disabled = false,
  onCategorize,
  onChangeCategory,
  onMerchant,
  onExclude,
  onReinclude,
}: DetailActionsProps) {
  const { t } = useTranslation();

  return (
    <View style={{ marginTop: theme.space['5'], gap: theme.space['3'] }}>
      {actions.map((action) => {
        switch (action) {
          case 'categorize':
            return (
              <Button
                key={action}
                label={t('transaction_detail.action_categorize')}
                onPress={onCategorize}
                disabled={disabled}
              />
            );
          case 'change_category':
            return (
              <Button
                key={action}
                variant="outline"
                label={t('transaction_detail.action_change_category')}
                onPress={onChangeCategory}
                disabled={disabled}
              />
            );
          case 'merchant':
            return (
              <Button
                key={action}
                variant="outline"
                label={t('transaction_detail.action_merchant')}
                onPress={onMerchant}
                disabled={disabled}
              />
            );
          case 'exclude':
            return (
              <Button
                key={action}
                variant="ghost"
                label={t('transaction_detail.action_exclude')}
                onPress={onExclude}
                disabled={disabled}
              />
            );
          case 'reinclude':
            return (
              <Button
                key={action}
                label={t('transaction_detail.action_reinclude')}
                onPress={onReinclude}
                disabled={disabled}
              />
            );
        }
      })}
    </View>
  );
}
