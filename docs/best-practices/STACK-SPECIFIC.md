# Stack-Specific Best Practices

## Stack Summary

TypeScript (strict) · Expo SDK 54 / React Native · Expo Router · SQLite (`expo-sqlite`) +
Drizzle ORM · `expo-secure-store` · `react-native-webview` (on-device bank scraping) ·
TanStack Query · `react-native-svg` · Jest + Maestro · Turborepo + pnpm workspaces.

Architecture and rationale: [`../project/3-software-architecture.md`](../project/3-software-architecture.md).

---

## Best Practices by Technology

| Area | File |
|------|------|
| Framework · language | [stack/expo-react-native.md](stack/expo-react-native.md) |
| Database | [stack/sqlite-drizzle.md](stack/sqlite-drizzle.md) |
| Scraping | [stack/bank-scraper.md](stack/bank-scraper.md) |
| Styling | [stack/design-tokens.md](stack/design-tokens.md) |

---

## Quick Reference

The rules most likely to be violated in this codebase. Detail lives in the `stack/` files.

- **A credential never leaves `expo-secure-store` except into the scraper's memory.** Never
  into SQLite, never into a log line, never into an error payload, never into a component prop
  that outlives the sync. If you are typing `credentials` outside
  `packages/bank-scraper` or the credential form, stop.

- **Money is `INTEGER` minor units, everywhere.** No `number` arithmetic on formatted strings,
  no floats, no `parseFloat` on a bank string outside the scraper's parser. CLP has no cents;
  a decimal point in an amount is a bug.

- **The inclusion rule is written once.** Totals and charts count a transaction when
  `excluded_at IS NULL`, at `COALESCE(included_amount, amount)`. Import the shared query
  fragment from `@finanzas/db`. A hand-rolled `WHERE` that forgets exclusions is a review
  blocker, not a nit.

- **Screens never import Drizzle.** `screen → feature hook (TanStack Query) → @finanzas/db
  repository`. A `db.select()` inside `app/` fails review.

- **`@finanzas/core` stays pure.** No React, no SQL, no `expo-*`, no `Date.now()` — pass the
  clock in. This is what makes the domain rules testable in milliseconds.

- **Every screen state in the manifest is a real render branch.** A screen is not done until
  each `state_id` under its entry in
  [`design/mockups/mobile/mockup-manifest.js`](../../design/mockups/mobile/mockup-manifest.js)
  renders — including `empty`, `error` and loading. Reference the `#screen=…&state=…` in the PR.

- **Tokens come from `design/tokens.json`.** No hardcoded hex, no magic spacing. If a value is
  missing, add it to `tokens.json`, mirror it in the mockup `:root`, and consume it from
  `@finanzas/ui` — in the same commit.

- **Migrations are additive and irreversible in the field.** New tables and new nullable
  columns only. A migration ships with a test that opens a fixture DB from the previous version.
  There is no way to fix a bad migration on a user's phone.

- **Re-syncing must be idempotent.** Every write path from the scraper goes through the
  repository's upsert keyed on `(account_id, external_id)` / `dedup_hash`. Adding a direct
  `insert` from sync code reintroduces the duplicate-movements bug.

- **Bank scripts are isolated and fixture-tested.** Bank-specific selectors live only under
  `packages/bank-scraper/configs/<country>/<bank>/`. Every script generator gets a jsdom test
  against captured HTML. Never reach into a bank's DOM from app code.

- **Spanish (es-CL) in user-facing copy, English in code.** `screen_id`s, identifiers, table
  and column names, commit messages and comments are English; every string a user reads is
  Spanish and matches the mockup copy.
