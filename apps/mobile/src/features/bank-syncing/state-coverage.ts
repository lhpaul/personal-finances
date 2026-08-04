import {
  verifyErrorStateRendersFailureAndButtons,
  verifyLoginStateRendersProgressCard,
  verifyProductsStateRendersProgressCard,
  verifyTransactionsStateRendersProgressCardAndCta,
} from './state-verifiers';

/**
 * The residual-verification mechanism for "every state the `bank-syncing` screen declares is
 * implemented" (implementation plan Decision 13, issue #11). For each of the four manifest
 * `state_id`s: the source file that renders it and the test that asserts it. `verify` is not a
 * description of an assertion — it **is** the assertion, imported by exact function reference
 * from `./state-verifiers.ts`, where it is also the callback
 * `bank-syncing-screen.test.tsx` passes to its own `it(...)` (mirrors item #9's
 * `CONNECT_FLOW_STATE_COVERAGE` / `state-verifiers.ts` split exactly). Sharing one function
 * object between the feature's own test and this residual check means weakening or deleting an
 * assertion fails both identically — there is no way to keep one green while breaking the other.
 *
 * `state-coverage.test.ts` additionally checks this list is *exhaustive* (matches the manifest's
 * own declared states exactly, in both directions) and that every named file exists.
 */
export interface StateCoverageEntry {
  stateId: string;
  sourceFile: string;
  testFile: string;
  verify: () => void;
}

export const BANK_SYNCING_STATE_COVERAGE: StateCoverageEntry[] = [
  {
    stateId: 'login',
    sourceFile: 'apps/mobile/src/features/bank-syncing/components/SyncProgressCard.tsx',
    testFile: 'apps/mobile/src/features/bank-syncing/__tests__/bank-syncing-screen.test.tsx',
    verify: verifyLoginStateRendersProgressCard,
  },
  {
    stateId: 'products',
    sourceFile: 'apps/mobile/src/features/bank-syncing/components/SyncProgressCard.tsx',
    testFile: 'apps/mobile/src/features/bank-syncing/__tests__/bank-syncing-screen.test.tsx',
    verify: verifyProductsStateRendersProgressCard,
  },
  {
    stateId: 'transactions',
    sourceFile: 'apps/mobile/src/features/bank-syncing/components/SyncProgressCard.tsx',
    testFile: 'apps/mobile/src/features/bank-syncing/__tests__/bank-syncing-screen.test.tsx',
    verify: verifyTransactionsStateRendersProgressCardAndCta,
  },
  {
    stateId: 'error',
    sourceFile: 'apps/mobile/src/features/bank-syncing/components/SyncErrorState.tsx',
    testFile: 'apps/mobile/src/features/bank-syncing/__tests__/bank-syncing-screen.test.tsx',
    verify: verifyErrorStateRendersFailureAndButtons,
  },
];
