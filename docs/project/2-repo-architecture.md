# Repository Architecture

## Overview

Single **Turborepo + pnpm workspaces** monorepo. One shippable app (Expo) plus packages that
exist because they need independent test boundaries — the scraper and the database layer are
the two pieces most likely to break, and both must be testable without booting the app.

The repo also carries its own design system (`design/`) and the AI development workflow
(`docs/`, `.claude/`, `scripts/`), so an agent has specs, mockups, tokens, schema and protocols
in a single clone.

## Directory Structure

```
personal-finances/
├── apps/
│   └── mobile/                 # Expo SDK 54 app (iOS + Android), Expo Router
├── packages/
│   ├── bank-scraper/           # On-device WebView scraping engine + bank configs
│   ├── db/                     # Drizzle schema, migrations, seeds, repositories
│   ├── core/                   # Domain logic: categorization, merchant matching, aggregates
│   ├── ui/                     # Themed primitives generated from design/tokens.json
│   └── configs/                # Shared ESLint / TS / Prettier / Jest configs
├── design/                     # Tokens + HTML mockups (see design/README.md)
├── docs/                       # Project specs, best practices, AI workflow protocols
├── e2e/                        # Playwright placeholder (see note below)
└── scripts/                    # Workflow helpers from the AI dev framework
```

`bank-scrapper-app/` and `personal-finances-app-mockups-v0/` remain on disk as local reference
(their own git repos, gitignored here). `bank-scrapper-app` is the source for
`packages/bank-scraper`; `personal-finances-app-mockups-v0` is superseded by `design/mockups`.

## Applications

| App | Description | Tech | Path |
|-----|-------------|------|------|
| `mobile` | The product. Onboarding, bank connection, categorization, dashboard, settings | Expo SDK 54, React Native, Expo Router, TypeScript | `apps/mobile` |

There is deliberately **no web app and no backend**. The product is local-first; adding a
server would undo the differentiator.

## Shared Packages / Libraries

| Package | Purpose | Consumed by |
|---------|---------|-------------|
| `@finanzas/bank-scraper` | WebView automation: `BankScraperRef.start(country, bankId, credentials)`, message protocol, state machine, per-bank script configs | `apps/mobile` |
| `@finanzas/db` | Drizzle schema, migrations, seed data, repository functions. The only module that writes SQL | `apps/mobile`, `@finanzas/core` |
| `@finanzas/core` | Pure domain logic: merchant alias matching, category suggestion, the inclusion rule, period aggregates. No I/O, no React | `apps/mobile` |
| `@finanzas/ui` | Themed primitives (Button, Card, Amount, Chip, TxRow, Badge…) mirroring `design/tokens.json` | `apps/mobile` |
| `@finanzas/configs` | ESLint 9 flat config, tsconfig bases, Prettier, Jest presets | everything |

## Dependency Graph

```
apps/mobile → @finanzas/{bank-scraper, db, core, ui, configs}
@finanzas/core → @finanzas/db (types only)
@finanzas/db  → @finanzas/configs
@finanzas/ui  → @finanzas/configs
@finanzas/bank-scraper → @finanzas/configs
```

`@finanzas/core` must never import from `apps/mobile` or `@finanzas/ui`. Enforced by an ESLint
`no-restricted-imports` rule in `@finanzas/configs`.

## Common Commands

```bash
# Install dependencies (pnpm 10+, Node 20+)
pnpm install

# Start development
pnpm dev                                   # all workspaces via Turbo
pnpm --filter mobile exec expo start       # Expo dev server only

# Build
pnpm build

# Test
pnpm test                                  # Jest across workspaces
pnpm --filter @finanzas/core test          # domain logic only (fast)
pnpm --filter @finanzas/bank-scraper test  # injected-script unit tests

# Type check
pnpm typecheck

# Lint / Format
pnpm lint
pnpm format

# Database
pnpm --filter @finanzas/db db:generate     # generate a Drizzle migration
pnpm --filter @finanzas/db db:check        # apply migrations to a fixture DB
pnpm --filter @finanzas/db db:seed         # regenerate bundled seed fixtures

# Mockups
open design/mockups/mobile/index.html
```

## Environment Setup

1. Node 20+, pnpm 10+, Xcode (iOS Simulator) and/or Android Studio.
   See [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment).
2. `pnpm install`
3. `cp .ai-dev-workflow.local.example.yaml .ai-dev-workflow.local.yaml` (AI workflow only)
4. `pnpm --filter mobile exec expo start`, then `i` / `a`

Stack details and rationale: [3-software-architecture.md](3-software-architecture.md).

## A note on `e2e/`

The template ships a Playwright placeholder. This product has no web surface, so the
label-gated `e2e-regression` workflow stays disabled. End-to-end coverage for the app runs
through **Maestro** flows in `apps/mobile/.maestro/` — see
[3-software-architecture.md](3-software-architecture.md#testing-strategy).
