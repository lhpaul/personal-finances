import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/ui';
import { theme } from '../../../theme';
import type { DetailAction } from '../detail-state';

export interface DetailActionsProps {
  actions: readonly DetailAction[];
  onCategorize: () => void;
  onChangeCategory: () => void;
  onMerchant: () => void;
  onExclude: () => void;
  onReinclude: () => void;
}

/**
 * The drawn action button stack (`.mu-btn-stack`, a utility class — composed locally, no
 * `MU_CLASS_MAP` change). `actions` is `resolveActionSet`'s pure output (Decision 4); this
 * component only maps each action kind to its button variant and label.
 */
export function DetailActions({
  actions,
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
              <Button key={action} label={t('transaction_detail.action_categorize')} onPress={onCategorize} />
            );
          case 'change_category':
            return (
              <Button
                key={action}
                variant="outline"
                label={t('transaction_detail.action_change_category')}
                onPress={onChangeCategory}
              />
            );
          case 'merchant':
            return (
              <Button
                key={action}
                variant="outline"
                label={t('transaction_detail.action_merchant')}
                onPress={onMerchant}
              />
            );
          case 'exclude':
            return (
              <Button key={action} variant="ghost" label={t('transaction_detail.action_exclude')} onPress={onExclude} />
            );
          case 'reinclude':
            return (
              <Button key={action} label={t('transaction_detail.action_reinclude')} onPress={onReinclude} />
            );
        }
      })}
    </View>
  );
}
