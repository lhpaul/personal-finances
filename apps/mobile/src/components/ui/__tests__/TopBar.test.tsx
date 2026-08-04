import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { TopBar } from '../TopBar';

/**
 * `TopBar` calls no hook, so it can be exercised with the same renderer-free element-tree
 * inspection style used across `src/features/connect-bank/__tests__/`. Added in review
 * (CodeRabbit PR #80, round 3): the trailing spacer was rendering unconditionally on
 * `titleAlign === 'center'` even with no `onBack`, leaving an unmatched leading control and
 * pushing the title left of center.
 */

function pressables(tree: ReturnType<typeof TopBar>) {
  return collectElements(
    tree,
    (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === 'button',
  );
}

describe('TopBar — centered title with onBack', () => {
  it('renders both the back button and the trailing spacer, so the title stays centered', () => {
    const tree = TopBar({ title: 'Título', onBack: jest.fn(), titleAlign: 'center' });
    expect(pressables(tree)).toHaveLength(1);

    const spacers = collectElements(
      tree,
      (el) => elementTypeName(el) === 'View' && el.props.style?.width !== undefined,
    );
    expect(spacers).toHaveLength(1);
  });
});

describe('TopBar — centered title without onBack (found in review, round 3)', () => {
  it('renders neither the back button nor the trailing spacer', () => {
    const tree = TopBar({ title: 'Título', titleAlign: 'center' });
    expect(pressables(tree)).toHaveLength(0);

    const spacers = collectElements(
      tree,
      (el) => elementTypeName(el) === 'View' && el.props.style?.width !== undefined,
    );
    expect(spacers).toHaveLength(0);
  });
});

describe('TopBar — left-aligned title', () => {
  it('renders neither a back button nor a trailing spacer, even with onBack supplied', () => {
    const tree = TopBar({ title: 'Título', onBack: jest.fn(), titleAlign: 'left' });
    expect(pressables(tree)).toHaveLength(0);

    const spacers = collectElements(
      tree,
      (el) => elementTypeName(el) === 'View' && el.props.style?.width !== undefined,
    );
    expect(spacers).toHaveLength(0);
  });
});

/**
 * `trailingAction` (dashboard implementation plan for issue #17, Decision 9) — additive: the
 * three describe blocks above pass no `trailingAction` and must keep asserting exactly what they
 * asserted before this prop existed (verified above, unchanged).
 */
describe('TopBar — centered title with a trailing action (issue #17)', () => {
  it('renders the back button and the trailing action button, and no spacer', () => {
    const tree = TopBar({
      title: 'Dashboard',
      onBack: jest.fn(),
      titleAlign: 'center',
      trailingAction: { glyph: '⚙️', onPress: jest.fn(), accessibilityLabel: 'Configuración' },
    });
    expect(pressables(tree)).toHaveLength(2);

    const spacers = collectElements(
      tree,
      (el) => elementTypeName(el) === 'View' && el.props.style?.width !== undefined,
    );
    expect(spacers).toHaveLength(0);
  });

  it('renders only the trailing action button when there is no onBack', () => {
    const tree = TopBar({
      title: 'Dashboard',
      titleAlign: 'center',
      trailingAction: { glyph: '⚙️', onPress: jest.fn(), accessibilityLabel: 'Configuración' },
    });
    expect(pressables(tree)).toHaveLength(1);
  });
});
