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

> **Finding recorded during #35's implementation (2026-08-02)**: on a real, larger monorepo tree
> (not the small scratch dir the plan's V-log used), step 2's `pnpm check:layout` does **not**
> reproduce a FAIL as written. pnpm performs an implicit dependency-sync check before any
> `pnpm run`/`pnpm exec` invocation and silently relinks `node_modules` back to match the
> *declared* `nodeLinker` in `pnpm-workspace.yaml` (still `hoisted`) before the script runs — even
> with `--force` added to the isolated install. This does **not** affect the `postinstall`
> enforcement mechanism itself (Step 3 below is unaffected and reproduces genuinely), only this
> step's use of the *named* `pnpm check:layout` command to observe a FAIL. To get a genuine FAIL
> for this step, invoke the script directly, bypassing `pnpm run`:
>
> ```bash
> node scripts/check-node-linker-layout.mjs; echo "exit=$?"
> ```
>
> This runs the same code the `pnpm check:layout`/`postinstall` wiring calls, without pnpm's
> pre-run sync in the way. Step 4 (both invocations, once the tree is genuinely hoisted again)
> works via either form.

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

> **Same finding as Step 2 applies here**: `pnpm exec expo export:embed …` is also a `pnpm`-mediated
> invocation, so a CLI-flag-only isolated install (`--node-linker=isolated`) is silently healed back
> to hoisted before the bundle command runs and step 2 will incorrectly *succeed*. To reproduce a
> genuine FAIL, declare the isolated linker in `pnpm-workspace.yaml` itself instead of via a CLI
> flag (this is also exactly what CI's Step 5 scratch commit does, so it is a higher-fidelity local
> rehearsal of that CI run):
>
> ```bash
> sed -i '' 's/^nodeLinker: hoisted$/nodeLinker: isolated/' pnpm-workspace.yaml
> rm -rf node_modules apps/*/node_modules packages/*/node_modules
> pnpm install --ignore-scripts
> cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false; echo "exit=$?"
> cd ../..
> sed -i '' 's/^nodeLinker: isolated$/nodeLinker: hoisted/' pnpm-workspace.yaml
> rm -rf node_modules apps/*/node_modules packages/*/node_modules
> pnpm install
> cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false; echo "exit=$?"
> cd ../..
> ```

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

> **Status (2026-08-02)**: **RAN, PASS**, executed on implementation PR #39 after it opened.
> Scratch commit set `pnpm-workspace.yaml: nodeLinker: isolated`, pushed, and the `iOS bundle`
> job failed: [FAILURE run](https://github.com/lhpaul/personal-finances/actions/runs/30732643254/job/91455606495)
> — failure occurred at the `Install dependencies` step, where the root `postinstall` layout
> check refused the install itself (`FAIL: pnpm config get nodeLinker printed "isolated"`,
> `[ELIFECYCLE] Command failed with exit code 1`), before the bundle step ever ran — an even
> stronger proof than a resolver error mid-bundle. `Lint`/`Type check`/`Test` correctly failed the
> same way on that commit, since `postinstall` runs on every `pnpm install --frozen-lockfile`.
> The scratch commit was reverted (`git revert --no-edit HEAD`) and pushed; the `iOS bundle` job
> then passed: [SUCCESS run](https://github.com/lhpaul/personal-finances/actions/runs/30732674784/job/91455674728).
> Both URLs are also recorded in PR #39's description under the `Evidence` heading (E4).
> tick this step's boxes in the Assertions Checklist once done.

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

**Result — RAN, 2026-08-02**: PASS with two documented corrections (both now in
`2-repo-architecture.md` → Environment Setup). Versions: Node `v26.5.0`, pnpm `11.12.0`, Xcode
`26.6` (build `17F113`), CocoaPods `1.16.2`, macOS `26.5.2`. `expo prebuild --platform ios --clean`
succeeded; the CocoaPods step inside it failed once with a Ruby/locale
`Encoding::CompatibilityError` and was fixed by exporting `LANG=en_US.UTF-8` /
`LC_ALL=en_US.UTF-8` before `pod install`; `expo run:ios` then failed once with a stale Xcode
DerivedData `build.db` lock left by an earlier interrupted attempt (killing the orphaned
`SWBBuildService` process and retrying resolved it) before succeeding.

### Step 8: The app boots in the iOS Simulator

**Maps to**: AC6, AC7

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

**Result — RAN, 2026-08-02**: PASS. Xcode, CocoaPods and the iOS Simulator were all available in
the implementation environment (contrary to the "possibly no Xcode" contingency this runbook and
the plan both anticipated), so this was executed directly, not left open. `xcrun simctl list
devices | grep Booted` showed `iPhone 17 (…) (Booted)`; a `launchctl list` spawn on that simulator
showed the `UIKitApplication:cl.finanzas.mobile` process running; a screenshot was captured showing
the app on the `onboarding-intro` placeholder (mockup screen `onboarding-intro`, route
`/(onboarding)/intro`), matching item #1's smoke-test Step 4 expected result exactly. Evidence
(transcript, screenshot) is in the implementation PR for #35, and item #1's runbook AC4/AC7 rows
are updated accordingly.

### Step 9: No stale reference to the old configuration survives

**Maps to**: AC1, AC6

1. `grep -rn "node-linker\|npmrc" --include="*.md" --include="*.mjs" --include="*.js" --include="*.yaml" --include="*.yml" . | grep -v node_modules`
2. Read the results.

**Expected result**: the only surviving hits are inside item #1's merged implementation plan
(`docs/specs/developments/20260801113404_1-bootstrap-monorepo-expo-app/`), which is a historical
record and is intentionally not rewritten. No live config file, script, source comment or current
project document still points at `.npmrc` for the linker setting. In particular
`apps/mobile/metro.config.js` now cites `pnpm-workspace.yaml`.

**Result — RAN, 2026-08-02**: PASS. Surviving hits: item #1's and #35's own merged/in-progress
implementation plans (both historical, intentionally not rewritten), this runbook and the
implementation-plan for #35 itself (intentional — they describe the fix), the new
`scripts/check-node-linker-layout.mjs` and `pnpm-workspace.yaml` (intentional — the fix itself),
`AGENTS.md`/`2-repo-architecture.md` (intentional — explain the correct current behaviour), and
`CHANGELOG.md` (intentional — the entry names `.npmrc` as what was removed). No live config,
script, comment or current doc still points at `.npmrc` as the linker declaration surface.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below, including the ones marked NOT RUN with a reason.
- `pnpm install` one last time so the working tree is left in a hoisted, healthy state.
- Stop any Metro bundler and shut down the simulator.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion of issue #35. Status recorded 2026-08-02, during
implementation, ahead of the implementation PR being opened.

- [x] **AC1** — A plain `pnpm install` (no flags) produces a hoisted layout with
      `@expo/metro-runtime` at the workspace root (Steps 1, 3). PASS — verified directly (real
      directories, not symlinks; `pnpm config get nodeLinker` → `hoisted`).
- [x] **AC2** — The layout check fails on a tree deliberately installed isolated and passes on a
      hoisted one, with both outputs recorded (Steps 2, 3). PASS, with the Step 2 methodology
      correction noted above (`node scripts/check-node-linker-layout.mjs` invoked directly, not
      `pnpm check:layout`, for the negative case — pnpm's implicit pre-run sync otherwise heals
      the tree before the check runs). Step 3's `postinstall` enforcement reproduces genuinely
      through either invocation form (it is not affected by the same masking).
- [x] **AC3** — `expo export:embed --eager --platform ios --dev false` succeeds in CI (Steps 4, 5).
      Step 4 (local) PASS: 992 modules, 3.8 MB, 22 assets on the hoisted tree. Step 5 (CI) PASS,
      executed on implementation PR #39 — see the run URLs recorded under Step 5 below.
- [x] **AC4** — The bundle job was *seen to fail* on a deliberately isolated tree, locally and in
      CI, before the green run was trusted (Steps 4, 5). Step 4 (local) PASS, using the
      `pnpm-workspace.yaml`-edit methodology noted above (a CLI-flag-only isolated install is
      silently healed by pnpm before `pnpm exec` runs, so it does not reproduce a failure — see
      the Step 4 note). Step 5 (CI) PASS: the scratch commit's failing run and the reverted
      commit's passing run are both recorded under Step 5 below and in PR #39's description.
- [x] **AC5** — A test proves `no-restricted-imports` rejects a deliberate violation from
      `@finanzas/shared-domain`, and the test itself fails when the rule is neutered (Step 6).
      PASS — emptying `sharedDomainPurity`'s `patterns` group triggers ESLint's own schema
      validation (`minItems: 1`), which fails the two purity-rule test cases with a fatal config
      error (a stronger failure than "silently stops firing"). Reverted and re-verified passing.
- [x] **AC6** — `docs/project/2-repo-architecture.md` carries a setup sequence that was executed
      end to end to a running simulator build (Steps 7, 8, 9). PASS — see the Step 7/8 results
      above.
- [x] **AC7** — Item #1's simulator criterion has real evidence, or an explicit written
      reclassification stating what remains unverified (Step 8). PASS with real evidence (not a
      reclassification): Xcode/CocoaPods/Simulator were available in the implementation
      environment. Item #1's runbook AC4 and AC7 rows are updated with this evidence.

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
