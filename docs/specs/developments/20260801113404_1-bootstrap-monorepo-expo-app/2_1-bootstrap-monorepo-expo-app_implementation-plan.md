# Bootstrap the Monorepo and the Expo App — Implementation Plan

**Spec**: [`1_1-bootstrap-monorepo-expo-app_specs.md`](1_1-bootstrap-monorepo-expo-app_specs.md)
**Smoke test runbook**: [`../../../testing/mobile/1-bootstrap-monorepo-expo-app.smoke-test.md`](../../../testing/mobile/1-bootstrap-monorepo-expo-app.smoke-test.md)
**Issue**: lhpaul/personal-finances#1

---

## Summary

**Approach**: Convert the current documentation-only repository into a Turborepo + pnpm
workspace without disturbing the AI workflow tooling that already lives in it. The root gains
workspace, task-orchestration, lint, format and runtime-pinning configuration; `apps/mobile`
is a fresh Expo SDK 54 app with Expo Router and strict TypeScript; `packages/shared-domain`,
`packages/shared-utils` and `packages/bank-scraper` are three minimal `tsc`-backed workspaces.
The route skeleton is generated from the mockup manifest — one placeholder file per MVP screen
— and a Jest parity test asserts, mechanically, that the set of route files equals the set of
MVP manifest routes, that no out-of-MVP route exists, and that the tab group holds exactly two
routes. Domain purity is enforced by a `no-restricted-imports` block defined in the root
`eslint.config.mjs`. Three GitHub Actions jobs (lint, type-check, test) run on pull requests
into `develop` and `main`.

**Estimated complexity**: L

<!-- S: < 1 day | M: 1-3 days | L: 3+ days -->

**Rationale**: The change is wide rather than deep. It touches every layer of the repository
(package manager, task runner, lint, TypeScript, test runner, app framework, CI), replaces the
root manifest that existing markdown tooling depends on, and creates roughly seventy new files.
None of the individual pieces is algorithmically hard, but the number of interacting toolchains
— pnpm workspaces, Metro's monorepo resolution, jest-expo, ESLint 9 flat config, Turborepo —
means several verification loops are expected before all four commands are green from a clean
clone.

**Dependencies**: None. This is the first implementation item; every other backlog item depends
on it.

---

## Verification Log

> Reproducible plan-time verification. Repo revision for every row below: `3cd4939`
> (`implementation-plan/1-bootstrap-monorepo-expo-app`, branched from `origin/develop` after
> spec PR #26 merged). Verified 2026-08-01T16:45Z.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `3cd4939` |
| MVP route enumeration (drives the 25-route file list and the parity test) | `node -e "const fs=require('fs'),vm=require('vm');const ctx={window:{}};vm.runInNewContext(fs.readFileSync('design/mockups/mobile/mockup-manifest.js','utf8'),ctx);const m=ctx.window.__MOCKUP_MANIFEST__;const ds=['ds-colors','ds-typography','ds-components'];console.log(m.screens.length, m.screens.filter(s=>s.mvp!==false&&!ds.includes(s.screen_id)).length, m.screens.filter(s=>s.mvp===false).length)"` | `36` screens total, `25` in-MVP non-design-system screens, `8` flagged `mvp: false`; the 25 routes match the spec's MVP Route Scope table exactly |
| Out-of-MVP screen ids | same script, printing `screen_id` for `mvp === false` | `auth`, `verify-code`, `budgets`, `budget-create`, `planning`, `planning-life`, `benefits`, `benefit-category` |
| npm / lockfile coupling that the pnpm migration must handle | `grep -rn "npm ci\|package-lock" .github/ hooks/ scripts/` | 4 hits: `.github/workflows/markdown-lint.yml:15` (`paths` entry), `.github/workflows/markdown-lint.yml:36` (`npm ci`), `.github/workflows/e2e-regression.yml:39` (`npm ci`, scoped to `working-directory: e2e`), `hooks/truncation-checker/index.ts:47` (regex over changed file names) |
| Anything consuming the root package name or version | `grep -rn "ai-dev-framework-template" --include="*.yml" --include="*.sh" --include="*.json" . --exclude-dir=node_modules` and `grep -rn "0\.40\.0" --include="*.yml" --include="*.sh" --include="*.json" .` | Only `package.json` / `package-lock.json` themselves, plus shell test fixtures that use `lhpaul/ai-dev-framework-template` as a mocked **repository slug** (not the package name). No workflow or script reads the root package name or version |
| Root binaries the markdown tooling invokes | `ls node_modules/.bin/` | `markdownlint-cli2`, `prettier` — both must remain reachable at `./node_modules/.bin/` after the pnpm migration (AC11) |
| Pre-existing app/package directories | `ls apps packages` | Neither exists; every source file in this item is new |
| Existing CI workflows | `ls .github/workflows/` | `auto-tag-release.yml`, `claude-code-review.yml`, `deploy.yml`, `e2e-regression.yml`, `markdown-lint.yml`, `pr-agent.yml`, `pr-policy.yml`, `shellcheck.yml`, `test-pr-review-loop.yml` — no lint/type-check/test workflow exists yet |
| Web e2e gating (AC10) | `sed -n '/^    if:/,/^    runs-on/p' .github/workflows/e2e-regression.yml` | Job is gated on `vars.ENABLE_TEMPLATE_PLACEHOLDER_REGRESSION == 'true'` **and** the `ready-for-regression` label; this item changes nothing in that file |
| Same-surface open PRs (bounded assumption cross-check) | Current invocation item list is `{#1}`; `gh pr list --state open` | `[]` — the only other PR in this repository is #26, this item's own already-merged spec PR. No unbounded repository-wide PR scan was performed |
| Design assets discovery | Issue #1 body has no `## Design assets` section; no tracker attachments; no `<dev-folder>/assets/` directory | Authoritative visual reference is the repo's own UI contract, `design/mockups/mobile/index.html` (+ `mockup-manifest.js`), which the spec itself links as the routing contract |
| Local runtime on the authoring machine | `node --version` | `v26.5.0` — differs from the Node 20 pin this item introduces. Recorded as a known risk requiring human verification, **not** as a reason to change the pin (spec Business Rule 11) |
| Agent-commit hook coupling to the lockfile switch | `sed -n '35,50p' hooks/truncation-checker/index.ts` | Its skip list already contains both `/package-lock/` and `/pnpm-lock/`, so deleting `package-lock.json` and adding `pnpm-lock.yaml` needs no hook change |
| Markdown files under `e2e/` (AC11 exposure of a new `.prettierignore`) | `find e2e -name "*.md"` | No matches — ignoring `e2e` in `.prettierignore` cannot change what `pnpm format` rewrites |
| Nested-artifact guard | `run-nested-artifact-guard.sh --mode pre-pr --issue 1 --expected-branch implementation-plan/1-bootstrap-monorepo-expo-app --approved-base develop` (the `pre-create` run was performed by the parent orchestrator before this branch was dispatched) | `RESULT=clean`, `CANONICAL_COUNT=3`, `UNEXPECTED_COUNT=0` |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Artifact owner / repository mode | `single_repo` (no `mode` key present) — this repository owns spec, plan and implementation artifacts | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo` section) | 2026-08-01T16:45Z, `3cd4939` | Current invocation item list = `{#1}`; the only other PR in the repository is the merged spec PR #26 for this same item, so no other work can be changing artifact ownership | `Verified` |
| Approved base branch for plan and implementation PRs | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* ("spec/plan/feature/fix PRs target `develop`"); merged spec PR #26 targeted `develop` | 2026-08-01T16:45Z, `3cd4939` | Current invocation item list = `{#1}`; no same-surface open PR changes branching policy | `Verified` |
| Pinned runtime version | Node 20 (`.nvmrc` = `20.19.4`, `engines.node`) | Spec Business Rule 11; issue #1 scope section (".nvmrc (Node 20)") | 2026-08-01T16:45Z, `3cd4939` | Current invocation item list = `{#1}`; no same-surface open PR pins a runtime, and `.nvmrc` does not exist yet. The authoring machine's Node v26.5.0 is a *local environment* fact, not a competing declaration of the pin | `Verified` |
| Package manager and workspace layout | pnpm 10+ workspaces over `apps/*` and `packages/*`; workspace names `@finanzas/mobile`, `@finanzas/shared-domain`, `@finanzas/shared-utils`, `@finanzas/bank-scraper` | [`docs/project/2-repo-architecture.md`](../../../project/2-repo-architecture.md) (Directory Structure, Conventions, Applications, Shared Packages tables) | 2026-08-01T16:45Z, `3cd4939` | Same-surface scan: no open PR touches `package.json`, `pnpm-workspace.yaml` or the architecture doc | `Verified` |
| Internal review runner for the draft plan PR | `claude` (local override), policy `warn` | `.ai-dev-workflow.local.yaml` overriding `review.on_draft.runner: [codex]` in `.ai-dev-workflow.yaml` | 2026-08-01T16:45Z, `3cd4939` | Current invocation only; the override is machine-local and gitignored | `Verified` |

No `Conflict` rows. Nothing in this check blocks implementation.

---

## Key Decisions

Each decision below is referenced by index from the Layer-by-Layer, Testing and Implementation
Order sections. Indices are stable within this document.

**Decision 1 — pnpm uses a hoisted node linker.** `.npmrc` sets `node-linker=hoisted`. Expo's
Metro resolver and React Native autolinking assume a flat `node_modules`; pnpm's default
symlinked store is the single most common cause of "native module not found" and duplicate-React
failures in Expo monorepos. *Unverified against this repository (no app exists yet) — the
implementer must confirm the app boots with this setting before considering Step 6 complete.*

**Decision 2 — shared packages are source-first.** Each package sets `"main": "src/index.ts"`
and `"types": "src/index.ts"`, so Metro, Jest and `tsc` all consume TypeScript source directly
and no build step is required before `pnpm dev:mobile`. The `build` script (`tsc`) still exists
and emits `dist/`, because spec AC3 requires each package to be buildable on its own; `dist/` is
gitignored and is not what the app consumes.

**Decision 3 — one ESLint rule source, per-workspace configs.** The root `eslint.config.mjs`
default-exports the shared flat-config array and *additionally* named-exports
`sharedDomainPurity` — the `no-restricted-imports` block that implements Business Rule 6. Each
workspace has its own `eslint.config.mjs` that imports the root config;
`packages/shared-domain/eslint.config.mjs` is the only one that appends `sharedDomainPurity`.
Root `pnpm lint` runs `turbo run lint`, which runs each workspace's `eslint .`. Rationale: ESLint
9 flat config does **not** perform nested config discovery, so a single root `eslint .` run would
silently ignore `apps/mobile/eslint.config.mjs` (which must add `eslint-config-expo`), and
config `files` globs are resolved relative to the config file that ESLint loaded, so a
root-relative glob such as `packages/shared-domain/**` would not match when ESLint is invoked
from inside the package.

**Decision 4 — the root `format` script keeps its current markdown-only glob.** `format` stays
exactly `prettier --write "**/*.md"` so AC11 holds by construction. Source formatting gets a new,
separate `format:code` script. A `.prettierignore` is added for build output and generated
directories.

**Decision 5 — the root manifest is rewritten in place and npm is dropped at the root.**
`package.json` keeps `markdownlint-cli2`, `markdownlint-rule-relative-links` and `prettier` as
devDependencies (AC11), gains the workspace command surface, and is renamed to `finanzas` with
version `0.0.0`. The root `package-lock.json` is deleted and `.github/workflows/markdown-lint.yml`
switches from `npm ci` to pnpm. `e2e/` keeps its own `package.json` + `package-lock.json` and its
own npm-based workflow: it is not a pnpm workspace member (`pnpm-workspace.yaml` declares only
`apps/*` and `packages/*`), so AC10 is unaffected.

**Decision 6 — Node is pinned at `20.19.4`.** `.nvmrc` contains `20.19.4` and the root
`package.json` declares `"engines": { "node": ">=20.19.4", "pnpm": ">=10" }`. Expo SDK 54 /
React Native 0.81 documents Node 20.19.4 as its Node 20 floor, and pinning a patch rather than a
bare major keeps Business Rule 11 satisfied while making CI and local runs reproducible.
`engine-strict` is deliberately **not** enabled in `.npmrc`, so the declared range is advisory at
install time rather than a hard install failure.

The authoring machine for this plan runs **Node v26.5.0**, so the pinned runtime is *not* the
runtime the plan was written under. Two consequences the implementer must honour:

- Every verification command in the Implementation Order is run after `nvm use` (Node 20), and CI
  resolves the same version through `node-version-file: .nvmrc`. A green run on Node 26 is not
  evidence for AC1 or AC2.
- If Expo SDK 54 tooling turns out not to work on Node 20, that is an **escalation**, recorded as
  an explicit decision on the pull request. Raising the patch *within* Node 20 is allowed and must
  be recorded; changing the major version to match whatever is installed is forbidden (spec
  Business Rule 11).

**Decision 7 — `app/index.tsx` is an entry shim, not a destination.** Expo Router needs a match
for `/`. This item ships an unconditional `<Redirect href="/(onboarding)/intro" />`, with a
comment naming the follow-up item that replaces it with the
`app_settings.onboarding_completed` gate (spec Business Rule 13, issue #8). It renders no UI,
implements no mockup screen, and is excluded from route-parity counting, so Business Rule 3
("a route exists only if the manifest declares it") is not weakened: the shim adds no
destination.

**Decision 8 — no typed routes; `expo-env.d.ts` is committed.** `experiments.typedRoutes` stays
off in this item, because typed routes require generated `.expo/types` output that CI's
`tsc --noEmit` job would not have. For the same reason `apps/mobile/expo-env.d.ts` is committed
rather than gitignored, so type-checking is hermetic from a clean clone.

**Decision 9 — CI is three jobs, not three steps.** `.github/workflows/ci.yml` defines separate
`lint`, `typecheck` and `test` jobs so each reports its own check result on the pull request
(AC8). Each job installs with `pnpm install --frozen-lockfile`, which is the mechanism that makes
a lockfile out of sync with the manifests fail the check instead of resolving different versions
(AC9). No `paths` filter is used, so a required-check configuration can never hang pending on a
docs-only PR; `concurrency` with `cancel-in-progress` bounds the cost.

**Decision 10 — `apps/mobile` defines no `build` script.** Turborepo skips workspaces that do
not define a task, so `pnpm build` builds the three packages. Shippable mobile artifacts come
from EAS build profiles (`apps/mobile/eas.json`), which this item declares but never runs.

**Decision 11 — route/manifest parity is enforced by an automated test.** The mockup manifest is
the routing contract (Business Rule 3); a reviewer should not have to count files. A Jest test
loads `design/mockups/mobile/mockup-manifest.js` and asserts set equality against the route files
under `apps/mobile/app/`. This is the enforcement mechanism behind AC5, AC6 and AC14.

**Decision 12 — no end-to-end tier is wired in this item.** The web Playwright placeholder in
`e2e/` stays disabled and untouched: no Playwright dependency is added, `e2e-regression.yml` is
not edited, and the `ENABLE_TEMPLATE_PLACEHOLDER_REGRESSION` repository variable is not set, so
the `E2E regression (placeholder)` check keeps reporting as skipped (AC10, Business Rule 10).
Device end-to-end coverage through Maestro is **item #22's** scope; `.maestro/` is not created
here.

---

## Root Command Surface

The root `package.json` scripts below are the surface AC13 measures against
[`docs/project/2-repo-architecture.md`](../../../project/2-repo-architecture.md) → *Common
Commands*. Anything that document lists but this table omits is reconciled in the same change
through the [Documentation Updates](#documentation-updates) section, as Business Rule 1 requires.

| Script | Value | Backing criterion |
| --- | --- | --- |
| `dev` | `turbo run dev` | Arch doc *Common Commands* |
| `dev:mobile` | `pnpm --filter @finanzas/mobile dev` | AC4, issue #1 acceptance criteria |
| `dev:mobile:ios` | `pnpm --filter @finanzas/mobile dev:ios` | AC4, arch doc |
| `build` | `turbo run build` | AC3 (packages build; Decision 10) |
| `lint` | `turbo run lint` | AC2, AC7 |
| `typecheck` | `turbo run typecheck` | AC2 |
| `test` | `turbo run test` | AC2, AC5, AC6, AC14 |
| `clean` | `turbo run clean` | AC3 |
| `format` | `prettier --write "**/*.md"` | **Byte-identical to today** (AC11, Decision 4) |
| `format:code` | `prettier --write "**/*.{ts,tsx,js,mjs,json,yaml,yml}"` | Decision 4 — new, separate from `format` |
| `mockups:mobile` | `open design/mockups/mobile/index.html` | Arch doc |
| `mobile:build:dev-store` | `pnpm --filter @finanzas/mobile build:dev-store` | Arch doc; thin delegation to EAS, never run in this item |
| `mobile:build:production-store` | `pnpm --filter @finanzas/mobile build:production-store` | Arch doc; thin delegation to EAS, never run in this item |

Deliberately **not** created here, because their subject does not exist yet: `mockups:verify`
(manifest-versus-HTML verification, a later design item — route/manifest parity is covered
instead by the Jest test of Decision 11) and `db:generate` / `db:check` (no database — spec Out
of Scope). Both are marked as arriving later in the architecture document by the Documentation
Updates step.

---

## Layer-by-Layer Changes

### Database / Data Layer

- [ ] **None.** Spec Business Rule 7 and AC12 forbid any schema, migration or seed in this item.
      No `apps/mobile/src/db/` directory is created; `expo-sqlite` and `drizzle-orm` are not
      added as dependencies.

### Backend / API

- [ ] **None.** The product has no backend (spec Business Rule 8). No first-party network client,
      analytics or crash-reporting dependency is added.

### Shared Packages / Libraries

- [ ] `packages/shared-domain` (`@finanzas/shared-domain`) — `src/index.ts` exporting
      `PACKAGE_NAME = '@finanzas/shared-domain'`, `package.json` with `build` / `dev` / `clean` /
      `lint` / `typecheck` / `test`, `tsconfig.json` extending the root base config,
      `jest.config.js`, and `eslint.config.mjs` that appends `sharedDomainPurity` (Decision 3).
- [ ] `packages/shared-utils` (`@finanzas/shared-utils`) — same shape,
      `PACKAGE_NAME = '@finanzas/shared-utils'`. No money, date or RUT helper is written here:
      those arrive with the items that need them, and a CLP formatter would violate AC12.
- [ ] `packages/bank-scraper` (`@finanzas/bank-scraper`) — same shape,
      `PACKAGE_NAME = '@finanzas/bank-scraper'`. No bank configuration, no injected script, no
      WebView code (AC12).
- [ ] Dependency graph wiring per
      [`docs/project/2-repo-architecture.md`](../../../project/2-repo-architecture.md):
      `@finanzas/shared-domain` and `@finanzas/bank-scraper` each declare
      `"@finanzas/shared-utils": "workspace:*"`; `apps/mobile` declares all three as
      `workspace:*`. The declared dependency on `shared-utils` is what the domain-purity rule
      must *not* block — `sharedDomainPurity` restricts app, Expo and SQL imports only.

### Frontend / UI

- [ ] `apps/mobile` scaffolded on Expo SDK 54 with `expo-router`, strict TypeScript,
      `app.config.js`, `eas.json` (profiles `development`, `preview`, `production` — declared,
      never run), `metro.config.js` with monorepo `watchFolders` and `nodeModulesPaths`,
      `babel.config.js`, `jest.config.js` (`preset: 'jest-expo'`), `eslint.config.mjs`,
      `tsconfig.json`, `expo-env.d.ts` (Decision 8) and the default Expo template assets.
- [ ] `apps/mobile/src/components/RoutePlaceholder.tsx` — one shared placeholder component taking
      `screenId`, `route` and an optional list of `next` links. It renders the mockup screen
      identifier and the route path as plain text on unstyled default React Native views, plus
      `<Link>`s to the manifest's next destinations. No token, colour, spacing or typography
      choice is made (spec UX Rules); it must look obviously unfinished.
- [ ] Route skeleton: 25 placeholder route files, one per MVP manifest screen, plus three layout
      files and the entry shim. Full file list in **Files to Create** below.
- [ ] `apps/mobile/app/(tabs)/_layout.tsx` renders `<Tabs>` with exactly two `<Tabs.Screen>`
      entries, `home` and `transactions` (AC14, Deferral Note 2). No Presupuestos or Beneficios
      tab, not even disabled. Labels stay at the route file names / plain Spanish text; final
      labels, icons and styling belong to the tab-shell item.
- [ ] No `app/(auth)/` directory, no sign-in route, no credential input anywhere (AC14, AC12).
- [ ] State management: none. No TanStack Query provider, no context, no data fetching — every
      route renders static placeholder text.

### Infrastructure / Configuration

- [ ] Root workspace: `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json`
      (`build`, `dev`, `lint`, `typecheck`, `test`, `clean`), `.npmrc` (Decision 1), `.nvmrc`
      (Decision 6), `tsconfig.base.json`, `eslint.config.mjs`, `.prettierignore`, and the
      rewritten root `package.json` (Decision 5).
- [ ] `.gitignore` additions: `dist/`, `.turbo/`, `.expo/`, `apps/mobile/ios/`,
      `apps/mobile/android/`, `*.tsbuildinfo`. Keep `apps/mobile/expo-env.d.ts` tracked
      (Decision 8).
- [ ] `.github/workflows/ci.yml` — new; three jobs on `pull_request` into `develop` and `main`
      (Decision 9).
- [ ] `.github/workflows/markdown-lint.yml` — migrate `npm ci` to a pnpm install; swap the
      `package-lock.json` `paths` entry for `pnpm-lock.yaml` and add `pnpm-workspace.yaml`. The
      `./node_modules/.bin/markdownlint-cli2` invocation and all lint globs stay byte-for-byte
      identical (AC11).
- [ ] `.github/workflows/e2e-regression.yml` — **not touched**, and no repository variable is set
      (AC10, Decision 12).
- [ ] `pnpm-lock.yaml` — generated by `pnpm install` once every workspace manifest is final, then
      committed. It is the single lockfile after `package-lock.json` is deleted (AC1, AC9,
      Business Rule 12). Regenerate it from the final manifests; never hand-edit it.
- [ ] `hooks/truncation-checker/index.ts` — **no change needed**. Its skip list already matches
      both `/package-lock/` and `/pnpm-lock/`, so the lockfile switch does not disturb the
      optional Haystack agent-commit hook (Verification Log).

---

## Files to Create

### Root

| File | Purpose |
| --- | --- |
| `pnpm-workspace.yaml` | Declares `apps/*` and `packages/*` |
| `turbo.json` | `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**"]`), `dev` (persistent, uncached), `lint`, `typecheck`, `test`, `clean` (uncached) |
| `.npmrc` | `node-linker=hoisted` (Decision 1) |
| `.nvmrc` | `20.19.4` (Decision 6) |
| `tsconfig.base.json` | `strict: true`, `target`/`lib` ES2022, `moduleResolution: bundler`, `noUncheckedIndexedAccess`, `skipLibCheck` |
| `eslint.config.mjs` | Default export: shared flat config (typescript-eslint recommended, `no-console`). Named export: `sharedDomainPurity` (Decision 3) |
| `.prettierignore` | `node_modules`, `dist`, `.expo`, `.turbo`, `pnpm-lock.yaml`, `design/mockups/mobile/index.html`, `e2e` |

### Root command surface (`package.json` scripts)

This is the exact surface AC13 compares against
[`docs/project/2-repo-architecture.md`](../../../project/2-repo-architecture.md) → *Common
Commands*. Anything in that document that this item does not ship is marked as arriving later in
the **Documentation Updates** section — the two must not disagree.

| Script | Value | Notes |
| --- | --- | --- |
| `dev` | `turbo run dev` | All workspaces |
| `dev:mobile` | `pnpm --filter @finanzas/mobile exec expo start` | |
| `dev:mobile:ios` | `pnpm --filter @finanzas/mobile exec expo start --ios` | AC4 |
| `build` | `turbo run build` | Packages only (Decision 10) |
| `test` | `turbo run test` | AC2 |
| `lint` | `turbo run lint` | AC2, AC7 (Decision 3) |
| `typecheck` | `turbo run typecheck` | AC2 |
| `clean` | `turbo run clean` | |
| `format` | `prettier --write "**/*.md"` | Unchanged from `develop` (Decision 4, AC11) |
| `format:code` | `prettier --write "{apps,packages}/**/*.{ts,tsx,js,jsx,json}"` | New (Decision 4) |
| `mockups:mobile` | `open design/mockups/mobile/index.html` | macOS-only convenience, matches the architecture document |
| `mobile:build:dev-store` | `pnpm --dir apps/mobile dlx eas-cli build --profile development` | Declared only; never executed by this item or by CI |
| `mobile:build:production-store` | `pnpm --dir apps/mobile dlx eas-cli build --profile production` | Declared only; never executed by this item or by CI |

`eas-cli` is deliberately **not** a dependency: `pnpm dlx` fetches it only when a human runs a
store build, so CI never pays for it. Both commands require EAS authentication, which is out of
scope here.

Not shipped by this item and therefore reconciled in the architecture document instead:
`mockups:verify` (needs the manifest-verification script under `scripts/design/`), and
`db:generate` / `db:check` (need Drizzle, which AC12 forbids here).

### `apps/mobile`

| File | Purpose |
| --- | --- |
| `package.json` | `@finanzas/mobile`; scripts `dev` (`expo start`), `lint`, `typecheck`, `test`, `clean`; no `build` (Decision 10) |
| `app.config.js` | App name `Finanzas`, slug, scheme `finanzas`, iOS/Android identifiers, no env var reads |
| `eas.json` | `development`, `preview`, `production` build profiles (declared only) |
| `metro.config.js` | Monorepo `watchFolders` + `nodeModulesPaths` + `disableHierarchicalLookup` |
| `babel.config.js` | `babel-preset-expo` |
| `jest.config.js` | `preset: 'jest-expo'` |
| `eslint.config.mjs` | Root config + `eslint-config-expo` flat config |
| `tsconfig.json` | Extends `expo/tsconfig.base` and `../../tsconfig.base.json`; `strict: true` |
| `expo-env.d.ts` | Committed Expo type reference (Decision 8) |
| `assets/` | Default Expo template icon / splash assets (no design decision) |
| `src/components/RoutePlaceholder.tsx` | Shared placeholder component |
| `src/test-utils/route-inventory.ts` | `toRoutePath(relativePath)` and `listRouteFiles(appDir)` |
| `src/test-utils/mockup-manifest.ts` | `loadMockupManifest()` — reads the manifest with `node:vm` |
| `src/test-utils/route-inventory.test.ts` | Unit tests for `toRoutePath` edge cases |
| `src/__tests__/route-manifest-parity.test.ts` | AC5 / AC6 / AC14 parity assertions |
| `src/__tests__/workspace-wiring.test.ts` | AC3 — imports all three packages |

### `apps/mobile/app` — layouts and entry

| File | Route | Notes |
| --- | --- | --- |
| `_layout.tsx` | — | Root `<Stack>` |
| `index.tsx` | — | Entry shim, redirects to `/(onboarding)/intro` (Decision 7) |
| `(onboarding)/_layout.tsx` | — | `<Stack>` |
| `(tabs)/_layout.tsx` | — | `<Tabs>` with exactly two screens (AC14) |

### `apps/mobile/app` — the MVP route files

Every row below is one placeholder screen; the `Mockup screen` column is the `screen_id` the
placeholder must print on screen alongside its route (spec UX Rules, AC5). The list is the live
manifest enumeration recorded in the Verification Log, not a copy of a stale list.

| Route file | Route (manifest) | Mockup screen |
| --- | --- | --- |
| `(onboarding)/intro.tsx` | `/(onboarding)/intro` | `onboarding-intro` |
| `(onboarding)/value.tsx` | `/(onboarding)/value` | `onboarding-value` |
| `(onboarding)/connect-bank.tsx` | `/(onboarding)/connect-bank` | `connect-bank-intro` |
| `(onboarding)/bank-picker.tsx` | `/(onboarding)/bank-picker` | `bank-picker` |
| `(onboarding)/bank-credentials.tsx` | `/(onboarding)/bank-credentials` | `bank-credentials` |
| `(onboarding)/bank-syncing.tsx` | `/(onboarding)/bank-syncing` | `bank-syncing` |
| `(onboarding)/bank-connected.tsx` | `/(onboarding)/bank-connected` | `bank-connected` |
| `(onboarding)/notifications/index.tsx` | `/(onboarding)/notifications` | `notifications-intro` |
| `(onboarding)/notifications/schedule.tsx` | `/(onboarding)/notifications/schedule` | `notifications-schedule` |
| `(onboarding)/ready.tsx` | `/(onboarding)/ready` | `onboarding-ready` |
| `categorize/intro.tsx` | `/categorize/intro` | `stage-intro` |
| `categorize/index.tsx` | `/categorize` | `categorize` |
| `categorize/merchant/[merchantId].tsx` | `/categorize/merchant/[merchantId]` | `merchant-edit` |
| `categorize/complete.tsx` | `/categorize/complete` | `categorize-complete` |
| `(tabs)/home.tsx` | `/(tabs)/home` | `home` |
| `(tabs)/transactions.tsx` | `/(tabs)/transactions` | `transactions` |
| `transactions/[transactionId].tsx` | `/transactions/[transactionId]` | `transaction-detail` |
| `dashboard.tsx` | `/dashboard` | `dashboard` |
| `settings/index.tsx` | `/settings` | `settings` |
| `settings/account.tsx` | `/settings/account` | `settings-account` |
| `settings/banks/index.tsx` | `/settings/banks` | `settings-banks` |
| `settings/banks/[bankId].tsx` | `/settings/banks/[bankId]` | `bank-review` |
| `settings/notifications.tsx` | `/settings/notifications` | `settings-notifications` |
| `settings/categories.tsx` | `/settings/categories` | `settings-categories` |
| `settings/about.tsx` | `/settings/about` | `settings-about` |

Files that must **not** exist: any route under `(auth)/`, `(tabs)/budgets`, `budgets/new`,
`planning`, `planning/life`, `(tabs)/benefits`, `benefits/[categoryId]`, or any
`design-system/*` route (AC6, AC14).

### `packages/*` (identical shape for `shared-domain`, `shared-utils`, `bank-scraper`)

| File | Purpose |
| --- | --- |
| `package.json` | Scoped name; `main`/`types` → `src/index.ts` (Decision 2); scripts `build` (`tsc`), `dev` (`tsc --watch`), `clean` (`rm -rf dist .turbo *.tsbuildinfo`), `lint`, `typecheck`, `test` |
| `tsconfig.json` | Extends `../../tsconfig.base.json`; `rootDir: src`, `outDir: dist`, `declaration: true` |
| `jest.config.js` | `preset: 'ts-jest'`, `testEnvironment: 'node'` |
| `eslint.config.mjs` | Root config; `shared-domain` also appends `sharedDomainPurity` |
| `src/index.ts` | `export const PACKAGE_NAME = '<scoped name>';` |
| `src/index.test.ts` | Asserts `PACKAGE_NAME` — keeps `pnpm test` meaningful in every workspace |

### CI

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | New: `lint`, `typecheck`, `test` jobs on PRs into `develop` and `main` |

## Files to Modify

| File | Change |
| --- | --- |
| `package.json` | Rewritten per Decision 5 (name, engines, `packageManager`, workspace scripts; markdown devDependencies preserved) |
| `package-lock.json` | Deleted (Decision 5) |
| `.gitignore` | Add `dist/`, `.turbo/`, `.expo/`, `apps/mobile/ios/`, `apps/mobile/android/`, `*.tsbuildinfo` |
| `.github/workflows/markdown-lint.yml` | npm → pnpm install; `paths` entry `package-lock.json` → `pnpm-lock.yaml` plus `pnpm-workspace.yaml` |

---

## Testing Strategy

**Test types**: Unit (Jest, four workspaces) + Smoke (manual runbook, partly on the iOS
Simulator). No integration or device-E2E tier in this item — there is no data layer to integrate,
web end-to-end stays disabled (Decision 12), and device end-to-end through Maestro is item #22
(spec Business Rule 10).

**Key scenarios to test**:

1. Each shared package's `PACKAGE_NAME` export resolves — proves the workspace, TypeScript and
   Jest wiring of that package (AC2).
2. `apps/mobile` imports all three packages in one test file and reads each `PACKAGE_NAME` —
   proves the app can consume every package through `workspace:*` + Metro/Jest resolution (AC3).
3. Route/manifest parity: the derived set of route paths under `apps/mobile/app/` equals the 25
   MVP manifest routes, exactly (AC5).
4. Out-of-MVP absence: no route file derives to any `mvp: false` manifest route, no
   `app/(auth)` directory exists, and no route path contains `design-system` (AC6, AC14).
5. Tab composition: `apps/mobile/app/(tabs)/` contains exactly two route files besides
   `_layout.tsx` (AC14).
6. `toRoutePath` edge cases (see the parser-risk addendum below).
7. Domain-purity violation: a deliberate `import Constants from 'expo-constants';` inside
   `packages/shared-domain/src/index.ts` makes `pnpm lint` fail with the restriction message;
   removing it makes lint pass (AC7). Executed manually in Implementation Order Step 3 and smoke
   runbook Step 9 — never committed, because a permanent violation would permanently break
   `pnpm lint`. `expo-constants` is the chosen probe in all three places.
8. Clean-clone reproducibility: `pnpm install && pnpm lint && pnpm typecheck && pnpm test` in a
   fresh clone (AC1, AC2, AC12 review).
9. Simulator boot and flow walk (AC4, AC5 reachability) — smoke runbook.

**Smoke test runbook**: `docs/testing/mobile/1-bootstrap-monorepo-expo-app.smoke-test.md`

**Regression suite**: The repository's only automated regression surface is the disabled
Playwright placeholder in `e2e/`, which stays disabled for this product (AC10). No regression
spec is added.

### Parser-risk addendum

Classified **parser-risk**: `apps/mobile/src/test-utils/route-inventory.ts` derives structured
route paths from file paths, and `mockup-manifest.ts` evaluates a structured-text manifest file.
Both drive the AC5/AC6/AC14 assertions, so a silent derivation bug would silently weaken those
criteria.

`toRoutePath(relativePath: string): string | null` contract: takes a path relative to
`apps/mobile/app`, returns the manifest-style route string, or `null` when the file is not a
route. Manifest routes keep their group parentheses (`/(tabs)/home`), so groups are preserved
verbatim rather than stripped.

**Edge-case enumeration** (concrete inputs → expected output):

| Input (relative to `app/`) | Expected `toRoutePath` result | Why it matters |
| --- | --- | --- |
| `dashboard.tsx` | `/dashboard` | Plain top-level route |
| `(tabs)/home.tsx` | `/(tabs)/home` | Group parentheses preserved, not stripped |
| `(onboarding)/notifications/index.tsx` | `/(onboarding)/notifications` | `index` collapses to its parent directory |
| `categorize/index.tsx` | `/categorize` | `index` collapse next to sibling non-index routes |
| `categorize/merchant/[merchantId].tsx` | `/categorize/merchant/[merchantId]` | Dynamic segment preserved character-for-character |
| `settings/banks/[bankId].tsx` | `/settings/banks/[bankId]` | Nested dynamic segment |
| `_layout.tsx` | `null` | Layout files are not destinations |
| `(tabs)/_layout.tsx` | `null` | Layout inside a group |
| `index.tsx` (app root) | `null` | Entry shim, excluded by Decision 7 |
| `settings/_shared.ts` | `null` | Leading-underscore non-route file |
| `+not-found.tsx` | `null` | Expo special file; must not be counted as a manifest route even if a later item adds it |
| `dashboard.test.tsx` | `null` | Negative case: a test file whose name resembles a route |
| `dashboard.tsx.bak` | `null` | Negative case: only `.tsx`/`.ts` route extensions count |
| `Settings/about.tsx` | `/Settings/about` (no case normalisation) | Guard against accidental case folding hiding a real mismatch — the parity assertion must fail loudly, not silently pass |
| `settings//about.tsx` (doubled separator) | `/settings/about` | Separator normalisation so a path-join artefact cannot fail parity spuriously |

**Unit test mapping**: `apps/mobile/src/test-utils/route-inventory.test.ts` — one `it(...)` per
row above (15 cases), each asserting the exact expected value. Two further tests cover
`listRouteFiles`: it must recurse into nested directories, and it must return paths with `/`
separators on any platform.

`mockup-manifest.ts` edge cases are covered inside
`apps/mobile/src/__tests__/route-manifest-parity.test.ts`: the loader must throw a descriptive
error if `window.__MOCKUP_MANIFEST__` is undefined after evaluation (guards against a future
manifest refactor silently emptying the expected route set and making parity trivially pass), and
the derived MVP route list must contain exactly 25 entries before the set comparison runs.

**Suppression semantics**: Not applicable — neither helper supports inline suppression
directives, and none should be added. A route that cannot satisfy parity is a manifest change
(Business Rule 3), not a suppression.

### Concurrent-event-source addendum

**Not applicable.** The skeleton has no event listeners, sockets, timers or async queues, and no
shared mutable state: every route renders static placeholder text, and the helpers are
synchronous pure functions over the file system. The scraper's concurrency model arrives with the
`@finanzas/bank-scraper` implementation item.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| — | None. This item introduces no database, no fixtures and no sample product data; spec Business Rule 7 and AC12 forbid it. The route-parity tests read the committed `design/mockups/mobile/mockup-manifest.js`, which is existing repository content, not seed data. | — |

---

## Documentation Updates

To be executed by the developer during implementation (not now). Business Rule 1 and AC13
require the architecture document and the skeleton to agree at the end of this change.

- [ ] `docs/project/2-repo-architecture.md` — (a) in **Directory Structure**, mark
      `scripts/design/`, `scripts/dev/`, `.maestro/` and `apps/mobile/scripts/` as arriving with
      later items, and add the root files this item actually creates (`tsconfig.base.json`,
      `.prettierignore`); (b) in **Conventions inherited from `zeki-platform`**, restate the
      ESLint sentence as "the rule is defined in the root `eslint.config.mjs` and applied by
      `packages/shared-domain/eslint.config.mjs`" (Decision 3); (c) in **Common Commands**, mark
      `mockups:verify`, `db:generate` and `db:check` as arriving with the manifest-verification
      and database items, note that `mobile:build:*` require EAS authentication and are not run by
      this item, and add `format:code` and `clean`; (d) in **Dependency Graph**, keep the purity
      sentence but point at the applying config; (e) in **Environment Setup**, drop the
      `apps/mobile/.env.example` step — the skeleton requires no environment variable (AC1).
- [ ] `docs/project/3-software-architecture.md` — in **Frontend Architecture**, remove the
      `(auth)/sign-in.tsx · verify-code.tsx` line and the `budgets.tsx · benefits.tsx` tab
      entries, note that the tab bar renders exactly two tabs in the MVP, and align the tree with
      `src/features/` and `src/lib/`; in **Automated Suite**, fix
      `pnpm --filter mobile exec maestro …` to `pnpm --filter @finanzas/mobile exec maestro …`.
- [ ] `docs/best-practices/stack/expo-react-native.md` — the line "Groups in use: `(auth)`,
      `(onboarding)`, `(tabs)`" must drop `(auth)`; there is no sign-in in this product.
- [ ] `AGENTS.md` (and therefore `CLAUDE.md` / `GEMINI.md`, which are symlinks) — in **Common
      Commands**, replace `pnpm --filter mobile exec expo start` with `pnpm dev:mobile`, use the
      scoped workspace names in every `--filter` example, mark the `db:*` commands as arriving
      with the database item, and state the pinned Node/pnpm versions. Leave the markdown lint and
      formatting command block unchanged (AC11).
- [ ] `README.md` — update **Status** (the skeleton now exists), replace
      `pnpm --filter mobile exec expo start` with `pnpm dev:mobile` in **Quick start**, and fix
      the **MVP scope** line that still begins "In: sign-in, …" — there is no sign-in.
- [ ] `docs/testing/README.md` — add a one-line pointer that product smoke runbooks live under
      `docs/testing/mobile/` while workflow runbooks stay under `docs/testing/workflow/`. No other
      change; that file is still a project-setup template.
- [ ] `docs/project/4-database-model.md` — no change (no schema in this item).

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **AC4 (iOS Simulator boot) cannot be verified in the automated agent environment** | Certain | Medium | Implementation Order Step 6 is marked human-verification-required, and the pull request description must flag AC4 as pending human verification instead of claiming it. Runbook Steps 4-8 carry the same marking |
| pnpm's symlinked layout breaks Metro/Expo resolution | High | High | `node-linker=hoisted` from the start (Decision 1); the simulator boot in Implementation Order Step 6 is the gate that proves it — which means this risk is only fully retired by a human run |
| The implementation is verified on the developer machine's Node v26.5.0 instead of the pinned Node 20, hiding a Node 20 incompatibility until CI | Medium | Medium | `nvm use` before every verification command; CI resolves the version from `.nvmrc` (`node-version-file`), so the pinned runtime is exercised on every pull request regardless of the local machine (Decision 6) |
| Replacing the root `package.json` breaks the markdown lint workflow the whole AI workflow depends on | Medium | High | Keep the three markdown devDependencies and the `format` glob byte-identical (Decisions 4, 5); run the three AGENTS.md markdown commands locally before and after (AC11); the markdown-lint workflow itself is exercised by this PR |
| Expo SDK 54 tooling rejects the pinned Node patch | Medium | Medium | Decision 6 allows raising the patch within Node 20 and requires escalation for anything larger (Business Rule 11) |
| `app/(tabs)/transactions.tsx` and the sibling `app/transactions/` directory are reported by Expo Router as a route conflict | Low | Medium | Both come straight from the manifest, so a rename is not an option (Business Rule 3). Verify during Step 6; if the router reports a conflict, stop and escalate the exact message rather than renaming a manifest route |
| `tsc --noEmit` passes locally but fails in CI because a generated Expo type file is missing | Medium | Medium | Commit `expo-env.d.ts` and keep typed routes off (Decision 8); Implementation Order Step 9 verifies type-check in a clean clone before the PR |
| Three CI jobs each install dependencies, tripling minutes on every PR including docs-only ones | Medium | Low | `concurrency` with `cancel-in-progress`, pnpm store caching via `actions/setup-node` `cache: pnpm`; revisit path filters only if a required-check configuration makes them safe (Decision 9) |
| `pnpm/action-setup` is a third-party action | Low | Medium | Pin by commit SHA like every other action in this repository; the Corepack alternative is rejected because bundled Corepack versions have known signature-verification failures with pnpm 10 |
| Placeholder screens drift toward looking implemented | Low | Medium | One shared `RoutePlaceholder` component, no theme import, no token usage; the smoke runbook has an explicit "does not resemble the mockup" check |

---

## Code Samples

> All samples are **illustrative** — adapt during implementation.

Domain-purity block (root `eslint.config.mjs`, Decision 3):

```js
// Illustrative — adapt during implementation
export const sharedDomainPurity = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              'expo',
              'expo-*',
              'react-native',
              'react-native-*',
              '@finanzas/mobile',
              '**/apps/**',
              'drizzle-orm',
              'drizzle-orm/*',
              'expo-sqlite',
              'better-sqlite3',
              'sqlite3',
              'knex',
              'kysely',
              'typeorm',
              '@prisma/client',
            ],
            message:
              '@finanzas/shared-domain may not depend on the app, on Expo modules, or on any SQL library.',
          },
        ],
      },
    ],
  },
};
```

Route path derivation (`apps/mobile/src/test-utils/route-inventory.ts`):

```ts
// Illustrative — adapt during implementation
export function toRoutePath(relativePath: string): string | null {
  const normalized = relativePath.split('\\').join('/').replace(/\/{2,}/g, '/');
  if (!/\.(ts|tsx)$/.test(normalized)) return null;
  if (/\.test\.(ts|tsx)$/.test(normalized)) return null;

  const withoutExt = normalized.replace(/\.(ts|tsx)$/, '');
  const segments = withoutExt.split('/');
  const last = segments[segments.length - 1];

  if (segments.some((s) => s.startsWith('_') || s.startsWith('+'))) return null;
  if (segments.length === 1 && last === 'index') return null; // entry shim (Decision 7)
  if (last === 'index') segments.pop();

  return `/${segments.join('/')}`;
}
```

Tab layout (`apps/mobile/app/(tabs)/_layout.tsx`, AC14):

```tsx
// Illustrative — adapt during implementation
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transacciones' }} />
    </Tabs>
  );
}
```

---

## Implementation Order

1. **Root workspace skeleton.** Create `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`,
   `tsconfig.base.json`, `turbo.json`, `.prettierignore`; rewrite `package.json` (Decision 5);
   delete `package-lock.json`; extend `.gitignore`.
   *Verify*: `pnpm install` succeeds and writes `pnpm-lock.yaml`; `pnpm format` still rewrites
   only markdown files (`git status` shows no non-markdown file touched).

2. **Shared packages.** Create the three workspaces with their manifests, `tsconfig.json`,
   `jest.config.js`, `eslint.config.mjs`, `src/index.ts` and `src/index.test.ts`; wire
   `workspace:*` dependencies per the Layer-by-Layer section.
   *Verify*: `pnpm build`, `pnpm --filter @finanzas/shared-domain test`,
   `pnpm --filter @finanzas/shared-utils build` and `pnpm --filter @finanzas/bank-scraper lint`
   each succeed; `pnpm --filter @finanzas/shared-domain clean` removes `dist/` (AC3).

3. **Domain-purity rule.** Add `sharedDomainPurity` to the root `eslint.config.mjs` and apply it
   in `packages/shared-domain/eslint.config.mjs` (Decision 3).
   *Verify*: temporarily add `import 'expo-constants';` to `packages/shared-domain/src/index.ts`,
   run `pnpm lint`, confirm the output names the restriction message from the sample above, then
   remove the import and confirm `pnpm lint` passes again. Do not commit the violation (AC7).

4. **Expo app scaffold.** Create `apps/mobile` on Expo SDK 54: manifest with `"expo": "~54.0.0"`,
   then `pnpm --filter @finanzas/mobile exec expo install expo-router expo-constants expo-linking
   expo-status-bar react-native-safe-area-context react-native-screens` and
   `expo install --fix` so every version comes from the SDK 54 compatibility table rather than
   from this plan. Add `app.config.js`, `eas.json`, `metro.config.js`, `babel.config.js`,
   `jest.config.js`, `eslint.config.mjs`, `tsconfig.json`, `expo-env.d.ts`, `assets/`.
   *Verify*: `pnpm --filter @finanzas/mobile typecheck` passes; `pnpm lint` passes; confirm the
   installed `expo` version reported by `pnpm --filter @finanzas/mobile exec expo --version`
   belongs to SDK 54.

5. **Route skeleton.** Add `RoutePlaceholder`, the three layout files, the entry shim
   (Decision 7) and all 25 route files from the **Files to Create** tables. Each placeholder
   prints its `screen_id` and route and links to its manifest successors; `(tabs)/_layout.tsx`
   declares exactly two screens.
   *Verify*: `pnpm typecheck` and `pnpm lint` pass. Run the command from the Verification Log's
   MVP-route row again and confirm the printed route list matches the route files you created,
   file by file.

6. **Boot and walk — HUMAN VERIFICATION REQUIRED.** `pnpm dev:mobile:ios` on a macOS machine with
   Xcode. **This step cannot be executed in the automated agent environment**: booting the iOS
   Simulator needs an interactive macOS session with Xcode, which the implementation agent does
   not have. The implementation pull request description must list AC4 (and the flow-walk parts of
   AC5 and AC14) as *pending human verification* rather than claiming them from agent evidence,
   and must say so explicitly before `ready-for-human-review` is requested.
   *Verify (human)*: the app boots to the onboarding intro placeholder; walk the onboarding,
   categorization, tab, transactions, dashboard and settings areas; confirm the tab bar shows two
   tabs; confirm the Metro output reports no route conflict and no missing-module warning. Reach
   one dynamic route directly with
   `pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://transactions/any-id" --ios`.
   The agent-runnable substitutes for this step are Step 5's route enumeration and Step 7's parity
   test; they establish that the route *files* are correct, not that the app *boots*.

7. **Parity and wiring tests.** Add `src/test-utils/route-inventory.ts`,
   `src/test-utils/mockup-manifest.ts`, `src/test-utils/route-inventory.test.ts`,
   `src/__tests__/route-manifest-parity.test.ts` and `src/__tests__/workspace-wiring.test.ts`.
   *Verify*: `pnpm test` passes across all four workspaces. Then prove the parity test is not
   vacuous: temporarily create `apps/mobile/app/(tabs)/budgets.tsx`, confirm `pnpm test` fails
   naming that route, and delete it.

8. **CI.** Add `.github/workflows/ci.yml` with the `lint`, `typecheck` and `test` jobs
   (Decision 9), pinning every action by commit SHA — reuse the SHAs already used in this
   repository for `actions/checkout` and `actions/setup-node`, and resolve `pnpm/action-setup` v4
   with `gh api repos/pnpm/action-setup/commits/v4 -q .sha`. Migrate
   `.github/workflows/markdown-lint.yml` from `npm ci` to pnpm and update its `paths` list.
   *Verify*: `actionlint` or a YAML parse if available; after pushing, confirm the pull request
   shows three separate check results and that the markdown-lint check still passes.

9. **Clean-clone verification (AC1, AC2, AC11, AC12).** Clone the branch into a scratch directory,
   run `pnpm install`, then `pnpm lint`, `pnpm typecheck`, `pnpm test`. Run the three markdown
   commands documented in `AGENTS.md` (markdownlint-cli2, the heuristic lint, the duplicate-header
   check) and confirm the output is unchanged from `develop`. Finally, review the diff for
   credentials, credential prompts, monetary amounts, schema/migration files or bank-specific
   scraping logic — there must be none.

10. **Smoke runbook.** Execute
    `docs/testing/mobile/1-bootstrap-monorepo-expo-app.smoke-test.md` end to end and record the
    result in the PR description.

11. **Documentation.** Apply every item in the **Documentation Updates** section above.

12. **CHANGELOG.** Add this entry verbatim under `### Added` in the `[Unreleased]` section of
    `CHANGELOG.md`:

    ```markdown
    - **Bootstrap the monorepo and the Expo app** (#1): Turborepo + pnpm workspace with the Expo
      SDK 54 app (`apps/mobile`, Expo Router, strict TypeScript), the `shared-domain`,
      `shared-utils` and `bank-scraper` packages, placeholder routes for every MVP mockup screen,
      an enforced shared-domain import restriction, and lint / type-check / test checks on pull
      requests
    ```

### Residual verification strategy

This is a pattern-completeness item ("every MVP route in the manifest"). Before requesting
`ready-for-human-review`, the implementation PR description must record:

- **Evidence source**: the passing `route-manifest-parity` test run, which asserts set equality
  between derived route files and manifest MVP routes — occurrence counts alone are not accepted,
  because a count can match while two route strings differ.
- **Residual list**: the out-of-MVP manifest screens deliberately left without a route (the eight
  `mvp: false` screens and the three design-system screens), quoted from the spec's MVP Route
  Scope exclusion table with the reason "out of MVP / not an app destination".
- **Negative-control evidence**: the Step 7 verification that a deliberately added out-of-MVP
  route file makes the parity test fail, proving the guard is live rather than vacuous.

---

## Acceptance Criteria Coverage

| AC | Where it is satisfied | Verification mechanism |
| --- | --- | --- |
| AC1 | Steps 1, 9 | `pnpm install` from a clean clone, no manual repair, no environment variable |
| AC2 | Steps 1–8, 9 | `pnpm lint` / `pnpm typecheck` / `pnpm test` are `turbo run` tasks; every one of the four workspaces defines all three scripts |
| AC3 | Step 2 | Per-package `build` / `dev` / `clean` / `lint` scripts; `workspace-wiring.test.ts` proves the app consumes all three |
| AC4 | Step 6 | Simulator boot via `pnpm dev:mobile:ios`; smoke runbook Step 4 |
| AC5 | Steps 5, 6, 7 | `route-manifest-parity.test.ts` set equality + smoke runbook flow walk and deep-link steps |
| AC6 | Step 7 | Parity test's absence assertions for the eight `mvp: false` routes and the three design-system screens |
| AC7 | Step 3 | `sharedDomainPurity` `no-restricted-imports` block; smoke runbook Step 9 demonstrates failure and recovery |
| AC8 | Step 8 | Three separate GitHub Actions jobs on PRs into `develop` and `main` |
| AC9 | Step 8 | `pnpm install --frozen-lockfile` in every CI job |
| AC10 | — | `e2e-regression.yml` is untouched and stays double-gated (repo variable + label); `ci.yml` installs no browser |
| AC11 | Steps 1, 8, 9 | `format` glob and markdown lint globs unchanged; markdown-lint workflow re-verified on this PR |
| AC12 | Step 9 | Diff review checklist; no `src/db/`, no `expo-secure-store`, no `expo-sqlite`, no money formatting anywhere in the item |
| AC13 | Step 11 | Documentation Updates align `docs/project/2-repo-architecture.md` with the delivered skeleton |
| AC14 | Steps 5, 7 | `(tabs)/_layout.tsx` declares exactly two screens; parity test asserts the tab-group file count and the absence of `(auth)` |
