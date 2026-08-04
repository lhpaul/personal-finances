import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import type { AliasCandidate, Merchant, MerchantAlias, MerchantMatchType, PeriodDelta } from '@finanzas/shared-domain';
import { aliasMatches, computePeriodDelta, normalizeDescription, resolveMerchant, suggestAliasCandidates, suggestCategory } from '@finanzas/shared-domain';
import { formatMonthAbbreviation, getMonthPeriod, shiftMonthPeriod, type DateLocal, type Period } from '@finanzas/shared-utils';

import { includedAmount, isIncluded, isPesoDenominated } from '../fragments';
import type { NewId, Now } from '../ids';
import type { SupportedLocale } from '../labels';
import { merchantAliases, merchants, transactions, users } from '../schema';
import type { AppDatabase, Category, MerchantEditorSnapshot, MerchantMonthTotal, MerchantSpendingStats } from '../types';
import { listCategories } from './categories';
import type { MovementEnricher, MovementEnrichment } from './transactions';

/**
 * `merchants` repository (implementation plan Layer-by-Layer, spec Business Rule 21, AC10, AC22;
 * issue #10 Decision 7, Business Rules 18-20, AC16-AC20).
 *
 * There is no `deleteTransaction` export anywhere in `src/db` (Business Rule 5, AC22) — a
 * movement is never deleted, only excluded. `deleteMerchant` reflects the same asymmetry on the
 * merchant side: its aliases go with it (`merchant_aliases.merchant_id` is
 * `ON DELETE CASCADE`), but every movement that named it survives and simply stops naming a
 * merchant.
 */
export function deleteMerchant(db: AppDatabase, merchantId: string): void {
  db.transaction((tx: AppDatabase) => {
    // `transactions.merchant_id` has no `ON DELETE` action, so with `PRAGMA foreign_keys = ON`
    // (Decision 5) the merchant row cannot be deleted while a movement still references it —
    // this update must run first, inside the same transaction, so the operation is indivisible.
    tx.update(transactions)
      .set({ merchantId: null })
      .where(eq(transactions.merchantId, merchantId))
      .run();
    // `merchant_aliases` cascades via its own foreign key (`ON DELETE CASCADE`).
    tx.delete(merchants).where(eq(merchants.id, merchantId)).run();
  });
}

export interface MerchantMatchingSet {
  merchants: Merchant[];
  aliases: MerchantAlias[];
}

/**
 * Loads every merchant and every alias, in `@finanzas/shared-domain` shapes, for the sync
 * engine's enrichment step (Decision 7). Loaded once per sync — not per movement — because a
 * sync's read can carry hundreds of movements against the same small catalogue.
 *
 * `isUserDefined = user_id !== null` is the schema's own "null = seeded; set = created by the
 * person" distinction (Conflict 4's resolution) — the only signal that separates an `auto`
 * suggestion from a `rule` one without a new column.
 */
export function loadMerchantMatchingSet(db: AppDatabase): MerchantMatchingSet {
  const merchantRows = db
    .select({
      id: merchants.id,
      name: merchants.name,
      transactionCategoryId: merchants.transactionCategoryId,
      userId: merchants.userId,
    })
    .from(merchants)
    .all() as { id: string; name: string; transactionCategoryId: string | null; userId: string | null }[];

  const aliasRows = db
    .select({
      id: merchantAliases.id,
      merchantId: merchantAliases.merchantId,
      rawPattern: merchantAliases.rawPattern,
      matchType: merchantAliases.matchType,
    })
    .from(merchantAliases)
    .all() as { id: string; merchantId: string; rawPattern: string; matchType: string }[];

  return {
    merchants: merchantRows.map((row) => ({
      id: row.id,
      name: row.name,
      transactionCategoryId: row.transactionCategoryId,
      isUserDefined: row.userId !== null,
    })),
    aliases: aliasRows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      rawPattern: row.rawPattern,
      matchType: row.matchType as MerchantMatchType,
    })),
  };
}

/**
 * Builds the `MovementEnricher` the sync engine passes to `writeBankTransactionsInTx` (Decision
 * 7, spec Business Rules 18-20). Resolves a merchant once per description via `resolveMerchant`,
 * then asks `suggestCategory` for its default category with `currentCategorySource: null` — the
 * only value this call site ever passes, because enrichment only ever runs on the insert branch
 * (a movement being inserted has no prior category source). `suggestCategory` therefore only
 * ever returns `'auto'` or `'rule'`, never `'user'` (AC17, AC20): `'user'` is unreachable from
 * this code path by construction, not by a runtime check.
 *
 * A match with no default category still sets `merchantId` — Business Rule 18 records the
 * category "when the merchant … carries a default category"; the merchant itself is recognised
 * either way. No match sets neither (AC18).
 */
export function createMovementEnricher(matchingSet: MerchantMatchingSet): MovementEnricher {
  const merchantsById = new Map(matchingSet.merchants.map((merchant) => [merchant.id, merchant]));

  return (rawDescription: string): MovementEnrichment => {
    const match = resolveMerchant(rawDescription, matchingSet.aliases);
    const merchant = match ? (merchantsById.get(match.merchantId) ?? null) : null;
    const suggestion = suggestCategory({ currentCategorySource: null, merchant });

    return {
      merchantId: merchant ? merchant.id : null,
      transactionCategoryId: suggestion ? suggestion.transactionCategoryId : null,
      // `suggestion.source` is typed as the broader `CategorySource` ('auto' | 'rule' | 'user'),
      // but `currentCategorySource: null` above makes `suggestCategory` return only 'auto' or
      // 'rule' by construction — never 'user' (AC17, AC20).
      categorySource: suggestion ? (suggestion.source as 'auto' | 'rule') : null,
    };
  };
}

// -------------------------------------------------------------------------------------------
// `#screen=merchant-edit` (implementation plan for issue #14). `readMerchantEditor` composes the
// screen's whole snapshot inside one transaction (Decision 13); `saveMerchantProfile` and
// `groupAliasIntoMerchant` are its two writes (Decision 4); `recountMerchantAliases` backs both
// the snapshot read and the write path (Decision 7).
// -------------------------------------------------------------------------------------------

interface MerchantAliasRow {
  id: string;
  rawPattern: string;
  matchType: string;
  matchCount: number;
}

/**
 * Recomputes every alias's `match_count` for one merchant from the movements table (Decision 7,
 * AC3) — never incremented, so a deleted, re-linked or re-pointed movement can never leave a
 * stale count behind. `resolveMerchant` is a total order over aliases with unique ids (#5
 * Decision 7), so a movement is counted by at most one alias; a movement this merchant owns that
 * no alias explains (e.g. hand-attributed) is counted by none, which is intentional (Decision 7).
 * Runs against `db` directly or against an open transaction handle — both are `AppDatabase`
 * (Decision 1).
 */
export function recountMerchantAliases(db: AppDatabase, merchantId: string): void {
  const aliasRows = db
    .select({
      id: merchantAliases.id,
      rawPattern: merchantAliases.rawPattern,
      matchType: merchantAliases.matchType,
      matchCount: merchantAliases.matchCount,
    })
    .from(merchantAliases)
    .where(eq(merchantAliases.merchantId, merchantId))
    .all() as MerchantAliasRow[];

  const aliasesForResolve: MerchantAlias[] = aliasRows.map((row) => ({
    id: row.id,
    merchantId,
    rawPattern: row.rawPattern,
    matchType: row.matchType as MerchantMatchType,
  }));

  const counts = new Map<string, number>(aliasRows.map((row) => [row.id, 0]));

  const movementRows = db
    .select({ id: transactions.id, rawDescription: transactions.rawDescription })
    .from(transactions)
    .where(eq(transactions.merchantId, merchantId))
    .all() as { id: string; rawDescription: string }[];

  for (const movement of movementRows) {
    const match = resolveMerchant(movement.rawDescription, aliasesForResolve);
    if (match === null) continue;
    counts.set(match.aliasId, (counts.get(match.aliasId) ?? 0) + 1);
  }

  for (const [aliasId, count] of counts) {
    db.update(merchantAliases).set({ matchCount: count }).where(eq(merchantAliases.id, aliasId)).run();
  }
}

/**
 * Groups a detected raw description into this merchant's aliases (implementation plan Decisions
 * 8, 9; brief AC1). Re-points an existing alias row rather than inserting a duplicate —
 * `merchant_aliases_raw_pattern_unique` is a **global** unique index, so a pattern already used
 * by another merchant moves instead of colliding, and re-tapping "Agrupar" on an already-grouped
 * pattern is a no-op. Re-links only movements with no merchant yet (`merchant_id IS NULL`) —
 * a movement already attributed elsewhere is never silently moved. Everything happens in one
 * transaction, ending with a fresh recount.
 */
export function groupAliasIntoMerchant(
  db: AppDatabase,
  params: {
    merchantId: string;
    rawPattern: string;
    /** Defaults to `'prefix'` (Assumption A11 — matches the schema default and every seeded
     * alias). Only used when inserting a brand-new alias row; re-pointing an existing row keeps
     * its own `matchType`. */
    matchType?: MerchantMatchType;
    newId: NewId;
    now: Now;
  },
): void {
  const pattern = normalizeDescription(params.rawPattern);
  // Fixed sentence, no interpolation of the input — the house rule this package and `src/db`
  // both follow: a thrown message never echoes caller-supplied content.
  if (pattern === '') throw new RangeError('groupAliasIntoMerchant: empty pattern');

  const matchType = params.matchType ?? 'prefix';

  db.transaction((tx: AppDatabase) => {
    const existing = tx
      .select({ id: merchantAliases.id, merchantId: merchantAliases.merchantId, matchType: merchantAliases.matchType })
      .from(merchantAliases)
      .where(eq(merchantAliases.rawPattern, pattern))
      .get() as { id: string; merchantId: string; matchType: string } | undefined;

    const effectiveMatchType = existing ? (existing.matchType as MerchantMatchType) : matchType;

    if (!existing) {
      tx.insert(merchantAliases)
        .values({ id: params.newId(), merchantId: params.merchantId, rawPattern: pattern, matchType })
        .run();
    } else if (existing.merchantId !== params.merchantId) {
      tx.update(merchantAliases).set({ merchantId: params.merchantId }).where(eq(merchantAliases.id, existing.id)).run();
    }

    const orphans = tx
      .select({ id: transactions.id, rawDescription: transactions.rawDescription })
      .from(transactions)
      .where(sql`${transactions.merchantId} is null`)
      .all() as { id: string; rawDescription: string }[];

    const matchedIds = orphans
      .filter((row) => aliasMatches(row.rawDescription, { rawPattern: pattern, matchType: effectiveMatchType }))
      .map((row) => row.id);

    if (matchedIds.length > 0) {
      tx.update(transactions)
        .set({ merchantId: params.merchantId, updatedAt: params.now() })
        .where(inArray(transactions.id, matchedIds))
        .run();
    }

    recountMerchantAliases(tx, params.merchantId);
  });
}

/**
 * The screen's single write of name + default category (implementation plan Decisions 4, 5, 6;
 * brief AC2). Touches only the `merchants` row — no `transactions` row is ever written here, which
 * is what makes AC2 ("setting a default category does not overwrite categories the user already
 * confirmed") true by construction rather than by a filter that could be got wrong. When the
 * merchant is still seed-owned (`user_id is null`), this configuring act marks it person-owned by
 * reading the single local `users` row's id and writing it in the same statement — an
 * already-set `user_id` is left exactly as it was (Decision 6). The caller (the feature hook)
 * therefore never needs to know the local user's id — that stays an `src/db`-internal concern,
 * consistent with the app tier never touching a table directly.
 */
export function saveMerchantProfile(
  db: AppDatabase,
  params: {
    merchantId: string;
    name: string;
    transactionCategoryId: string | null;
  },
): void {
  const merchantRow = db
    .select({ userId: merchants.userId })
    .from(merchants)
    .where(eq(merchants.id, params.merchantId))
    .get() as { userId: string | null } | undefined;

  const localUser = merchantRow?.userId
    ? undefined
    : (db.select({ id: users.id }).from(users).get() as { id: string } | undefined);
  const nextUserId = merchantRow?.userId ?? localUser?.id ?? null;

  db.update(merchants)
    .set({
      name: params.name,
      transactionCategoryId: params.transactionCategoryId,
      userId: nextUserId,
    })
    .where(eq(merchants.id, params.merchantId))
    .run();
}

/**
 * Assumption A5 — the category picker lists the full taxonomy for the merchant's *observed*
 * direction: the direction of most of its included movements, expense (`0`) on a tie or when it
 * has none.
 *
 * Grouped by `transactions.type` rather than counted with two separate `WHERE` queries, so a
 * merchant's movements are scanned once regardless of how lopsided the split is. `isIncluded` is
 * applied here (unlike `recountMerchantAliases`, which deliberately counts every movement
 * regardless of exclusion, per Decision 7) because this is a *display* decision about which
 * taxonomy to show, not an alias-attribution count — an excluded movement should not tip which
 * category grid the person sees.
 */
function resolveMerchantDirection(db: AppDatabase, merchantId: string): 0 | 1 {
  const rows = db
    .select({ type: transactions.type, count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(eq(transactions.merchantId, merchantId), isIncluded))
    .groupBy(transactions.type)
    .all() as { type: string; count: number }[];

  const debitCount = rows.find((row) => row.type === 'debit')?.count ?? 0;
  const creditCount = rows.find((row) => row.type === 'credit')?.count ?? 0;
  return creditCount > debitCount ? 1 : 0;
}

/** The stats card's per-month total (Decision 12): included, peso-denominated expense movements
 * of this merchant, in `period`. Reads through the shared `isIncluded` / `includedAmount` /
 * `isPesoDenominated` fragments — a consumer of the inclusion and currency-guard rules, not a
 * second statement of either (`src/db/checks/inclusion-rule-scan.ts`,
 * `src/db/checks/peso-total-scan.ts`). */
function totalForMerchantInPeriod(db: AppDatabase, merchantId: string, period: Period): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${includedAmount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.merchantId, merchantId),
        eq(transactions.type, 'debit'),
        isIncluded,
        isPesoDenominated,
        gte(transactions.dateLocal, period.start),
        lte(transactions.dateLocal, period.end),
      ),
    )
    .get() as { total: number } | undefined;
  return row?.total ?? 0;
}

/** Assembles the "Estadísticas de gasto" card (Decision 12): the current month and the two
 * before it, oldest to newest, anchored to `today` — never to the merchant's last activity
 * (Assumption A9), so a dormant merchant shows empty bars rather than its last active window. */
function computeMerchantSpendingStats(
  db: AppDatabase,
  merchantId: string,
  today: DateLocal,
  locale: SupportedLocale,
): MerchantSpendingStats {
  const currentPeriod = getMonthPeriod(today);
  const periods: Period[] = [shiftMonthPeriod(currentPeriod, -2), shiftMonthPeriod(currentPeriod, -1), currentPeriod];

  const months: MerchantMonthTotal[] = periods.map((period) => ({
    monthLabel: formatMonthAbbreviation(period.start, locale),
    total: totalForMerchantInPeriod(db, merchantId, period),
  }));

  const monthlyAverage = Math.round(months.reduce((sum, month) => sum + month.total, 0) / months.length);
  const currentMonth = months[months.length - 1] as MerchantMonthTotal;
  const previousMonth = months[months.length - 2] as MerchantMonthTotal;
  const delta: PeriodDelta = computePeriodDelta(currentMonth.total, previousMonth.total);

  return { months, monthlyAverage, delta };
}

interface MerchantRow {
  id: string;
  name: string;
  transactionCategoryId: string | null;
  userId: string | null;
}

/**
 * The one consistent read behind every state of `#screen=merchant-edit` (implementation plan
 * Decision 13): merchant, aliases (freshly recounted), suggested candidates, the picker's
 * categories and the spending stats, all inside one transaction, so nothing the screen renders
 * can disagree with anything else it renders. Returns `undefined` when `merchantId` does not
 * resolve to a real merchant (Assumption A7 — the route is deep-linkable, so a bad id is
 * reachable).
 */
export function readMerchantEditor(
  db: AppDatabase,
  params: { merchantId: string; today: DateLocal; locale: SupportedLocale },
): MerchantEditorSnapshot | undefined {
  return db.transaction((tx: AppDatabase) => {
    const merchantRow = tx
      .select({
        id: merchants.id,
        name: merchants.name,
        transactionCategoryId: merchants.transactionCategoryId,
        userId: merchants.userId,
      })
      .from(merchants)
      .where(eq(merchants.id, params.merchantId))
      .get() as MerchantRow | undefined;
    if (!merchantRow) return undefined;

    // The counts the person is about to read must be current, including any drift left behind
    // by a re-link/re-point elsewhere (Decision 7).
    recountMerchantAliases(tx, params.merchantId);

    const aliasRows = tx
      .select({
        id: merchantAliases.id,
        rawPattern: merchantAliases.rawPattern,
        matchType: merchantAliases.matchType,
        matchCount: merchantAliases.matchCount,
      })
      .from(merchantAliases)
      .where(eq(merchantAliases.merchantId, params.merchantId))
      .orderBy(asc(merchantAliases.rawPattern))
      .all() as MerchantAliasRow[];

    const orphanDescriptionRows = tx
      .select({ rawDescription: transactions.rawDescription })
      .from(transactions)
      .where(sql`${transactions.merchantId} is null`)
      .all() as { rawDescription: string }[];

    const candidates: AliasCandidate[] = suggestAliasCandidates({
      merchantName: merchantRow.name,
      existingPatterns: aliasRows.map((row) => row.rawPattern),
      descriptions: orphanDescriptionRows.map((row) => row.rawDescription),
    });

    const direction = resolveMerchantDirection(tx, params.merchantId);
    const categories: Category[] = listCategories(tx, { income: direction, locale: params.locale });

    const stats = computeMerchantSpendingStats(tx, params.merchantId, params.today, params.locale);

    return {
      merchant: {
        id: merchantRow.id,
        name: merchantRow.name,
        transactionCategoryId: merchantRow.transactionCategoryId,
        isUserDefined: merchantRow.userId !== null,
      },
      aliases: aliasRows.map((row) => ({
        id: row.id,
        rawPattern: row.rawPattern,
        matchType: row.matchType as MerchantMatchType,
        matchCount: row.matchCount,
      })),
      candidates,
      categories,
      stats,
    };
  });
}
