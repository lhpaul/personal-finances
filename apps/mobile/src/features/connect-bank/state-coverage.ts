/**
 * The residual-verification mechanism for AC28 ("every state declared in the manifest for the
 * four screens of this item renders") — implementation plan Testing Strategy, "State- and
 * catalogue-coverage residuals". For each of the four screens, every manifest `state_id` is
 * mapped to the source file that renders it, the test that asserts it, and (found in review —
 * CodeRabbit PR #80) a literal string that must still appear in that test file's source.
 *
 * `connect-flow-state-coverage.test.ts` checks this list is *exhaustive* (matches the manifest's
 * own declared states exactly, in both directions), that every named file exists, and that every
 * `assertionKeyword` is still present in its `testFile` — so removing an entry here, a state
 * shipping in the manifest that this item never renders, or **deleting the describe block that
 * actually asserts a state's content** all fail a test instead of silently passing AC28.
 *
 * `assertionKeyword` is each state's own `describe(...)` title (or an assertion line tight
 * enough to be state-specific) — a real, content-bearing string, not a generic file-existence
 * check. This narrows, but does not close, the original gap: a source change that silently
 * defeats a *still-present* assertion (rather than removing the describe block itself) is not
 * caught by a keyword scan. Full state-specific rendering assertions for every entry remain a
 * "Heavy lift" per CodeRabbit's own classification; this is the proportionate middle ground.
 */
export interface StateCoverageEntry {
  screenId: string;
  stateId: string;
  sourceFile: string;
  testFile: string;
  assertionKeyword: string;
}

export const CONNECT_FLOW_STATE_COVERAGE: StateCoverageEntry[] = [
  {
    screenId: 'connect-bank-intro',
    stateId: 'default',
    sourceFile: 'apps/mobile/app/(onboarding)/connect-bank.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/connect-bank-intro.test.tsx',
    assertionKeyword: 'SecurityAccordion — default (collapsed)',
  },
  {
    screenId: 'connect-bank-intro',
    stateId: 'how-it-works',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/SecurityAccordion.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/connect-bank-intro.test.tsx',
    assertionKeyword: 'SecurityAccordion — how-it-works (expanded)',
  },
  {
    screenId: 'bank-picker',
    stateId: 'list',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
    assertionKeyword: 'BankPickerResults — list (AC7, AC8)',
  },
  {
    screenId: 'bank-picker',
    stateId: 'search',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
    assertionKeyword: 'BankPickerResults — search (AC10, AC11)',
  },
  {
    screenId: 'bank-picker',
    stateId: 'no-results',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
    assertionKeyword: 'BankPickerResults — no-results (AC12)',
  },
  {
    screenId: 'bank-credentials',
    stateId: 'empty',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
    assertionKeyword: 'CredentialForm — empty / filled (AC13, AC15)',
  },
  {
    screenId: 'bank-credentials',
    stateId: 'filled',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
    assertionKeyword: 'the connect button is enabled once canConnect is true',
  },
  {
    screenId: 'bank-credentials',
    stateId: 'error',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
    assertionKeyword: 'CredentialForm — error (AC16)',
  },
  {
    screenId: 'bank-credentials',
    stateId: 'rut-locked',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
    assertionKeyword: 'CredentialForm — rut-locked (AC18)',
  },
  {
    screenId: 'bank-connected',
    stateId: 'single',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/ConnectedBankSummaryList.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-connected.test.tsx',
    assertionKeyword: 'ConnectedBankSummaryList — single (AC24)',
  },
  {
    screenId: 'bank-connected',
    stateId: 'multiple',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/ConnectedBankSummaryList.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-connected.test.tsx',
    assertionKeyword: 'ConnectedBankSummaryList — multiple (AC25)',
  },
];
