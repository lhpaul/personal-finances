# Software Architecture

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| App runtime | **Expo SDK 54 / React Native 0.81**, TypeScript strict. Node 22, pnpm 11.12.0 | The scraper needs a native WebView on the user's device. Expo gives OTA-free dev velocity plus `expo-secure-store` and `expo-notifications` out of the box. Continues the stack already proven in `bank-scrapper-app` |
| Navigation | **Expo Router** (file-based) | Routes in `design/mockups/mobile/mockup-manifest.js` are already written as Expo Router paths — the mockup manifest doubles as the routing spec |
| Storage | **SQLite** via `expo-sqlite` (SQLCipher-encrypted, `useSQLCipher: true` — item #25) + **Drizzle ORM** | Local-first is a product requirement, not a shortcut. Drizzle gives typed queries and file-based migrations without a codegen daemon. `useSQLCipher` is a **native build flag**: it is compiled into the binary via `app.config.js`'s `expo-sqlite` plugin entry, never delivered as a JS-only OTA update — every developer, every EAS profile and every existing dev client must be rebuilt (`npx expo prebuild --clean`) after it changes |
| Secrets | **`expo-secure-store`** (iOS Keychain / Android Keystore) | The one place bank credentials may exist |
| Scraping | **`react-native-webview`** + injected scripts (`@finanzas/bank-scraper`) | Hosted by `apps/mobile` (hidden) and `apps/scraper-lab` (visible). Registry: Chile, Falabella, synthetic Pelotillehue. Product picker still offers only Chile |
| State | Feature hooks (`getAppDatabase()` + repository functions) + React Context for session state | Screens are read-heavy over SQLite. **Not yet using TanStack Query** — it is not installed; the current pattern is a hook that awaits `getAppDatabase()` and calls repository functions directly (established by issue #8's onboarding screens, the app's first real screens). Adopting a query library for caching/invalidation remains a possible future direction, not a current dependency |
| Charts | Hand-rolled **`react-native-svg`** components | Item #12's home screen trend line is the first chart built (`src/components/ui/LineChart.tsx`); the dashboard (#17) adds `DonutChart` and `BarChart` and widens `LineChart`/`Legend` additively, all already drawn in the mockups. A chart library would cost more than it saves |
| i18n | **`i18next`** + `react-i18next` + `expo-localization`, enforced by `eslint-plugin-i18next` |
| Notifications | **`expo-notifications`**, local scheduling only | Reminders are local; there is no push server |
| Testing | **Jest** (unit) + **Maestro** (device E2E) | See [Testing Strategy](#testing-strategy) |
| CI | **GitHub Actions**; builds via **EAS** | |

## Key Architectural Decisions

### 1. Local-first, no backend

All data lives in SQLite on the device. There is no API, no server-side account, no sync.

**Why:** the differentiator is that credentials and movements never reach a server. A backend
would have to be justified against that promise. It also removes auth, RLS, migrations-in-prod
and infra cost from a one-day MVP.

**Cost, accepted:** no multi-device, no backup, no community merchant suggestions. Losing the
phone loses the data. The schema keeps `users.id` and stable UUID keys so a future sync layer
has anchors — see [4-database-model.md](4-database-model.md).

### 2. The scraper is a package, not a screen

`@finanzas/bank-scraper` exposes a headless `ScrapeSession` (`start()` / `cancel()`, constructed
with a `BankConfig`, a `WebViewPort` and the caller's credentials) plus a hidden `<WebView>`
implementing that port. `startBankRead({ countryCode, bankId, credentials, port, onResult })` is
the barrel's convenience entry point: it resolves the bank/country pair against the registry and
refuses before opening anything for an unsupported one. Bank-specific knowledge lives entirely in
`src/configs/cl/<bank>/*.script.ts`. `apps/mobile` hosts the WebView hidden during sync;
`apps/scraper-lab` hosts the same component with a visible WebView and does not persist the
result.

**Why:** bank sites change without warning. Adding or repairing a bank must be a contained
change: one directory, unit-tested script generators, no app code touched.

### 3. Domain logic is pure and separate

`@finanzas/shared-domain` holds merchant matching (`merchant-matching.ts`), category suggestion
(`category-suggestion.ts`), the inclusion rule (`inclusion.ts`) and period aggregates
(`aggregates.ts`, `apportionment.ts`) as pure functions over plain data. No React, no SQL, no I/O,
and no `Date` global — every date-dependent function takes the instant as an injected `DateLocal`
parameter.

**Why:** these are the rules most likely to be wrong and the cheapest to test. They run in
milliseconds in Jest without a simulator.

### 4. The mockups are the UI contract

`design/mockups/mobile/` is the source of truth for flow, layout and copy. `src/components/ui`
mirrors `design/tokens.json`. Every backlog item names the `#screen=` / `state=` it implements.

**Why:** it removes the "what should this look like?" round-trip from the implementation agent
and makes visual review diffable.

### 5. No auth in the MVP

There is no account, no sign-in and no identity. The app opens straight into onboarding, and
the profile is the device.

**Why:** with no server, there is nothing to authenticate against. An emailed one-time code
would need a service to send and hold it — shipping an extractable API key in the binary while
still verifying nothing, since the client would both issue and check the code. Rather than
build security theatre, the MVP is honest: the data is on the device, protected by the device
passcode and the OS sandbox.

**What this costs:** no recovery and no multi-device. Both were already out of MVP scope.

**How it comes back:** `auth` and `verify-code` are drawn in the mockups and flagged
`mvp: false`. When sync ships, identity ships with it, backed by a managed auth provider that
never sees financial data. `users.id` and stable UUID keys already exist as anchors.
The accepted remote-architecture decisions are recorded in [Architecture decisions](../decisions/README.md);
they do not add authentication, a backend, or remote data storage to the MVP.

### 6. One port, one adapter, one boundary, per native capability

Every native dependency this app talks to is wrapped in a narrow, hand-written port interface
with exactly one production implementer, enforced twice: an ESLint `no-restricted-imports` rule
(`eslint.config.mjs`) forbidding the package's import specifier anywhere else, and a source-scan
test that survives a lint-config regression. Three instances of the same shape exist:

| Native capability | Port | Adapter (the one sanctioned importer) | Boundary rule / test |
|---|---|---|---|
| SQL | repository functions over `AppDatabase` | `apps/mobile/src/db/` (the whole directory) | `dbAccessBoundary` / `db-access-boundary.test.ts` |
| Secrets | `SecureStorePort` | `src/lib/secure-store/expo-secure-store.adapter.ts` | `secureStoreBoundary` / `secure-store-boundary.test.ts` |
| Local notifications | `NotificationsPort` | `src/lib/notifications/expo-notifications.adapter.ts` | `notificationsBoundary` / `notifications-boundary.test.ts` (item #18) |

**Why:** every port is testable with an in-memory double and no simulator (`getAppDatabase()`'s
Node-tier fixture, `createMemorySecureStore()`, `createMemoryNotificationsPort()`), a future
platform change is a one-file diff, and no test ever calls a real native API through the port —
every test exercises pure functions and hooks over the double, never the adapter's own
implementation. This does **not** mean the real package's JS never loads: a hook that imports the
`notifications` barrel by value (not `import type`) pulls in `expo-notifications.adapter.ts`
transitively, so `expo-notifications`'s own module-scope code still runs under the `app` project —
harmlessly (jest-expo's native-module shims are enough for it to load without a device), but not
silently in every case. `expo-notifications` in particular logs an Expo-Go push-registration
`console.warn` at import time; `expo-secure-store` does not have an equivalent module-scope side
effect, so the same shape is quieter there. Neither package is ever explicitly mocked with
`jest.mock(...)` — this is an accepted consequence of "one real adapter, reached only through a
port," not a gap the port pattern was meant to close.

## Frontend Architecture

```
apps/mobile/
├── app/                        # Expo Router — routes mirror the manifest
│   ├── (onboarding)/…          # intro → value → connect-bank → … → ready
│   ├── (tabs)/home.tsx · transactions.tsx
│   ├── (dev)/gallery.tsx       # __DEV__-gated design-system gallery; no product screen links to it
│   ├── categorize/…            # intro · index · merchant/[merchantId] · complete
│   ├── transactions/[transactionId].tsx
│   ├── dashboard.tsx
│   └── settings/…
├── src/
│   ├── components/ui/           # Design-system primitives (theme.ts-driven, mirrors mu-* mockup classes)
│   ├── dev/                      # __DEV__-only surfaces (DesignSystemGallery) — never ships
│   ├── features/                # One folder per domain area
│   │   ├── sync/                 # Headless: idempotent persistence engine (item #10), no UI
│   │   └── <feature>/{components,use-*.ts}
│   ├── i18n/                    # es / en catalogues — all user-facing copy
│   └── db/runtime.ts            # getAppDatabase(): Promise<AppDatabase> — the app-tier entry point
```

There is no `(auth)` route group — this product has no sign-in. The tab bar renders exactly
two tabs in the MVP, Inicio and Transacciones; Presupuestos and Beneficios are not tab
destinations until those sections ship.

- **Components** are presentational; primitives come from `src/components/ui`.
- **Hooks** in `src/features/<feature>/use-*.ts` call `getAppDatabase()`
  (`apps/mobile/src/db/runtime.ts`) and then call `apps/mobile/src/db` repository functions
  directly — no TanStack Query, no `QueryProvider`, no `DatabaseProvider`, and no
  `app/_layout.tsx` change (established by issue #8's onboarding screens, the app's first real
  screens; see `use-launch-decision.ts`, `use-onboarding-summary.ts`,
  `use-complete-onboarding.ts`). `@tanstack/react-query` is not installed; adopting it is a
  possible future direction, not a current dependency. Screens never call Drizzle directly.
- **Screen states** in the mockups (`empty`, `error`, `filters`…) are real render branches.
  A screen is not done until every state in its manifest entry renders.
- **Copy lives in i18n catalogues** (`src/i18n/{es,en}.json`, flat keys), never inline in JSX.
  `i18next` + `react-i18next` with `expo-localization` for detection, matching
  `zeki-platform`. Enforced by `eslint-plugin-i18next/no-literal-string`.
- **Long, unbounded lists use `FlashList`** (`@shopify/flash-list`, item #15's `transactions`
  screen — the only table that grows without limit) over a flat, heterogeneous entry array with
  `getItemType`, never `.map()` into a `ScrollView`. `FlatList` + `getItemLayout` was rejected for
  this screen because a movement row's name can wrap to a second line, so no precomputed
  per-item height table is reliable; `FlatList` (no `getItemLayout`) is the recorded fallback if
  `FlashList` is ever incompatible with a future SDK/New-Architecture combination.

## Backend / API Architecture

**None.** The only network traffic the app makes is the WebView loading the bank's own site,
and the store/OS endpoints the platform itself uses. Nothing else.

Any future backend must be introduced as an *optional sync target*, never as a required
dependency, and must never receive credentials.

## Data Access Layer

```
screen → feature hook (getAppDatabase() + repository functions) → src/db repository → Drizzle → SQLite
                                                                 ↘ @finanzas/shared-domain (pure rules)
```

**The sync engine (item #10) is the one exception that renders nothing.** It sits in the same
layer as a feature hook, but its own inbound edge is a *read result*, not a screen event. The
seam end to end, across three items:

```
connect flow (item #9)          syncing screen (item #11)                sync engine (item #10)
────────────────────────        ──────────────────────────────────       ─────────────────────────
writes a connection row,   →    mounts the hidden <WebView>,         →   runSync(deps, request)
hands a ConnectHandoff          implements ScraperRunner by              → ScraperRunner.run(...)
{ connectionId, … } —            mounting BankScraperComponent,          → applySyncWrite(...)
never a credential value         reads the credential late (after        → src/db repository
                                  the device lock is held) and
                                  clears it on every settlement path
```

`useScraperRunner` (`apps/mobile/src/features/bank-syncing/use-scraper-runner.tsx`) is the
concrete `ScraperRunner` implementation and the only file in the app allowed the deep,
headless-barrel-excluded import `@finanzas/bank-scraper/src/component` — the hidden WebView it
wraps lives only while a read is in flight, keyed by a fresh identity per attempt, never reused
across a retry. `@finanzas/bank-scraper` is imported **type-only** by `src/features/sync` — the
engine itself never imports `expo-secure-store` or `expo-crypto`, and is handed only a
connection's `credentials_key` (a secure-store *key name*, never a value) — the credential itself
never enters this layer, only the syncing screen's own runner.

- `src/db` is the only module that emits SQL. Repository functions return domain types.
- Aggregates used by `home` and `dashboard` are SQL, not JS loops over the full table. `dashboard`
  (item #17) adds no aggregate of its own: it reads through `getAppDatabase()` plus item #12's
  `sumIncludedByDirectionAndCategory` / `sumIncludedByDirectionAndDay` / `listCategories` behind
  one feature hook (`useDashboardData`), the same shape every screen in this campaign uses. Its
  six-period trend chart folds one bounded day-grained read (≤ 368 rows for a six-month window)
  into period buckets with a pure function — this is still "aggregate in SQL, not in JS," because
  every filter and every `sum()` already happened in SQLite; the fold only reduces a row count
  bounded by the window, never by movement volume.
- The inclusion rule (`excluded_at IS NULL`, `COALESCE(included_amount, amount)`) has exactly
  **two** sanctioned statements: the shared SQL query fragment (`apps/mobile/src/db`) for
  set-based aggregates, and `@finanzas/shared-domain`'s `inclusion.ts` for in-memory plain
  objects. A third statement anywhere is a review blocker.
- Writes go through repositories so sync bookkeeping (`updated_at`, dedup) stays in one place.
- `src/db/migrate.ts` wraps Drizzle's migration runner and maps any throw to a typed
  `DatabaseMigrationError`. `src/db/bootstrap.ts` calls it, then writes `schema_version`, then
  applies seeds — every step idempotent, and single-flighted so two concurrent callers share one
  bootstrap run.
- Starter content is driven by a `seed_ledger` table (see
  [`4-database-model.md`](4-database-model.md#seed_ledger)), not by a plain upsert-by-slug: a
  refresh inserts a genuinely new starter record, corrects one nobody has touched, and never
  overwrites an edit or resurrects a deletion.
- Hashing and id generation are injected **ports**, not direct imports: repositories take a
  `DbPorts` object (`digestSha256`, `newId`, `now`). The runtime supplies `expo-crypto`; the test
  tier supplies `node:crypto` and a deterministic counter, so the native module is never loaded by
  Jest and the committed store snapshot stays reproducible.
- **Paginated reads use a keyset cursor, never `OFFSET`** (item #15, `transactions`): the cursor
  is the last row's `(date_local desc, id desc)` pair — a total order because `id` is the primary
  key, so a row inserted mid-scroll can never be skipped or repeated in an already-read prefix.
  `LIMIT limit + 1` answers "is there a next page?" without a second `count(*)`.
- **A filtered read and its own count are built from one shared predicate function**, called
  twice with a different `SELECT`/`GROUP BY` (item #15's `buildTransactionListPredicates` +
  `transactionListQuery`). This is the mechanism, not a convention: a header count and the rows
  under it cannot describe different sets, because a filter added to one and forgotten in the
  other is not expressible. Every later paginated, grouped read follows this shape.

## Security Model

| Concern | Approach |
|---------|----------|
| Bank credentials | `expo-secure-store` only. Keyed `bank_creds.<institutionId>` (dot, not colon — expo-secure-store's key validator rejects a colon; found in item #100). Read exclusively by the scraper, in memory, for the duration of one sync. Every write uses `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` (the library's own default has no `…ThisDeviceOnly` suffix, and would otherwise carry the entry into an encrypted device backup). Exactly one module, `apps/mobile/src/lib/secure-store/expo-secure-store.adapter.ts`, may import `expo-secure-store` — enforced by an ESLint rule and a source-text boundary scan (item #9) |
| Credentials in logs | The scraper's trace log redacts credential fields before any `console` call. `no-console` is enabled; traces go through a logger that strips known secret keys |
| Database | SQLite in the app sandbox, **encrypted at rest with SQLCipher** (item #25 — `expo-sqlite`'s `useSQLCipher`, no new dependency). A 32-byte raw key lives only in `expo-secure-store` (`db_key.main`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` — the key must stay readable while the device is locked, e.g. a #18 notification wake). An existing plaintext store migrates on first launch via a verified `sqlcipher_export` copy into a second file (`finanzas.enc.db`); the plaintext original (`finanzas.db`) is deleted only after the copy is confirmed row-for-row and is never deleted before that. A binary built without `useSQLCipher` refuses to launch (`PRAGMA cipher_version` returns no row) rather than silently opening a plaintext store |
| Auth | None. There is no account, no session and no authorization surface |
| Network | The app makes no requests to first-party servers. The WebView is restricted to the target bank's exact origin (`URL.origin` equality, never a suffix/substring match), checked at three independent points before any credential is entered: the navigation gate (`onShouldStartLoadWithRequest`), the injection gate (re-checked at load-end, before any script runs), and an in-page gate the login script itself evaluates as its first statement |
| Deletion | Settings' "Borrar todos mis datos" (item #19; there is no "cuenta" to eliminate — BR0) is an ordered, fail-closed sequence, not a bulk `DELETE`: (1) derive every `bank_creds.<institutionId>` key from `user_financial_institutions` ∪ the seeded institution catalogue, (2) delete each key from `expo-secure-store`, (3) read every key back and **stop before touching the database** if any survives, (4) only then close the SQLite handle and delete the encrypted store file, and clear the memoized handle plus the bootstrap single-flight so the next launch genuinely re-bootstraps, (5) delete the database key itself (`db_key.main`) and confirm it is gone — **after** the store file, never before, so the worst case is a stale key protecting a file that no longer exists, never a bricked profile (item #25). Irreversible, local-only, and no code path in it issues a `DELETE` against any table (`apps/mobile/src/features/settings/wipe-local-data.ts`) |

Threat model note: an attacker with an unlocked device has the data. That is the same exposure
as the user's own banking app, and is the accepted trade for never centralizing credentials.

## Environment Strategy

There are no server environments. "Environment" means **build profile**, via EAS.

| Environment | Purpose | App name / bundle id | Endpoint |
|-------------|---------|-----------------------|----------|
| `development` | Local development and CI's `bundle` job | `Finanzas [DEV]` · `cl.finanzas.mobile.dev` | Simulator / device via Expo dev server |
| `preview` | Internal builds for real-device testing | `Finanzas [BETA]` · `cl.finanzas.mobile.preview` | TestFlight internal / internal APK |
| `production` | Store builds | `Finanzas` · `cl.finanzas.mobile` | App Store / Play Store |

`useSQLCipher` (item #25) is compiled into the native binary, not shipped over the wire — there is
no "environment" in this table a JS-only update could deliver it through. Every profile above is
built from the same `app.config.js`, so all three carry the encrypted-store binary once the change
lands; a dev client built before it landed does not, and must be rebuilt (`npx expo prebuild
--clean`).

### Deployment Mapping

| Branch | Target | Deployment workflow | Path filter | Approval / protections |
|--------|--------|---------------------|-------------|------------------------|
| `develop` | `preview` (EAS internal) | `.github/workflows/eas-build.yml` | `apps/mobile/**`, `packages/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, the workflow file | `develop` environment, no required reviewer |
| `main` | `production` (EAS store submit) | `.github/workflows/eas-build.yml` | same as above | `production` environment — required reviewer + `EXPO_TOKEN`/`EAS_AUTO_SUBMIT` gates |

Every build job gates on a `preflight` job that checks `EXPO_TOKEN`: absent, the workflow stays
green and the build job skips (see
[`5-release-and-signing-runbook.md`](5-release-and-signing-runbook.md)).
`.github/workflows/deploy.yml` remains the framework's unused placeholder — it is not the
delivery workflow and carries no build logic.

Credential model (details in
[`5-release-and-signing-runbook.md`](5-release-and-signing-runbook.md)): the only **repository
secret** is `EXPO_TOKEN` (an Expo personal access token). The EAS project id
(`extra.eas.projectId`) and the bundle identifiers are **non-secret, committed** identifiers, not
credentials. Apple signing material (distribution certificate, provisioning profile, App Store
Connect API key) lives entirely in EAS-managed credentials and never touches GitHub or this
repository.

There is no auth secret, because there is no auth. No bank-related secret exists at build time
either — credentials only ever come from the user, at runtime, on the device.

No EAS Update / OTA channel is used: a JavaScript change never reaches a device without going
through the store or an internal build the owner explicitly installs, keeping "the app makes no
requests to first-party servers" intact.

## External Integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| Banco de Chile online banking | Source of products and movements | Scraped on-device. **Unversioned third-party HTML — expect breakage.** Scripts are isolated per bank and unit-tested |
| *(none)* | — | The app makes no first-party network calls |
| Expo EAS | Builds and submissions | |

No analytics or crash reporting in the MVP. Adding either requires an explicit decision about
what leaves the device.

## Testing Strategy

The riskiest code is not the UI — it is the scraper (external HTML) and the aggregates (money
arithmetic). Testing weight goes there.

### Overview

| Tier | Tool | Location | When to use |
|------|------|----------|-------------|
| **Unit — domain** | Jest | `packages/shared-domain/**/*.test.ts` | Every rule in [1-business-domain.md](1-business-domain.md#business-rules). Mandatory |
| **Unit — data** | Jest + in-memory SQLite | `apps/mobile/src/db/**/*.test.ts` | Repositories, migrations, dedup on re-sync. Mandatory |
| **Unit — scraper** | Jest — `node` for the engine/security/parsers, `jsdom` for the four reading routines | `packages/bank-scraper/src/**/*.test.ts` (engine, security, parsing) and `packages/bank-scraper/src/**/*.dom.test.ts` (injected script generators against fixtures) | Every reading routine against a recorded/hand-authored HTML fixture; the security perimeter (origin allowlist, credential holder, redaction) against planted violations. Ported from `bank-scrapper-app` (issue #6) |
| **Device E2E** | Maestro, contract-driven | `.maestro/` | Ten flows: first-launch onboarding through bank connection, sync to a populated home, a categorization session, transaction detail and exclusion, the dashboard, re-sync idempotency, settings wipe, settings banks, settings categories, and notifications (item #22). `.maestro/flow-contract.json` + `scripts/e2e/flow-contract.mjs`/`flow-lint.mjs` run in CI on every PR (no simulator); the device leg is label-gated (see below) |
| **Toolchain — layout & bundle** | `scripts/check-node-linker-layout.mjs` + `expo export:embed` | `pnpm check:layout` (postinstall + CI), CI `bundle` job | Every install and every PR. Proves the `node_modules` tree is hoisted and that Metro can actually produce an iOS bundle — CI cannot be green on a tree that cannot build the app |
| **UI — design fidelity** | `scripts/mobile-ui/` (Playwright + pixelmatch, `node --test`) | `pnpm fidelity:contract` / `fidelity:test` in CI; `pnpm fidelity` / `fidelity:verify-gate` local-only | Every screen item: the manifest-driven contract (`fidelity-targets.json`) and its unit tests run in CI on every PR; the mockup-vs-simulator pixel diff needs a booted device and stays local (item #47) |

The automated suite is the canonical record of what works.

### Automated Suite

```bash
pnpm test                                   # all unit tiers
pnpm --filter @finanzas/shared-domain test           # fastest feedback loop
pnpm e2e:contract                           # E2E flow contract validation — CI, no simulator
pnpm e2e:lint                               # E2E credential scanner + selector rule — CI, no simulator
pnpm e2e:test                               # E2E toolchain unit tests — CI, no simulator
pnpm e2e                                    # AC1's device suite: maestro test .maestro/, wrapped with
                                             # preflight checks — local only (or the label-gated
                                             # maestro-ios CI job), needs a booted "Finanzas E2E"
                                             # simulator and a Debug (__DEV__) build
maestro test .maestro/                      # the literal AC1 acceptance command
pnpm fidelity:contract                      # design-fidelity contract validation — CI, no simulator
pnpm fidelity:test                          # design-fidelity contract + comparator unit tests — CI
pnpm fidelity --screen home --state pending # mockup vs. running-app pixel diff — local only, needs
                                             # a booted "Finanzas Fidelity" simulator and a dev build
```

`Finanzas E2E` and `Finanzas Fidelity` are two separate, dedicated simulators (`.maestro/README.md`,
item #22 D4) — the E2E suite's `reset` fixture state deletes secure-store credentials, which must
never happen on whichever device a fidelity capture is mid-run on, and an E2E run leaves the
database in a flow-specific state that would corrupt a subsequent fidelity comparison.

The device leg of the Maestro suite is wired but **off by default**: `e2e-regression.yml`'s
`maestro-ios` job (macOS runner) is gated on both the `ready-for-regression` label and the
repository variable `ENABLE_MAESTRO_E2E`. Until an owner sets that variable, the job never starts
and bills nothing — the suite is fully usable locally via `pnpm e2e` in the meantime. A follow-up
(not adopted in item #22) is consuming an EAS-built simulator artifact (item #23's `development`
profile) instead of compiling the native project on the runner, once that profile's own posture
supports it.

Non-negotiable cases:

- **Re-sync is idempotent** — run the same scrape fixture twice, assert the row count is stable.
- **Excluded and partially-included movements** are honoured by every aggregate — see
  `packages/shared-domain/src/inclusion.ts`'s `INCLUSION_RULE_CASES` and the Fixture A/B
  assertions in `aggregates.test.ts` for the hand-derived expected numbers.
- **Deleting a category** re-parents its transactions to ✨ Otros.
- **No credential ever reaches the database or a log line** — asserted in the scraper tests.
- **Migrations are additive** — open a fixture DB from the previous schema version and migrate.

### Relationship Between Runbooks and Specs

Each smoke-test runbook (`docs/testing/[section]/[feature].smoke-test.md`) is the
human-readable specification for a feature's key journeys; the Maestro flow is its executable
form. Runbook steps map 1:1 to flow steps.

### Ad-hoc Scripts (Fallback)

When no spec exists yet, agents write throwaway scripts under the scratchpad, never committed.
Once validated, the logic is promoted to a committed test.
