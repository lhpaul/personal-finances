import {
  verifyDefaultStateRendersCollapsed,
  verifyEmptyStateMasksPasswordAndDisablesConnect,
  verifyErrorStateShowsGenericRejection,
  verifyFilledStateEnablesConnect,
  verifyHowItWorksStateRendersSteps,
  verifyListStateShowsBothRows,
  verifyMultipleStateShowsAllRows,
  verifyNoResultsStateShowsEmptyState,
  verifyRutLockedStateLocksRutField,
  verifySearchStateNarrowsResults,
  verifySingleStateShowsOneRow,
} from './state-verifiers';

/**
 * The residual-verification mechanism for AC28 ("every state declared in the manifest for the
 * four screens of this item renders") — implementation plan Testing Strategy, "State- and
 * catalogue-coverage residuals".
 *
 * Each entry's `verify` is not a description of an assertion — it **is** the assertion,
 * imported by exact function reference from `./state-verifiers.ts`, where it is also the
 * callback the feature's own test file passes to its own `it(...)`.
 * `connect-flow-state-coverage.test.ts` calls this same function object again.
 * `state-verifiers.ts` deliberately lives outside `__tests__/` and is not itself a `*.test.ts`
 * file: a static `import` of a file containing top-level `describe`/`it` calls re-executes them
 * under whichever test file did the importing, which would have silently double-registered every
 * state's own test the moment this registry imported it.
 * Found in review (CodeRabbit PR #80): an earlier version of this
 * mechanism only scanned each `testFile`'s source text for a literal `describe`/`it` title
 * string — a title staying in the source proves nothing about whether the assertions inside its
 * body still run, or still assert anything real. A `describe` block can keep its title while
 * every `expect(...)` inside it is deleted or weakened, and a text scan would not notice.
 * Sharing one function object between two call sites closes that gap completely: there is
 * exactly one implementation of each state's assertion, so weakening or deleting it fails BOTH
 * the feature's own test and this residual check identically — there is no way to keep one
 * green while breaking the other.
 *
 * `connect-flow-state-coverage.test.ts` additionally checks this list is *exhaustive* (matches
 * the manifest's own declared states exactly, in both directions) and that every named
 * `sourceFile` exists.
 */
export interface StateCoverageEntry {
  screenId: string;
  stateId: string;
  sourceFile: string;
  testFile: string;
  verify: () => void;
}

export const CONNECT_FLOW_STATE_COVERAGE: StateCoverageEntry[] = [
  {
    screenId: 'connect-bank-intro',
    stateId: 'default',
    sourceFile: 'apps/mobile/app/(onboarding)/connect-bank.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/connect-bank-intro.test.tsx',
    verify: verifyDefaultStateRendersCollapsed,
  },
  {
    screenId: 'connect-bank-intro',
    stateId: 'how-it-works',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/SecurityAccordion.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/connect-bank-intro.test.tsx',
    verify: verifyHowItWorksStateRendersSteps,
  },
  {
    screenId: 'bank-picker',
    stateId: 'list',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
    verify: verifyListStateShowsBothRows,
  },
  {
    screenId: 'bank-picker',
    stateId: 'search',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
    verify: verifySearchStateNarrowsResults,
  },
  {
    screenId: 'bank-picker',
    stateId: 'no-results',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
    verify: verifyNoResultsStateShowsEmptyState,
  },
  {
    screenId: 'bank-credentials',
    stateId: 'empty',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
    verify: verifyEmptyStateMasksPasswordAndDisablesConnect,
  },
  {
    screenId: 'bank-credentials',
    stateId: 'filled',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
    verify: verifyFilledStateEnablesConnect,
  },
  {
    screenId: 'bank-credentials',
    stateId: 'error',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
    verify: verifyErrorStateShowsGenericRejection,
  },
  {
    screenId: 'bank-credentials',
    stateId: 'rut-locked',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
    verify: verifyRutLockedStateLocksRutField,
  },
  {
    screenId: 'bank-connected',
    stateId: 'single',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/ConnectedBankSummaryList.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-connected.test.tsx',
    verify: verifySingleStateShowsOneRow,
  },
  {
    screenId: 'bank-connected',
    stateId: 'multiple',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/ConnectedBankSummaryList.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-connected.test.tsx',
    verify: verifyMultipleStateShowsAllRows,
  },
];
