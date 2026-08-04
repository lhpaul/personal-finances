import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { SecurityAccordion, type SecurityAccordionCopy } from '../components/SecurityAccordion';

/**
 * `#screen=connect-bank-intro` (`default`, `how-it-works`) — implementation plan Testing
 * Strategy, AC28. Renderer-free element-tree inspection over `SecurityAccordion`, the one part
 * of this screen with real per-state structure; the rest of `connect-bank.tsx` is a fixed
 * composition with no conditional branch of its own.
 *
 * Added in review (CodeRabbit PR #80): before this file, `CONNECT_FLOW_STATE_COVERAGE`'s
 * `connect-bank-intro` entries pointed only at this file's own existence check, with no
 * assertion that either state's content actually renders — removing the `how-it-works` branch
 * from `SecurityAccordion` would not have failed anything.
 */

const COPY: SecurityAccordionCopy = {
  toggleLabel: '¿Cómo funciona la conexión segura?',
  step1: 'Abrimos el sitio de tu banco dentro de la app, en tu teléfono.',
  step2: 'Tus credenciales se escriben en ese formulario y se guardan cifradas en el llavero del dispositivo.',
  step3: 'Leemos tus productos y movimientos y los guardamos localmente.',
};

describe('SecurityAccordion — default (collapsed)', () => {
  it('shows the toggle row and none of the three steps', () => {
    const tree = SecurityAccordion({ expanded: false, onToggle: jest.fn(), copy: COPY });
    const texts = collectElements(tree, (el) => elementTypeName(el) === 'Text').map(
      (el) => el.props.children,
    );
    expect(texts).toContain(COPY.toggleLabel);
    expect(texts).not.toContain(COPY.step1);
    expect(collectElements(tree, (el) => elementTypeName(el) === 'Badge')).toHaveLength(0);
  });

  it('is announced collapsed to assistive technology', () => {
    const tree = SecurityAccordion({ expanded: false, onToggle: jest.fn(), copy: COPY });
    const pressable = collectElements(tree, (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === 'button')[0];
    expect(pressable?.props.accessibilityState).toEqual({ expanded: false });
  });
});

describe('SecurityAccordion — how-it-works (expanded)', () => {
  it('shows the toggle row and all three numbered steps, verbatim', () => {
    const tree = SecurityAccordion({ expanded: true, onToggle: jest.fn(), copy: COPY });
    const texts = collectElements(tree, (el) => elementTypeName(el) === 'Text').map(
      (el) => el.props.children,
    );
    expect(texts).toContain(COPY.toggleLabel);
    expect(texts).toContain(COPY.step1);
    expect(texts).toContain(COPY.step2);
    expect(texts).toContain(COPY.step3);

    const badges = collectElements(tree, (el) => elementTypeName(el) === 'Badge');
    expect(badges.map((badge) => badge.props.label)).toEqual(['1', '2', '3']);
  });

  it('is announced expanded to assistive technology', () => {
    const tree = SecurityAccordion({ expanded: true, onToggle: jest.fn(), copy: COPY });
    const pressable = collectElements(tree, (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === 'button')[0];
    expect(pressable?.props.accessibilityState).toEqual({ expanded: true });
  });

  it('tapping the toggle calls onToggle', () => {
    const onToggle = jest.fn();
    const tree = SecurityAccordion({ expanded: false, onToggle, copy: COPY });
    const pressable = collectElements(tree, (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === 'button')[0];
    pressable?.props.onPress();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
