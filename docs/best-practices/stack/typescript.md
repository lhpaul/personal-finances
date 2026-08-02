# TypeScript

Applies to every app and package. Adapted from the same conventions in `zeki-platform`.

---

## Language defaults

- `strict: true` everywhere. No exceptions per package.
- Prefer `const` and immutability by default.
- Prefer `unknown` over `any`. Narrow with type guards.
- Avoid `as` casts unless you can prove safety — prefer validation or a guard function.
- No non-null assertions (`!`) on data crossing a module boundary.
- Keep types close to their usage; export only what another package needs.

## Domain types

- Domain types are defined once, in `@finanzas/shared-domain`, and re-exported. A component
  must never redeclare a shape that already exists.
- Repository functions in `src/db` return **domain types**, not Drizzle row types. A screen
  must not know a column name.
- Money is `number` in minor units at the type level, but treat it as a distinct concept: a
  formatted string never flows back into a calculation. See
  [`sqlite-drizzle.md`](sqlite-drizzle.md).
- **Temporary exception (tracked as a follow-up, issue #5 Decision 16):** `@finanzas/shared-domain`'s
  `src/types.ts` is the canonical home for `CategorySource`, `ReviewFlag`, `ExclusionReason` and
  the `merchant_aliases.match_type` union. `apps/mobile/src/db/types.ts` holds item #3's own
  pre-promotion copies of the same four closed-set unions, because item #3 was already
  mid-implementation when this package was filled in and this package cannot import from `apps/`.
  Promoting `apps/mobile/src/db/types.ts` to re-export from `@finanzas/shared-domain` is a pure
  move with no schema consequence — file it as a follow-up rather than letting the duplication go
  unnoticed.

## Untrusted input

Three sources are untrusted and must be parsed into domain types before use:

1. **Route params** (Expo Router) — validate presence and shape; never assume.
2. **Anything the scraper returns** — it is parsed out of third-party HTML that changes
   without notice.
3. **JSON columns** (`assets`, `metadata`, `labels`) — `JSON.parse` returns `any`. Parse
   through a guard, and tolerate a missing key rather than crashing a screen.

## Errors

- Errors carry stable `code` values, not display strings. The i18n catalogue resolves the copy;
  see [`i18n.md`](i18n.md).
- Do not swallow errors to satisfy a type. If a value can genuinely be absent, model it.

## Lint

- `no-console` is enabled. Use the logger, which redacts known secret keys.
- `no-restricted-imports` enforces that `@finanzas/shared-domain` imports nothing from
  `apps/*`, `expo-*`, or any SQL library. Do not add an eslint-disable to work around it —
  it is the boundary that keeps the domain testable in milliseconds.
