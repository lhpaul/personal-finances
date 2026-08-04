import fs from 'node:fs';
import path from 'node:path';

import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { PROGRESS_FLOOR } from '../bank-syncing-state';
import { BankSyncingBody } from '../components/BankSyncingBody';
import {
  BANK_SYNCING_SCREEN_COPY as COPY,
  baseProps,
  resolveComponents,
  verifyErrorStateRendersFailureAndButtons,
  verifyLoginStateRendersProgressCard,
  verifyProductsStateRendersProgressCard,
  verifyTransactionsStateRendersProgressCardAndCta,
} from '../state-verifiers';

/** Testing Strategy scenarios 19-20, 23 (implementation plan, issue #11). Every string in
 * `BANK_SYNCING_SCREEN_COPY` (`state-verifiers.ts`) is a unique sentinel so a stray literal or a
 * mixed-up prop is unambiguous in a failure message — `BankSyncingBody` calls no hook (Decision
 * 8 precedent), so it stays directly callable here. `resolveComponents` / `baseProps` are
 * imported from `state-verifiers.ts` rather than re-declared here (found in review — CodeRabbit
 * PR #85): a second, independent copy of the resolvable-component allowlist could silently drift
 * from the shared one if a future sub-component were added to `BankSyncingBody`. */

const KNOWN_TEXT_VALUES = new Set<string>([...Object.values(COPY), '🔄', '⚠️', '✅', '⏳', '💡']);

function textNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Text', { resolveComponents });
}

function badgeNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Badge', { resolveComponents });
}

function buttonNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Button', { resolveComponents });
}

function noteNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Note', { resolveComponents });
}

function progressNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Progress', { resolveComponents });
}

describe('BankSyncingBody — all four manifest states (scenario 19; non-negotiable 6)', () => {
  it('login: draws the 🔄 headline block, the bar floored at 0.25 and all three step rows', verifyLoginStateRendersProgressCard);
  it('products: draws the bar floored at 0.6 and the products row', verifyProductsStateRendersProgressCard);
  it(
    'transactions: draws the bar floored at 0.9 and the "Ver resultado" CTA',
    verifyTransactionsStateRendersProgressCardAndCta,
  );
  it('error: draws ⚠️, the title, the per-code body, the danger note and both buttons', verifyErrorStateRendersFailureAndButtons);

  it('the "starting" phase renders the bar indeterminate rather than a fabricated 0.25 (Decision 3)', () => {
    const tree = BankSyncingBody({ ...baseProps(), state: 'login', indeterminate: true });
    expect(progressNodes(tree)[0]?.props.indeterminate).toBe(true);
  });

  it('transactions: the CTA is disabled until ctaEnabled is true (Assumption A2)', () => {
    const disabledTree = BankSyncingBody({ ...baseProps(), state: 'transactions', ctaEnabled: false });
    expect(buttonNodes(disabledTree)[0]?.props.disabled).toBe(true);

    const enabledTree = BankSyncingBody({ ...baseProps(), state: 'transactions', ctaEnabled: true });
    expect(buttonNodes(enabledTree)[0]?.props.disabled).toBe(false);
  });

  it('login/products draw no CTA button at all', () => {
    for (const state of ['login', 'products'] as const) {
      const tree = BankSyncingBody({ ...baseProps(), state });
      expect(buttonNodes(tree)).toHaveLength(0);
    }
  });

  it('login/products/transactions draw no error block', () => {
    for (const state of ['login', 'products', 'transactions'] as const) {
      const tree = BankSyncingBody({ ...baseProps(), state, progressValue: PROGRESS_FLOOR[state] });
      expect(noteNodes(tree)).toHaveLength(0);
      const texts = textNodes(tree).map((el) => el.props.children);
      expect(texts).not.toContain('⚠️');
      expect(texts).not.toContain(COPY.errorHeadline);
    }
  });

  it('error draws no progress card, no bar and no step rows', () => {
    const tree = BankSyncingBody({ ...baseProps(), state: 'error' });
    expect(badgeNodes(tree)).toHaveLength(0);
    expect(progressNodes(tree)).toHaveLength(0);
    const texts = textNodes(tree).map((el) => el.props.children);
    expect(texts).not.toContain('🔄');
    expect(texts).not.toContain(COPY.progressHeadline);
  });

  it("error: Reintentar and Elegir otro banco call their own callbacks, not each other's", () => {
    const onRetry = jest.fn();
    const onChooseOtherBank = jest.fn();
    const tree = BankSyncingBody({ ...baseProps(), state: 'error', onRetry, onChooseOtherBank });
    const buttons = buttonNodes(tree);

    buttons[0]?.props.onPress();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onChooseOtherBank).not.toHaveBeenCalled();

    buttons[1]?.props.onPress();
    expect(onChooseOtherBank).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('BankSyncingBody — no literal strings (scenario 20; non-negotiable 8)', () => {
  it.each(['login', 'products', 'transactions', 'error'] as const)(
    '%s: every rendered Text/Badge/Button string is either a decorative glyph or a value from `copy`',
    (state) => {
      const tree = BankSyncingBody({ ...baseProps(), state, ctaEnabled: true });
      const texts = textNodes(tree).map((el) => el.props.children);
      const badgeLabels = badgeNodes(tree).map((el) => el.props.label as string);
      const buttonLabels = buttonNodes(tree).map((el) => el.props.label as string);

      for (const value of [...texts, ...badgeLabels, ...buttonLabels]) {
        // `toContain` (rather than `.has(...).toBe(true)`) names the offending literal directly
        // in the failure message (found in review — CodeRabbit PR #85).
        expect([...KNOWN_TEXT_VALUES]).toContain(value as string);
      }
    },
  );
});

describe('scenario 23: apps/mobile/app/_layout.tsx contains no StrictMode (Decision 4)', () => {
  it('the root layout does not enable React.StrictMode', () => {
    const layoutPath = path.resolve(__dirname, '..', '..', '..', '..', 'app', '_layout.tsx');
    const source = fs.readFileSync(layoutPath, 'utf8');
    expect(source).not.toContain('StrictMode');
  });
});
