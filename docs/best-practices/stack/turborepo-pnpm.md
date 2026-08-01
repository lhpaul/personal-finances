# pnpm + Turborepo

Adapted from the same conventions in `zeki-platform`.

---

## Workspace hygiene

- Shared code lives in `packages/*`. Apps depend on it via `workspace:*`.
- **No cross-package relative imports.** Import shared code through the `@finanzas/*` package
  name, never `../../packages/shared-domain/src/…`.
- The root `package.json` `packageManager` field is the pnpm source of truth. Do not document
  or require a different pnpm major without changing that field.
- Keep a dependency in the package that imports it. Do not add it at the root to satisfy one
  app.
- `packages/shared-domain` stays domain- and type-focused. It has no runtime dependency on
  React, `expo-*`, or any SQL library — enforced by `no-restricted-imports` in the root
  `eslint.config.mjs`.

## Task scripts

Every app and package implements the standard scripts where applicable:
`dev`, `build`, `lint`, `test`, `clean`.

- `turbo run <task>` from the root for consistency.
- `pnpm --filter <package> <script>` for focused validation while working.
- Long-running dev tasks are non-cacheable in `turbo.json`.
- Build tasks declare `outputs` so caching is effective.
- If a package cannot support a standard script, document why in the table below.

### Validation commands

```bash
pnpm lint                                    # turbo run lint
pnpm typecheck
pnpm format:check
pnpm --filter @finanzas/shared-domain test   # focused, fastest loop
```

### Documented script exceptions

| Path / package | Gap | Reason |
|----------------|-----|--------|
| `e2e/` | outside the pnpm workspace | Playwright placeholder; this product has no web surface |
| `hooks/` | outside the pnpm workspace | Git hooks; linted by the root ESLint config when edited |
| `.maestro/` | no scripts | YAML flows run by the `maestro` CLI, not by node |

## Versions and engines

- Node and pnpm versions stay consistent across `.nvmrc` (`22`), root `package.json`
  `packageManager` (`pnpm@11.12.0`) and `engines`.
- **Do not pin an end-of-life runtime.** Node 20 went EOL in April 2026; this repo pins 22.
- Do not adopt tooling that needs a different Node major without a repo-wide decision.
- EAS may pin its own Node image for native builds. That decision lives in
  `apps/mobile/eas.json` and must be called out in any PR that changes mobile build behaviour.
- **Do not mix package managers.** This repo uses pnpm workspaces. A `package-lock.json` or a
  stray `npm install` in a workspace package is a bug, not a shortcut.

## Dependency changes

- Use the narrowest dependency that solves the problem and is actively maintained.
- Prefer an existing helper in the repo before adding a package.
- **Check native compatibility before adding any React Native / Expo dependency**, and install
  Expo-managed packages with `npx expo install` so the native version matches the SDK.
- This app ships to a phone: weigh bundle size, and prefer no dependency at all for things
  already drawn in the mockups (the charts are hand-rolled `react-native-svg` for this reason).
