import { formatShortDate } from '@finanzas/shared-utils';

import type { SupportedLocale } from '../../db/labels';
import type { BankConnectionSummary } from '../../db/types';
import { describeSyncTime, type SyncTimeDescriptor } from '../home/relative-time';
import type { BankConnectionListItem, BankReviewState, CopyFragment } from './types';

const MONOGRAM_LENGTH = 3;

/**
 * Pure view logic for `settings-banks` and `bank-review` (implementation plan for issue #20,
 * Decisions 3, 9, 11). No React, no SQL — every function here takes already-read rows (or a
 * {@link SyncTimeDescriptor}, which item #12's `describeSyncTime` produces from a `now`/`iso`
 * pair) and returns a catalogue key plus interpolation values, never a Spanish string built in
 * TypeScript (AGENTS.md non-negotiable 8).
 */

/** `count === 1` picks the singular suffix (Decision 11) — Spanish and English agree on the
 * one/other boundary for "banco(s)" and "producto(s)", so one selector serves both catalogues. */
export function pluralKey(base: string, count: number): string {
  return count === 1 ? `${base}_one` : `${base}_other`;
}

/** Total over `sync_status` (Decision 9): `'error'` is the only status that renders the `error`
 * state; `'idle'`, `'syncing'` and `'ok'` all render `ok` — the manifest declares no third state. */
export function resolveBankReviewState(connection: Pick<BankConnectionSummary, 'syncStatus'>): BankReviewState {
  return connection.syncStatus === 'error' ? 'error' : 'ok';
}

/** The shared four-branch shape both `settings_banks.synced_*` and `bank_review.synced_*` carry
 * (Decision 3's `resolveSyncTimeKey`). */
export function resolveSyncTimeKey(
  descriptor: SyncTimeDescriptor,
  prefix: 'settings_banks' | 'bank_review',
  locale: SupportedLocale,
): CopyFragment {
  switch (descriptor.kind) {
    case 'minutes':
      return { key: `${prefix}.synced_minutes`, values: { value: descriptor.minutes } };
    case 'hours':
      return { key: `${prefix}.synced_hours`, values: { value: descriptor.hours } };
    case 'yesterday':
      return { key: `${prefix}.synced_yesterday`, values: { time: descriptor.timeOfDay } };
    case 'date':
      return { key: `${prefix}.synced_date`, values: { date: formatShortDate(descriptor.dateLocal, locale) } };
  }
}

/**
 * `bank-review`'s error-state header (Decision 9): the same total shape as
 * {@link resolveSyncTimeKey}, prefixed `last_success_*` instead of `synced_*` — mirrors home's
 * own `SyncErrorNote`'s `lastSuccessLabel` (`home.sync_error_last_success_*`), the merged
 * precedent for "the last successful sync, shown while the connection is currently in error".
 * The copy inventory names only the `yesterday`/`date` branches (the mockup's own sample is
 * `ayer 21:14`); the `minutes`/`hours` branches are added here for totality over
 * {@link SyncTimeDescriptor}'s four variants — a recent success can still precede an immediate
 * later failure.
 */
export function resolveLastSuccessKey(descriptor: SyncTimeDescriptor, locale: SupportedLocale): CopyFragment {
  switch (descriptor.kind) {
    case 'minutes':
      return { key: 'bank_review.last_success_minutes', values: { value: descriptor.minutes } };
    case 'hours':
      return { key: 'bank_review.last_success_hours', values: { value: descriptor.hours } };
    case 'yesterday':
      return { key: 'bank_review.last_success_yesterday', values: { time: descriptor.timeOfDay } };
    case 'date':
      return { key: 'bank_review.last_success_date', values: { date: formatShortDate(descriptor.dateLocal, locale) } };
  }
}

/**
 * `settings-banks`'s row-level sync fragment — the last **attempt** time
 * (`connection.lastSyncAt`), mirroring home's own `ConnectedBanksCard` precedent exactly. Total
 * over "never attempted a sync".
 */
export function resolveListSyncFragment(
  lastSyncAt: string | null,
  now: Date,
  locale: SupportedLocale,
): CopyFragment {
  if (lastSyncAt === null) return { key: 'settings_banks.never_synced', values: {} };
  return resolveSyncTimeKey(describeSyncTime(now, lastSyncAt), 'settings_banks', locale);
}

/**
 * `bank-review`'s header sub-line — always the last **successful** sync (Decision 9), regardless
 * of the current state: the relative form for `ok`, the absolute form for `error`. Total over "has
 * never synced successfully" (`last_success_at is null`), which can be true in either state.
 */
export function resolveReviewHeaderFragment(
  lastSuccessAt: string | null,
  now: Date,
  locale: SupportedLocale,
  state: BankReviewState,
): CopyFragment {
  if (lastSuccessAt === null) return { key: 'bank_review.never_synced', values: {} };
  const descriptor = describeSyncTime(now, lastSuccessAt);
  return state === 'error' ? resolveLastSuccessKey(descriptor, locale) : resolveSyncTimeKey(descriptor, 'bank_review', locale);
}

export function resolveProductCountFragment(count: number): CopyFragment {
  return { key: `settings_banks.${pluralKey('product_count', count)}`, values: { value: count } };
}

export function resolveBankCountFragment(count: number): CopyFragment {
  return { key: `settings_banks.${pluralKey('bank_count', count)}`, values: { value: count } };
}

/** `settings-banks`'s summary line — "N banco(s) · M producto(s)" (Decision 11). */
export function summarizeConnections(
  connections: readonly Pick<BankConnectionSummary, 'productCount'>[],
): { bankCount: number; productCount: number } {
  return {
    bankCount: connections.length,
    productCount: connections.reduce((sum, connection) => sum + connection.productCount, 0),
  };
}

/** A 2-3 letter monogram — `BankRow`'s own fallback rule (Assumption A13), mirrored here so this
 * feature composes it without importing a component. */
export function monogramFor(connection: Pick<BankConnectionSummary, 'shortName' | 'name'>): string {
  if (connection.shortName !== undefined) return connection.shortName;
  return connection.name.slice(0, MONOGRAM_LENGTH).toUpperCase();
}

/**
 * `settings-banks`'s per-row derived presentation (Decision 3, Decision 4, Assumption A7/A8).
 * An errored connection's sub-label is a single override fragment (`settings_banks.sync_error`,
 * "Error de sincronización") rather than the composed `row_subtitle` — the same replace-not-append
 * rule item #12's `ConnectedBanksCard` already applies for its own `home.banks_sub_error`.
 */
export function resolveConnectionListItem(
  connection: BankConnectionSummary,
  now: Date,
  locale: SupportedLocale,
): BankConnectionListItem {
  const isError = connection.syncStatus === 'error';

  if (isError) {
    return {
      badgeTone: 'danger',
      badgeLabelKey: 'settings_banks.badge_error',
      subLabelTone: 'danger',
      subLabel: { kind: 'override', fragment: { key: 'settings_banks.sync_error', values: {} } },
    };
  }

  return {
    badgeTone: 'ok',
    badgeLabelKey: 'settings_banks.badge_ok',
    subLabelTone: 'default',
    subLabel: {
      kind: 'composed',
      syncFragment: resolveListSyncFragment(connection.lastSyncAt, now, locale),
      productCountFragment: resolveProductCountFragment(connection.productCount),
    },
  };
}
