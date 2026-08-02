# Smoke Test Runbook: Fix the pnpm hoisted layout and add a CI bundle check

**Feature**: Hoisted pnpm layout enforced locally and in CI, iOS bundle check in CI, a test that
proves the `@finanzas/shared-domain` import restriction fires, and a native setup sequence that was
actually executed.
**Work item**: [lhpaul/personal-finances#35](https://github.com/lhpaul/personal-finances/issues/35) — `Type: Refactor` (no spec; the issue body is the specification)
**Implementation plan**: [`2_35-pnpm-hoisted-layout-ci-bundle-check_implementation-plan.md`](../../specs/developments/20260801232851_35-pnpm-hoisted-layout-ci-bundle-check/2_35-pnpm-hoisted-layout-ci-bundle-check_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

> **The point of this runbook**: every step below that verifies a control also *breaks* it first.
> A control that has only ever been seen to pass has not been verified. Do not mark a step PASS
> because it looks right — mark it PASS because you saw the failure and then saw the fix.

---

## Prerequisites

- [ ] macOS with **Xcode** and at least one iOS Simulator installed — required for Steps 7 and 8
      only. Steps 1–6 and 9 run unattended on any platform.
- [ ] **CocoaPods** installed (`pod --version`) — Step 7.
- [ ] Node 22 (`.nvmrc`) and pnpm resolved through `packageManager` (`pnpm --version` must print
      `11.12.0` when run inside the repository).
- [ ] A working network connection — Steps 1–3 reinstall dependencies several times.
- [ ] The implementation branch checked out, and its pull request open (Step 5 reads CI results).
- [ ] No uncommitted work you care about: several steps deliberately install a broken dependency
      tree and one pushes a scratch commit that is reverted.

> **Time**: Steps 1–6 take roughly 20–30 minutes including reinstalls. Step 7 (`expo prebuild` +
> CocoaPods + first native build) can take 15–30 minutes on a cold machine.

---

## Test Data

| Item | Value |
| --- | --- |
| Layout check | `pnpm check:layout` |
| Layout check script | `scripts/check-node-linker-layout.mjs` |
| Linker declaration | `nodeLinker: hoisted` in `pnpm-workspace.yaml` |
| Probe module (transitive, hoisted-only) | `node_modules/@expo/metro-runtime` |
| Bundle command | `cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false` |
| Purity test | `pnpm --filter @finanzas/shared-domain test` |
| CI workflow | `.github/workflows/ci.yml`, job `bundle` (display name `iOS bundle`) |

---

## Smoke Test Steps

### Step 1: A plain install produces a hoisted layout

**Maps to**: AC1

1. From the repository root: `rm -rf node_modules apps/*/node_modules packages/*/node_modules`
2. Run `pnpm install` — **no flags**.
3. Run `ls -d node_modules/@expo/metro-runtime`.
4. Run `ls -ld node_modules/react-native`.
5. Run `pnpm config get nodeLinker`.

**Expected result**: the install succeeds; both directories exist at the **workspace root** and are
real directories, not symlinks; `pnpm config get nodeLinker` prints `hoisted`. There is no `.npmrc`
in the repository root (`ls .npmrc` reports "No such file").

### Step 2: The layout check fails on a deliberately isolated tree

**Maps to**: AC2

1. `pnpm install --node-linker=isolated --ignore-scripts`
2. `pnpm check:layout; echo "exit=$?"`
3. `pnpm install` (plain, no flags)
4. `pnpm check:layout; echo "exit=$?"`

**Expected result**: step 2 prints `exit=1` with FAIL lines naming the installed-layout assertion
and the missing root modules, and each FAIL line says what to fix and which command to re-run.
Step 4 prints `exit=0` with one ok line per assertion. Record both outputs — this is the evidence
that the check can fail, not just pass.

### Step 3: A plain install cannot silently end isolated

**Maps to**: AC1, AC2

1. `pnpm install --node-linker=isolated; echo "exit=$?"` (note: **no** `--ignore-scripts` this time)
2. `pnpm install; echo "exit=$?"`

**Expected result**: the first command exits non-zero — the `postinstall` layout check fails the
install itself, with the same diagnostic as Step 2. The second command exits `0`. Anyone who ends
up with an isolated tree learns it at install time, not fifteen minutes into a native build.

### Step 4: The bundle command fails on an isolated tree and succeeds on a hoisted one

**Maps to**: AC3, AC4

1. `pnpm install --node-linker=isolated --ignore-scripts`
2. `cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false; echo "exit=$?"`
3. `cd ../.. && pnpm install`
4. `cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false; echo "exit=$?"`
5. `cd ../..`

**Expected result**: step 2 exits non-zero with the resolver error
`Unable to resolve "@expo/metro-runtime" from expo-router/entry-classic.js`. Step 4 exits `0` and
reports a module count, bundle size and asset count — record these numbers; the issue's reference
run was 1022 modules, 3.9 MB, 22 assets, and a large deviation is worth a look.

> If the exact `--eager` invocation had to be adapted (see the plan's Risks table), use the form
> recorded in the implementation PR here and note the deviation in the results.

### Step 5: The CI bundle job fails on an isolated tree and passes on a hoisted one

**Maps to**: AC3, AC4

1. Open the implementation pull request's checks list.
2. Confirm four jobs are reported individually: `Lint`, `Type check`, `Test`, `iOS bundle`.
3. Open the **failing** `iOS bundle` run recorded in the PR description (the scratch commit that
   set `nodeLinker: isolated`). Confirm the failure is in the layout check step or the bundle step,
   with the resolver error — not an unrelated infrastructure failure.
4. Open the **passing** `iOS bundle` run on the final head commit.
5. Confirm the final diff contains `nodeLinker: hoisted` and no leftover scratch commit content.

**Expected result**: both run URLs exist and show what the plan claims. A green `iOS bundle` job
with no recorded failing counterpart does not pass this step.

### Step 6: The domain-purity ESLint rule is proved to fire

**Maps to**: AC5

1. `pnpm --filter @finanzas/shared-domain test`
2. Temporarily empty the `patterns` group of `sharedDomainPurity` in `eslint.config.mjs`.
3. `pnpm --filter @finanzas/shared-domain test`
4. `git checkout -- eslint.config.mjs`
5. `pnpm --filter @finanzas/shared-domain test`
6. `pnpm lint && pnpm typecheck`

**Expected result**: steps 1 and 5 pass; step 3 **fails** on the "rule fires" case — proving the
test is coupled to the real rule and not to a hard-coded expectation. Step 6 passes: the new test
file is itself linted and type-checked. Confirm the test also covers the negative control (a clean
import reports no error) and the scoping case (the message does not leak into
`@finanzas/shared-utils`).

### Step 7: The documented native setup sequence works, start to finish

**Maps to**: AC6

Run the sequence exactly as written in `docs/project/2-repo-architecture.md` → "Environment Setup",
from a clean state, without improvising. If a step fails, that is a finding: the documentation is
wrong and must be corrected before this step passes.

1. `rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/mobile/ios`
2. Follow the documented sequence verbatim (install → layout check → prebuild → pods → run).
3. Record each command's outcome and the versions in use: `node -v`, `pnpm -v`,
   `xcodebuild -version`, `pod --version`, `sw_vers -productVersion`.

**Expected result**: the documented sequence reaches a native build with no undocumented step. Any
correction needed becomes an edit to `2-repo-architecture.md` before this runbook is signed off.

### Step 8: The app boots in the iOS Simulator

**Maps to**: AC6, AC7 — **HUMAN VERIFICATION REQUIRED**

1. Complete Step 7, ending with the app launching in the simulator.
2. Confirm the simulator shows the running app (a placeholder screen is the expected content at
   this point in the project).
3. Record evidence: a screenshot, or `xcrun simctl list devices | grep Booted` plus the build log
   tail.

**Expected result**: the app runs on the simulator, and the evidence is attached to the
implementation PR and referenced from
`docs/testing/mobile/1-bootstrap-monorepo-expo-app.smoke-test.md`.

> **If this step cannot be executed** (no Xcode, no simulator, sandboxed environment): mark it
> **NOT RUN**, leave item #1's AC4 open, and write in the PR and on issue #35 exactly which
> commands were executed, which were not, and what therefore remains unverified. Do **not** mark it
> PASS by inspection — that is the failure this whole item exists to correct.

### Step 9: No stale reference to the old configuration survives

**Maps to**: AC1, AC6

1. `grep -rn "node-linker\|npmrc" --include="*.md" --include="*.mjs" --include="*.js" --include="*.yaml" --include="*.yml" . | grep -v node_modules`
2. Read the results.

**Expected result**: the only surviving hits are inside item #1's merged implementation plan
(`docs/specs/developments/20260801113404_1-bootstrap-monorepo-expo-app/`), which is a historical
record and is intentionally not rewritten. No live config file, script, source comment or current
project document still points at `.npmrc` for the linker setting. In particular
`apps/mobile/metro.config.js` now cites `pnpm-workspace.yaml`.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below, including the ones marked NOT RUN with a reason.
- `pnpm install` one last time so the working tree is left in a hoisted, healthy state.
- Stop any Metro bundler and shut down the simulator.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion of issue #35.

- [ ] **AC1** — A plain `pnpm install` (no flags) produces a hoisted layout with
      `@expo/metro-runtime` at the workspace root (Steps 1, 3).
- [ ] **AC2** — The layout check fails on a tree deliberately installed isolated and passes on a
      hoisted one, with both outputs recorded (Steps 2, 3).
- [ ] **AC3** — `expo export:embed --eager --platform ios --dev false` succeeds in CI (Steps 4, 5).
- [ ] **AC4** — The bundle job was *seen to fail* on a deliberately isolated tree, locally and in
      CI, before the green run was trusted (Steps 4, 5).
- [ ] **AC5** — A test proves `no-restricted-imports` rejects a deliberate violation from
      `@finanzas/shared-domain`, and the test itself fails when the rule is neutered (Step 6).
- [ ] **AC6** — `docs/project/2-repo-architecture.md` carries a setup sequence that was executed
      end to end to a running simulator build (Steps 7, 8, 9).
- [ ] **AC7** — Item #1's simulator criterion has real evidence, or an explicit written
      reclassification stating what remains unverified (Step 8).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| — | None. This item introduces no database and no product data. | — |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Unable to resolve "@expo/metro-runtime" from expo-router/entry-classic.js` | The tree is isolated, not hoisted | `pnpm check:layout` to confirm, then `pnpm install` (plain). If the check's first assertion fails, `nodeLinker: hoisted` is missing from `pnpm-workspace.yaml` |
| `pnpm install` fails at the end with a layout error | Working as designed — `postinstall` refused a broken tree | Read the FAIL lines; they name the file to fix. Use `--ignore-scripts` only when deliberately testing the isolated case |
| `pnpm config get nodeLinker` prints `undefined` | The setting is in `.npmrc`, which pnpm 11 ignores, or it is missing entirely | Declare `nodeLinker: hoisted` in `pnpm-workspace.yaml` |
| `pnpm --version` prints something other than `11.12.0` inside the repo | The `packageManager` pin was bypassed (`--ignore-scripts` on a corepack-managed setup, or an alias) | Re-run from the repository root; the pin is in the root `package.json` |
| `expo prebuild` refuses because `ios/` already exists | Expected on a second run | `pnpm exec expo prebuild --platform ios --clean` |
| Native build fails with missing pods after dependencies changed | CocoaPods out of sync with the new module tree | `cd apps/mobile/ios && pod install --repo-update` |
| The `iOS bundle` CI job fails only on one PR while `develop` is green | That PR changed dependencies or the linker setting | Reproduce locally with Step 4; the resolver error names the module |
| `pnpm exec expo` cannot find the binary from `apps/mobile` | Bin links not created for that workspace | Run `pnpm --filter @finanzas/mobile exec expo …` from the root instead, and note the deviation |

---

## Known Limitations

- Steps 7 and 8 need an interactive macOS session with Xcode and are human-verification-required.
  Every other step runs unattended on any platform.
- Step 5 depends on artefacts produced during implementation (a deliberately failing CI run that
  was then reverted). If those run URLs are missing from the PR description, the step cannot be
  completed after the fact without repeating the scratch-commit cycle.
- Steps 2, 3 and 4 deliberately install a broken dependency tree. Always finish the runbook with a
  plain `pnpm install`.
- This runbook cannot detect a *future* regression on its own; that is the job of `pnpm check:layout`,
  the `iOS bundle` CI job and the domain-purity test it verifies.
- No design-fidelity step exists: issue #35 ships no UI and has no design assets, so no visual
  baseline is invented here.
