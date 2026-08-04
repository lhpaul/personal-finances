# Expo + React Native

## Routing

Expo Router, file-based. Routes mirror `route` in
[`design/mockups/mobile/mockup-manifest.js`](../../../design/mockups/mobile/mockup-manifest.js)
exactly — the manifest is the routing spec, so `/(tabs)/home` in the manifest is
`app/(tabs)/home.tsx` in the app. Changing a route means changing both, in the same commit.

Groups in use: `(onboarding)`, `(tabs)`. There is no `(auth)` group — this product has no
sign-in. Everything else is a stack route.

## Screen structure

```
app/(tabs)/home.tsx          # route: layout + composition only
src/features/home/
├── components/              # presentational, no data access
└── use-home.ts              # feature hook: getAppDatabase() + repository functions
src/i18n/{es,en}.ts          # all user-facing copy, keyed home.*
```

A route file that contains business logic or a SQL query is in the wrong place.

**Data-access pattern (established by issue #8's onboarding screens, the first real screens
built)**: a feature hook calls `getAppDatabase()` (`apps/mobile/src/db/runtime.ts`) and then
calls `src/db` repository functions directly — no TanStack Query, no `QueryProvider`, no
`DatabaseProvider`, and no `app/_layout.tsx` change. `@tanstack/react-query` is not a dependency
of `@finanzas/mobile`. Two hook shapes follow this pattern:

- **Read hooks** — `use-launch-decision.ts` and `use-onboarding-summary.ts`: await
  `getAppDatabase()`, read through repository functions, and return a small discriminated-union
  status (`{ status: 'pending' } | { status: 'resolved'; ... }`).
- **Command hooks** — `use-complete-onboarding.ts`: return an action function (`{ complete }`)
  that awaits `getAppDatabase()` and writes/navigates when called; no status union, since there is
  nothing to render while idle.

Whether the app adopts TanStack Query at all for caching/invalidation is a separate, not-yet-made
decision — this pattern is what ships until that decision changes it.

## Screen states are not optional

Every `state_id` in a screen's manifest entry is a render branch that must exist:
`empty`, `error`, `search`, `filters`, loading skeletons. A PR that implements `home` but skips
`home/empty` and `home/sync-error` is incomplete — reference the `#screen=…&state=…` you
implemented in the description.

## Data fetching

- Feature hooks over repository functions (see "Screen structure" above) — `@tanstack/react-query`
  is not installed today. Adopting it for caching/invalidation is a stated possible future
  direction, not yet decided; do not write code against it until it is actually a dependency.
- Invalidate precisely after a write. Categorizing one movement should not refetch the entire
  dashboard.
- No global store for app data. Session state for a **multi-route-group** flow — the connect-bank
  wizard spans `(onboarding)` and the settings stack — cannot use a layout-scoped React context,
  because no single layout wraps both groups. Item #9 uses a module-scoped store read through
  `useSyncExternalStore` instead (`src/features/connect-bank/connect-flow-store.ts`): a plain
  module-level object plus a `Set` of listeners, with a closed type (no credential field, no
  index signature) so a later "just stash a secret here" edit is a compile error, not a runtime
  leak. A flow contained within one route group (the categorization run) can still use React
  Context scoped to that group.

## Performance

- Long lists (`transactions` holds every movement ever synced) use `FlashList` or
  `FlatList` with `getItemLayout`. Never `.map()` a full table into a `ScrollView`.
- Aggregations happen in SQL. See [sqlite-drizzle.md](sqlite-drizzle.md).
- Charts are `react-native-svg`, memoized on their data. Recomputing donut arcs on every render
  is visible on a mid-range Android device.
- The scraper's WebView stays hidden and mounted only during a sync. Unmount it when the run
  ends.

## Build variants

`APP_VARIANT` (`development` / `preview` / `production`) is the **only** supported build-time
switch, and `apps/mobile/app.config.js` is the **only** place it is read — every `eas.json`
build profile sets it, it defaults to `development` for local `expo run:ios` and the CI `bundle`
job, and an unrecognised value throws rather than falling back silently. It selects the app name
and the iOS/Android bundle identifier only (`Finanzas [DEV]` / `[BETA]` / plain `Finanzas`,
`cl.finanzas.mobile[.dev|.preview]` / `cl.finanzas.mobile`) — nothing else.

**No feature code may read `process.env.APP_VARIANT` or branch on it.** There is no
environment-dependent behaviour inside the app: no first-party server call differs by
environment (there is no backend), and no feature flag is implemented this way. If a screen ever
needs to know something at runtime, that is a product decision requiring its own design, not a
reuse of the build variant. See
[`docs/project/5-release-and-signing-runbook.md`](../../project/5-release-and-signing-runbook.md)
for the full build/release pipeline.

## Native modules and permissions

- Notifications: `expo-notifications`, **local scheduling only**. Ask for permission at the
  point the mockups ask (`notifications-intro`), never on launch. Handle denial — it is a real
  state (`notifications-intro/denied`, `settings-notifications/disabled`), not an error.
- Secrets: `expo-secure-store` only. See [bank-scraper.md](bank-scraper.md). Exactly one module,
  `apps/mobile/src/lib/secure-store/expo-secure-store.adapter.ts`, may import it — enforced by
  the `secureStoreBoundary` ESLint rule (`eslint.config.mjs`) and a source-text boundary scan
  (`secure-store-boundary.test.ts`), the same shape as the `dbAccessBoundary` pair for SQL
  libraries. Every write passes `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` explicitly —
  the library's own default omits the `…ThisDeviceOnly` suffix and would carry the entry into an
  encrypted device backup, which is a copy of the secret outside the phone it was typed on
  (item #9).
- **Resetting the on-device store**: `resetAppDatabase()` (`apps/mobile/src/db/runtime.ts`) is the
  **only** sanctioned way to invalidate the memoized database handle `getAppDatabase()` returns
  (item #19). It clears the memo *before* awaiting the file deletion — so a caller that arrives
  mid-reset starts a fresh bootstrap against a store that is about to exist, rather than holding a
  handle to a file that is about to disappear — then closes and deletes the file
  (`deleteAppDatabaseFile`, `apps/mobile/src/db/client.ts`), then clears the bootstrap
  single-flight (`resetDatabaseBootstrap()`, `apps/mobile/src/db/bootstrap.ts`). A screen or
  feature hook must never hold its own copy of the `sqlite`/`db` handle across a reset — always
  call `getAppDatabase()` again after any reset completes.
- Anything requiring a native module needs a dev build, not Expo Go. Say so in the PR.

## Copy and formatting

- **No user-facing literal strings in JSX.** Copy comes from the `src/i18n/` catalogues via
  `t('…')`, with flat keys matching the screen (`home.pending_title`). The Spanish string
  comes from the mockup — if copy should change, change the mockup first. See
  [`i18n.md`](i18n.md).
- Currency: `$1.200.000` — point as thousands separator, no decimals, no space after `$`.
  Income prefixed `+`, expenses unsigned. Abbreviate (`3.7M`, `$279K`) in the stat tiles and in
  the `home` category rows, per the mockups.
- Dates: `24 ene` in lists, `viernes, 24 de enero de 2025` in detail. Lowercase month, as in
  Spanish convention. These labels are produced by `Intl.DateTimeFormat(locale, …)` inside
  `@finanzas/shared-utils`, parameterised by the active app locale — not by a hardcoded month
  table. See [`i18n.md`](i18n.md).
- Money, date and RUT formatting live in `@finanzas/shared-utils` (`formatClp`,
  `formatClpAbbreviated`, `formatShortDate`, `formatLongDate`, `formatRut`, …), not in
  `apps/mobile`: `@finanzas/bank-scraper` also consumes them and cannot import from the app.
  `apps/mobile/src/lib/format.ts`, if it is ever created, is a thin composition layer that
  delegates to this package (for example gluing `formatShortDate(...)` and
  `formatTimeOfDay(...)` into `26 ene · 14:32`) rather than reimplementing formatting itself.
  `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` are an ESLint error
  (`no-restricted-properties`) repository-wide, not merely a convention.

## TypeScript

- `strict: true`, no `any`, no non-null assertions on data crossing a module boundary.
- Domain types come from `apps/mobile/src/db`; components never redeclare a shape that already exists.
- `no-console` is on. Use the logger, which redacts.

## Accessibility

Touch targets ≥ 44pt (`tokens.json → touchTarget.min`). Every icon-only button gets an
`accessibilityLabel`. Amounts and status badges must not rely on colour alone — the mockups
pair every colour with an icon or text for this reason.
