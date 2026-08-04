import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

import { elementTypeName } from '../../../test-utils/element-tree';
import { PROGRESS_FLOOR } from '../bank-syncing-state';
import { BankSyncingBody, type BankSyncingBodyCopy } from '../components/BankSyncingBody';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- element props/type vary by node
type AnyElement = import('react').ReactElement<any, any>;

/**
 * `element-tree.ts`'s `resolveComponents: true` mode resolves *every* function-typed node
 * uniformly, which crashes on `Progress` (it calls `useRef`/`useEffect`, and a bare function
 * call outside a real render has no dispatcher — found during implementation). This module's
 * own composition only needs to see inside its **own** hookless components — `SyncErrorState`,
 * `SyncProgressCard`, `SyncStepRow` — whose content is data-prop-driven rather than passed as
 * `children`; every design-system primitive they compose (`Badge`, `Button`, `Card`, `Note`,
 * `Progress`, `Text`) exposes what this suite needs as a **prop on the found element itself**
 * (`Badge.label`, `Button.label`, `Progress.value` …) or via ordinary `children`, so neither
 * needs resolving. An explicit allowlist, rather than "resolve everything", is what keeps this
 * safe.
 */
const RESOLVABLE_COMPONENT_NAMES = new Set(['SyncErrorState', 'SyncProgressCard', 'SyncStepRow']);

function isElement(node: unknown): node is AnyElement {
  return (
    node !== null &&
    typeof node === 'object' &&
    Object.prototype.hasOwnProperty.call(node, 'type') &&
    Object.prototype.hasOwnProperty.call(node, 'props')
  );
}

function collectElements(root: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  const found: AnyElement[] = [];

  function visit(node: ReactNode): void {
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!isElement(node)) return;

    if (predicate(node)) found.push(node);

    const typeName = typeof node.type === 'function' ? node.type.name : undefined;
    if (typeName !== undefined && RESOLVABLE_COMPONENT_NAMES.has(typeName)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see module doc comment
      visit((node.type as (props: any) => ReactNode)(node.props));
      return;
    }

    const children = (node.props as { children?: ReactNode } | undefined)?.children;
    if (children !== undefined) visit(children);
  }

  visit(root);
  return found;
}

/** Testing Strategy scenarios 19-20, 23 (implementation plan, issue #11). Every string below is
 * a unique sentinel so a stray literal or a mixed-up prop is unambiguous in a failure message —
 * `BankSyncingBody` calls no hook (Decision 8 precedent), so it stays directly callable here. */
const COPY: BankSyncingBodyCopy = {
  progressHeadline: 'COPY_PROGRESS_HEADLINE',
  progressBody: 'COPY_PROGRESS_BODY',
  progressAccessibilityLabel: 'COPY_PROGRESS_A11Y',
  stepLoginLabel: 'COPY_STEP_LOGIN',
  stepProductsLabel: 'COPY_STEP_PRODUCTS',
  stepTransactionsLabel: 'COPY_STEP_TRANSACTIONS',
  badgePendingLabel: 'COPY_BADGE_PENDING',
  badgeInProgressLabel: 'COPY_BADGE_IN_PROGRESS',
  badgeDoneLabel: 'COPY_BADGE_DONE',
  viewResultCta: 'COPY_VIEW_RESULT',
  errorHeadline: 'COPY_ERROR_HEADLINE',
  errorBody: 'COPY_ERROR_BODY',
  errorDangerNote: 'COPY_ERROR_DANGER_NOTE',
  retryCta: 'COPY_RETRY',
  chooseOtherBankCta: 'COPY_CHOOSE_OTHER_BANK',
};

const KNOWN_TEXT_VALUES = new Set<string>([...Object.values(COPY), '🔄', '⚠️', '✅', '⏳', '💡']);

function textNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Text');
}

function badgeNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Badge');
}

function buttonNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Button');
}

function noteNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Note');
}

function progressNodes(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Progress');
}

function baseProps() {
  return {
    progressValue: 0,
    indeterminate: false,
    ctaEnabled: false,
    onViewResult: jest.fn(),
    onRetry: jest.fn(),
    onChooseOtherBank: jest.fn(),
    copy: COPY,
  };
}

describe('BankSyncingBody — login/products/transactions (scenario 19; non-negotiable 6)', () => {
  it.each(['login', 'products', 'transactions'] as const)(
    '%s: draws the 🔄 headline block, the bar and all three step rows',
    (state) => {
      const tree = BankSyncingBody({ ...baseProps(), state, progressValue: PROGRESS_FLOOR[state] });

      const texts = textNodes(tree).map((el) => el.props.children);
      expect(texts).toContain('🔄');
      expect(texts).toContain(COPY.progressHeadline);
      expect(texts).toContain(COPY.progressBody);
      expect(texts).toContain(COPY.stepLoginLabel);
      expect(texts).toContain(COPY.stepProductsLabel);
      expect(texts).toContain(COPY.stepTransactionsLabel);

      // Every state draws all three badges — one per row, whichever status each is in.
      expect(badgeNodes(tree)).toHaveLength(3);

      // The bar itself: exactly one Progress, floored at this state's mockup width, not
      // indeterminate once a real value is known.
      const progress = progressNodes(tree);
      expect(progress).toHaveLength(1);
      expect(progress[0]?.props.value).toBeCloseTo(PROGRESS_FLOOR[state]);
      expect(progress[0]?.props.indeterminate).toBe(false);
      expect(progress[0]?.props.accessibilityLabel).toBe(COPY.progressAccessibilityLabel);
    },
  );

  it('the "starting" phase renders the bar indeterminate rather than a fabricated 0.25 (Decision 3)', () => {
    const tree = BankSyncingBody({ ...baseProps(), state: 'login', indeterminate: true });
    expect(progressNodes(tree)[0]?.props.indeterminate).toBe(true);
  });

  it('transactions: draws the "Ver resultado" CTA, disabled until the read finalizes (Assumption A2)', () => {
    const disabledTree = BankSyncingBody({ ...baseProps(), state: 'transactions', ctaEnabled: false });
    const disabledButtons = buttonNodes(disabledTree);
    expect(disabledButtons).toHaveLength(1);
    expect(disabledButtons[0]?.props.label).toBe(COPY.viewResultCta);
    expect(disabledButtons[0]?.props.disabled).toBe(true);

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
      const tree = BankSyncingBody({ ...baseProps(), state });
      expect(noteNodes(tree)).toHaveLength(0);
      const texts = textNodes(tree).map((el) => el.props.children);
      expect(texts).not.toContain('⚠️');
      expect(texts).not.toContain(COPY.errorHeadline);
    }
  });
});

describe('BankSyncingBody — error (scenario 19; non-negotiable 6; brief AC2)', () => {
  it('draws ⚠️, the title, the per-code body, the danger note and both buttons', () => {
    const tree = BankSyncingBody({ ...baseProps(), state: 'error' });

    const texts = textNodes(tree).map((el) => el.props.children);
    expect(texts).toContain('⚠️');
    expect(texts).toContain(COPY.errorHeadline);
    expect(texts).toContain(COPY.errorBody);

    const notes = noteNodes(tree);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.props.children).toBe(COPY.errorDangerNote);
    expect(notes[0]?.props.tone).toBe('danger');

    const buttons = buttonNodes(tree);
    expect(buttons.map((button) => button.props.label)).toEqual([COPY.retryCta, COPY.chooseOtherBankCta]);
  });

  it('draws no progress card, no bar and no step rows', () => {
    const tree = BankSyncingBody({ ...baseProps(), state: 'error' });
    expect(badgeNodes(tree)).toHaveLength(0);
    const texts = textNodes(tree).map((el) => el.props.children);
    expect(texts).not.toContain('🔄');
    expect(texts).not.toContain(COPY.progressHeadline);
  });

  it('Reintentar and Elegir otro banco call their own callbacks, not each other\'s', () => {
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
    '%s: every rendered Text/Badge string is either a decorative glyph or a value from `copy`',
    (state) => {
      const tree = BankSyncingBody({ ...baseProps(), state, ctaEnabled: true });
      const texts = textNodes(tree).map((el) => el.props.children);
      const badgeLabels = badgeNodes(tree).map((el) => el.props.label as string);
      const buttonLabels = buttonNodes(tree).map((el) => el.props.label as string);

      for (const value of [...texts, ...badgeLabels, ...buttonLabels]) {
        expect(KNOWN_TEXT_VALUES.has(value as string)).toBe(true);
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
