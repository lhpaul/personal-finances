import fs from 'node:fs';
import path from 'node:path';

import { resolveBankReviewState, resolveConnectionListItem } from './connection-view';
import type { BankConnectionSummary } from '../../db/types';

/**
 * State-specific assertions for `BANKS_STATE_COVERAGE` (implementation plan for issue #20,
 * Testing Strategy). This codebase's own presentational components call `useTranslation()`
 * directly (`ConnectedBanksCard`, `SyncErrorNote`, `DetailHeroCard`, …) and are never invoked as
 * plain functions outside a render — there is no `react-test-renderer` /
 * `@testing-library/react-native` dependency anywhere in this repo, and no other feature renders
 * a hook-using component this way (verified: `grep -rl "@testing-library/react-native"
 * apps/mobile/src` finds nothing). Each `verify()` below instead combines a pure-logic assertion
 * (the same functions the route calls) with a source-text check that the route actually wires the
 * component/branch for that state — the same "wiring, not rendering" pattern
 * `fidelity-wiring.test.ts` and `no-secure-store-import.test.ts` already use in this codebase.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SETTINGS_BANKS_ROUTE = path.resolve(REPO_ROOT, 'apps/mobile/app/settings/banks/index.tsx');
const BANK_REVIEW_ROUTE = path.resolve(REPO_ROOT, 'apps/mobile/app/settings/banks/[bankId].tsx');

function readRoute(routePath: string): string {
  return fs.readFileSync(routePath, 'utf8');
}

function activeConnection(overrides: Partial<BankConnectionSummary> = {}): BankConnectionSummary {
  return {
    id: 'conn-1',
    institutionId: 'banco-de-chile',
    name: 'Banco de Chile',
    shortName: 'BCH',
    brandColor: '#003da5', // style-literal-allow: fixture data (financial_institutions seed value), not a style prop
    logoUrl: undefined,
    status: 'active',
    syncStatus: 'ok',
    lastSyncAt: '2026-02-10T10:00:00.000Z',
    lastSuccessAt: '2026-02-10T10:00:00.000Z',
    lastErrorCode: null,
    lastErrorMessage: null,
    productCount: 3,
    ...overrides,
  };
}

export function verifySettingsBanksListState(): void {
  const item = resolveConnectionListItem(activeConnection(), new Date('2026-02-10T12:00:00.000Z'), 'es');
  if (item.subLabel.kind !== 'composed') throw new Error('list state must compose row_subtitle');

  const source = readRoute(SETTINGS_BANKS_ROUTE);
  if (!source.includes('ConnectedBankRow')) throw new Error('settings-banks route must render ConnectedBankRow');
  if (!source.includes('summarizeConnections')) throw new Error('settings-banks route must render the summary line');
}

export function verifySettingsBanksEmptyState(): void {
  const source = readRoute(SETTINGS_BANKS_ROUTE);
  if (!source.includes('EmptyState')) throw new Error('settings-banks route must render EmptyState');
  if (!source.includes('settings_banks.empty_cta')) {
    throw new Error('settings-banks route must draw the empty-state CTA');
  }
}

export function verifySettingsBanksDisconnectConfirmState(): void {
  const source = readRoute(SETTINGS_BANKS_ROUTE);
  if (!source.includes('DisconnectConfirmModal')) {
    throw new Error('settings-banks route must render DisconnectConfirmModal');
  }
  if (!source.includes('params.disconnect')) {
    throw new Error('settings-banks route must resolve the modal target from the disconnect param');
  }
}

export function verifyBankReviewOkState(): void {
  const state = resolveBankReviewState(activeConnection());
  if (state !== 'ok') throw new Error('an idle/syncing/ok connection must resolve to the ok state');

  const source = readRoute(BANK_REVIEW_ROUTE);
  if (!source.includes('bank_review.sync_now')) throw new Error('bank-review route must draw Sincronizar ahora');
}

export function verifyBankReviewErrorState(): void {
  const state = resolveBankReviewState(activeConnection({ syncStatus: 'error' }));
  if (state !== 'error') throw new Error('an errored connection must resolve to the error state');

  const source = readRoute(BANK_REVIEW_ROUTE);
  if (!source.includes('bank_review.update_credentials')) {
    throw new Error('bank-review route must draw Actualizar credenciales for the error state');
  }
}
