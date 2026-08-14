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
  identity.
- **Scraper lab app sharing `@finanzas/bank-scraper`** (#116): Falabella and a synthetic Banco
  Pelotillehue join Banco de Chile in the scraper package (origin allowlist, `toJsStringLiteral`,
  per-directory containment). `apps/scraper-lab` is a second Expo 54 host with a visible WebView
  and no SQLite. The product picker still lists only Chile as `available`. EAS auto-builds are
  filtered to `apps/mobile/**` so the lab is never built on merge.
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
- **Settings: connected banks and bank review** (#20): the connected-banks list with its empty
  state, per-bank detail with products, balances and cupo, manual re-sync and credential
  update hand-offs, and disconnection — which deletes the keychain entry and keeps every
  downloaded movement. The list re-reads immediately after a confirmed disconnect (#111,
  found in post-merge QA) — it previously kept showing the connected row until the screen
  lost and regained focus.
- **Dashboard** (#17): the trend, spending-overview and category-report cards in both
  manifest states (`month`, `week`), with month/week period toggles, donut and bar charts
  on `react-native-svg`, and per-card empty states. Every figure is produced by the same
  `apps/mobile/src/db/repositories/transactions.ts` aggregates the home screen calls, so
  the two screens cannot diverge; this item adds no SQL. Adds the `DonutChart` and
  `BarChart` design-system primitives and wires the two `dashboard` design-fidelity targets
- **Mockup manifest verification script** (#24): `scripts/design/verify-manifest.mjs` and
  `pnpm mockups:verify` enforce the mockup PR checklist mechanically — navigation targets,
  unique local states, exactly one `initial: true`, no screen-level fields inside states,
  manifest/DOM parity, declared `data-states`, resolvable `go()` targets, and semantic colour
  tokens mirrored in `:root`. Runs in CI on every pull request and replaces the `node -e`
  one-liner in `design/mockups/mobile/README.md`, including its two documented false positives
- **Settings: hub, local profile and about** (#19): the settings hub, the local-profile screen
  and the about screen, plus the product's only destructive operation — a full local wipe of
  the SQLite store and every `expo-secure-store` credential key, behind an explicit
  confirmation, returning the app to onboarding.
- **Settings: categories management** (#21): the categories screen — expense and income tabs,
  create, rename and re-icon, drag to reorder with persisted `sort_order`, and delete with
  re-parenting to ✨ Otros through the existing transactional cascade. The two ✨ Otros
  categories offer no edit, delete or reorder affordance.
- **EAS build profiles and release CI** (#23): `eas.json` gains real `development`,
  `preview` and `production` profiles with per-variant app names and bundle identifiers, a
  new `.github/workflows/eas-build.yml` maps `develop` to internal builds and `main` to store
  builds, and `docs/project/5-release-and-signing-runbook.md` documents the credential model
  and the release procedure. Signing material stays in EAS-managed credentials; `EXPO_TOKEN`
  is the only repository secret.
- **Notifications and local reminders** (#18): the onboarding flow now asks for the OS
  notification permission at `notifications-intro` (never at launch), treats a denial as a
  supported state with how-to-re-enable copy, and lets the person pick a time and the days of
  the week. Reminders are scheduled locally with `expo-notifications` behind a single adapter —
  no push token, no server — and saving a schedule cancels the app's own scheduled
  notifications before registering the new set, so changing it reschedules instead of
  duplicating. `/settings/notifications` shows and edits the same schedule, and reflects a
  revoked OS permission as disabled.
- **Maestro end-to-end flows** (#22): a contract-driven device E2E suite in `.maestro/` — ten
  flows covering first-launch onboarding through bank connection, sync to a populated home, a
  categorization session, transaction detail and exclusion, the dashboard, re-sync idempotency,
  and (screens #18/#19/#20/#21 having all merged by the time this item was implemented) the
  settings wipe, settings banks, settings categories and notifications flows the plan originally
  declared as extensions. Adds the `__DEV__` `/(dev)/e2e-fixtures` panel with five named,
  idempotent device states, a deterministic stubbed read (`complete_with_data`), and `pnpm e2e` /
  `e2e:contract` / `e2e:lint` / `e2e:test`. No flow file contains a real credential, and the
  credential scanner proves it in CI. The macOS `maestro-ios` job is wired but off until
  `ENABLE_MAESTRO_E2E` is set. Running the suite for real against a Debug build found three
  pre-existing product bugs blocking four of the ten flows (a real-device-only `expo-secure-store`
  key-format rejection, a screen missing a `ScrollView`, and a shared overlay primitive that
  merges sheet/modal contents into one non-individually-tappable accessibility element) — none
  fixed here (out of this item's scope); see the runbook's *Blocked flows* section. **Closing-task
  update**: with all three bugs fixed on `develop` (#101, #103, #106), flows 04 and 07 now pass —
  04 needed a flow-file fix (a targeted `swipe` in place of `scrollUntilVisible` against the
  exclude sheet's own footer) and 07 needed a selector fix (a `.*` suffix, since the settings
  hub's "Acerca de"/"Perfil local" subtitles are no longer empty on this build). Flows 01 and 03
  each hit a new, real, pre-existing product bug the original three findings' fixes uncovered
  once the flows could run further — see the runbook's *Blocked flows* section for both.
- **Encrypt the local database at rest** (#25): the on-device SQLite store is now SQLCipher-encrypted with a 32-byte key held only in `expo-secure-store`. Existing unencrypted databases migrate on first launch via a verified `sqlcipher_export` copy that never deletes the original until the replacement is confirmed row-for-row. Requires a native rebuild — this change cannot be delivered as a JS-only update.

### Fixed

- **iOS scrape start no longer crashes on `about:blank`** (#116): `react-native-webview` treats a URI without a host as a file URL and calls `WKWebView loadFileURL`, which throws `about:blank is not a file URL`. The host WebView now loads a blank HTML document for bootstrap and teardown, matching the old lab.
- **Bank pages stay in the in-app WebView instead of Safari** (#116): `originWhitelist` was bound to `allowedOrigins`, and react-native-webview opens any non-matching URL with `Linking.openURL`. The allowlist remains the navigation/injection/in-page gates; `originWhitelist` stays the default `http://*` / `https://*` so a bank redirect does not leave the app.
- **Banco de Chile post-login portal is an allowed origin** (#116): after sign-in the bank navigates to `https://portalpersonas.bancochile.cl`. That host is now on `allowedOrigins`; credentials are still typed only at `https://login.portales.bancochile.cl`.

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
- **P0: the app crashed at first render on every device build** (#95): `getAppDatabase()`
  (`apps/mobile/src/db/runtime.ts`) read `require('../../drizzle/migrations').journal`, but this
  project's real `babel-preset-expo` interop compiles that file's `export default { journal,
  migrations }` to `exports.default = {...}` in every real environment — Metro's bundle and
  Jest's `babel-jest` transform both nest it under `.default` — so `.journal` was always
  `undefined`. This retroactively explains every failed on-device fidelity capture in the
  campaign: the app had never successfully booted on a device build. A new
  `resolveMigrationsConfig` (`apps/mobile/src/db/migrations-config.ts`) accepts either the flat
  or the `.default`-nested shape; `src/db/__tests__/migrations-journal-interop.test.ts` compiles
  the real `drizzle/migrations.js` with the real Babel config under both a Metro-shaped and a
  `babel-jest`-shaped caller and asserts the accessor resolves a defined journal — the pre-fix
  `.journal`-only accessor is proven to fail in the same suite. `expo export:embed` alone did not
  catch this (it already passed while the bug existed); the fix's evidence includes a real
  simulator boot reaching the onboarding launch gate.
- **Secure-store credential keys used a colon the real `expo-secure-store` validator rejects**
  (#100): `credentialsKeyFor` (`apps/mobile/src/lib/secure-store/credential-store.ts`, #9) built
  keys as `bank_creds:<institutionId>` — the installed `expo-secure-store@15.0.8`'s own key
  validator (`build/SecureStore.js`'s `isValidKey`, `/^[\w.-]+$/`) rejects a colon, so every real
  credential write, read or delete would throw on a device (the same shape #25/PR #99 found and
  fixed for the encryption key, `db_key.main`). The format is now `bank_creds.<institutionId>`
  (dot separator, converging with #99's choice); every hand-built literal that bypassed
  `credentialsKeyFor` (a dev-fixture writer and several test doubles) was swept to call it
  instead. The in-memory secure-store fake used by Node-tier tests
  (`apps/mobile/src/lib/secure-store/testing/memory-secure-store.ts`) now enforces the identical
  key-validation regex on every operation, so a future hand-built invalid key fails in Node
  instead of only on a real device — no stored-data migration is needed (no released users).
- **The shared Sheet/Modal overlay fused every descendant into one accessibility element**
  (#104): `_internal/Overlay.tsx`'s two wrapping `Pressable`s (the backdrop and the no-op
  content-touch-capture layer) left `accessible` at `Pressable`'s own default (`true`) — a
  `View`/`Pressable` with `accessible={true}` merges all of its subviews' accessibility info
  into ONE node, so a screen reader could not reach any individual button inside a `Sheet` or
  `Modal` (found by E2E flows 04/07 on device, item #22, PR #102). Both wrapping layers are now
  `accessible={false}`, making them transparent to the accessibility tree while sighted touch
  dismissal is unaffected. The overlay's element-tree construction is split out into a hookless
  `renderOverlayTree` so `Overlay.test.tsx` can assert, via the renderer-free element-tree
  walker, that a `Sheet`'s/`Modal`'s own buttons remain separate accessible nodes.
- **`StageIntroScreen`'s CTA was unreachable on the reference device profile** (#103): the
  screen wrapped its content (hero, "what we'll do", the three step icons, the two stat tiles,
  the "why it matters" list, the note and the "🚀 ¡Empezar mi primera etapa!" CTA) in a plain
  `View`, not a `ScrollView` — on the 393×852 reference profile the content overflowed the
  viewport height and the CTA rendered entirely off-screen with no way to scroll to it (found by
  E2E flow 03 on a real simulator, item #22, PR #102). The content now sits inside a
  `ScrollView`, following the same pattern `CategorizeCompleteScreen` already uses; a new
  source-scan test (`stage-intro-scroll.test.ts`) proves the CTA sits inside the `ScrollView`'s
  open/close tags, with planted-violation proofs for both a missing `ScrollView` and a
  `ScrollView` present but the CTA left outside it.
- **`CategorizeScreen`'s "Siguiente" CTA was unreachable on the reference device profile** (#107):
  the identical defect class #103 fixed on `StageIntroScreen` — the screen wrapped its content
  (stage progress, the movement card, the category grid, the "not sure" disclosure, the optional
  write-failed note, and the "Omitir" / "Siguiente" buttons) in a plain `View`, not a
  `ScrollView`, so a taxonomy-heavy category grid could push the CTA entirely off-screen on the
  393×852 reference profile with no way to scroll to it. The content now sits inside a
  `ScrollView`, following the same pattern `StageIntroScreen` and `CategorizeCompleteScreen`
  already use in this same feature folder; a new source-scan test (`categorize-scroll.test.ts`,
  mirroring `stage-intro-scroll.test.ts`) proves the "Siguiente" CTA sits inside the
  `ScrollView`'s open/close tags, with planted-violation proofs for both a missing `ScrollView`
  and a `ScrollView` present but the CTA left outside it. A sweep of every other screen-level
  `SafeAreaView` in `apps/mobile/app/` and `apps/mobile/src/features/` found no further instance
  of this defect: `CategorizeCompleteScreen` and `TransactionDetailScreen` already wrap in a
  `ScrollView`; the two remaining screens without one (`(onboarding)/intro.tsx`,
  `(onboarding)/ready.tsx`) use a fixed, bounded-content `justifyContent: 'space-between'` splash
  layout, not an open-ended content list, so they are not the same defect class.
