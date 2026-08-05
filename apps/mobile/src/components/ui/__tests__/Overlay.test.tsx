import { Pressable, Text } from 'react-native';

import { collectElements } from '../../../test-utils/element-tree';
import { renderOverlayTree } from '../_internal/Overlay';

/**
 * `renderOverlayTree` calls no hook (`Overlay` itself owns the `useEffect`; see the module doc
 * comment), so it can be exercised with the same renderer-free element-tree inspection style
 * `TopBar.test.tsx`/`ListRow.test.tsx` use.
 *
 * Regression coverage for issue #104: the overlay's two wrapping `Pressable`s (the backdrop and
 * the no-op content-touch-capture layer) previously left `accessible` at `Pressable`'s own
 * default (`true`), which fuses every descendant's accessibility info into ONE node for a
 * screen reader — a `Sheet`'s/`Modal`'s own buttons stopped being individually reachable. Both
 * wrapping layers are now `accessible={false}`.
 *
 * Matches by `el.type === Pressable` (referential identity), not by an `elementTypeName`
 * string: `react-native`'s `Pressable` export is `memo(Pressable)`, so `element.type` is the
 * `memo` object, not a plain named function — `elementTypeName`'s `typeof type === 'function'`
 * branch does not apply to it.
 */

function stubButtons() {
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={() => undefined} />
      <Pressable accessibilityRole="button" accessibilityLabel="Confirmar" onPress={() => undefined} />
      <Text>Cuerpo del contenido</Text>
    </>
  );
}

function findPressables(tree: ReturnType<typeof renderOverlayTree>) {
  return collectElements(tree, (el) => el.type === Pressable);
}

describe('renderOverlayTree — accessibility fusion (issue #104)', () => {
  it('marks both wrapping Pressables (backdrop + content touch-capture) accessible={false}', () => {
    const tree = renderOverlayTree({ align: 'bottom', onRequestClose: jest.fn(), children: stubButtons() });

    const allPressables = findPressables(tree);
    // 2 wrappers (backdrop, content touch-capture) + 2 content buttons.
    expect(allPressables).toHaveLength(4);

    const nonAccessibleWrappers = allPressables.filter(
      (el) => (el.props as { accessible?: boolean }).accessible === false,
    );
    expect(nonAccessibleWrappers).toHaveLength(2);
  });

  it('does not mark the content buttons non-accessible — they remain individually reachable, not fused into the wrapper', () => {
    const tree = renderOverlayTree({ align: 'center', onRequestClose: jest.fn(), children: stubButtons() });

    const buttons = findPressables(tree).filter(
      (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === 'button',
    );
    expect(buttons).toHaveLength(2);

    // Each button keeps its own distinguishing label and is not itself opted out of the
    // accessibility tree — proving these are two separate accessible nodes, not one fused node.
    const labels = buttons.map((el) => (el.props as { accessibilityLabel?: string }).accessibilityLabel);
    expect(labels).toEqual(['Cancelar', 'Confirmar']);
    buttons.forEach((el) => {
      expect((el.props as { accessible?: boolean }).accessible).not.toBe(false);
    });
  });

  it('the backdrop Pressable still calls onRequestClose on press — accessible={false} only changes screen-reader fusion, not touch dismissal', () => {
    const onRequestClose = jest.fn();
    const tree = renderOverlayTree({ align: 'bottom', onRequestClose, children: stubButtons() });

    const [backdrop] = findPressables(tree).filter(
      (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === 'none',
    );
    expect(backdrop).toBeDefined();
    (backdrop!.props as { onPress: () => void }).onPress();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('the content touch-capture Pressable is a no-op on press — tapping content does not dismiss the overlay', () => {
    const onRequestClose = jest.fn();
    const tree = renderOverlayTree({ align: 'bottom', onRequestClose, children: stubButtons() });

    const [contentWrapper] = findPressables(tree).filter(
      (el) =>
        (el.props as { accessible?: boolean }).accessible === false &&
        (el.props as { accessibilityRole?: string }).accessibilityRole === undefined,
    );
    expect(contentWrapper).toBeDefined();
    (contentWrapper!.props as { onPress: () => void }).onPress();
    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
