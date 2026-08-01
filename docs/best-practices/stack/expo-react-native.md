# Expo + React Native

## Routing

Expo Router, file-based. Routes mirror `route` in
[`design/mockups/mobile/mockup-manifest.js`](../../../design/mockups/mobile/mockup-manifest.js)
exactly — the manifest is the routing spec, so `/(tabs)/home` in the manifest is
`app/(tabs)/home.tsx` in the app. Changing a route means changing both, in the same commit.

Groups in use: `(auth)`, `(onboarding)`, `(tabs)`. Everything else is a stack route.

## Screen structure

```
app/(tabs)/home.tsx          # route: layout + composition only
features/home/
├── components/              # presentational, no data access
├── queries.ts               # TanStack Query hooks over @finanzas/db repositories
└── strings.ts               # es-CL copy, matching the mockup
```

A route file that contains business logic or a SQL query is in the wrong place.

## Screen states are not optional

Every `state_id` in a screen's manifest entry is a render branch that must exist:
`empty`, `error`, `search`, `filters`, loading skeletons. A PR that implements `home` but skips
`home/empty` and `home/sync-error` is incomplete — reference the `#screen=…&state=…` you
implemented in the description.

## Data fetching

- TanStack Query over repository functions. Query keys are structured
  (`['transactions', { month }]`), never string-concatenated.
- Invalidate precisely after a write. Categorizing one movement should not refetch the entire
  dashboard.
- No global store. Session state (the current categorization run, the connect-bank wizard) is
  React Context scoped to its flow, not app-wide.

## Performance

- Long lists (`transactions` holds every movement ever synced) use `FlashList` or
  `FlatList` with `getItemLayout`. Never `.map()` a full table into a `ScrollView`.
- Aggregations happen in SQL. See [sqlite-drizzle.md](sqlite-drizzle.md).
- Charts are `react-native-svg`, memoized on their data. Recomputing donut arcs on every render
  is visible on a mid-range Android device.
- The scraper's WebView stays hidden and mounted only during a sync. Unmount it when the run
  ends.

## Native modules and permissions

- Notifications: `expo-notifications`, **local scheduling only**. Ask for permission at the
  point the mockups ask (`notifications-intro`), never on launch. Handle denial — it is a real
  state (`notifications-intro/denied`, `settings-notifications/disabled`), not an error.
- Secrets: `expo-secure-store` only. See [bank-scraper.md](bank-scraper.md).
- Anything requiring a native module needs a dev build, not Expo Go. Say so in the PR.

## Copy and formatting

- All user-facing text is **Spanish (es-CL)** and matches the mockup copy verbatim. If the copy
  should change, change the mockup first.
- Currency: `$1.200.000` — point as thousands separator, no decimals, no space after `$`.
  Income prefixed `+`, expenses unsigned. Abbreviate (`3.7M`) **only** in the stat tiles on
  `home`, per the mockups.
- Dates: `24 ene` in lists, `viernes, 24 de enero de 2025` in detail. Lowercase month, as in
  Spanish convention.
- Formatting lives in `lib/format.ts` and is unit-tested. No inline `toLocaleString` calls.

## TypeScript

- `strict: true`, no `any`, no non-null assertions on data crossing a module boundary.
- Domain types come from `@finanzas/db`; components never redeclare a shape that already exists.
- `no-console` is on. Use the logger, which redacts.

## Accessibility

Touch targets ≥ 44pt (`tokens.json → touchTarget.min`). Every icon-only button gets an
`accessibilityLabel`. Amounts and status badges must not rely on colour alone — the mockups
pair every colour with an icon or text for this reason.
