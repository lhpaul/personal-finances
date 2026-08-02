import { Button } from '../components/ui/Button';
import { StatTile } from '../components/ui/StatTile';
import { componentMetrics, theme } from '../theme';

/**
 * Targeted regressions for findings from review that the pure-data test suite (theme parity,
 * style-literal scan, mu-class coverage) cannot see, because they are about which *token* a
 * component selects at render time, not whether a literal leaked outside `theme.ts`. Each test
 * calls the component function directly (no renderer — Decision 8) and inspects the returned,
 * unrendered element tree.
 */
describe('component style regressions', () => {
  it('Button size="sm" uses the mockup\'s .mu-btn--sm font-size (theme.typography.size.base), not the default 15', () => {
    const element = Button({ label: 'Pequeño', size: 'sm' }) as {
      props: { children: { props: { style: { fontSize: number } } } };
    };
    const textStyle = element.props.children.props.style;
    expect(textStyle.fontSize).toBe(theme.typography.size.base);
  });

  it('Button size="md" keeps componentMetrics.button.fontSize, not the sm override', () => {
    const element = Button({ label: 'Normal' }) as {
      props: { children: { props: { style: { fontSize: number } } } };
    };
    const textStyle = element.props.children.props.style;
    expect(textStyle.fontSize).toBe(componentMetrics.button.fontSize);
    expect(textStyle.fontSize).not.toBe(theme.typography.size.base);
  });

  it('StatTile\'s value line applies theme.typography.scale.amount.stat.lineHeight', () => {
    const element = StatTile({ tone: 'income', label: 'Ingresos', value: '3.7M' }) as {
      props: { children: unknown[] };
    };
    const valueText = element.props.children[1] as { props: { style: { lineHeight?: number } } };
    expect(valueText.props.style.lineHeight).toBe(theme.typography.scale.amount.stat.lineHeight);
  });
});
