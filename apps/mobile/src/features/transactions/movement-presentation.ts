import { formatClp } from '@finanzas/shared-utils';
import { isIncludedInAnalysis } from '@finanzas/shared-domain';

import type { TransactionListRow } from '../../db/types';

/** Decorative glyphs, not user-facing copy (Decision 10) — the fallback icon when neither the
 * merchant nor the category carries an emoji (Assumption A9), identical to item #12's
 * `RecentMovementsSection` for the same primitive. */
const FALLBACK_CREDIT_ICON = '💰';
const FALLBACK_DEBIT_ICON = '💳';

/**
 * The row's meta line, as a translation-free descriptor (implementation plan for issue #15,
 * Assumptions A10-A11) — no Spanish string is built here, matching item #12's
 * `SyncTimeDescriptor` precedent. The component resolves it through `t()`.
 */
export type MovementMetaDescriptor =
  | { kind: 'pending' }
  | { kind: 'excluded'; dateLocal: string; reason: Exclude<TransactionListRow['exclusionReason'], null> }
  | { kind: 'plain'; dateLocal: string; categoryName: string | undefined; note: string | undefined };

export interface MovementPresentation {
  icon: string;
  name: string;
  amount: string;
  direction: 'in' | 'out';
  state: 'default' | 'pending' | 'excluded';
  meta: MovementMetaDescriptor;
}

function resolveIcon(row: TransactionListRow): string {
  if (row.merchantEmoji !== undefined) return row.merchantEmoji;
  if (row.categoryEmoji !== undefined) return row.categoryEmoji;
  return row.type === 'credit' ? FALLBACK_CREDIT_ICON : FALLBACK_DEBIT_ICON;
}

/**
 * Reproduces all nine drawn rows (Assumptions A9-A11, brief AC2). The dimmed-row decision is
 * delegated to the one in-memory statement of the inclusion rule — `isIncludedInAnalysis` from
 * `@finanzas/shared-domain` — rather than a hand-written `excludedAt === null` (Decision 6); this
 * file states no exclusion condition of its own.
 *
 * Takes no `locale`: `row.categoryName` already arrived locale-resolved from the repository
 * (`resolveLabel`), `formatClp` is locale-invariant by design, and the meta line's date is
 * formatted by the component that already holds `locale` for `formatShortDate` — mirroring item
 * #12's `describeSyncTime`/`SyncErrorNote` split, so this function stays translation-free and
 * locale-free.
 */
export function describeMovement(row: TransactionListRow): MovementPresentation {
  const included = isIncludedInAnalysis(row);
  const isPending = included && row.type === 'debit' && row.categoryName === undefined;

  const meta: MovementMetaDescriptor = !included
    ? { kind: 'excluded', dateLocal: row.dateLocal, reason: row.exclusionReason ?? 'other' }
    : isPending
      ? { kind: 'pending' }
      : { kind: 'plain', dateLocal: row.dateLocal, categoryName: row.categoryName, note: row.note ?? undefined };

  return {
    icon: resolveIcon(row),
    name: row.merchantName ?? row.rawDescription,
    amount: formatClp(row.amount, { direction: row.type === 'credit' ? 'in' : 'out' }),
    direction: row.type === 'credit' ? 'in' : 'out',
    state: !included ? 'excluded' : isPending ? 'pending' : 'default',
    meta,
  };
}
