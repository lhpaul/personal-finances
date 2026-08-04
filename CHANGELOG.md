# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Design system: `design/tokens.json` v1.0.0 and interactive HTML mockups covering 36 screens
  with 60 local states, built on the HTML Mockup Framework
- Project documentation: business domain, repository architecture, software architecture and
  the validated local-first SQLite data model
- Stack-specific best practices for Expo/React Native, SQLite + Drizzle, the bank scraper and
  design tokens
- AI development workflow from the `ai-dev-framework-template`
- **Bootstrap the monorepo and the Expo app** (#1): Turborepo + pnpm workspace with the Expo
  SDK 54 app (`apps/mobile`, Expo Router, strict TypeScript), the `shared-domain`,
  `shared-utils` and `bank-scraper` packages, placeholder routes for every MVP mockup screen,
  an enforced shared-domain import restriction, and lint / type-check / test checks on pull
  requests
- **shared-utils: CLP money, dates and RUT** (#4): `@finanzas/shared-utils` now ships CLP formatting (`formatClp`, `formatClpAbbreviated`), Chilean date helpers (`deriveDateLocal`, month/week period boundaries, es-CL labels) and RUT normalization, modulo-11 validation and display formatting. Locale formatting via `toLocaleString` is now an ESLint error repository-wide.
- **Theme and design-system primitives** (#2): `apps/mobile/src/theme.ts` as a parity-tested
  mirror of `design/tokens.json`, 23 UI primitives under `apps/mobile/src/components/ui/`
  matching the mockup `mu-*` classes, seven new design tokens, and a dev-only design-system
  gallery route at `/gallery`
- **i18n infrastructure: catalogues, resolver and the no-literal-string lint rule** (#34): `i18next` + `react-i18next` initialised in `apps/mobile/src/i18n/`, flat-key `es`/`en` catalogues, device-locale resolution via `expo-localization` defaulting to `es`, and `eslint-plugin-i18next/no-literal-string` enforcing, for JSX text covered by its `jsx-text-only` mode, that no user-facing literal string appears in JSX (known exception: the two tab-title literals in `apps/mobile/app/(tabs)/_layout.tsx`, which the rule's JSX-text-only mode cannot see). The design-system gallery now renders entirely from catalogue keys; `gallery.strings.ts` is removed.
- **Local database: schema, migrations and seed data** (#3): the full local SQLite store under
  `apps/mobile/src/db` — twelve tables with their indexes and constraints, the single shared
  inclusion rule, an idempotent bank-movement upsert that never overwrites a person's
  decisions, a ledger-driven starter-content seeder that neither overwrites an edit nor
  resurrects a deletion, and `db:generate` / `db:check` / `db:seed` with a four-mode check that
  mechanically rejects any non-additive change to the stored shape
- **shared-domain: rules, matching and aggregates** (#5): `@finanzas/shared-domain` now ships the inclusion rule as domain logic (the twin of the SQL fragment in `apps/mobile/src/db/fragments.ts`), merchant alias matching with `prefix` / `contains` / `exact` strategies and normalization, category suggestion with `auto` / `rule` / `user` provenance, and period aggregates — totals, per-category breakdown with largest-remainder percentages that sum to exactly 100%, period-over-period deltas and daily average. The clock is injected as a `DateLocal`; ESLint bans the `Date` global and React imports inside the package.
- **Onboarding: intro, value carousel and ready** (#8): the app now opens on a real
  first-launch gate — `app_settings.onboarding_completed` decides between
  `(onboarding)/intro` and `(tabs)/home`, and the device database is bootstrapped at launch
  for the first time. The intro, three-step value carousel (swipe or CTA, with "Saltar") and
  ready screens are built from the mockup, with all copy in the `es`/`en` catalogues;
  `onboarding-ready` summarises the real connection and reminder state. Completing onboarding
  writes the flag and replaces the route so the flow is never re-entered.
- **Port the bank scraper with Banco de Chile** (#6): `@finanzas/bank-scraper` now ships the
  headless read engine (`ScrapeSession` with `start` / `cancel`, message routing, step state
  machine and WebView driver), the four Banco de Chile reading routines (sign in, product
  list, account movements, credit-card details) under
  `src/configs/cl/banco-de-chile/`, an exact bank-origin allowlist checked at three points
  before any credential is entered, a single-owner credential holder cleared before the
  browser session is torn down, a redacting diagnostic trail asserted by test, integer
  minor-unit amount parsing including foreign-currency card movements, timezone-independent
  `DD/MM/YYYY` dates, bounded retries with an overall read deadline, and
  `complete` / `partial` / `failed` / `cancelled` read outcomes carrying an opaque per-product
  identity. Banco Falabella and Banco Pelotillehue are not ported.
- **Design-fidelity gate: port the Zeki fidelity kit wired to the mockup manifest** (#47): `scripts/mobile-ui/` compares every `mvp: true` mockup screen state against the running app on a 393×852 iOS simulator and fails when the pixel mismatch exceeds the screen's threshold. A fidelity contract registers all 64 MVP screen/state targets against `design/mockups/mobile/mockup-manifest.js` and is validated in CI, so a mockup state cannot be added — or a screen shipped — without the gate noticing. `pnpm fidelity:verify-gate` proves the comparison passes on a faithful build and fails on a wrong token, a wrong state and a wrong device size.
- **Home screen** (#12): the challenge hero, financial summary, trend chart, category
  breakdown, recent movements and connected-banks card, in all four manifest states
  (`pending`, `all-clear`, `empty`, `sync-error`), reading real aggregates through the
  shared `isIncluded` / `includedAmount` / `isPesoDenominated` fragments. Adds five
  design-system primitives (`ScreenHeader`, `CategoryRow`, `LineChart`, `Legend`, `BankRow`),
  `formatPercentTenths` in `@finanzas/shared-utils`, and a `__DEV__`-only sample-data route
- **Connect a bank: picker, credentials and secure storage** (#9): the connect-bank
  introduction with its security accordion, the bank picker over the seeded institution
  catalogue, the credential form with shared RUT validation, the rejection and RUT-locked
  states, and the connected screen. Credentials are written only to `expo-secure-store`,
  under a deterministic per-bank key, and the connection row holds the key and never a
  value. `connectBank` re-checks the RUT lock server-side (not only in the UI) and restores
  the prior credential if a reconnect's database write fails, so a stale password is never
  left stranded disguised as the current one. Adds the `TopBar` design-system primitive,
  extends `BankRow` and `TextField` additively, and adds a dev-only connect-flow fixtures
  route
- **Sync engine** (#10): a bank read is stored idempotently — products by the scraper's opaque
  instance identity, movements by an identity that now carries direction and an occurrence index,
  so two identical movements in one read stay two and a re-read adds none. The person's
  category, note, review flag, exclusion and merchant are never written by a sync. Each sync is
  one indivisible write and updates the connection's own record of its last attempt, last
  success and last failure.
- **Categorization flow** (#13): the stage intro, the categorization screen with its expense, income, not-sure and exclude-sheet states, and the partial/done completion screen — reading the pending queue and writing categories, deferral marks and exclusions through the shipped repositories.
- **Merchant editor and alias grouping** (#14): `#screen=merchant-edit` ships all three of its MVP states. A person can rename a merchant, fold several raw bank descriptions into it, and set a default category that applies to future movements only — a category the person already confirmed is never overwritten. Grouping an alias re-points or creates one `merchant_aliases` row, re-links unattributed movements that match it, and recomputes every alias's `match_count` from the movements table in one transaction. Alias suggestions are derived on device from the person's own movements; there is no backend and no community source. The screen also shows the merchant's spending over the current month and the two before it.
- **Transactions list** (#15): the month-grouped virtualized movement list with keyset
  pagination, text search across the raw description, merchant, note and category, the
  filter sheet (tipo, estado, producto, mostrar excluidas) with its header badge, the empty
  state and manual transaction entry, in all four manifest states (`list`, `search`,
  `filters`, `empty`). Excluded movements stay in the list, attenuated, per Business Rule 3
- **Bank syncing progress screen** (#11): `#screen=bank-syncing` shows the real scraper
  progress — every `ScraperStepId` moves the step list and the bar as it happens, and all four
  manifest states (`login`, `products`, `transactions`, `error`) are implemented. The error
  state explains what went wrong from a four-value failure code, never a raw exception, and
  *Reintentar* re-runs the sync with the credential already in the keychain — except after a
  credential rejection, the one failure that returns to the credentials form. The app's hidden
  `react-native-webview` host lives here, so no credential value ever reaches screen state, a
  log or an error payload.
- **Transaction detail and exclusion** (#16): the movement detail screen with its categorized, uncategorized and excluded states — the immutable bank facts, the editable note, a category change, the merchant shortcut, the exclusion sheet, and re-inclusion, which clears the exclusion fields and restores the movement to every total.

### Fixed

- **Foreign-currency movements no longer leak into peso totals on home or the categorization
  completion tiles** (#86): `sumIncludedByDirectionAndCategory`, `sumIncludedByDirectionAndDay`
  and `sumIncludedExpensesInPeriod` now also filter on `isPesoDenominated`, matching
  `totalForCategoryInPeriod`'s existing guard (#10) — a stored foreign-currency movement is
  excluded from every peso total and chart, and still shows up unchanged everywhere else
  (Business Rule 17). The guard's own scanner, `peso-total-scan.ts`, is tightened from a
  file-level pairing to per-declaration-scope: a guarded aggregate can no longer vacuously clear
  an unguarded sibling declared elsewhere in the same file — the exact gap that let this through.
- **Fix the pnpm hoisted layout and add a CI bundle check** (#35): `nodeLinker: hoisted` now lives
  in `pnpm-workspace.yaml`, where pnpm 11 actually reads it — a plain `pnpm install` produces the
  hoisted layout the Expo/Metro resolver needs, and `.npmrc` (which pnpm 11 silently ignored) is
  gone. A new `pnpm check:layout` check runs on every install and in CI, a new `iOS bundle` CI job
  runs `expo export:embed` so a tree that cannot build the app can no longer be green, and a test
  now proves the `@finanzas/shared-domain` import restriction rejects a deliberate violation.
