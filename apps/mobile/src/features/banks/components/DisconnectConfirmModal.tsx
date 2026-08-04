import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Modal, Note, Text } from '../../../components/ui';
import { theme } from '../../../theme';

/** Decorative glyphs, not user-facing copy (mockup's `mu-modal__icon`; the failure note's glyph
 * mirrors `SyncErrorNote`'s own `WARNING_ICON` precedent). */
const DISCONNECT_ICON = '🔌';
const FAILURE_ICON = '⚠️';

export interface DisconnectConfirmModalProps {
  visible: boolean;
  bankName: string;
  disabled: boolean;
  /** Decision 2: a keychain-delete or status-write failure leaves the connection row visible —
   * "the state is visible (the row is still listed, with a failure Note)". The modal itself is
   * where the person just pressed *Desconectar*, so it stays open and renders this Note rather
   * than silently re-enabling its buttons with no explanation. */
  failed: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * The `disconnect-confirm` modal (implementation plan for issue #20, Decision 2, Decision 7). A
 * route-param state of `/settings/banks`, reachable from both screens — this component only
 * renders the dialog; the route owns opening/closing it via the `disconnect` search param.
 * `Modal`'s required `onRequestClose` is wired to the same clearing function as *Cancelar*, so a
 * hardware back press and the cancel button take the identical path.
 */
export function DisconnectConfirmModal({
  visible,
  bankName,
  disabled,
  failed,
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
      {failed && (
        <View style={{ marginTop: theme.space['4'], width: '100%' }}>
          <Note tone="danger" icon={FAILURE_ICON}>
            {t('settings_banks.disconnect_failed')}
          </Note>
        </View>
      )}
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
