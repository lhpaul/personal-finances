# Smoke Test Runbook: Bootstrap the Monorepo and the Expo App

**Feature**: Monorepo + Expo app skeleton (issue #1)
**Spec**: [`../../specs/developments/20260801113404_1-bootstrap-monorepo-expo-app/1_1-bootstrap-monorepo-expo-app_specs.md`](../../specs/developments/20260801113404_1-bootstrap-monorepo-expo-app/1_1-bootstrap-monorepo-expo-app_specs.md)
**Implementation plan**: [`../../specs/developments/20260801113404_1-bootstrap-monorepo-expo-app/2_1-bootstrap-monorepo-expo-app_implementation-plan.md`](../../specs/developments/20260801113404_1-bootstrap-monorepo-expo-app/2_1-bootstrap-monorepo-expo-app_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

Before running this smoke test:

- [ ] A **fresh clone** of the branch under test, in a directory that has never had
      `node_modules` installed (Steps 1-3 test clean-clone behaviour and cannot be trusted in a
      dirty tree).
- [ ] The Node version named in `.nvmrc` is active (`nvm use`), and pnpm 10 or newer is
      available (`pnpm --version`).
- [ ] macOS with Xcode and an iOS Simulator installed — required only for Steps 4, 5, 7 and 8.
- [ ] `design/mockups/mobile/index.html` can be opened in a browser (the UI contract, used in
      Step 7).

There is **no login step and no seeded database** in this runbook: the product has no sign-in
and this item introduces no database.

---

## Test Data

| Item | Value |
| --- | --- |
| Placeholder merchant id | `any-merchant` |
| Placeholder transaction id | `any-transaction` |
| Placeholder bank id | `any-bank` |
| Deep-link scheme | `finanzas://` |
| Mockup viewer | `design/mockups/mobile/index.html` |
| Manifest (routing contract) | `design/mockups/mobile/mockup-manifest.js` |

Dynamic routes accept any identifier value — the skeleton does not validate it.

---

## Smoke Test Steps

### Step 1: Install from a clean clone

**Maps to**: AC1

1. From the repository root of the fresh clone, run `pnpm install`.

**Expected result**: The install completes successfully with no manual repair step, no prompt to
create an environment file, and no undocumented environment variable. `pnpm-lock.yaml` is
unchanged afterwards (`git status` reports a clean tree).

### Step 2: Root verification commands

**Maps to**: AC2

1. Run `pnpm lint`.
2. Run `pnpm typecheck`.
3. Run `pnpm test`.

**Expected result**: All three succeed. Each command's output names all four workspaces —
`@finanzas/mobile`, `@finanzas/shared-domain`, `@finanzas/shared-utils`, `@finanzas/bank-scraper`
— so a failure is attributable to a specific workspace and command.

### Step 3: Per-package commands

**Maps to**: AC3

1. Run `pnpm --filter @finanzas/shared-domain build`, then `dev` (start and stop it), then
   `clean`, then `lint`.
2. Repeat for `@finanzas/shared-utils` and `@finanzas/bank-scraper`.
3. Run `pnpm --filter @finanzas/mobile test`.

**Expected result**: Every package command succeeds on its own; `build` produces `dist/` and
`clean` removes it. The mobile workspace's `workspace-wiring` test passes, proving the app
consumes code from all three packages.

### Step 4: Boot the app in the iOS Simulator — HUMAN VERIFICATION REQUIRED

**Maps to**: AC4

> Steps 4-8 need an interactive macOS session with Xcode and cannot be executed by the
> implementation agent. Their results must be recorded by a human; until then the pull request
> must list AC4 — and the flow-walk portions of AC5 and AC14 — as *pending human verification*
> rather than claiming them.

1. Run `pnpm dev:mobile:ios`.
2. Wait for the iOS Simulator to open the app.

**Expected result**: The app boots and lands on the `onboarding-intro` placeholder. The Metro
output contains no route-conflict warning and no missing-module error.

### Step 5: Walk the MVP flow map

**Maps to**: AC5, AC14

1. Starting from the onboarding intro placeholder, navigate forward through the onboarding area
   to `onboarding-ready`, including the notifications sub-route.
2. Navigate through the categorization area: intro, categorize, merchant editor, complete.
3. Reach the tab area and switch between its tabs.
4. From the transactions tab, open a transaction detail placeholder.
5. Reach the dashboard placeholder.
6. Walk the settings area, including the bank detail placeholder.
7. On every placeholder reached, read the text on screen.

**Expected result**: Every one of the MVP routes listed in the spec's *MVP Route Scope* table is
reachable by navigation, and each placeholder prints the mockup screen identifier and the route
it stands for. The tab bar shows exactly two tabs — Inicio and Transacciones — and there is no
Presupuestos tab, no Beneficios tab, and no sign-in screen anywhere in the walk.

### Step 6: Reach routes directly (no flow replay)

**Maps to**: AC5

1. With the app running, open each of the following without walking the flow:

   ```bash
   pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://transactions/any-transaction" --ios
   pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://categorize/merchant/any-merchant" --ios
   pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://settings/banks/any-bank" --ios
   pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://dashboard" --ios
   ```

**Expected result**: Each command lands directly on the corresponding placeholder, with the
placeholder identifier value accepted as-is and no validation error.

### Step 7: Out-of-MVP routes do not exist

**Maps to**: AC6, AC14

1. Attempt each of the following:

   ```bash
   pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://sign-in" --ios
   pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://budgets" --ios
   pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://benefits" --ios
   pnpm --filter @finanzas/mobile exec uri-scheme open "finanzas://planning" --ios
   ```

2. Confirm from the repository that no `apps/mobile/app/(auth)` directory exists.

**Expected result**: Each attempt lands on the router's unmatched-route screen rather than a
placeholder. No `(auth)` directory exists.

### Step 8: Design fidelity — expected vs actual

**Maps to**: AC5, and the spec's UX Rules ("placeholders look obviously unfinished")

**Reference asset**: `design/mockups/mobile/index.html` (the repository's UI contract), addressed
per screen with `#screen=<screen_id>`.

1. Open the mockup viewer and select `#screen=home`, then `#screen=settings`, then
   `#screen=bank-credentials`.
2. Put each mockup next to the corresponding placeholder in the simulator.
3. Compare, in this order:
   - **Identity**: the placeholder prints the same `screen_id` and route as the mockup entry.
   - **Deliberate non-fidelity**: the placeholder does *not* reproduce the mockup's layout,
     colours, copy or components.
   - **No product data**: the placeholder shows no amount, no bank movement, no account, no
     credential field — including on `bank-credentials`, whose mockup does show a credential
     form.
4. Record PASS/FAIL with expected-vs-actual detail on failure.

**Expected result**: Identity matches for every screen checked; visual fidelity is deliberately
absent; no product data or credential input appears anywhere.

### Step 9: The domain-purity restriction fails a deliberate violation

**Maps to**: AC7

1. Add `import Constants from 'expo-constants';` to `packages/shared-domain/src/index.ts`.
2. Run `pnpm lint`.
3. Remove the import.
4. Run `pnpm lint` again.

**Expected result**: The first run fails and the message names the violated restriction — that
`@finanzas/shared-domain` may not depend on the app, on Expo modules, or on any SQL library — and
identifies the offending import. The second run passes. Leave the working tree clean.

### Step 10: Automated checks on the pull request

**Maps to**: AC8, AC9, AC10

1. Open the implementation pull request into `develop`.
2. Read the checks list on the pull request.
3. Open the run log of one check.
4. Confirm no browser-based end-to-end check ran.

**Expected result**: Three separate check results are visible — lint, type-check and test — each
attributable to its own command. Each installs dependencies with a frozen lockfile. The
`E2E / Regression Tests` workflow did not run.

### Step 11: Lockfile drift fails the checks

**Maps to**: AC9

1. On a scratch branch, add a dependency to `packages/shared-utils/package.json` by hand without
   regenerating the lockfile, and push.

**Expected result**: The CI jobs fail during install because the lockfile no longer matches the
workspace manifests, rather than silently resolving a different version. Delete the scratch
branch afterwards.

### Step 12: The AI workflow markdown tooling is unchanged

**Maps to**: AC11

1. Run the markdown lint and formatting commands documented in `AGENTS.md`:

   ```bash
   npx markdownlint-cli2 "docs/specs/developments/**/*.md" "docs/testing/workflow/**/*.md" "CHANGELOG.md"
   find docs/specs/developments docs/testing/workflow -name "*.md" -print0 \
     | xargs -0 python3 scripts/lint/markdown-heuristic-lint.py CHANGELOG.md
   bash scripts/lint/check-changelog-duplicate-headers.sh CHANGELOG.md
   pnpm format
   ```

2. Run `git status`.

**Expected result**: The three lint commands produce the same results as on `develop`, and
`pnpm format` rewrites markdown files only — `git status` shows no non-markdown file modified.

### Step 13: No forbidden content was introduced

**Maps to**: AC12, AC13

1. Review the full diff of the implementation branch.
2. Confirm the workspace names, directory layout and root command surface match
   `docs/project/2-repo-architecture.md` as it stands after this change.

**Expected result**: No file contains a bank credential, a credential prompt, a monetary amount,
a database schema or migration, or bank-specific scraping logic. Any intentional difference from
the architecture document is reflected in that document in the same change.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below.
- Stop the Metro bundler and shut down the simulator.
- Confirm the working tree is clean (no leftover deliberate violation from Step 9 or 11).

---

## Assertions Checklist

- [ ] **AC1** — `pnpm install` succeeds from a clean clone with no manual repair step and no undocumented environment variable.
- [ ] **AC2** — `pnpm lint`, `pnpm typecheck` and `pnpm test` succeed from the root and cover the app and all three packages.
- [ ] **AC3** — Each package builds, develops, cleans and lints on its own, and the app consumes all three.
- [ ] **AC4** — `pnpm dev:mobile:ios` boots the app in the iOS Simulator and renders a placeholder.
- [ ] **AC5** — Every MVP route exists, is reachable by flow and directly, and names its mockup screen and route.
- [ ] **AC6** — No route exists for the eight out-of-MVP screens or the three design-system screens.
- [ ] **AC7** — A deliberate restricted import in `shared-domain` fails lint with the restriction message; removing it passes.
- [ ] **AC8** — The pull request shows lint, type-check and test results individually.
- [ ] **AC9** — Checks install from the committed lockfile, and a mismatched lockfile fails them.
- [ ] **AC10** — No browser-based end-to-end check runs on the pull request.
- [ ] **AC11** — The `AGENTS.md` markdown lint and formatting commands behave exactly as before.
- [ ] **AC12** — No credential, credential prompt, monetary amount, schema, migration or scraping logic was introduced.
- [ ] **AC13** — Workspace names, layout and root commands match `docs/project/2-repo-architecture.md`.
- [ ] **AC14** — Exactly two tabs (Inicio, Transacciones); no Presupuestos or Beneficios route or tab; no `(auth)` route group; `(onboarding)/intro` and `(tabs)/home` both exist.

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| — | None. This item introduces no database and no product data. | — |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Metro fails to resolve a workspace package | `node-linker=hoisted` missing from `.npmrc`, or `metro.config.js` lacks the monorepo `watchFolders` / `nodeModulesPaths` | Restore both, delete `node_modules`, re-run `pnpm install` |
| `tsc --noEmit` passes locally but fails in CI | `apps/mobile/expo-env.d.ts` was gitignored instead of committed | Commit the file; re-run type-check in a clean clone |
| A route opens the unmatched-route screen unexpectedly | The route file name does not match the manifest path exactly | Fix the file name; never rename a route without changing the manifest in the same change |
| The parity test passes but a route is visibly missing | The manifest loader returned an empty screen set | Confirm the loader throws when `window.__MOCKUP_MANIFEST__` is undefined |
| `pnpm format` rewrites non-markdown files | The root `format` glob was widened | Restore `prettier --write "**/*.md"` and use `format:code` for source |

---

## Known Limitations

- Steps 4-8 need an interactive macOS session with Xcode and are human-verification-required;
  every other step runs unattended on any platform.
- Step 11 mutates a scratch branch and must be cleaned up afterwards.
- Fidelity in Step 8 is a deliberate *non*-match check: placeholders are expected to look
  unfinished, so this runbook cannot detect visual regressions against the mockups. Real fidelity
  checks arrive with the screen-implementation items.
