import { collectElements, elementTypeName } from '../../test-utils/element-tree';
import { PROGRESS_FLOOR } from './bank-syncing-state';
import { BankSyncingBody, type BankSyncingBodyCopy } from './components/BankSyncingBody';

/**
 * Real, executable per-state assertions for Decision 13's state-coverage residual
 * (implementation plan Testing Strategy, issue #11), shared by exact function reference between
 * `bank-syncing-screen.test.tsx`'s own `it(...)` calls and `state-coverage.ts`'s
 * `BANK_SYNCING_STATE_COVERAGE` registry — mirrors item #9's `state-verifiers.ts` shape exactly,
 * including why this file is **not** `*.test.ts` and **not** under `__tests__/` (a static
 * `import` of a file with its own top-level `describe`/`it` would re-execute those blocks a
 * second time under whichever suite imported it).
 */

const RESOLVABLE_COMPONENT_NAMES = new Set(['SyncErrorState', 'SyncProgressCard', 'SyncStepRow']);
function resolveComponents(typeName: string): boolean {
  return RESOLVABLE_COMPONENT_NAMES.has(typeName);
}

export const BANK_SYNCING_SCREEN_COPY: BankSyncingBodyCopy = {
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

function baseProps() {
  return {
    progressValue: 0,
    indeterminate: false,
    ctaEnabled: false,
    onViewResult: jest.fn(),
    onRetry: jest.fn(),
    onChooseOtherBank: jest.fn(),
    copy: BANK_SYNCING_SCREEN_COPY,
  };
}

function textValues(tree: ReturnType<typeof BankSyncingBody>): unknown[] {
  return collectElements(tree, (el) => elementTypeName(el) === 'Text', { resolveComponents }).map(
    (el) => el.props.children,
  );
}

function badgeCount(tree: ReturnType<typeof BankSyncingBody>): number {
  return collectElements(tree, (el) => elementTypeName(el) === 'Badge', { resolveComponents }).length;
}

function progressProps(tree: ReturnType<typeof BankSyncingBody>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Progress', { resolveComponents })[0]?.props;
}

function buttonLabels(tree: ReturnType<typeof BankSyncingBody>): unknown[] {
  return collectElements(tree, (el) => elementTypeName(el) === 'Button', { resolveComponents }).map(
    (el) => el.props.label,
  );
}

/** `#screen=bank-syncing&state=login`. */
export function verifyLoginStateRendersProgressCard(): void {
  const tree = BankSyncingBody({ ...baseProps(), state: 'login', progressValue: PROGRESS_FLOOR.login });
  const texts = textValues(tree);
  expect(texts).toContain('🔄');
  expect(texts).toContain(BANK_SYNCING_SCREEN_COPY.progressHeadline);
  expect(texts).toContain(BANK_SYNCING_SCREEN_COPY.stepLoginLabel);
  expect(badgeCount(tree)).toBe(3);
  expect(progressProps(tree)?.value).toBeCloseTo(PROGRESS_FLOOR.login);
  expect(buttonLabels(tree)).toEqual([]);
}

/** `#screen=bank-syncing&state=products`. */
export function verifyProductsStateRendersProgressCard(): void {
  const tree = BankSyncingBody({ ...baseProps(), state: 'products', progressValue: PROGRESS_FLOOR.products });
  const texts = textValues(tree);
  expect(texts).toContain(BANK_SYNCING_SCREEN_COPY.stepProductsLabel);
  expect(badgeCount(tree)).toBe(3);
  expect(progressProps(tree)?.value).toBeCloseTo(PROGRESS_FLOOR.products);
  expect(buttonLabels(tree)).toEqual([]);
}

/** `#screen=bank-syncing&state=transactions`. */
export function verifyTransactionsStateRendersProgressCardAndCta(): void {
  const tree = BankSyncingBody({
    ...baseProps(),
    state: 'transactions',
    progressValue: PROGRESS_FLOOR.transactions,
    ctaEnabled: true,
  });
  const texts = textValues(tree);
  expect(texts).toContain(BANK_SYNCING_SCREEN_COPY.stepTransactionsLabel);
  expect(badgeCount(tree)).toBe(3);
  expect(progressProps(tree)?.value).toBeCloseTo(PROGRESS_FLOOR.transactions);
  expect(buttonLabels(tree)).toEqual([BANK_SYNCING_SCREEN_COPY.viewResultCta]);
}

/** `#screen=bank-syncing&state=error`. */
export function verifyErrorStateRendersFailureAndButtons(): void {
  const tree = BankSyncingBody({ ...baseProps(), state: 'error' });
  const texts = textValues(tree);
  expect(texts).toContain('⚠️');
  expect(texts).toContain(BANK_SYNCING_SCREEN_COPY.errorHeadline);
  expect(texts).toContain(BANK_SYNCING_SCREEN_COPY.errorBody);
  expect(badgeCount(tree)).toBe(0);
  expect(buttonLabels(tree)).toEqual([BANK_SYNCING_SCREEN_COPY.retryCta, BANK_SYNCING_SCREEN_COPY.chooseOtherBankCta]);
}
