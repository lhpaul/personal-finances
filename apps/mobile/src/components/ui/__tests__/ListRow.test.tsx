import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { ListRow } from '../ListRow';

/**
 * `ListRow` calls no hook, so it can be exercised with the same renderer-free element-tree
 * inspection style `TopBar.test.tsx` uses (implementation plan for issue #19, Decision 12).
 */

function findByAccessibilityRole(tree: ReturnType<typeof ListRow>, role: string) {
  return collectElements(tree, (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === role);
}

describe('ListRow — pressable (onPress supplied)', () => {
  it('renders as a Pressable with a role of "button" and a composed accessibility label', () => {
    const tree = ListRow({ icon: '👤', title: 'Perfil local', subtitle: 'RUT 18.456.789-0', onPress: jest.fn() });
    const buttons = findByAccessibilityRole(tree, 'button');
    expect(buttons).toHaveLength(1);
    expect((buttons[0]?.props as { accessibilityLabel?: string }).accessibilityLabel).toBe(
      'Perfil local, RUT 18.456.789-0',
    );
  });

  it('renders a chevron by default', () => {
    const tree = ListRow({ icon: '👤', title: 'Perfil local', onPress: jest.fn() });
    const chevrons = collectElements(tree, (el) => elementTypeName(el) === 'Text' && el.props.children === '›');
    expect(chevrons).toHaveLength(1);
  });
});

describe('ListRow — inert (no onPress, implementation plan Decision 8)', () => {
  it('renders as a non-pressable View with accessibilityState disabled, and no button role', () => {
    const tree = ListRow({ icon: '📄', title: 'Política de privacidad' });
    expect(findByAccessibilityRole(tree, 'button')).toHaveLength(0);

    const disabled = collectElements(
      tree,
      (el) => (el.props as { accessibilityState?: { disabled?: boolean } }).accessibilityState?.disabled === true,
    );
    expect(disabled).toHaveLength(1);
  });

  it('still renders the chevron — visually identical to a pressable row (Decision 8)', () => {
    const tree = ListRow({ icon: '📄', title: 'Política de privacidad' });
    const chevrons = collectElements(tree, (el) => elementTypeName(el) === 'Text' && el.props.children === '›');
    expect(chevrons).toHaveLength(1);
  });

  it('accessibility label falls back to the title alone when there is no subtitle', () => {
    const tree = ListRow({ icon: '📄', title: 'Política de privacidad' });
    const [row] = collectElements(
      tree,
      (el) => (el.props as { accessibilityState?: unknown }).accessibilityState !== undefined,
    );
    expect((row?.props as { accessibilityLabel?: string }).accessibilityLabel).toBe('Política de privacidad');
  });
});

describe('ListRow — chevron={false}', () => {
  it('renders with no trailing accessory at all', () => {
    const tree = ListRow({ icon: '👤', title: 'Perfil local', onPress: jest.fn(), chevron: false });
    const chevrons = collectElements(tree, (el) => elementTypeName(el) === 'Text' && el.props.children === '›');
    expect(chevrons).toHaveLength(0);
  });
});
