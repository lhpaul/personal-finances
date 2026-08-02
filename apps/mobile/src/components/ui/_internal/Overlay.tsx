import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { BackHandler, Pressable } from 'react-native';

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
 *
 * Registers an Android hardware-back-press handler while `visible` — otherwise the back
 * button does nothing while a `Sheet`/`Modal` is open instead of dismissing it (found in
 * review). The `useEffect` runs before the `visible` early return, per the Rules of Hooks.
 */
export function Overlay({ align, visible, onRequestClose, children }: OverlayProps) {
  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onRequestClose]);

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
