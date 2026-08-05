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
const CONNECTED_BANK_ROW = path.resolve(
  REPO_ROOT,
  'apps/mobile/src/features/banks/components/ConnectedBankRow.tsx',
);
const DISCONNECT_CONFIRM_MODAL = path.resolve(
  REPO_ROOT,
  'apps/mobile/src/features/banks/components/DisconnectConfirmModal.tsx',
);

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
  const okItem = resolveConnectionListItem(activeConnection(), new Date('2026-02-10T12:00:00.000Z'), 'es');
  if (okItem.subLabel.kind !== 'composed') throw new Error('list state must compose row_subtitle');
  if (okItem.accessibilityStatusKey !== 'settings_banks.status_ok') {
    throw new Error('a healthy connection must resolve the ok accessibility status key (Decision 4)');
  }
  const errorItem = resolveConnectionListItem(
    activeConnection({ syncStatus: 'error' }),
    new Date('2026-02-10T12:00:00.000Z'),
    'es',
  );
  if (errorItem.accessibilityStatusKey !== 'settings_banks.status_error') {
    throw new Error('an errored connection must resolve the error accessibility status key (Decision 4)');
  }

  const source = readRoute(SETTINGS_BANKS_ROUTE);
  if (!source.includes('ConnectedBankRow')) throw new Error('settings-banks route must render ConnectedBankRow');
  if (!source.includes('summarizeConnections')) throw new Error('settings-banks route must render the summary line');

  // Decision 4: the row's accessible name must carry the status word, not just the visible
  // relative-time sub-label — wired through BankRow's additive `accessibilityLabel` override.
  const rowSource = readRoute(CONNECTED_BANK_ROW);
  if (!rowSource.includes('accessibilityStatusKey')) {
    throw new Error('ConnectedBankRow must read accessibilityStatusKey from resolveConnectionListItem');
  }
  if (!rowSource.includes('accessibilityLabel=')) {
    throw new Error('ConnectedBankRow must override BankRow\'s accessibilityLabel with the status word (Decision 4)');
  }
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

  // Decision 2: a disconnect failure leaves the row visible with a failure Note — reviewer
  // finding on PR #91 (settings_banks.disconnect_failed was pinned by copy-contract.test.ts but
  // never referenced by any component). Both the route's prop-wiring and the modal's own
  // rendering of the failure Note are checked, so weakening either side fails this.
  if (!source.includes("disconnectHook.status === 'failed'") || !source.includes('failed={')) {
    throw new Error("settings-banks route must pass failed={disconnectHook.status === 'failed'} to the modal");
  }
  if (!source.includes('disconnectHook.reset()')) {
    throw new Error('settings-banks route must reset the disconnect hook on cancel, so a stale failure Note cannot reopen later');
  }

  // Issue #111: a confirmed disconnect mutates rows in place with no focus change, so the
  // hook's own focus-driven reload never fires on its own — the route's `onDisconnected`
  // callback must call `reload()` (aliased `reloadConnections`) itself, or the list keeps
  // showing the just-disconnected row until the screen loses and regains focus. Scoped to the
  // `onDisconnected` callback body (CodeRabbit finding on PR #112): a bare whole-file search
  // for the statement would keep passing if a future handler elsewhere called it while
  // `onDisconnected` itself no longer did. The statement form (trailing `;`) is still required
  // inside the body, so a doc comment that only *mentions* `reloadConnections()` cannot mask
  // the call site being deleted.
  const onDisconnectedBody = source.match(/onDisconnected:\s*\(\)\s*=>\s*\{([\s\S]*?)\}/);
  if (onDisconnectedBody === null) {
    throw new Error('settings-banks route must wire an onDisconnected callback with a block body');
  }
  if (!onDisconnectedBody[1]?.includes('reloadConnections();')) {
    throw new Error(
      'settings-banks route must call reloadConnections() inside onDisconnected, or the list stays stale until refocus',
    );
  }

  const modalSource = readRoute(DISCONNECT_CONFIRM_MODAL);
  if (!modalSource.includes('settings_banks.disconnect_failed')) {
    throw new Error('DisconnectConfirmModal must render settings_banks.disconnect_failed on a failure');
  }
  if (!modalSource.includes('failed &&')) {
    throw new Error('DisconnectConfirmModal must conditionally render the failure Note on the failed prop');
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
