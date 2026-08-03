/**
 * The residual-verification mechanism for AC28 ("every state declared in the manifest for the
 * four screens of this item renders") — implementation plan Testing Strategy, "State- and
 * catalogue-coverage residuals". For each of the four screens, every manifest `state_id` is
 * mapped to the source file that renders it and the test that asserts it.
 *
 * `connect-flow-state-coverage.test.ts` checks this list is *exhaustive* (matches the manifest's
 * own declared states exactly, in both directions) and that every named file exists — so
 * removing an entry here, or a state shipping in the manifest that this item never renders,
 * fails a test instead of silently passing AC28.
 */
export interface StateCoverageEntry {
  screenId: string;
  stateId: string;
  sourceFile: string;
  testFile: string;
}

export const CONNECT_FLOW_STATE_COVERAGE: StateCoverageEntry[] = [
  {
    screenId: 'connect-bank-intro',
    stateId: 'default',
    sourceFile: 'apps/mobile/app/(onboarding)/connect-bank.tsx',
    testFile: 'apps/mobile/src/__tests__/connect-flow-state-coverage.test.ts',
  },
  {
    screenId: 'connect-bank-intro',
    stateId: 'how-it-works',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/SecurityAccordion.tsx',
    testFile: 'apps/mobile/src/__tests__/connect-flow-state-coverage.test.ts',
  },
  {
    screenId: 'bank-picker',
    stateId: 'list',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
  },
  {
    screenId: 'bank-picker',
    stateId: 'search',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
  },
  {
    screenId: 'bank-picker',
    stateId: 'no-results',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/BankPickerResults.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-picker.test.tsx',
  },
  {
    screenId: 'bank-credentials',
    stateId: 'empty',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
  },
  {
    screenId: 'bank-credentials',
    stateId: 'filled',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
  },
  {
    screenId: 'bank-credentials',
    stateId: 'error',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
  },
  {
    screenId: 'bank-credentials',
    stateId: 'rut-locked',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/CredentialForm.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-credentials.test.tsx',
  },
  {
    screenId: 'bank-connected',
    stateId: 'single',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/ConnectedBankSummaryList.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-connected.test.tsx',
  },
  {
    screenId: 'bank-connected',
    stateId: 'multiple',
    sourceFile: 'apps/mobile/src/features/connect-bank/components/ConnectedBankSummaryList.tsx',
    testFile: 'apps/mobile/src/features/connect-bank/__tests__/bank-connected.test.tsx',
  },
];
