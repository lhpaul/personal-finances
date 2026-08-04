import {
  verifyBankReviewErrorState,
  verifyBankReviewOkState,
  verifySettingsBanksDisconnectConfirmState,
  verifySettingsBanksEmptyState,
  verifySettingsBanksListState,
} from './state-verifiers';

/**
 * The residual-verification mechanism for "every manifest state of both screens is implemented"
 * (implementation plan for issue #20, non-negotiable 6, Testing Strategy Scenario 20). Mirrors
 * item #9's `CONNECT_FLOW_STATE_COVERAGE` / `state-verifiers.ts` split: `verify` is not a
 * description of an assertion — it **is** the assertion, imported by exact function reference,
 * shared between this registry and this feature's own test file's `it(...)` calls.
 *
 * `state-coverage.test.ts` additionally checks this list is *exhaustive* (matches the manifest's
 * own declared states for `settings-banks` and `bank-review` exactly, in both directions) and
 * that every named `sourceFile` exists.
 */
export interface BanksStateCoverageEntry {
  screenId: 'settings-banks' | 'bank-review';
  stateId: string;
  sourceFile: string;
  testFile: string;
  verify: () => void;
}

export const BANKS_STATE_COVERAGE: BanksStateCoverageEntry[] = [
  {
    screenId: 'settings-banks',
    stateId: 'list',
    sourceFile: 'apps/mobile/app/settings/banks/index.tsx',
    testFile: 'apps/mobile/src/features/banks/__tests__/state-coverage.test.ts',
    verify: verifySettingsBanksListState,
  },
  {
    screenId: 'settings-banks',
    stateId: 'empty',
    sourceFile: 'apps/mobile/app/settings/banks/index.tsx',
    testFile: 'apps/mobile/src/features/banks/__tests__/state-coverage.test.ts',
    verify: verifySettingsBanksEmptyState,
  },
  {
    screenId: 'settings-banks',
    stateId: 'disconnect-confirm',
    sourceFile: 'apps/mobile/app/settings/banks/index.tsx',
    testFile: 'apps/mobile/src/features/banks/__tests__/state-coverage.test.ts',
    verify: verifySettingsBanksDisconnectConfirmState,
  },
  {
    screenId: 'bank-review',
    stateId: 'ok',
    sourceFile: 'apps/mobile/app/settings/banks/[bankId].tsx',
    testFile: 'apps/mobile/src/features/banks/__tests__/state-coverage.test.ts',
    verify: verifyBankReviewOkState,
  },
  {
    screenId: 'bank-review',
    stateId: 'error',
    sourceFile: 'apps/mobile/app/settings/banks/[bankId].tsx',
    testFile: 'apps/mobile/src/features/banks/__tests__/state-coverage.test.ts',
    verify: verifyBankReviewErrorState,
  },
];
