/**
 * The typed seam into item #11's syncing screen (implementation plan Decision 8). This item does
 * not mount the scraper's WebView — it marks the connection `syncing` (Decision 7) and hands over
 * a **key**, never a secret, so the plaintext can be dropped the moment `connectBank` resolves.
 *
 * Imports nothing from `@finanzas/bank-scraper` and nothing from `src/features/sync/` — item #11
 * mounts the hidden WebView, implements `ScraperRunner` over `startBankRead(...)`, reads the
 * credential through this item's secure-store port using `credentialsKey`, and calls item #10's
 * `runSync(deps, request)`.
 *
 * The history window (`priorMonths`) is deliberately not overridden here — the mockups draw no
 * control for it, so the scraper's own default (current month plus one prior month) applies
 * (Assumption A3). Item #11 should not invent a different default.
 */

/** Field names match item #10's merged `ScraperRunner.run` request exactly, so this handoff
 * drops in without a translation layer. Deliberately not named `SyncRequest` — item #10's merged
 * plan owns that type name in `src/features/sync/types.ts`. */
export type ConnectHandoff = {
  connectionId: string;
  countryCode: string;
  bankId: string;
  credentialsKey: string;
};

export const SYNCING_ROUTE = '/(onboarding)/bank-syncing';

/** `countryCode` is fixed at `'cl'` — the MVP's only supported country (data model). `bankId` is
 * the chosen institution's id, which is also `financial_institutions.id` and the scraper's own
 * `bankId` (identity contract verified at plan time: `banco-de-chile` matches on both sides). */
export function buildSyncRequest(
  result: { userFinancialInstitutionId: string; credentialsKey: string },
  bankId: string,
): ConnectHandoff {
  return {
    connectionId: result.userFinancialInstitutionId,
    countryCode: 'cl',
    bankId,
    credentialsKey: result.credentialsKey,
  };
}

/**
 * Module-scoped holder for the most recent handoff (found in review — CodeRabbit PR #80): this
 * item builds `buildSyncRequest` but has no route to hand its result to, since `bank-syncing.tsx`
 * is still item #11's placeholder and the spec forbids URL-serialized state. `useConnectBank`
 * calls {@link setPendingSyncHandoff} the moment a connection succeeds, so item #11's own screen
 * can call {@link consumePendingSyncHandoff} once it exists, instead of this seam staying
 * entirely unwired. Deliberately a separate store from `connect-flow-store.ts` — that store's
 * type is closed by design (Decision 1) and this is a different concern (a key handoff, not flow
 * navigation), not a credential: `credentialsKey` is a secure-store key *name*, never a value.
 */
let pendingHandoff: ConnectHandoff | null = null;

export function setPendingSyncHandoff(handoff: ConnectHandoff): void {
  pendingHandoff = handoff;
}

/** Reads and clears the pending handoff — a handoff is consumed at most once. */
export function consumePendingSyncHandoff(): ConnectHandoff | null {
  const handoff = pendingHandoff;
  pendingHandoff = null;
  return handoff;
}

/** Test-only escape hatch, mirroring `connect-flow-store.ts`'s `__resetConnectFlowForTests`. */
export function __resetPendingSyncHandoffForTests(): void {
  pendingHandoff = null;
}
