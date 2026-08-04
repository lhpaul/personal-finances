import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Modal, Text } from '../../../components/ui';
import { theme } from '../../../theme';

/** Decorative glyph, not user-facing copy (mockup's `mu-modal__icon`). */
const DISCONNECT_ICON = '🔌';

export interface DisconnectConfirmModalProps {
  visible: boolean;
  bankName: string;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * The `disconnect-confirm` modal (implementation plan for issue #20, Decision 7). A route-param
 * state of `/settings/banks`, reachable from both screens — this component only renders the
 * dialog; the route owns opening/closing it via the `disconnect` search param.
 * `Modal`'s required `onRequestClose` is wired to the same clearing function as *Cancelar*, so a
 * hardware back press and the cancel button take the identical path.
 */
export function DisconnectConfirmModal({
  visible,
  bankName,
  disabled,
  onCancel,
  onConfirm,
}: DisconnectConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      onRequestClose={onCancel}
      icon={DISCONNECT_ICON}
      title={t('settings_banks.disconnect_title')}
    >
      <Text variant="body" center style={{ marginTop: theme.space['2'] }}>
        {t('settings_banks.disconnect_body', { bank: bankName })}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['5'], width: '100%' }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            label={t('settings_banks.disconnect_cancel')}
            onPress={onCancel}
            disabled={disabled}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="danger"
            label={t('settings_banks.disconnect_confirm')}
            onPress={onConfirm}
            disabled={disabled}
          />
        </View>
      </View>
    </Modal>
  );
}
