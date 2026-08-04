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
│       │   ├── dev/                # __DEV__-only surfaces (design-system gallery); never ships
│       │   ├── features/           # One folder per domain area (screens' logic)
│       │   ├── hooks/
│       │   ├── lib/                # Query client, formatters, logger
│       │   ├── i18n/               # es-CL copy
│       │   ├── types/
│       │   ├── test-utils/
│       │   └── theme.ts            # Mirror of design/tokens.json
│       ├── assets/
│       ├── drizzle/                # Generated migrations: 0000_*.sql, meta/, migrations.js
│       ├── scripts/
│       │   └── db/                 # db:check (four-mode CLI), db:seed (fixture builder), dump.ts
│       │                           # dev-*.sh still arrives with a later item; EAS entry points
│       │                           # are root package.json scripts (#23), not apps/mobile/scripts/
│       ├── __tests__/                  # build-config.test.ts — eas.json <-> app.config.js anti-drift control (#23)
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
│   ├── design/                     # Mockup manifest verification: verify-manifest.mjs, pnpm mockups:verify (#24)
│   ├── mobile-ui/                  # Design-fidelity gate: contract, mockup/simulator capture, diff (#47)
│   ├── e2e/                        # flow-contract.mjs · flow-lint.mjs · run-e2e.sh (#22)
│   ├── development-workflow/       # AI workflow helpers
│   └── dev/                        # Local dev helpers (arrives with a later item)
├── .maestro/                       # Device E2E flows — flow-contract.json, config.yaml, flows/, shared/ (#22)
├── .github/
│   └── workflows/                  # ci.yml (lint/typecheck/test/db-check/bundle); eas-build.yml
│                                    # — develop -> preview, main -> production (#23); deploy.yml
│                                    # is the unused framework placeholder
├── turbo.json · pnpm-workspace.yaml · eslint.config.mjs · tsconfig.base.json
├── .nvmrc · .prettierrc.json · .prettierignore
└── package.json                    # Workspace root; orchestrates via turbo
```

`bank-scrapper-app/` and `personal-finances-app-mockups-v0/` remain on disk as local reference
(their own git repos, gitignored here). `bank-scrapper-app` is the source for
`packages/bank-scraper`; `personal-finances-app-mockups-v0` is superseded by `design/mockups`.

### Conventions inherited from `zeki-platform`

- Toolchain pins match Zeki: `.nvmrc` = `22`, `packageManager: pnpm@11.12.0`,
  `engines.node >= 22`. Expo SDK 54 / React Native 0.81.
- `pnpm-workspace.yaml` declares `apps/*` and `packages/*`, and also declares
  `nodeLinker: hoisted`. pnpm 11 (this repo's pin) reads pnpm-specific settings such as
  `nodeLinker` only from `pnpm-workspace.yaml` — it does **not** read `node-linker` from
  `.npmrc` (that migration happened silently, with no warning printed). Metro's resolver is
  pointed at the workspace root with `disableHierarchicalLookup = true`
  (`apps/mobile/metro.config.js`), so the installed tree must actually be hoisted or Expo
  cannot resolve `@expo/metro-runtime`. `pnpm check:layout` (also wired to root `postinstall`
  and to CI's `bundle` job) verifies the tree really is hoisted, not just declared as such —
  see [Common Commands](#common-commands) and [Environment Setup](#environment-setup).
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

`@finanzas/mobile` also depends on `react-native-svg` (added by item #12, the home screen's
trend chart) and `@shopify/flash-list` (added by item #15, the transactions list's virtualized
list — Decision 3) — both native modules, so each needs a **dev build** rebuild after install;
Expo Go cannot run any screen that imports either one.

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

`@finanzas/shared-domain` must never import from `apps/mobile`, from `expo-*`, from React
(including bare `react` / `react-dom`), or from any SQL library, and it must never read the
`Date` global — the clock enters the package as a `DateLocal` string produced by
`@finanzas/shared-utils`'s `deriveDateLocal`. Enforced by the `sharedDomainPurity`
`no-restricted-imports` and `no-restricted-globals` rules, defined in the root
`eslint.config.mjs` and applied by `packages/shared-domain/eslint.config.mjs`.

`@finanzas/shared-utils` purity (no React, no Expo/React Native modules, no SQL library, no
Node I/O) is enforced the same way, by the `sharedUtilsPurity` `no-restricted-imports` rule,
defined in the root `eslint.config.mjs` and applied by `packages/shared-utils/eslint.config.mjs`.

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

# node_modules layout check (also runs as postinstall and in CI's bundle job)
pnpm check:layout

# Local iOS bundle check (Metro only, no native build — the same command CI's bundle job runs)
cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false

# Database
pnpm --filter @finanzas/mobile db:generate   # generate a Drizzle migration
pnpm --filter @finanzas/mobile db:check      # apply migrations to a fixture DB, in four modes
pnpm --filter @finanzas/mobile db:seed       # regenerate the bundled seed fixture, deterministically

# Mockups
pnpm mockups:mobile                          # open design/mockups/mobile/index.html
pnpm mockups:verify                          # verify the manifest against the PR checklist (#24)
pnpm mockups:verify:test                     # unit tests for the verifier itself

# Store builds (declared only; both require EAS authentication, not run by this item or CI)
pnpm mobile:build:dev-store
pnpm mobile:build:production-store
```

## Environment Setup

The sequence below was run end to end on macOS under #35 (2026-08-02) to a booted iOS Simulator
running the app — not merely asserted. Tool versions used: Node `v26.5.0` (satisfies the
`.nvmrc`/`engines.node >= 22` pin — `.nvmrc` itself pins `22`), pnpm `11.12.0`, Xcode `26.6`
(build `17F113`), CocoaPods `1.16.2`, macOS `26.5.2`.

1. **Node ≥ 22** (`.nvmrc` pins `22`) and **pnpm 11.12.0** (`packageManager` in the root
   `package.json`) — matching `zeki-platform`. Node 20 is end-of-life and must not be pinned.
   Plus Xcode (iOS Simulator) and/or Android Studio.
   See [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment).
2. `pnpm install` — no environment variable is required; the skeleton reads none (spec AC1).
   `postinstall` runs `pnpm check:layout` automatically; a plain install that somehow ends
   isolated fails here with an actionable message rather than failing later inside Metro.
3. `pnpm check:layout` — explicit confirmation the tree is hoisted.
4. `cd apps/mobile && pnpm exec expo prebuild --platform ios --clean` — creates `ios/` and runs
   `pod install`. `--clean` is required on a second run: `expo prebuild` refuses to run over an
   existing `ios/` directory without it (`ios/` and `android/` are gitignored, so every clone
   starts without them).
5. **If CocoaPods fails inside `prebuild` or when run standalone** with
   `Encoding::CompatibilityError: Unicode Normalization not appropriate for ASCII-8BIT` — this is
   a CocoaPods/Ruby locale issue, not a project issue. Fix by exporting a UTF-8 locale before
   invoking `pod`:

   ```bash
   export LANG=en_US.UTF-8
   export LC_ALL=en_US.UTF-8
   cd apps/mobile/ios && pod install --repo-update && cd ..
   ```

   (CocoaPods itself prints this exact remediation as a warning; it is not optional on a shell
   whose locale is unset.)
6. `pnpm exec expo run:ios` — builds and boots the simulator. If this fails with
   `unable to attach DB: ... database is locked. Possibly there are two concurrent builds
   running in the same filesystem location`, an earlier build was interrupted and left an
   orphaned `SWBBuildService` process holding Xcode's DerivedData lock. Find and kill it, then
   retry:

   ```bash
   lsof "$HOME/Library/Developer/Xcode/DerivedData/FinanzasDEV-*/Build/Intermediates.noindex/XCBuildData/build.db"
   ```

   (The Xcode project is named `FinanzasDEV` for the `development` variant since #23 — see
   below; the DerivedData folder name follows it.)

   `kill -9` terminates immediately and without cleanup, and `lsof` can also return the PID of a
   build that is still legitimately running. **Verify the reported PID belongs to a stale,
   interrupted process (check `ps -p <pid>` and how long it has been idle) before terminating it,
   and confirm with whoever owns the machine before running `kill -9` on it** — do not run it
   automatically from a script or agent session:

   ```bash
   kill -9 <pid from lsof, verified stale>
   ```
7. Once a dev build exists on the simulator, `pnpm dev:mobile:ios` (equivalently
   `pnpm dev:mobile`, then `i`) starts Metro only and reopens the existing build — it does not
   rebuild the native project. Use step 6 again after any native dependency change.
8. `cp .ai-dev-workflow.local.example.yaml .ai-dev-workflow.local.yaml` (AI workflow only, not
   required to run the app).

**Since #23**: the local dev client is `Finanzas [DEV]`, bundle id `cl.finanzas.mobile.dev` — a
distinct identity and sandbox from the `preview` (`Finanzas [BETA]` /
`cl.finanzas.mobile.preview`) and `production` (`Finanzas` / `cl.finanzas.mobile`) variants, so
all three can be installed on one Simulator/device at once. `expo-dev-client` is now a
dependency, so `developmentClient: true` in `eas.json`'s `development` profile is backed by a
real package. **An app installed before #23 landed carries the old, shared `cl.finanzas.mobile`
identifier and must be deleted from the Simulator once** — step 6's rebuild installs the new
identity alongside it rather than over it, which looks confusing (two "Finanzas" icons) until the
stale one is removed. See
[`5-release-and-signing-runbook.md`](5-release-and-signing-runbook.md) for the full variant table
and the build/release pipeline.

Verified outcome: the app boots on the simulator (iPhone 17, iOS 26.5) and lands on the
`onboarding-intro` placeholder, matching
[`1-bootstrap-monorepo-expo-app.smoke-test.md`](../testing/mobile/1-bootstrap-monorepo-expo-app.smoke-test.md)
Step 4's expected result. Evidence (full transcript, screenshot) is in the implementation PR for
#35.

Stack details and rationale: [3-software-architecture.md](3-software-architecture.md).

## Backlog routing

Not every item earns the full pipeline. The `Type` field on the project board decides the path:

| Type | Path | Items |
|------|------|-------|
| `Feature` | spec → plan → implementation | #3 schema, #6 scraper, #9 credentials, #10 sync, #13 categorization |
| `Refactor` | plan → implementation (no spec) | everything else |

The `Refactor` items are not refactors in the literal sense — the label is how this framework
routes work that does not need a written spec. Their specification already exists: the mockup
screen and state list plus the issue body. A 450-line spec restating the mockup adds ceremony,
not signal.

`Feature` is reserved for the five places where being wrong is expensive: an irreversible
migration, third-party HTML we do not control, credential handling, sync idempotency, and the
core interaction loop.

## A note on `e2e/`

The template ships a Playwright placeholder. This product has no web surface, so the
label-gated placeholder job in `e2e-regression.yml` stays disabled (its own
`ENABLE_TEMPLATE_PLACEHOLDER_REGRESSION` variable is unset). End-to-end coverage runs through
**Maestro** flows in `.maestro/` instead — see
[3-software-architecture.md](3-software-architecture.md#testing-strategy). The same workflow file
now also carries `maestro-ios`, the (opt-in) device leg of that suite: label-gated the same way,
plus its own `ENABLE_MAESTRO_E2E` variable (item #22).
