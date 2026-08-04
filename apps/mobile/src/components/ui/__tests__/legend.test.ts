import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { findNakedText } from '../../../test-utils/naked-text-scan';
import { Legend, type LegendProps } from '../Legend';
import { Text } from '../Text';

/** Scenario 20 of the dashboard implementation plan's Testing Strategy (issue #17, Decision 8)
 * — `Legend`'s additive widening (the optional `value` slot). `Legend` calls no hook, so it is
 * exercised the same renderer-free way `TopBar.test.tsx` exercises `TopBar`. */
function texts(tree: ReturnType<typeof Legend>) {
  return collectElements(tree, (el) => el.type === Text);
}

describe('Legend — pre-#17 call sites (no value on any item) render unchanged', () => {
  const props: LegendProps = {
    items: [
      { color: '#10b981', label: 'Ingresos' },
      { color: '#cbd5e1', label: 'Mes anterior' },
    ],
  };

  it('renders the row layout: one dot + label pair per item, no value text', () => {
    const tree = Legend(props);
    const root = collectElements(tree, () => true)[0];
    expect(root && elementTypeName(root)).toBe('View');
    expect(root?.props.style?.flexDirection).toBe('row');

    const labelTexts = texts(tree);
    expect(labelTexts.map((el) => el.props.children)).toEqual(['Ingresos', 'Mes anterior']);
  });
});

describe('Legend — value slot (issue #17 category report)', () => {
  const props: LegendProps = {
    items: [
      { color: '#6366f1', label: '🍔 Comida', value: '20,6%' },
      { color: '#f59e0b', label: '📦 Compras', value: '17,4%' },
    ],
  };

  it('switches to the column layout and renders both the name and the value per row', () => {
    const tree = Legend(props);
    const root = collectElements(tree, () => true)[0];
    expect(root?.props.style?.flexDirection).toBe('column');

    const labelTexts = texts(tree);
    const rendered = labelTexts.map((el) => el.props.children);
    expect(rendered).toEqual(['🍔 Comida', '20,6%', '📦 Compras', '17,4%']);
  });

  it('never lands a string as a bare child of a non-text host (Scenario 19)', () => {
    expect(findNakedText(Legend(props), new Set([Text]))).toEqual([]);
  });
});
