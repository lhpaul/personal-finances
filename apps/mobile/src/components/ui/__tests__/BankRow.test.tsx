import { collectElements } from '../../../test-utils/element-tree';
import { BankRow } from '../BankRow';

/**
 * `BankRow` calls no hook, so it can be exercised with the same renderer-free element-tree
 * inspection style as `TopBar.test.tsx`. Covers the `accessibilityLabel` override added for
 * issue #20, Decision 4 (`settings-banks`'s row needs its accessible name to carry the status
 * word, not the visible relative-time `subLabel`).
 */

function pressable(tree: ReturnType<typeof BankRow>) {
  return collectElements(
    tree,
    (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === 'button',
  )[0];
}

describe('BankRow — accessibilityLabel (Decision 4)', () => {
  const baseProps = {
    monogram: 'BCH',
    monogramColor: '#003da5',
    name: 'Banco de Chile',
    subLabel: 'Sincronizado hace 2 h · 3 productos',
    onPress: jest.fn(),
  };

  it('defaults to "<name>, <subLabel>" when no override is given (every existing call site)', () => {
    const tree = BankRow(baseProps);
    expect(pressable(tree)?.props.accessibilityLabel).toBe(
      'Banco de Chile, Sincronizado hace 2 h · 3 productos',
    );
  });

  it('uses the override when provided, instead of the computed default', () => {
    const tree = BankRow({ ...baseProps, accessibilityLabel: 'Banco de Chile, Al día' });
    expect(pressable(tree)?.props.accessibilityLabel).toBe('Banco de Chile, Al día');
  });

  it('an error-status override ends with the error status label', () => {
    const tree = BankRow({ ...baseProps, accessibilityLabel: 'Banco de Chile, Error' });
    expect(pressable(tree)?.props.accessibilityLabel).toMatch(/Error$/);
  });
});
