import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { componentMetrics, theme } from '../../../theme';

export type OverlayAlign = 'bottom' | 'center';

export type OverlayProps = {
  align: OverlayAlign;
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

/**
 * `.mu-overlay`, `--center`. Shared by `Sheet` (`align="bottom"`) and `Modal`
 * (`align="center"`) — internal, not part of the public barrel (`mu-class-map.ts`
 * `internalOwners`).
 *
 * Tapping the backdrop calls `onRequestClose`; tapping `children` does not, because the
 * content is itself wrapped in a no-op `Pressable` that claims the touch responder first.
 */
export function Overlay({ align, visible, onRequestClose, children }: OverlayProps) {
  if (!visible) return null;

  return (
    <Pressable
      accessibilityRole="none"
      onPress={onRequestClose}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: componentMetrics.overlay.zIndex,
        backgroundColor: theme.colors.overlayScrim,
        flexDirection: 'column',
        justifyContent: align === 'center' ? 'center' : 'flex-end',
        padding: align === 'center' ? theme.space['5'] : undefined,
      }}
    >
      <Pressable onPress={() => undefined}>{children}</Pressable>
    </Pressable>
  );
}
