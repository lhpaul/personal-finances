import { deriveDateLocal, formatLongMonthYear, formatRut, type SupportedLocale } from '@finanzas/shared-utils';

/**
 * Guarded `formatRut` (implementation plan for issue #19, Decision 5): `formatRut` throws
 * `TypeError` on structurally malformed input, so it is never called unguarded. `null` in ->
 * `null` out (Assumption A5 — no credential entry exists, the screen renders an em dash). A
 * stored RUT that cannot be formatted falls back to the raw stored string rather than crashing
 * the screen — that shape is a bug in whatever wrote it (item #9), not a reason to crash here.
 * Shared by `useSettingsHub()` (the hub's "Perfil local" subtitle) and `buildLocalProfile` below,
 * so the guard is written exactly once.
 */
export function formatRutOrRaw(rawRut: string | null): string | null {
  if (rawRut === null) return null;
  try {
    return formatRut(rawRut);
  } catch {
    return rawRut;
  }
}

export interface BuildLocalProfileInput {
  /** The unformatted value `resolveLockedRut` returned — `null` when no credential entry exists
   * anywhere (Assumption A5). */
  rawRut: string | null;
  firstLaunchAt: string | undefined;
  transactionCount: number;
  locale: SupportedLocale;
}

export interface LocalProfileView {
  /** Formatted (or raw-fallback) RUT, `null` when there is none — the route renders
   * `settings.account.rut_empty` (an em dash) in that case (Decision 5). */
  rut: string | null;
  /** `"enero 2025"` — `undefined` only if `first_launch_at` was somehow never written, which
   * `ensureFirstLaunchAt` (`src/db/bootstrap.ts`) makes unreachable in practice (Decision 10). */
  since: string | undefined;
  transactionCount: number;
}

/**
 * `#screen=settings-account`'s single pure composition (implementation plan for issue #19,
 * Decisions 5, 10, 16). No React, no I/O — `useLocalProfile` supplies every input from a real
 * read.
 */
export function buildLocalProfile(input: BuildLocalProfileInput): LocalProfileView {
  const rut = formatRutOrRaw(input.rawRut);

  let since: string | undefined;
  if (input.firstLaunchAt !== undefined) {
    const dateLocal = deriveDateLocal(new Date(input.firstLaunchAt));
    since = formatLongMonthYear(dateLocal, input.locale);
  }

  return { rut, since, transactionCount: input.transactionCount };
}
