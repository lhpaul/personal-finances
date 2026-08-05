import type { ReactElement, ReactNode } from 'react';
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
 * Builds the overlay's element tree with no hook of its own — the "hook/pure split" precedent
 * already used for `use-wipe-local-data.ts`'s `attemptConfirmDelete`, applied here to a
 * component's render output instead of a hook's async logic, so it can be exercised by the
 * renderer-free element-tree walker (`test-utils/element-tree.ts`) without a React dispatcher.
 * `Overlay` (below) is the hook-owning wrapper that calls this after its `useEffect`.
 *
 * Both `Pressable`s are `accessible={false}` (fix for issue #104): `Pressable` defaults
 * `accessible` to `true` (`accessible !== false` in `react-native`'s own implementation), and a
 * `View`/`Pressable` with `accessible={true}` fuses every descendant's accessibility info into
 * ONE node for a screen reader — hiding each inner control (a `Sheet`'s/`Modal`'s own buttons)
 * from being individually reachable. Marking both wrapping layers non-accessible makes them
 * transparent to the accessibility tree so the real interactive descendants surface
 * individually, while sighted touch dismissal is unaffected: `accessible` only changes what a
 * screen reader reports, not touch handling — tapping the backdrop still calls
 * `onRequestClose`, and tapping `children` still doesn't, because the content is still wrapped
 * in a no-op `Pressable` that claims the touch responder first.
 */
export function renderOverlayTree({
  align,
  onRequestClose,
  children,
}: Omit<OverlayProps, 'visible'>): ReactElement {
  return (
    <Pressable
      accessible={false}
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
      <Pressable accessible={false} onPress={() => undefined}>
        {children}
      </Pressable>
    </Pressable>
  );
}

/**
 * `.mu-overlay`, `--center`. Shared by `Sheet` (`align="bottom"`) and `Modal`
 * (`align="center"`) — internal, not part of the public barrel (`mu-class-map.ts`
 * `internalOwners`).
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

  return renderOverlayTree({ align, onRequestClose, children });
}
