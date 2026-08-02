# Software Architecture

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| App runtime | **Expo SDK 54 / React Native 0.81**, TypeScript strict. Node 22, pnpm 11.12.0 | The scraper needs a native WebView on the user's device. Expo gives OTA-free dev velocity plus `expo-secure-store` and `expo-notifications` out of the box. Continues the stack already proven in `bank-scrapper-app` |
| Navigation | **Expo Router** (file-based) | Routes in `design/mockups/mobile/mockup-manifest.js` are already written as Expo Router paths — the mockup manifest doubles as the routing spec |
| Storage | **SQLite** via `expo-sqlite` + **Drizzle ORM** | Local-first is a product requirement, not a shortcut. Drizzle gives typed queries and file-based migrations without a codegen daemon |
| Secrets | **`expo-secure-store`** (iOS Keychain / Android Keystore) | The one place bank credentials may exist |
| Scraping | **`react-native-webview`** + injected scripts (`@finanzas/bank-scraper`) | Ported from `bank-scrapper-app`. Banco de Chile is already implemented |
| State | **TanStack Query** over repository functions + React Context for session state | Screens are read-heavy over SQLite; Query's cache/invalidate model fits better than a global store. No Redux |
| Charts | Hand-rolled **`react-native-svg`** components | The dashboard needs five chart shapes, all already drawn in the mockups. A chart library would cost more than it saves |
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

`@finanzas/bank-scraper` exposes a headless imperative API (`start(country, bankId, credentials)`)
plus a hidden `<WebView>`. Bank-specific knowledge lives entirely in
`configs/cl/<bank>/*.script.ts`.

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
│   │   └── <feature>/{components,hooks,queries}.ts
│   ├── i18n/                    # es / en catalogues — all user-facing copy
│   └── lib/                     # Query client, db provider, formatters, logger
```

There is no `(auth)` route group — this product has no sign-in. The tab bar renders exactly
two tabs in the MVP, Inicio and Transacciones; Presupuestos and Beneficios are not tab
destinations until those sections ship.

- **Components** are presentational; primitives come from `src/components/ui`.
- **Hooks** in `src/features/*/queries.ts` wrap TanStack Query over `apps/mobile/src/db`
  repositories. Screens never call Drizzle directly.
- **Screen states** in the mockups (`empty`, `error`, `filters`…) are real render branches.
  A screen is not done until every state in its manifest entry renders.
- **Copy lives in i18n catalogues** (`src/i18n/{es,en}.json`, flat keys), never inline in JSX.
  `i18next` + `react-i18next` with `expo-localization` for detection, matching
  `zeki-platform`. Enforced by `eslint-plugin-i18next/no-literal-string`.

## Backend / API Architecture

**None.** The only network traffic the app makes is the WebView loading the bank's own site,
and the store/OS endpoints the platform itself uses. Nothing else.

Any future backend must be introduced as an *optional sync target*, never as a required
dependency, and must never receive credentials.

## Data Access Layer

```
screen → feature hook (TanStack Query) → src/db repository → Drizzle → SQLite
                                       ↘ @finanzas/shared-domain (pure rules)
```

- `src/db` is the only module that emits SQL. Repository functions return domain types.
- Aggregates used by `home` and `dashboard` are SQL, not JS loops over the full table.
- The inclusion rule (`excluded_at IS NULL`, `COALESCE(included_amount, amount)`) has exactly
  **two** sanctioned statements: the shared SQL query fragment (`apps/mobile/src/db`) for
  set-based aggregates, and `@finanzas/shared-domain`'s `inclusion.ts` for in-memory plain
  objects. A third statement anywhere is a review blocker.
- Writes go through repositories so sync bookkeeping (`updated_at`, dedup) stays in one place.

## Security Model

| Concern | Approach |
|---------|----------|
| Bank credentials | `expo-secure-store` only. Keyed `bank_creds:<institutionId>`. Read exclusively by the scraper, in memory, for the duration of one sync |
| Credentials in logs | The scraper's trace log redacts credential fields before any `console` call. `no-console` is enabled; traces go through a logger that strips known secret keys |
| Database | SQLite in the app sandbox. Not encrypted at rest in the MVP — the OS sandbox plus device passcode is the boundary. **SQLCipher is a fast follow, tracked in the backlog** |
| Auth | None. There is no account, no session and no authorization surface |
| Network | The app makes no requests to first-party servers. The WebView is restricted to the target bank's origin |
| Deletion | "Eliminar cuenta" wipes the SQLite file and every `expo-secure-store` key, irreversibly and locally |

Threat model note: an attacker with an unlocked device has the data. That is the same exposure
as the user's own banking app, and is the accepted trade for never centralizing credentials.

## Environment Strategy

There are no server environments. "Environment" means **build profile**, via EAS.

| Environment | Purpose | Endpoint |
|-------------|---------|----------|
| `dev` | Local development, app name `Finanzas [DEV]` | Simulator / device via Expo dev server |
| `preview` | Internal builds for real-device testing | TestFlight / internal APK |
| `production` | Store builds | App Store / Play Store |

### Deployment Mapping

| Branch | Target | Deployment workflow | Approval / protections |
|--------|--------|---------------------|------------------------|
| `develop` | `preview` (EAS internal) | `.github/workflows/deploy.yml` | required checks only |
| `main` | `production` (EAS store submit) | `.github/workflows/deploy.yml` | required reviewers + environment protection |

Environment-specific secrets, **names only**: `EXPO_TOKEN`, `EAS_PROJECT_ID`, `APPLE_TEAM_ID`.

There is no auth secret, because there is no auth. No bank-related secret exists at build time
either — credentials only ever come from the user, at runtime, on the device.

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
| **Unit — scraper** | Jest over jsdom | `packages/bank-scraper/**/*.test.js` | Injected script generators against captured HTML fixtures. Pattern already exists in `bank-scrapper-app` |
| **Device E2E** | Maestro | `.maestro/` | Happy paths only: onboarding, categorization, exclusion |
| **Toolchain — layout & bundle** | `scripts/check-node-linker-layout.mjs` + `expo export:embed` | `pnpm check:layout` (postinstall + CI), CI `bundle` job | Every install and every PR. Proves the `node_modules` tree is hoisted and that Metro can actually produce an iOS bundle — CI cannot be green on a tree that cannot build the app |

The automated suite is the canonical record of what works.

### Automated Suite

```bash
pnpm test                                   # all unit tiers
pnpm --filter @finanzas/shared-domain test           # fastest feedback loop
pnpm --filter @finanzas/mobile exec maestro test .maestro/   # device flows, requires a booted simulator
```

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
