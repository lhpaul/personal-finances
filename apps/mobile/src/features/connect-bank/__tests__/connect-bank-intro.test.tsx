import { collectElements } from '../../../test-utils/element-tree';
import { SecurityAccordion, type SecurityAccordionCopy } from '../components/SecurityAccordion';
import { verifyDefaultStateRendersCollapsed, verifyHowItWorksStateRendersSteps } from '../state-verifiers';

/**
 * `#screen=connect-bank-intro` (`default`, `how-it-works`) — implementation plan Testing
 * Strategy, AC28. Renderer-free element-tree inspection over `SecurityAccordion`, the one part
 * of this screen with real per-state structure; the rest of `connect-bank.tsx` is a fixed
 * composition with no conditional branch of its own.
 *
 * Added in review (CodeRabbit PR #80): before this file, `CONNECT_FLOW_STATE_COVERAGE`'s
 * `connect-bank-intro` entries pointed only at this file's own existence check, with no
 * assertion that either state's content actually renders — removing the `how-it-works` branch
 * from `SecurityAccordion` would not have failed anything. The two state-defining assertions
 * below now live in `../state-verifiers.ts` and are imported both here and by
 * `state-coverage.ts`, so removing or weakening either fails this file's own test too, not only
 * a separate residual check.
 */

const COPY: SecurityAccordionCopy = {
  toggleLabel: '¿Cómo funciona la conexión segura?',
  step1: 'Abrimos el sitio de tu banco dentro de la app, en tu teléfono.',
  step2: 'Tus credenciales se escriben en ese formulario y se guardan cifradas en el llavero del dispositivo.',
  step3: 'Leemos tus productos y movimientos y los guardamos localmente.',
};

describe('SecurityAccordion — default (collapsed)', () => {
  it('shows the toggle row and none of the three steps', verifyDefaultStateRendersCollapsed);

  it('is announced collapsed to assistive technology', () => {
    const tree = SecurityAccordion({ expanded: false, onToggle: jest.fn(), copy: COPY });
    const pressable = collectElements(tree, (el) => (el.props as { accessibilityRole?: string }).accessibilityRole === 'button')[0];
    expect(pressable?.props.accessibilityState).toEqual({ expanded: false });
  });
});

describe('SecurityAccordion — how-it-works (expanded)', () => {
  it('shows the toggle row and all three numbered steps, verbatim', verifyHowItWorksStateRendersSteps);

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
