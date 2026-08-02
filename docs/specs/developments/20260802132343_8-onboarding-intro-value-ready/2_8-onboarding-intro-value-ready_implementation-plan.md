# Onboarding: intro, value carousel and ready — Implementation Plan

**Work item brief**: [lhpaul/personal-finances#8](https://github.com/lhpaul/personal-finances/issues/8)
(Refactor-type item — there is no spec document; the tracker brief plus
[`BEHAVIOR.md`](../../../../design/mockups/mobile/BEHAVIOR.md) and the mockups are the contract)
**Smoke test runbook**: [`docs/testing/mobile/8-onboarding-intro-value-ready.smoke-test.md`](../../../testing/mobile/8-onboarding-intro-value-ready.smoke-test.md)
**Mockup screens**: `#screen=onboarding-intro` · `#screen=onboarding-value&state=step-1|step-2|step-3` ·
`#screen=onboarding-ready`

---

## Summary

**Approach**: Build the three framing onboarding screens from the mockup, and turn the app's
existing unconditional entry shim into a real first-launch gate. `app/index.tsx` bootstraps the
already-merged local database (item #3), reads `app_settings.onboarding_completed`, and redirects
to `/(onboarding)/intro` or `/(tabs)/home`. The value carousel is a paged horizontal `ScrollView`
whose three pages are exactly the manifest's `step-1…step-3` states. `onboarding-ready` reads the
real connection and reminder state through new read-only repository functions and renders only the
summary rows it can truthfully fill. Completing the ready screen writes
`app_settings.onboarding_completed` and `router.replace`s out of the `(onboarding)` group, so the
flow is never re-entered. The bank-connection screens (#9, #10, #11) stay out: this plan defines
only the navigation seam into `/(onboarding)/connect-bank`.

**Estimated complexity**: M

**Rationale**: The three screens themselves are S — they compose existing primitives and add
catalogue copy. The M comes from the surrounding wiring this item must land first because it is
the app's entry point: the Expo-runtime database bootstrap has no caller yet, the launch gate is
new, and `onboarding-ready`'s "real state, not hardcoded copy" criterion needs two new
repository reads plus a settings-value contract that item #18 will later write to.

**Dependencies**:

- #2 (Theme and design-system primitives) — **merged**, present at the plan revision.
- #3 (Local database: schema, migrations and seed data) — **merged** into `develop` (the issue is
  still open on the board, but `apps/mobile/src/db/` exists at the plan revision; see the
  Verification Log). No part of this plan depends on the issue being closed.
- #34 (i18n infrastructure) — **merged**.

No dependency on #9/#10/#11/#18: this item navigates to `/(onboarding)/connect-bank` (an existing
placeholder route) and reads reminder settings defensively when they are absent.

---

## Verification Log

All commands were run from the plan worktree
(`.claude/worktrees/item-8`, branch `implementation-plan/8-onboarding-intro-value-ready`) at repo
revision `6ab7d03`.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `6ab7d03` |
| Declared MVP states for the three screens | `node -e "global.window={};require('./design/mockups/mobile/mockup-manifest.js'); …"` | `onboarding-intro /(onboarding)/intro` → no declared states; `onboarding-value /(onboarding)/value` → `step-1`, `step-2`, `step-3`; `onboarding-ready /(onboarding)/ready` → no declared states |
| "Saltar" is drawn in the mockup | `grep -n 'Saltar' design/mockups/mobile/index.html` | One hit, `index.html:716` — a `mu-btn--ghost` inside `#s-onboarding-value`'s top bar, `onclick="go('connect-bank-intro')"`. This **contradicts** `BEHAVIOR.md`'s 🟡 "el mockup no lo dibuja" (see Decision 3) |
| The database has no app-launch caller | `grep -rn "ensureDatabaseReady" apps/mobile/app` | 0 hits — `ensureDatabaseReady` is called only from `src/db/testing/memory-db.ts` and `src/db/__tests__/bootstrap.test.ts` |
| Existing repository functions | `grep -nE "^export (async )?function" apps/mobile/src/db/repositories/*.ts` | `countUncategorized(db)` already exists in `transactions.ts`; `getSetting` / `setSetting` exist in `settings.ts`; **no** reader for connected institutions or product counts exists |
| `app_settings` MVP key list | `docs/project/4-database-model.md` `### app_settings` | `onboarding_completed`, `reminder_enabled`, `reminder_time`, `reminder_days`, `last_categorization_session_at`, `schema_version`, `first_launch_at` — `onboarding_completed` needs **no** migration (key-value table) |
| `mu-*` ownership for the classes these screens use | `grep -nE "'mu-(topbar\|item__\|dots\|card\|badge\|btn\|h1\|h2\|p\|small\|center)[^']*'" apps/mobile/src/test-utils/mu-class-map.ts` | `mu-topbar*` = `deferred` to #12; `mu-item__txt/title/sub`, `mu-list` = `deferred` to #19; `mu-dots`, `mu-card*`, `mu-badge*`, `mu-btn*`, `mu-h1`, `mu-h2`, `mu-p`, `mu-p--lead`, `mu-small`, `mu-center` = `primitive`, already owned (see Decision 12) |
| No React renderer in the app test tier | `grep -c "testing-library" apps/mobile/package.json` | `0` — the repo's screen-test precedent is pure functions + static scans (item #34 Decision 11). See Decision 14 |
| Route files for the three screens today | `cat "apps/mobile/app/(onboarding)/{intro,value,ready}.tsx"` | All three render `RoutePlaceholder`; `app/index.tsx` unconditionally `Redirect`s to `/(onboarding)/intro` with a comment naming issue #8 as the owner of the real gate |
| `app/(tabs)/_layout.tsx` renders exactly two tabs | `cat "apps/mobile/app/(tabs)/_layout.tsx"` | `home` + `transactions` only — the launch gate's `/(tabs)/home` target exists |
| Route/manifest parity guard | `apps/mobile/src/__tests__/route-manifest-parity.test.ts` | Asserts the derived route set equals the manifest's 25 MVP routes exactly. This plan adds **no** route file, so the count is unchanged |
| `expo-router` exports `ErrorBoundary` | `grep -n "ErrorBoundary" apps/mobile/node_modules/expo-router/build/exports.d.ts` | `export { ErrorBoundary } from './views/ErrorBoundary';` — Decision 15's re-export is real API, not assumed |
| `expo-router` already mounts `SafeAreaProvider` | `grep -n "SafeAreaProvider" apps/mobile/node_modules/expo-router/build/ExpoRoot.js` | Mounted inside `ExpoRoot` — `app/_layout.tsx` needs **no** provider of its own |
| `drizzle-orm` is absent from the installed tree | `ls node_modules/.pnpm \| grep -i drizzle` | No match at the plan revision — the Expo migrator signature is therefore **unverified; the implementer must confirm it before proceeding** (Implementation Order step 1, Decision 2) |
| Same-surface open PRs | `gh pr list --state open` then `gh pr diff 51` | Open: #44, #46 (packages), #51 (spec for #9), #52 (spec for #10). Only #51 touches the onboarding journey; its scope starts at `/(onboarding)/connect-bank` and it states the person "reaches the connect-a-bank introduction at the end of the onboarding carousel" — the same seam this plan defines. No conflict |

### Residual verification strategy

This plan claims completeness against a manifest-declared enumeration ("every declared MVP state").
The evidence the implementation must produce before `ready-for-human-review`:

1. **Mechanical**: `apps/mobile/src/features/onboarding/__tests__/value-steps-manifest-parity.test.ts`
   loads `design/mockups/mobile/mockup-manifest.js` through the existing
   `src/test-utils/mockup-manifest` loader and asserts that `VALUE_STEPS.map((s) => s.stateId)`
   deep-equals the manifest's declared `onboarding-value` state ids, **in order**. A state added to
   the manifest later fails this test instead of silently going unimplemented.
2. **Mechanical**: `apps/mobile/src/features/onboarding/__tests__/onboarding-catalogue-keys.test.ts`
   scans the three route files and the onboarding feature components with the existing
   `src/test-utils/catalogue-key-scan` helper and asserts every `t('…')` key exists in `es.json`
   and that no dynamic key is used — the same control `gallery-catalogue-keys.test.ts` applies to
   the gallery.
3. **Manual**: the runbook's fidelity steps, one per `#screen=…&state=…` in the enumeration above,
   with the simulator/viewport recorded in the PR body per
   [`docs/best-practices/stack/mobile-ui-fidelity.md`](../../../best-practices/stack/mobile-ui-fidelity.md).

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` (no `mode` key) — this repository owns the plan | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo` block) | 2026-08-02, `6ab7d03` | Current invocation (item #8) only | `Verified` |
| Plan artifact base branch | `develop` | `AGENTS.md` → "Integration branch: `develop` (spec/plan/feature/fix PRs target `develop`)"; all four open PRs target `develop` | 2026-08-02, `6ab7d03` | The four open PRs (#44, #46, #51, #52) — all base `develop` | `Verified` |
| Onboarding→connect-bank navigation seam owner | `/(onboarding)/connect-bank` is entered from `onboarding-value`; item #9 owns everything from that screen onward | `design/mockups/mobile/mockup-manifest.js`, `BEHAVIOR.md` → `onboarding-value`, and open PR #51's spec ("reaches the connect-a-bank introduction at the end of the onboarding carousel") | 2026-08-02, `6ab7d03` | Same-surface open PRs only: #51 (spec for #9). #44/#46 touch `packages/*`; #52 is the sync-engine spec and does not touch onboarding routes | `Verified` |
| `app_settings` is a key-value table needing no migration for `onboarding_completed` | `app_settings(key TEXT PK, value TEXT NOT NULL)` | `apps/mobile/src/db/schema.ts:238`; `docs/project/4-database-model.md` `### app_settings` | 2026-08-02, `6ab7d03` | Current invocation only; no open PR modifies `apps/mobile/src/db/` | `Verified` |

No `Conflict` rows. The one cross-artifact contradiction found during planning is a **documentation**
contradiction inside this repository (`BEHAVIOR.md` vs. the mockup it complements), not a competing
operational assumption held by concurrent work; it is resolved on evidence in Decision 3 and carried
into the Documentation Updates list.

---

## Layer-by-Layer Changes

### Database / Data Layer

No migration. `app_settings` is key-value; `onboarding_completed` is a new key, not a new column
(non-negotiable 5 — migrations stay additive — is not engaged at all).

- [ ] `apps/mobile/src/db/runtime.ts` (**new**) — the Expo-runtime assembly that has been missing:
      opens the device database once via `openAppDatabase()`, wires `drizzle-orm/expo-sqlite/migrator`
      and `drizzle/migrations.js`, supplies the `newId` / `now` ports from `expo-crypto` and the
      system clock, calls `ensureDatabaseReady(...)`, and memoizes the resulting handle.
      Exports `getAppDatabase(): Promise<AppDatabase>`.
- [ ] `apps/mobile/src/db/migrate.ts` — add `runMigrationsAsync(migrate, latestMigrationTag)`, an
      `async` sibling of the existing `runMigrations` that `await`s the thunk. The existing sync
      export is left byte-identical so `src/db/testing/memory-db.ts` and its tests are untouched
      (Decision 2).
- [ ] `apps/mobile/src/db/bootstrap.ts` — widen `BootstrapDeps.migrate` to
      `() => void | Promise<void>` and call `await runMigrationsAsync(...)` in `runBootstrap`.
      Behaviour for the existing synchronous better-sqlite3 thunk is unchanged.
- [ ] `apps/mobile/src/db/repositories/settings.ts` — add three typed accessors over the existing
      `getSetting` / `setSetting`: `isOnboardingCompleted(db)`, `markOnboardingCompleted(db)`, and
      `readReminderSettings(db)`. Each coerces the `unknown` JSON value defensively and returns a
      typed result (Decision 8).
- [ ] `apps/mobile/src/db/repositories/connections.ts` (**new**) — read-only
      `getConnectedBanksSummary(db): ConnectedBanksSummary`, joining `user_financial_institutions`
      (status `connected`) to `financial_institutions` for names and counting
      `user_financial_products` rows. Write-side connection functions belong to #9.
- [ ] `apps/mobile/src/db/types.ts` — add the `ConnectedBanksSummary` and `ReminderSettings`
      domain types so no caller ever sees a Drizzle row shape.

### Shared Packages / Libraries

- [ ] `packages/shared-utils/src/dates.ts` — add `formatWallClockLabel(timeOfDay: string): string`,
      turning a stored 24-hour `"HH:mm"` into the mockup's `9:00 AM` (Decision 9). Formatting lives
      in `@finanzas/shared-utils` per `AGENTS.md`, not in the app.
- [ ] `packages/shared-utils/src/dates.test.ts` — unit tests for the new formatter.

### Frontend / UI — new files

- [ ] `apps/mobile/src/features/onboarding/use-launch-decision.ts` — `useLaunchDecision()`:
      awaits `getAppDatabase()`, reads `isOnboardingCompleted(db)`, and returns
      `{ status: 'pending' } | { status: 'resolved'; href: '/(onboarding)/intro' | '/(tabs)/home' }`.
      Cancellation-guarded (see the concurrency addendum). Bootstrap failures are re-thrown so the
      route's `ErrorBoundary` sees them (Decision 15).
- [ ] `apps/mobile/src/features/onboarding/launch-decision.ts` — the pure part:
      `resolveLaunchHref(onboardingCompleted: boolean)`. Unit-testable without a renderer.
- [ ] `apps/mobile/src/features/onboarding/value-steps.ts` — `VALUE_STEPS`, the ordered
      `{ stateId, glyph, titleKey, bodyKey }` descriptors for `step-1…step-3`, plus the pure
      `stepIndexFromScrollOffset(offsetX, pageWidth, total)` and `nextStepIndex(index, total)`.
- [ ] `apps/mobile/src/features/onboarding/ready-summary.ts` — the pure key selectors the ready
      screen renders through: `banksTitleKey(count)`, `banksProductsKey(count)` and
      `reminderDaysKey(summary)`, each returning a catalogue key (Decision 13). No React, no `t`.
- [ ] `apps/mobile/src/features/onboarding/use-onboarding-summary.ts` — `useOnboardingSummary()`:
      reads `getConnectedBanksSummary(db)` and `readReminderSettings(db)`, returns
      `{ status: 'pending' } | { status: 'ready'; banks; reminders }`.
- [ ] `apps/mobile/src/features/onboarding/use-complete-onboarding.ts` —
      `useCompleteOnboarding()` returns `{ complete }`; `complete()` writes
      `markOnboardingCompleted(db)`, then reads `countUncategorized(db)` and
      `router.replace`s to `/categorize/intro` or `/(tabs)/home` (Decisions 5 and 6). Re-entrancy
      guarded (concurrency addendum).
- [ ] `apps/mobile/src/features/onboarding/components/ValueStepPage.tsx` — one carousel page:
      glyph, `Text variant="h2"`, `Text variant="bodyLead"`, and (page 1 only) the
      `Card variant="flat"` checklist.
- [ ] `apps/mobile/src/features/onboarding/components/ReadySummaryRow.tsx` — a screen-local row
      (glyph + title + subtitle + `Badge tone="ok"`), **not** a new `components/ui/` primitive
      (Decision 12).
- [ ] `apps/mobile/src/features/reminders/summary.ts` — pure `summarizeReminderDays(days)` →
      `{ kind: 'weekdays' } | { kind: 'everyday' } | { kind: 'custom'; days }`. Placed in a
      `reminders` feature folder because item #18 and `settings-notifications` (#19) reuse it.

### Frontend / UI — modified files

- [ ] `apps/mobile/app/index.tsx` — replaces the unconditional `Redirect` with the launch gate.
      Renders `null` while `status === 'pending'` (Decision 15) and `<Redirect href={...} />` once
      resolved. Re-exports `ErrorBoundary` from `expo-router`.
- [ ] `apps/mobile/app/_layout.tsx` — **no change expected.** `expo-router`'s `ExpoRoot` already
      mounts `SafeAreaProvider` from `react-native-safe-area-context`
      (`expo-router/build/ExpoRoot.js:77`, see the Verification Log), so `useSafeAreaInsets` and
      `SafeAreaView` work in the onboarding screens without adding a second provider. Touch this
      file only if the runbook's step 2 shows insets resolving to zero, and say so in the PR.
- [ ] `apps/mobile/app/(onboarding)/_layout.tsx` — `screenOptions={{ headerShown: false }}`. The
      mockups draw their own top bars; no native header exists in any onboarding frame. This adds no
      literal string, so the `i18next/no-literal-string` exception recorded for
      `app/(tabs)/_layout.tsx` is not repeated here.
- [ ] `apps/mobile/app/(onboarding)/intro.tsx` — real screen (`#screen=onboarding-intro`).
      Replaces `RoutePlaceholder`.
- [ ] `apps/mobile/app/(onboarding)/value.tsx` — real screen
      (`#screen=onboarding-value&state=step-1|step-2|step-3`).
- [ ] `apps/mobile/app/(onboarding)/ready.tsx` — real screen (`#screen=onboarding-ready`).
- [ ] `apps/mobile/src/theme.ts` — add a new `screenMetrics` export with an `onboarding` group for
      the mockup-measured values these screens need (Decision 10). The `theme` object itself is
      **not** touched — `theme-tokens-parity.test.ts` asserts its key set exactly.
- [ ] `apps/mobile/src/i18n/es.json`, `apps/mobile/src/i18n/en.json` — the `onboarding_intro.*`,
      `onboarding_value.*`, `onboarding_ready.*` and `reminders.*` keys below, added to both
      catalogues in the same change.

### Infrastructure / Configuration

None. No new dependency, no config change, no CI change. `expo-crypto`,
`react-native-safe-area-context`, `drizzle-orm` and `expo-sqlite` are already dependencies of
`@finanzas/mobile`.

---

## Catalogue keys

Flat, `snake_case` in every segment, namespaced by journey
([`docs/best-practices/stack/i18n.md`](../../../best-practices/stack/i18n.md)). The Spanish string
is copied from the mockup; the English string is a translation. Both catalogues get the same key
set (`catalogue-parity.test.ts` enforces it).

| Key | `es` (from the mockup) | Mockup source |
| --- | --- | --- |
| `onboarding_intro.title` | `Bienvenido a Finanzas` | `index.html:703` |
| `onboarding_intro.body` | `Te ayudaremos a tomar control de tu dinero — paso a paso, a tu propio ritmo.` | `index.html:704` |
| `onboarding_intro.cta` | `Comenzar` | `index.html:707` |
| `onboarding_value.skip` | `Saltar` | `index.html:716` |
| `onboarding_value.cta` | `Continuar` | `index.html:749-751` |
| `onboarding_value.step_1_title` | `Mejoras financieras simples` | `index.html:723` |
| `onboarding_value.step_1_body` | `Organizamos tus gastos de forma automática sin abrumarte. Cada paso es claro y fácil de seguir.` | `index.html:724` |
| `onboarding_value.step_1_check_1` | `Sin complicaciones técnicas` | `index.html:738` |
| `onboarding_value.step_1_check_2` | `Proceso paso a paso` | `index.html:739` |
| `onboarding_value.step_1_check_3` | `Interfaz intuitiva` | `index.html:740` |
| `onboarding_value.step_2_title` | `Tus claves nunca salen del teléfono` | `index.html:728` |
| `onboarding_value.step_2_body` | `Leemos tu banco desde tu propio dispositivo. Tus credenciales se guardan cifradas aquí, no en nuestros servidores.` | `index.html:729` |
| `onboarding_value.step_3_title` | `A tu ritmo, unos minutos por semana` | `index.html:733` |
| `onboarding_value.step_3_body` | `No es una app que te exige todos los días. Un par de sesiones cortas por semana bastan para mantener el control.` | `index.html:734` |
| `onboarding_ready.title` | `¡Todo listo!` | `index.html:1096` |
| `onboarding_ready.body` | `Estás preparado para comenzar tu camino hacia el control financiero.` | `index.html:1097` |
| `onboarding_ready.cta` | `Comenzar` | `index.html:1106` |
| `onboarding_ready.banks_title_single` | `{{count}} banco conectado` | `index.html:1101` |
| `onboarding_ready.banks_title_plural` | `{{count}} bancos conectados` | derived plural of `index.html:1101` |
| `onboarding_ready.banks_products_single` | `{{count}} producto` | derived singular of `index.html:1101` |
| `onboarding_ready.banks_products_plural` | `{{count}} productos` | `index.html:1101` |
| `onboarding_ready.banks_subtitle` | `{{names}} · {{products}}` | `index.html:1101` (`Banco de Chile · 3 productos`) |
| `onboarding_ready.reminders_title` | `Notificaciones activadas` | `index.html:1102` |
| `reminders.summary` | `{{time}} · {{days}}` | `index.html:1102` (`9:00 AM · días laborales`) |
| `reminders.days_weekdays` | `días laborales` | `index.html:1102` and the `Solo días laborales` control at `index.html:1080` |
| `reminders.days_everyday` | `todos los días` | **not drawn** — Assumption A4 |
| `reminders.day_1` … `reminders.day_7` | `Lunes` … `Domingo` | `index.html:1072-1078` |

Decorative glyphs (`👋 🎯 🔒 🌱 🎉 ✓ 🏦 🔔`) are **not** catalogue entries — they are module-level
named constants, per item #34's Decision 10 (Decision 11 below).

Two notes on transcription, so the "string for string" check at review is unambiguous:

- `index.html:704` contains a `<br>` (`… tu dinero —<br>paso a paso …`). That is a layout line
  break in the mockup's fixed-width frame, not part of the sentence. The catalogue value is the
  sentence with a single space, and React Native wraps it; a literal `\n` in the catalogue would
  break on narrow screens in the wrong place.
- `index.html:1101` is one row rendered as three nodes (title, subtitle, badge). The catalogue
  splits it into `banks_title_*` and `banks_subtitle` accordingly; concatenated at count 1 it
  reproduces the drawn text exactly.

---

## Decisions

### Decision 1 — The launch gate lives in `app/index.tsx`, over a memoized database handle

`app/index.tsx` today unconditionally redirects to `/(onboarding)/intro` and its own comment names
issue #8 as the owner of the real gate. It becomes:

```tsx
// Illustrative — adapt during implementation.
export { ErrorBoundary } from 'expo-router';

export default function Index() {
  const decision = useLaunchDecision();
  if (decision.status === 'pending') return null;
  return <Redirect href={decision.href} />;
}
```

The handle comes from a new `src/db/runtime.ts`, because `ensureDatabaseReady` has **no** caller in
`app/` today (Verification Log) and item #3 deliberately left the Expo-side assembly to its first
consumer:

```ts
// Illustrative — adapt during implementation.
let handle: Promise<AppDatabase> | undefined;

export function getAppDatabase(): Promise<AppDatabase> {
  if (!handle) {
    handle = (async () => {
      const { db } = openAppDatabase();
      await ensureDatabaseReady({
        db,
        migrate: () => migrate(db, migrations),
        latestMigrationTag: latestJournalTag(),
        newId: () => Crypto.randomUUID(),
        now: () => new Date().toISOString(),
      });
      return db;
    })().catch((error: unknown) => {
      handle = undefined; // mirror bootstrap.ts: a failure must not be cached forever
      throw error;
    });
  }
  return handle;
}
```

`getAppDatabase()` is the single app-tier entry point to the store. Feature hooks call it and then
call repository functions; screens call neither directly. This keeps `AGENTS.md`'s layering
(`app/ → feature hooks → src/db → SQLite`) and the `dbAccessBoundary` ESLint rule intact, because no
file outside `src/db/` imports `drizzle-orm`, `expo-sqlite` or `better-sqlite3`.

`latestJournalTag()` reads the newest `tag` from the journal that `drizzle/migrations.js` already
imports (`journal.entries.at(-1).tag`), so no new file read and no new bundler config is needed.

### Decision 2 — Widen the `migrate` port to allow an async thunk, additively

`BootstrapDeps.migrate` is typed `() => void`, and `src/db/testing/memory-db.ts` passes the
synchronous `drizzle-orm/better-sqlite3/migrator`. The Expo migrator
(`drizzle-orm/expo-sqlite/migrator`) is the async one. `drizzle-orm` is not installed in the current
`node_modules` tree at the plan revision, so the exact signature is **verified at implementation
time**, not asserted here (Implementation Order step 1).

The change is written so it is correct either way: widen the port to
`() => void | Promise<void>` and `await` it. `await` on a returned `undefined` is a no-op, so the
better-sqlite3 path is behaviourally identical and `openMigratedMemoryDb()` stays synchronous.

```ts
// Illustrative — adapt during implementation. src/db/migrate.ts
export async function runMigrationsAsync(
  migrate: () => void | Promise<void>,
  latestMigrationTag: string,
): Promise<void> {
  try {
    await migrate();
  } catch (cause) {
    throw new DatabaseMigrationError(
      `Failed to apply database migration '${latestMigrationTag}'`,
      { cause },
    );
  }
}
```

The existing synchronous `runMigrations` export is **not** modified or removed — `memory-db.ts`'s
`openMigratedMemoryDb()` and every test that depends on it keep working unchanged. `bootstrap.ts`
switches its one call site to `await runMigrationsAsync(...)`.

**Rejected**: making `runMigrations` itself `async`. It would force `openMigratedMemoryDb()` to
become async and ripple through roughly a dozen merged test files for no behavioural gain.

### Decision 3 — "Saltar" exists: the mockup outranks `BEHAVIOR.md`'s 🟡

`BEHAVIOR.md` → `onboarding-value` says: *"🟡 ¿existe «saltar»? El mockup no lo dibuja — si no está
dibujado, no existe."* That premise is **false at this revision**: `index.html:716` draws
`<button class="mu-btn mu-btn--ghost mu-btn--auto" onclick="go('connect-bank-intro')">Saltar</button>`
inside `#s-onboarding-value`'s top bar.

Three sources, two of which agree:

| Source | Says |
| --- | --- |
| `design/mockups/mobile/index.html:716` | "Saltar" is drawn, and it goes to `connect-bank-intro` |
| Work item #8 acceptance criteria | "The carousel advances and **«Saltar» jumps to `connect-bank-intro`**" |
| `BEHAVIOR.md` 🟡 | Asks whether it exists, on the (incorrect) premise that it is not drawn |

**Decision**: implement "Saltar". `AGENTS.md` non-negotiable 6 makes `design/mockups/mobile/` the UI
contract, the 🟡 mark explicitly means "propuesto, pendiente de validación", and the tracker brief —
the governing document for this Refactor-type item — requires it. `BEHAVIOR.md` line 51 is corrected
in the Documentation Updates list rather than silently ignored, because `BEHAVIOR.md`'s own
"Cómo se usa" section says a gap in that document is fixed by a PR to that document.

"Saltar" and the step-3 "Continuar" have the **same destination** (`/(onboarding)/connect-bank`).
"Saltar" is not a skip of onboarding — it is a skip of the remaining carousel pages. Nothing about
`onboarding_completed` changes on this path.

### Decision 4 — The carousel is a paged `ScrollView`; pages are the manifest states

`BEHAVIOR.md` says "🟡 Avance por swipe o CTA". Both are implemented, with no new dependency
(`react-native-gesture-handler` / `react-native-reanimated` are not installed and are not needed):
a horizontal `ScrollView` with `pagingEnabled`, page width from `useWindowDimensions()`, and a ref
so the CTA scrolls to the next page.

`VALUE_STEPS` is the single ordered source for the three pages, the three dots (`Dots` primitive,
`total`/`current`) and the manifest-parity test. The mapping is fixed and asserted:
`step-1` = index 0, `step-2` = index 1, `step-3` = index 2.

The step-1 checklist card is rendered **inside page 1**, not below the pager, so it travels with its
page instead of appearing and disappearing under a static footer. This matches the mockup's DOM
order (`data-states="step-1"` on the card, before the dots and CTA) and avoids a layout jump between
pages.

The CTA label is `Continuar` on all three pages (`index.html:749-751`); only the **action** changes
on page 3, from "scroll to next page" to "navigate to `/(onboarding)/connect-bank`".

### Decision 5 — `onboarding_completed` is written exactly once, at the ready screen's CTA

`BEHAVIOR.md` → `onboarding-ready`: *"Fin del onboarding: no se vuelve a entrar a `(onboarding)`
salvo para agregar bancos desde settings."* The write happens in `useCompleteOnboarding().complete()`,
**before** navigation, and navigation uses `router.replace` so the hardware back button cannot walk
back into the flow. The value screen's "Saltar" does not write it (Decision 3).

`markOnboardingCompleted(db)` is `setSetting(db, 'onboarding_completed', true)` — idempotent by
construction (`onConflictDoUpdate` on the primary key).

### Decision 6 — The ready CTA's destination is data-driven

`BEHAVIOR.md`: *"🟡 CTA → `stage-intro` si hay movimientos sin categorizar, o directo a `home` si
no."* `countUncategorized(db)` already exists in `src/db/repositories/transactions.ts` and is backed
by the partial index on `category_id is null and excluded_at is null`, so this needs no new SQL:

- `countUncategorized(db) > 0` → `router.replace('/categorize/intro')`
- otherwise → `router.replace('/(tabs)/home')`

Both routes exist as placeholders today (#13 and #12 own their contents). The count is read at press
time, not at mount, so a sync that finished while the screen was open is reflected.

### Decision 7 — The ready summary renders only rows it can truthfully fill

Acceptance criterion: *"`onboarding-ready` reflects the real connection and reminder state, not
hardcoded copy."* The mockup draws exactly one variant of this card — one bank connected, and
reminders on. It draws **no** "sin bancos" or "notificaciones desactivadas" variant, and the manifest
declares **no** states for `onboarding-ready`.

**Decision**: each row is conditional on real data, and no undrawn copy is invented.

| Row | Rendered when | Title | Subtitle |
| --- | --- | --- | --- |
| Banks (`🏦`) | `connectionCount > 0` | `banks_title_single` / `banks_title_plural` with `{{count}}` | `banks_subtitle` = `{{names}} · {{products}}`, names joined from the connected institutions, products from `banks_products_single` / `_plural` |
| Reminders (`🔔`) | `reminders.enabled === true` | `reminders_title` | `reminders.summary` = `{{time}} · {{days}}`, or omitted when `reminder_time`/`reminder_days` are missing or malformed |

With one connected bank holding three products, this renders `1 banco conectado` /
`Banco de Chile · 3 productos` — byte-identical to `index.html:1101`.

When neither row qualifies (the state the app is actually in until #9 and #18 land), the `Card` is
not rendered at all and the screen shows glyph + title + body + CTA. Inventing "0 bancos conectados"
would violate the i18n rule that the Spanish string comes from the mockup. This is Assumption A2,
and the Documentation Updates list adds it to `BEHAVIOR.md` so the decision is recorded where the
next screen item will look for it.

### Decision 8 — This plan fixes the reminder settings value contract for item #18

`docs/project/4-database-model.md` names the keys but not their value shapes, and nothing writes them
yet. Reading them requires a contract, so this plan defines it and documents it:

| Key | Value shape | Read behaviour when absent or malformed |
| --- | --- | --- |
| `onboarding_completed` | `true` (boolean JSON) | Treated as `false` (first launch) |
| `reminder_enabled` | boolean | Treated as `false` — the reminder row is not rendered |
| `reminder_time` | `"HH:mm"`, 24-hour, zero-padded | The reminder row renders with title only |
| `reminder_days` | array of ISO weekday integers, `1` = Monday … `7` = Sunday | The reminder row renders with title only |

`readReminderSettings(db)` validates defensively — `getSetting` returns `unknown`, and
`parseSettingValue` already returns `null` for unparseable JSON, so every branch is reachable and
tested. Item #18 must write these shapes; the contract is added to
`docs/project/4-database-model.md` in the Documentation Updates list so #18's plan inherits it
rather than re-deciding it.

### Decision 9 — The 12-hour clock label goes in `@finanzas/shared-utils`

The mockup writes `9:00 AM`. `shared-utils` already owns `formatTimeOfDay(instant, timeZone)`, which
returns 24-hour `14:32` from a `Date`. The new function takes the **stored string**, not an instant,
and is numeric-only (no `Intl`), so it is deterministic and needs no ICU:

```ts
// Illustrative — adapt during implementation. packages/shared-utils/src/dates.ts
/** `"09:00"` → `"9:00 AM"`. Numeric only, so it takes no locale — the mockup's format is
 *  fixed (`index.html:1102`, and the presets at `index.html:1048-1052`). */
export function formatWallClockLabel(timeOfDay: string): string;
```

Placing it in the app would contradict `AGENTS.md` and
[`expo-react-native.md`](../../../best-practices/stack/expo-react-native.md) ("Money, date and RUT
formatting live in `@finanzas/shared-utils` … not in `apps/mobile`"), and `settings-notifications`
(#19) plus the schedule screen (#18) need the same label.

`formatTimeOfDay` is **not** modified; the two functions have different inputs and different output
formats, and both doc comments say so.

### Decision 10 — Screen-level measured values go in a new `screenMetrics` export

`no-style-literals.test.ts` fails any numeric style-property literal outside `theme.ts`, and these
screens need mockup-measured numbers (the 62px hero glyph, the 20px summary-row glyph).

`theme` itself cannot grow a group: `theme-tokens-parity.test.ts` asserts
`Object.keys(theme).sort()` equals an exact ten-group allowlist mirrored from `design/tokens.json`.
`componentMetrics` is the established home for "measured from the mockup, not a design token", but
every one of its groups is named after a `components/ui/` primitive.

**Decision**: add a sibling export `screenMetrics` to `theme.ts`, with the same doc-comment
contract as `componentMetrics` (including the graduation rule: a value moves to
`design/tokens.json` when it is a colour, or when two unrelated surfaces use it for the same
semantic reason):

```ts
// Illustrative — adapt during implementation. src/theme.ts
export const screenMetrics = {
  onboarding: {
    /** `#s-onboarding-intro` (L702), `#s-onboarding-value` (L722/727/732),
     *  `#s-onboarding-ready` (L1095) hero glyph font-size. */
    heroGlyphSize: 62,
    /** `#s-onboarding-ready` summary-row glyph font-size (L1101-1102). */
    summaryGlyphSize: 20,
  },
} as const;
```

This sets the pattern for every later screen item (#12–#21) instead of stretching
`componentMetrics` past its documented meaning. `design-tokens.md` is updated to describe it.

### Decision 11 — Decorative glyphs are module constants, not catalogue entries

Direct application of item #34's Decision 10. `👋 🎯 🔒 🌱 🎉 ✓ 🏦 🔔` are language-independent icon
glyphs, not copy. They become named module-level constants in the file that renders them, so
`i18next/no-literal-string` sees an expression rather than JSX text and no `eslint-disable` is
written anywhere:

```tsx
// Illustrative — adapt during implementation.
/** Decorative glyph, not user-facing copy: language-independent, must not enter the catalogues. */
const WAVE_GLYPH = '👋';
```

They are also not added to `theme.ts` — `theme.categoryIcons` is a mirrored token group and
`theme-tokens-parity.test.ts` would reject an unmirrored addition.

### Decision 12 — `mu-topbar*` and `mu-item__*` stay deferred; these screens compose locally

`MU_CLASS_MAP` records `mu-topbar*` as deferred to #12 (Home) and `mu-item__txt` / `mu-item__title` /
`mu-item__sub` / `mu-list` as deferred to #19 (Settings hub). Both appear in the screens this item
builds: the value screen's "Saltar" row and the ready screen's summary rows.

**Decision**: build both as screen-local compositions of existing primitives — a right-aligned
`View` holding a ghost `Button` for the skip row, and `ReadySummaryRow` composing `Text` + `Badge`
inside a `Card` — and leave `MU_CLASS_MAP` **unchanged**.

The map records which `components/ui/` **primitive owns** a mockup class, not which screen has ever
rendered something that looks like it. Promoting `mu-item__*` to a primitive is a design-system
decision with `#screen=ds-components` consequences, and #19 owns it. Changing the map here would
make `mu-class-coverage.test.ts` assert an owner that does not exist in the barrel.

### Decision 13 — Explicit `_single` / `_plural` keys, not i18next plural suffixes

The catalogue is typed: `src/i18n/i18next.d.ts` derives the `t()` key union from `es.json` with
`keySeparator: false`. i18next's own plural machinery (`_one` / `_other` suffixes with an inferred
base key) interacts with that inference, and this repository has no precedent for it.

**Decision**: two explicit keys and a `count === 1` check in code. The suffixes are `_single` and
`_plural` precisely so they cannot collide with i18next's `_one` / `_other` plural separator
handling. Both keys satisfy the `catalogue-parity.test.ts` key pattern, both are in the typed union,
and the branch is covered by a unit test.

### Decision 14 — No React renderer: tests are pure functions plus static scans

`@testing-library/react-native` is not a dependency (Verification Log), and item #34's Decision 11
established the repository's precedent: assert through pure functions and static source scans rather
than rendering.

**Decision**: follow the precedent. Every non-trivial behaviour is extracted into a pure module that
is unit-tested without React (`resolveLaunchHref`, `stepIndexFromScrollOffset`, `nextStepIndex`,
`summarizeReminderDays`, `formatWallClockLabel`), the repository reads are tested against
`better-sqlite3` in the `db` Jest project, and rendering fidelity is covered by the smoke runbook.

Introducing a renderer is a real gap, but it is test-infrastructure work whose blast radius (jest-expo
preset, React 19 compatibility, a new devDependency in the app) does not belong in the first screen
item. It is filed under "Follow-ups to report, not implement".

### Decision 15 — Pending renders `null`; failures surface through Expo Router's `ErrorBoundary`

The mockups draw no splash screen and no launch-failure screen, and `expo-splash-screen` is not a
dependency.

- **Pending**: `app/index.tsx` renders `null` while the bootstrap resolves. On a warm launch this is
  imperceptible; on a first launch it is the migration + seed window.
- **Failure**: `useLaunchDecision` re-throws, and `app/index.tsx` re-exports `ErrorBoundary` from
  `expo-router` so the framework's error screen is shown instead of a permanently blank screen.

Authoring branded Spanish copy for an unrecoverable-migration screen would mean inventing copy that
does not exist in the mockup, which non-negotiable 8 forbids. It is Assumption A3 and a reported
follow-up (mockup change first, then the screen).

### Decision 16 — Explicitly out of scope

- Every screen from `connect-bank-intro` onward (#9, #10, #11) — this item only navigates to
  `/(onboarding)/connect-bank`.
- `notifications-intro` and `notifications-schedule` (#18) — this item **reads** the reminder
  settings it defines in Decision 8 and never writes them.
- `stage-intro` (#13) and `home` (#12) — targets of `router.replace`, still placeholders.
- Promoting `mu-topbar*` / `mu-item__*` to primitives (#12 / #19 — Decision 12).
- Local-database encryption (#25) and the design-fidelity automation (#47).
- Any `(auth)` route: non-negotiable 7, BR0. Nothing in this plan creates one.

---

## Assumptions

Every item below is a 🟡-derived or gap-derived choice made without a human in the loop. Each names
the evidence it rests on.

| # | Assumption | Evidence and rationale |
| --- | --- | --- |
| A1 | "Saltar" exists on `onboarding-value` and goes to `connect-bank-intro` | Drawn at `index.html:716`; required by the work item's acceptance criteria. Overrides `BEHAVIOR.md`'s 🟡, whose premise ("el mockup no lo dibuja") is false at this revision — Decision 3 |
| A2 | `onboarding-ready` hides a summary row rather than showing an undrawn "none/disabled" variant | The mockup draws only the positive variant and the manifest declares no states for this screen; inventing negative copy would breach non-negotiable 8 — Decision 7 |
| A3 | A bootstrap failure surfaces through Expo Router's `ErrorBoundary`, not a branded screen | No launch-failure frame exists in the mockups; branded copy would have to be invented — Decision 15 |
| A4 | `reminders.days_everyday` = `todos los días` | The only reminder-days label the mockup draws is `días laborales`. A seven-day selection is reachable from `notifications-schedule`, so a label is needed; this is the one string in this plan not sourced from the mockup, and it is flagged for LH to draw or replace |
| A5 | Custom day sets render as the drawn full day names joined by `' · '` | Day names come from `index.html:1074-1080`; the `' · '` separator is the mockup's own separator in the same subtitle (`index.html:1102`) and is a module constant, not copy |
| A6 | Multiple connected banks render as one aggregated row (`N bancos conectados`, names joined) | `onboarding-ready` declares no `multiple` state (unlike `bank-connected`, which does), so the drawn single row is the only layout available. MVP ships Banco de Chile only, so this path is unreachable in practice — Decision 7 |
| A7 | The carousel advances by both swipe and CTA | `BEHAVIOR.md` says "🟡 Avance por swipe o CTA"; the mockup draws dots, which imply a swipeable pager — Decision 4 |
| A8 | `reminder_time` is `"HH:mm"` and `reminder_days` is `[1..7]` with Monday = 1 | No source defines them; this plan defines the contract and documents it for #18 — Decision 8 |
| A9 | Onboarding routes render with no native header | Every onboarding frame in the mockup draws its own chrome (or none); a native header would double it |

None of these blocks implementation. A1–A4 are the ones a human should confirm at review; each is
paired with a documentation update so the confirmation lands in a durable place.

---

## Testing Strategy

**Test types**: Unit (`app` and `db` Jest projects, plus the `shared-utils` package) + Smoke
(manual, on a dev build).

**Key scenarios**:

1. **First launch routes to onboarding** (brief AC1) — `resolveLaunchHref(false)` returns
   `/(onboarding)/intro`. *(`src/features/onboarding/__tests__/launch-decision.test.ts`)*
2. **Subsequent launches route to home** (AC1) — `resolveLaunchHref(true)` returns `/(tabs)/home`.
   *(same file)*
3. **The single `users` row is created on first launch with a generated UUID** (AC2) — already
   covered by the merged `src/db/__tests__/bootstrap.test.ts`; this item adds
   `src/db/__tests__/settings-onboarding.test.ts` asserting that on a freshly bootstrapped store
   `isOnboardingCompleted(db)` is `false`, that `markOnboardingCompleted(db)` makes it `true`, and
   that calling it twice is idempotent (AC5).
4. **The carousel advances** (AC3) — `nextStepIndex` and `stepIndexFromScrollOffset` over the three
   pages, including the clamp at the last page and a half-scrolled offset.
   *(`src/features/onboarding/__tests__/value-steps.test.ts`)*
5. **The carousel implements every declared state** (non-negotiable 6) —
   `VALUE_STEPS.map((s) => s.stateId)` deep-equals the manifest's declared state ids in order.
   *(`src/features/onboarding/__tests__/value-steps-manifest-parity.test.ts`)*
6. **`onboarding-ready` reflects real state** (AC4) — against `openBootstrappedMemoryDb()`:
   an empty store returns `connectionCount: 0`; a store with one connected institution and three
   products returns `{ connectionCount: 1, institutionNames: ['Banco de Chile'], productCount: 3 }`;
   a `disconnected` institution is excluded. *(`src/db/__tests__/connections.test.ts`)*
7. **Reminder settings are read defensively** (AC4, Decision 8) — `readReminderSettings` over an
   absent key, a malformed JSON value, a valid full record, and a record missing `reminder_time`.
   *(`src/db/__tests__/settings-onboarding.test.ts`)*
8. **Reminder day summarisation** (A4, A5) — `summarizeReminderDays([1,2,3,4,5])` → `weekdays`;
   `[1..7]` → `everyday`; `[6,7]` → `custom`; `[]` → `custom` with no days; unordered input is
   normalised. *(`src/features/reminders/__tests__/summary.test.ts`)*
9. **12-hour clock label** (Decision 9) — `"09:00"` → `"9:00 AM"`, `"12:00"` → `"12:00 PM"`,
   `"00:30"` → `"12:30 AM"`, `"18:00"` → `"6:00 PM"`, and a malformed input's documented behaviour.
   *(`packages/shared-utils/src/dates.test.ts`)*
10. **Plural branch** (Decision 13) — `banksTitleKey` and `banksProductsKey` from
    `src/features/onboarding/ready-summary.ts` return the `_single` keys at count 1 and the
    `_plural` keys at 0 and 2; `reminderDaysKey` maps each `summarizeReminderDays` result to its
    catalogue key. *(`src/features/onboarding/__tests__/ready-summary.test.ts`)*
11. **All screen copy comes from the catalogue** (non-negotiable 8) — the catalogue-key scan
    described in the Residual verification strategy.
    *(`src/features/onboarding/__tests__/onboarding-catalogue-keys.test.ts`)*
12. **Existing guards still pass unchanged** — `route-manifest-parity`, `no-style-literals`,
    `theme-tokens-parity`, `mu-class-coverage`, `catalogue-parity`, `db-access-boundary`. This item
    adds no route file, no `theme` key and no `MU_CLASS_MAP` entry, so all six must pass without
    edits. Any need to edit one of them is a signal that a decision above was violated.

**Smoke test runbook**:
[`docs/testing/mobile/8-onboarding-intro-value-ready.smoke-test.md`](../../../testing/mobile/8-onboarding-intro-value-ready.smoke-test.md)

**Regression suite**: the repository has no automated regression suite yet (Maestro flows are item
#22). No regression spec is added here; the runbook's steps are written so #22 can lift them.

### Parser-risk addendum

**Not applicable.** No file under `scripts/lint/` or `scripts/parse/` changes; no module named for
lint/parser/scanner/tokenizer responsibilities is added; no regex-heavy or structured-text scanning
behaviour is introduced. The two static-scan tests reuse merged helpers
(`src/test-utils/catalogue-key-scan`, `src/test-utils/mockup-manifest`) without modifying them.

### Concurrent-event-source addendum

Included because the launch gate is an initialization sequence that races with component teardown,
and the ready screen's CTA is a user event that can arrive twice before its handler finishes.

- **Shared mutable state guards**: the only shared mutable state is the memoized database handle in
  `src/db/runtime.ts`. It is a module-level `Promise<AppDatabase>` written once before any `await`,
  so concurrent callers share one open+bootstrap rather than racing two. This mirrors the
  single-flight promise already inside `ensureDatabaseReady`, which remains the inner guard.
- **Re-entrancy / in-flight tracking**: yes for `complete()` on the ready screen — a double tap can
  fire it twice. Guarded by a `useRef<boolean>` in-flight flag that returns early on the second
  call, so `markOnboardingCompleted` and `router.replace` each run once per press sequence. The
  write itself is idempotent regardless (Decision 5), so the guard protects navigation, not data.
- **Event deduplication**: `onMomentumScrollEnd` can fire repeatedly for one gesture. The handler
  computes an index and calls `setState` with the same value, which React coalesces; no dedup logic
  is needed beyond comparing against the current index before setting.
- **Listener and resource cleanup**: the launch effect sets `cancelled = true` in its cleanup
  function and checks it before every `setState`. No timers and no subscriptions are created. The
  database handle is deliberately **not** closed on unmount — it is process-lifetime state owned by
  `src/db/runtime.ts`, not by any screen.
- **Race conditions at initialization**: a screen can mount and unmount before the bootstrap
  resolves. The cancellation flag drops the late result; the bootstrap itself continues and its
  memoized handle is reused by the next mount, so nothing is wasted or half-applied.
- **Race conditions at teardown**: a resolved bootstrap arriving after unmount is discarded by the
  same flag. A rejected bootstrap arriving after unmount is also discarded rather than re-thrown,
  because throwing from a cleaned-up effect would produce an unhandled rejection with no
  `ErrorBoundary` still mounted to catch it; the failure is re-observed on the next mount because
  `getAppDatabase()` clears its memo on failure.
- **Error propagation across async boundaries**: `useLaunchDecision` stores a rejection in state and
  re-throws it during render, which is what makes it reachable by the route's `ErrorBoundary`
  (throwing inside an async effect callback would not be). `useOnboardingSummary` does **not**
  re-throw: a failed summary read degrades to "no rows", because the ready screen must not become
  unreachable over a cosmetic query.
- **New concurrent patterns**: none. The memoized-promise and cancellation-flag patterns both follow
  the merged `src/db/bootstrap.ts` precedent.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| — | **No new seed data.** The starter content seeded by item #3 (16 categories, institutions including `banco-de-chile`, merchants) is sufficient; the committed fixture `apps/mobile/src/db/__fixtures__/store-v1.sql` is unchanged and `pnpm --filter @finanzas/mobile db:seed` must produce no diff | — |
| `user_financial_institutions` + `user_financial_products` | Test-only fixture rows for scenario 6: one `connected` institution referencing `banco-de-chile` with three products, plus one `disconnected` institution that must be excluded. Inserted in-test against `openBootstrappedMemoryDb()`, **not** added to the shipped seeds — a device must never boot with a fake bank connection | `apps/mobile/src/db/__tests__/connections.test.ts` |
| `app_settings` | Test-only rows for scenarios 3 and 7: `onboarding_completed`, and the four reminder-settings variants (absent / malformed / complete / partial) | `apps/mobile/src/db/__tests__/settings-onboarding.test.ts` |

Smoke-test data is produced by using the app: a fresh install is the first-launch scenario, and
completing onboarding once produces the returning-launch scenario.

---

## Documentation Updates

To be executed by the developer during implementation, not now.

- [ ] `design/mockups/mobile/BEHAVIOR.md` — **required**. In `### onboarding-value`, replace the
      "🟡 ¿existe «saltar»? El mockup no lo dibuja" line with the validated behaviour: "Saltar"
      is drawn at `index.html:716` and navigates to `connect-bank-intro` without ending onboarding
      (Decision 3). In `### onboarding-ready`, record the summary-row rule from Decision 7 and
      Assumption A2 (rows appear only when there is real state to report). In `### onboarding-intro`,
      promote the 🟡 entry/exit note to validated, since the launch gate now implements it.
- [ ] `docs/project/4-database-model.md` — in `### app_settings`, add the value shapes from
      Decision 8 (`onboarding_completed`, `reminder_enabled`, `reminder_time`, `reminder_days`) so
      item #18 writes what this item reads.
- [ ] `docs/best-practices/stack/design-tokens.md` — document the new `screenMetrics` export
      alongside `componentMetrics`, including the same graduation rule (Decision 10).
- [ ] `docs/best-practices/stack/expo-react-native.md` — the "Screen structure" example shows
      `queries.ts` with TanStack Query, which is not installed. Update it to the pattern this item
      actually establishes: feature hooks calling `getAppDatabase()` plus repository functions.
      Keep TanStack Query as the stated future direction if that is still the intent, but do not
      leave the example describing code that cannot compile.
- [ ] `AGENTS.md` — no change required. The repository structure, commands and non-negotiables are
      all still accurate after this item; `src/features/` is already documented as a directory.
- [ ] `docs/project/2-repo-architecture.md` and `docs/project/3-software-architecture.md` — read
      both during implementation and update only if the `src/db/runtime.ts` entry point or the
      `src/features/<area>/` layout contradicts what they describe. Do not edit them speculatively.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `drizzle-orm/expo-sqlite/migrator`'s signature differs from what the async port assumes | Medium | Medium | It is verified as Implementation Order step 1 before any code is written. The port widening (`() => void \| Promise<void>`) is correct for **both** the sync and async shapes, so the design does not depend on the answer |
| The first real device bootstrap fails on a device (migrations have only ever run under better-sqlite3) | Medium | High | `db:check` already applies the migration set in four modes in CI. The runbook's step 1 is an explicit fresh-install launch on a dev build, and a failure there blocks the item rather than shipping |
| A blank screen during a slow first-launch bootstrap reads as a hang | Medium | Low | Recorded as Assumption A3. The runbook measures the gap on a fresh install; if it is perceptible, the follow-up is a mockup-first splash frame, not invented copy |
| `pagingEnabled` + `useWindowDimensions()` mismeasures after rotation or on a foldable | Low | Low | Page width is read from the hook on every render rather than captured once, and the dots derive from the same index state the CTA writes. The runbook includes a small-screen viewport pass |
| Long Spanish copy overflows the value pages on a small device | Medium | Low | `mobile-ui-fidelity.md` requires a small-screen viewport capture; the runbook asks for one explicitly, and each page is inside the scrollable pager |
| The reminder row is unreachable until #18 lands, so its formatting is only unit-tested | High | Low | Accepted. The pure summariser and formatter are unit-tested (scenarios 8 and 9), and the runbook has an optional step that writes the settings keys directly to exercise the row before #18 exists |
| `screenMetrics` is judged the wrong home for screen measurements at review | Low | Low | Decision 10 records the two rejected alternatives (`theme`, blocked by the parity test; `componentMetrics`, semantically owned by primitives) so the reviewer can rule with the same evidence |

---

## Implementation Order

1. **Verify the Expo migrator signature.** Run `pnpm install`, then inspect
   `node_modules/drizzle-orm/expo-sqlite/migrator.d.ts`. Record in the PR body whether `migrate` is
   synchronous or asynchronous. *Verification*: the recorded signature is quoted in the PR body.
2. **Widen the migration port** — add `runMigrationsAsync` to `src/db/migrate.ts`, widen
   `BootstrapDeps.migrate` and `await` it in `src/db/bootstrap.ts` (Decision 2).
   *Verification*: `pnpm --filter @finanzas/mobile test` — the whole existing `db` project passes
   with no test file edited.
3. **Add the Expo runtime assembly** — `src/db/runtime.ts` with `getAppDatabase()` (Decision 1).
   *Verification*: `pnpm --filter @finanzas/mobile typecheck` passes, and `pnpm lint` reports no
   `dbAccessBoundary` violation.
4. **Add the repository reads** — `getConnectedBanksSummary` in the new
   `src/db/repositories/connections.ts`, the three settings accessors in
   `src/db/repositories/settings.ts`, and the two domain types in `src/db/types.ts`.
   Write `src/db/__tests__/connections.test.ts` and `src/db/__tests__/settings-onboarding.test.ts`
   (scenarios 3, 6, 7). *Verification*: both new suites pass in the `db` project.
5. **Add the shared formatter** — `formatWallClockLabel` in `packages/shared-utils/src/dates.ts`
   with its tests (scenario 9). *Verification*:
   `pnpm --filter @finanzas/shared-utils test` passes.
6. **Add the pure feature modules** — `launch-decision.ts`, `value-steps.ts`,
   `src/features/reminders/summary.ts` and `ready-summary.ts`, each with its unit test
   (scenarios 1, 2, 4, 5, 8, 10). *Verification*: the `app` Jest project passes, including the new
   manifest-parity test.
7. **Add the catalogue keys** to `es.json` and `en.json` (both, in one change).
   *Verification*: `catalogue-parity.test.ts` passes.
8. **Add `screenMetrics`** to `src/theme.ts` (Decision 10). *Verification*:
   `theme-tokens-parity.test.ts` still passes untouched.
9. **Wire the launch gate** — `app/index.tsx` and `app/(onboarding)/_layout.tsx`
   (`headerShown: false`), plus `use-launch-decision.ts`. `app/_layout.tsx` is expected to need no
   change (see Layer-by-Layer).
   *Verification*: launch a dev build on a simulator with the app data cleared and confirm it lands
   on the intro screen; relaunch after completing onboarding (step 12) and confirm it lands on the
   home placeholder.
10. **Build the three screens** — `intro.tsx`, `value.tsx` (with `ValueStepPage`), `ready.tsx`
    (with `ReadySummaryRow`), plus `use-onboarding-summary.ts` and `use-complete-onboarding.ts`.
    Delete no shared file: `RoutePlaceholder` is still used by the other placeholder routes.
    *Verification*: `pnpm lint` reports no `i18next/no-literal-string` and no `no-style-literals`
    violation, and the catalogue-key scan test passes.
11. **Compare against the mockup**, one `#screen=…&state=…` at a time, following
    `docs/best-practices/stack/mobile-ui-fidelity.md`. *Verification*: run the smoke runbook end to
    end and record the simulator, viewport and screenshot paths in the PR body.
12. **Run the full suite** — `pnpm lint && pnpm typecheck && pnpm test && pnpm check:layout`, plus
    `pnpm --filter @finanzas/mobile db:seed` to confirm the committed fixture is unchanged.
    *Verification*: all green, and `git status` shows no change under `src/db/__fixtures__/`.
13. **Update the project docs** listed in **Documentation Updates** above.
14. **Update `CHANGELOG.md`** under `[Unreleased]` → `### Added`, using the project's
    `**Bold Title** (#N):` format. Add exactly this entry:

    ```markdown
    - **Onboarding: intro, value carousel and ready** (#8): the app now opens on a real
      first-launch gate — `app_settings.onboarding_completed` decides between
      `(onboarding)/intro` and `(tabs)/home`, and the device database is bootstrapped at launch
      for the first time. The intro, three-step value carousel (swipe or CTA, with "Saltar") and
      ready screens are built from the mockup, with all copy in the `es`/`en` catalogues;
      `onboarding-ready` summarises the real connection and reminder state. Completing onboarding
      writes the flag and replaces the route so the flow is never re-entered.
    ```

### Follow-ups to report, not implement

1. **A React renderer for screen tests** (Decision 14) — every screen item after this one will want
   `@testing-library/react-native`. File it as a backlog item with the jest-expo / React 19
   compatibility check as its first step.
2. **A launch-failure frame in the mockups** (Decision 15, Assumption A3) — mockup first, then the
   screen, per the i18n rule.
3. **`reminders.days_everyday`** (Assumption A4) — the only string in this item not sourced from the
   mockup. Either draw it or replace it.
4. **`docs/best-practices/stack/expo-react-native.md` describes TanStack Query**, which is not
   installed. Listed under Documentation Updates for this item, but the larger question — whether
   the app adopts TanStack Query at all — is a separate decision for LH.
