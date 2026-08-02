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
| Language | [stack/typescript.md](stack/typescript.md) |
| Framework | [stack/expo-react-native.md](stack/expo-react-native.md) |
| Monorepo | [stack/turborepo-pnpm.md](stack/turborepo-pnpm.md) |
| Database | [stack/sqlite-drizzle.md](stack/sqlite-drizzle.md) |
| Scraping | [stack/bank-scraper.md](stack/bank-scraper.md) |
| Styling | [stack/design-tokens.md](stack/design-tokens.md) |
| Copy | [stack/i18n.md](stack/i18n.md) |
| UI fidelity | [stack/mobile-ui-fidelity.md](stack/mobile-ui-fidelity.md) |

---

## Quick Reference

The rules most likely to be violated in this codebase. Detail lives in the `stack/` files.

- **A credential never leaves `expo-secure-store` except into the scraper's memory.** Never
  into SQLite, never into a log line, never into an error payload, never into a component prop
  that outlives the sync. If you are typing `credentials` outside
  `packages/bank-scraper` or the credential form, stop.

- **Money is `INTEGER` minor units, everywhere.** No `number` arithmetic on formatted strings,
  no floats, no `parseFloat` on a bank string outside the scraper's parser. CLP has no cents;
  a decimal point in an amount is a bug. `formatClp` / `formatClpAbbreviated` from
  `@finanzas/shared-utils` are the only sanctioned CLP formatters — a hand-built amount string
  anywhere else is a review blocker.

- **The inclusion rule is written once per layer.** Totals and charts count a transaction when
  `excluded_at IS NULL`, at `COALESCE(included_amount, amount)`. There are exactly two sanctioned
  statements of this rule: the shared query fragment in `apps/mobile/src/db` for set-based SQL
  queries, and `isIncludedInAnalysis` / `effectiveAmount` / `contributedAmount` in
  `@finanzas/shared-domain`'s `inclusion.ts` for in-memory plain objects. Use the SQL fragment
  inside a repository query; use the domain functions everywhere else (aggregates, screens,
  tests) that already have a `Movement`-shaped object in hand. A hand-rolled `WHERE`, or a
  hand-rolled JavaScript restatement of `excludedAt` / `includedAmount`, is a review blocker, not
  a nit — a third statement of the rule anywhere is exactly the anti-pattern this bullet exists
  to prevent.

- **Screens never import Drizzle.** `screen → feature hook (TanStack Query) →
  src/db repository`. A `db.select()` inside `app/` fails review.

- **`@finanzas/shared-domain` stays pure.** No React, no SQL, no `expo-*`, no `Date.now()` — the
  clock enters the package as a `DateLocal` string (never a `Date`); ESLint's `sharedDomainPurity`
  bans the `Date` global outright, in addition to Expo, React (including bare `react`/`react-dom`),
  React Native, `@finanzas/mobile`, `apps/*` and every SQL library. This is what makes the domain
  rules testable in milliseconds.

- **Every screen state in the manifest is a real render branch.** A screen is not done until
  each `state_id` under its entry in
  [`design/mockups/mobile/mockup-manifest.js`](../../design/mockups/mobile/mockup-manifest.js)
  renders — including `empty`, `error` and loading. Reference the `#screen=…&state=…` in the PR.

- **Tokens come from `design/tokens.json`.** No hardcoded hex, no magic spacing. If a value is
  missing, add it to `tokens.json`, mirror it in the mockup `:root`, and consume it from
  `apps/mobile/src/theme.ts` — in the same commit.

- **Migrations are additive and irreversible in the field.** New tables and new nullable
  columns only. A migration ships with a test that opens a fixture DB from the previous version.
  There is no way to fix a bad migration on a user's phone.

- **Re-syncing must be idempotent.** Every write path from the scraper goes through the
  repository's upsert keyed on `(user_financial_product_id, external_id)` / `dedup_hash`. Adding a direct
  `insert` from sync code reintroduces the duplicate-movements bug.

- **Bank scripts are isolated and fixture-tested.** Bank-specific selectors live only under
  `packages/bank-scraper/configs/<country>/<bank>/`. Every script generator gets a jsdom test
  against captured HTML. Never reach into a bank's DOM from app code.

- **No user-facing literal strings in JSX.** Copy lives in the `src/i18n/` catalogues (`es`
  primary, `en` fallback) and the Spanish string comes from the mockup. This is enforced by
  `eslint-plugin-i18next/no-literal-string`, so a literal fails `pnpm lint` — do not
  eslint-disable it to get a screen merged. Identifiers, table and
  column names, commit messages and comments stay English. Enum-like values are stored as
  stable codes and resolved to copy by the catalogue — never persist a translated string.
  Spanish **date labels** are the one exception to "copy comes from the catalogue": they come
  from `@finanzas/shared-utils`'s `Intl.DateTimeFormat(locale, …)`-based formatters
  (`formatShortDate`, `formatLongDate`, `formatMonthYear`, `formatMonthAbbreviation`) —
  locale-parameterised, with no hardcoded month or weekday table — while sentence-level **copy**
  still comes from `apps/mobile/src/i18n/`. The two surfaces do not overlap: formatters produce
  date/number primitives, the catalogue produces sentences.

- **No cross-package relative imports.** Shared code is imported by its `@finanzas/*` package
  name. A `../../packages/…` import defeats the boundary that keeps the domain testable.
