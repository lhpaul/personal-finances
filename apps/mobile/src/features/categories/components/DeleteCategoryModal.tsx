import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Modal, Text } from '../../../components/ui';
import { theme } from '../../../theme';

export type DeleteCategoryModalProps = {
  visible: boolean;
  /** The emoji + name already composed (`🍔 Comida`) — never a literal, always built from a
   * store row (Decision 6). */
  categoryLabel: string;
  /** `✨ Otros`, composed the same way (Decision 6). */
  fallbackLabel: string;
  /** The category's all-time movement count — deletion re-parents *all* of them, not this
   * month's (Decision 6, Assumption A5). */
  totalCount: number;
  onRequestClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * `Modal` with the `🗑` icon and the interpolated body of Decision 6 (implementation plan for
 * issue #21). Renders unbolded `fallbackLabel`, unlike the mockup's `<b>` (Assumption A9,
 * follow-up 5).
 */
export function DeleteCategoryModal({
  visible,
  categoryLabel,
  fallbackLabel,
  totalCount,
  onRequestClose,
  onCancel,
  onConfirm,
}: DeleteCategoryModalProps) {
  const { t } = useTranslation();

  const body =
    totalCount === 0
      ? t('settings.categories.delete_modal_body_none', { category: categoryLabel })
      : totalCount === 1
        ? t('settings.categories.delete_modal_body_single', {
            category: categoryLabel,
            fallback: fallbackLabel,
          })
        : t('settings.categories.delete_modal_body_plural', {
            category: categoryLabel,
            n: totalCount,
            fallback: fallbackLabel,
          });

  return (
    <Modal
      visible={visible}
      onRequestClose={onRequestClose}
      icon={t('settings.categories.delete_modal_icon')}
      title={t('settings.categories.delete_modal_title')}
    >
      <Text variant="body" center style={{ marginTop: theme.space['2'] }}>
        {body}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['5'] }}>
        <View style={{ flex: 1 }}>
          <Button variant="outline" label={t('settings.categories.cancel')} onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="danger"
            label={t('settings.categories.delete_modal_confirm')}
            onPress={onConfirm}
          />
        </View>
      </View>
    </Modal>
  );
}
