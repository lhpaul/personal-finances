# Repository Architecture

## Overview

Single **Turborepo + pnpm workspaces** monorepo, following the conventions already in use in
[`zeki-platform`](https://github.com/lhpaul/zeki-platform): `apps/*` + `packages/*` workspaces,
scoped package names, shared tooling config at the repo root, and per-app config alongside each
app.

One shippable app (Expo). Packages exist only where code must be testable without booting the
app, or is genuinely shared: pure domain rules, formatting utilities, and the bank scraper.

The repo also carries its own design system (`design/`) and the AI development workflow
(`docs/`, `.claude/`, `scripts/`), so an agent has specs, mockups, tokens, schema and protocols
in a single clone.

## Directory Structure

```
personal-finances/
├── apps/
│   └── mobile/                     # @finanzas/mobile — the Expo app
│       ├── app/                    # Expo Router routes, mirroring the mockup manifest
│       ├── src/
│       │   ├── components/         # Shared components; components/ui/ = design-system primitives
│       │   ├── db/                 # Drizzle schema, migrations, seeds, repositories
│       │   ├── features/           # One folder per domain area (screens' logic)
│       │   ├── hooks/
│       │   ├── lib/                # Query client, formatters, logger
│       │   ├── i18n/               # es-CL copy
│       │   ├── types/
│       │   ├── test-utils/
│       │   └── theme.ts            # Mirror of design/tokens.json
│       ├── assets/
│       ├── scripts/                # dev-*.sh, eas-build-*.sh (arrives with a later item)
│       ├── app.config.js · eas.json · metro.config.js
│       ├── jest.config.js · eslint.config.mjs · tsconfig.json · expo-env.d.ts
│       └── package.json
├── packages/
│   ├── shared-domain/              # @finanzas/shared-domain — pure rules & domain types
│   ├── shared-utils/               # @finanzas/shared-utils — money, dates, RUT
│   └── bank-scraper/               # @finanzas/bank-scraper — WebView scraping engine
├── design/                         # Tokens + HTML mockups (see design/README.md)
├── docs/                           # Project specs, best practices, AI workflow protocols
├── e2e/                            # Playwright placeholder (see note below)
├── scripts/
│   ├── design/                     # Mockup manifest verification (arrives with #24)
│   ├── development-workflow/       # AI workflow helpers
│   └── dev/                        # Local dev helpers (arrives with a later item)
├── .maestro/                       # Device E2E flows (arrives with #22)
├── turbo.json · pnpm-workspace.yaml · eslint.config.mjs · tsconfig.base.json
├── .nvmrc · .npmrc · .prettierrc.json · .prettierignore
└── package.json                    # Workspace root; orchestrates via turbo
```

`bank-scrapper-app/` and `personal-finances-app-mockups-v0/` remain on disk as local reference
(their own git repos, gitignored here). `bank-scrapper-app` is the source for
`packages/bank-scraper`; `personal-finances-app-mockups-v0` is superseded by `design/mockups`.

### Conventions inherited from `zeki-platform`

- Toolchain pins match Zeki: `.nvmrc` = `22`, `packageManager: pnpm@11.12.0`,
  `engines.node >= 22`. Expo SDK 54 / React Native 0.81.
- `pnpm-workspace.yaml` declares `apps/*` and `packages/*`.
- Package names are scoped: `@finanzas/mobile`, `@finanzas/shared-domain`, …
- Shared packages are minimal: `src/`, `package.json`, `tsconfig.json`, with
  `build` / `dev` / `clean` / `lint` scripts backed by `tsc`.
- ESLint 9 flat config at the repo root, extended by each workspace's own `eslint.config.mjs`.
  There is **no `packages/configs`** — root config plus per-workspace overrides. The
  domain-purity rule is defined in the root `eslint.config.mjs` and applied by
  `packages/shared-domain/eslint.config.mjs`.
- The theme lives in the app (`apps/mobile/src/theme.ts`), not in a UI package. Design-system
  primitives live in `apps/mobile/src/components/ui/`.
- Root `package.json` exposes the cross-cutting commands (`dev`, `build`, `test`, `lint`,
  `mockups:*`) and delegates app-specific ones with `pnpm --filter`.

## Applications

| App | Description | Tech | Path |
|-----|-------------|------|------|
| `@finanzas/mobile` | The product. Onboarding, bank connection, categorization, dashboard, settings | Expo SDK 54, React Native, Expo Router, TypeScript | `apps/mobile` |

There is deliberately **no web app and no backend**. The product is local-first; adding a
server would undo the differentiator.

## Shared Packages / Libraries

| Package | Purpose | Consumed by |
|---------|---------|-------------|
| `@finanzas/shared-domain` | Domain types plus pure rules: the inclusion rule, period aggregation math, merchant alias matching, category suggestion. No React, no SQL, no I/O | `apps/mobile` |
| `@finanzas/shared-utils` | CLP money formatting, date/period helpers, RUT normalization and check-digit validation | `apps/mobile`, `@finanzas/bank-scraper` |
| `@finanzas/bank-scraper` | WebView automation: `BankScraperRef.start(country, bankId, credentials)`, message protocol, state machine, per-bank script configs | `apps/mobile` |

The data layer (Drizzle schema, migrations, seeds, repositories) lives in
`apps/mobile/src/db/`, following Zeki's convention of keeping repositories inside the app that
owns them. Only one app consumes it, and it depends on `expo-sqlite`.

## Dependency Graph

```
apps/mobile → @finanzas/{shared-domain, shared-utils, bank-scraper}
@finanzas/bank-scraper → @finanzas/shared-utils
@finanzas/shared-domain → @finanzas/shared-utils
```

`@finanzas/shared-domain` must never import from `apps/mobile`, from `expo-*`, or from any
SQL library. Enforced by the `sharedDomainPurity` `no-restricted-imports` rule, defined in the
root `eslint.config.mjs` and applied by `packages/shared-domain/eslint.config.mjs`.

## Common Commands

```bash
# Install dependencies (Node 22 via .nvmrc, pnpm 11.12.0 via packageManager)
pnpm install

# Development
pnpm dev                                   # all workspaces via Turbo
pnpm dev:mobile                            # expo start
pnpm dev:mobile:ios                        # expo start --ios

# Build
pnpm build

# Test
pnpm test                                              # Jest across workspaces
pnpm --filter @finanzas/shared-domain test             # domain rules only (fast)
pnpm --filter @finanzas/bank-scraper test              # injected-script tests
pnpm --filter @finanzas/mobile test                    # app + db tests

# Type check / lint / format
pnpm typecheck
pnpm lint
pnpm format                                  # markdown only
pnpm format:code                             # apps/ and packages/ source
pnpm clean                                   # per-workspace clean scripts, via Turbo

# Database (arrives with the database item, #3 — needs Drizzle, which this item does not add)
pnpm --filter @finanzas/mobile db:generate   # generate a Drizzle migration
pnpm --filter @finanzas/mobile db:check      # apply migrations to a fixture DB

# Mockups
pnpm mockups:mobile                          # open design/mockups/mobile/index.html
pnpm mockups:verify                          # arrives with the mockup-verification item, #24

# Store builds (declared only; both require EAS authentication, not run by this item or CI)
pnpm mobile:build:dev-store
pnpm mobile:build:production-store
```

## Environment Setup

1. **Node 22** (`.nvmrc`) and **pnpm 11.12.0** (`packageManager` in the root
   `package.json`) — matching `zeki-platform`. Node 20 is end-of-life and must not be pinned.
   Plus Xcode (iOS Simulator) and/or Android Studio.
   See [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment).
2. `pnpm install` — no environment variable is required; the skeleton reads none (spec AC1).
3. `cp .ai-dev-workflow.local.example.yaml .ai-dev-workflow.local.yaml` (AI workflow only)
4. `pnpm dev:mobile`, then `i` / `a`

Stack details and rationale: [3-software-architecture.md](3-software-architecture.md).

## A note on `e2e/`

The template ships a Playwright placeholder. This product has no web surface, so the
label-gated `e2e-regression` workflow stays disabled. End-to-end coverage runs through
**Maestro** flows in `.maestro/` — see
[3-software-architecture.md](3-software-architecture.md#testing-strategy).
