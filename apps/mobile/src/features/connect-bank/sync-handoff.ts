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
