import type { ReactNode } from 'react';
import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Overlay } from './_internal/Overlay';
import { Text } from './Text';

export type ModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
};

/** `.mu-modal`, `__icon`. Renders via the shared `_internal/Overlay`. */
export function Modal({ visible, onRequestClose, icon, title, children }: ModalProps) {
  return (
    <Overlay align="center" visible={visible} onRequestClose={onRequestClose}>
      <View
        style={{
          backgroundColor: theme.colors.surface1,
          borderRadius: theme.radius.xl,
          paddingVertical: theme.space['6'],
          paddingHorizontal: theme.space['5'],
          alignItems: 'center',
        }}
      >
        {icon !== undefined && (
          <Text center style={{ fontSize: componentMetrics.modal.iconFontSize }}>
            {icon}
          </Text>
        )}
        <Text variant="h2" center style={{ marginTop: theme.space['3'] }}>
          {title}
        </Text>
        {children}
      </View>
    </Overlay>
  );
}
