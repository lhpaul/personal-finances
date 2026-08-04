# Smoke Test Runbook: EAS build profiles and release CI

**Feature**: Real EAS build profiles (`development`, `preview`, `production`) with per-variant app
identities, a `develop` → internal / `main` → store delivery workflow, and a documented signing and
release runbook.
**Work item**: [lhpaul/personal-finances#23](https://github.com/lhpaul/personal-finances/issues/23) — `Type: Refactor` (no spec; the issue body plus the scope carried over from the closed duplicate #48 is the specification)
**Implementation plan**: [`2_23-eas-build-release-ci_implementation-plan.md`](../../specs/developments/20260802155158_23-eas-build-release-ci/2_23-eas-build-release-ci_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

> **How this runbook is split.** Steps 1–7 need **no account of any kind** and must all pass
> before the implementation PR is marked ready. Steps 8–12 are **HUMAN steps** that need the
> owner's Expo and Apple accounts; they are the only path to the acceptance criterion "a
> production build installs and launches on a real device", and the item stays open until they
> pass. Do not record steps 8–12 as PASS by inference — they pass when someone has held the phone.
>
> **Prove the control, do not admire it.** Several steps deliberately break something before
> fixing it. A control that has only ever been seen to pass has not been verified. This is the
> same discipline item #35 established for the layout and bundle checks.

---

## Prerequisites

- [ ] macOS with **Xcode** and at least one iOS Simulator — required for step 3 only. Steps 1, 2
      and 4–7 run on any platform.
- [ ] **CocoaPods** installed (`pod --version`) — step 3.
- [ ] Node 22 (`.nvmrc`); `pnpm --version` prints `11.12.0` inside the repository.
- [ ] A network connection — steps 1 and 3 install dependencies, step 7 talks to GitHub.
- [ ] The implementation branch checked out and its pull request open (step 7 reads a workflow run).
- [ ] No uncommitted work you care about: steps 4 and 5 deliberately break files and revert them,
      and step 3 runs a clean prebuild.
- [ ] **For steps 8–12 only**: an Expo account, an Apple Developer Program membership, and a
      physical iPhone signed into the Apple ID that will receive the TestFlight invitation.

> **Time**: steps 1–2 and 4–7 take about 20 minutes. Step 3 (clean prebuild + CocoaPods + native
> build) takes 15–30 minutes on a cold machine. Steps 8–12 are dominated by Apple enrolment and
> App Store Connect processing, which are waits, not work.

---

## Test Data

| Item | Value |
| --- | --- |
| Build config unit test | `apps/mobile/__tests__/build-config.test.ts` |
| Test command | `pnpm --filter @finanzas/mobile test` |
| Build profiles file | `apps/mobile/eas.json` |
| App identity file | `apps/mobile/app.config.js` |
| Variant switch | `APP_VARIANT` — `development` (default) / `preview` / `production` |
| Development identity | `Finanzas [DEV]` · `cl.finanzas.mobile.dev` |
| Preview identity | `Finanzas [BETA]` · `cl.finanzas.mobile.preview` |
| Production identity | `Finanzas` · `cl.finanzas.mobile` |
| URL scheme (all variants) | `finanzas://` |
| Delivery workflow | `.github/workflows/eas-build.yml` (display name `EAS build`) |
| Framework placeholder that must stay untouched | `.github/workflows/deploy.yml` |
| Repository secret | `EXPO_TOKEN` (the only one) |
| Repository variables | `EAS_PREVIEW_ON_PUSH`, `EAS_AUTO_SUBMIT` |
| Release and signing runbook | `docs/project/5-release-and-signing-runbook.md` |
| Bundle check (must stay green) | `cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false` |

---

## Smoke Test Steps

### Step 1: The build-config unit tests pass

**Maps to**: S1 (EAS build configuration)

1. From the repository root: `pnpm install`
2. `pnpm --filter @finanzas/mobile test`
3. `pnpm typecheck`

**Expected result**: the suite passes, including every case in `build-config.test.ts` — the three
variant identities, the unset-variant default, the throw on an unknown variant, the single
`finanzas` scheme, the version taken from `apps/mobile/package.json`, and the `eas.json` ↔
`app.config.js` agreement assertions. `typecheck` reports no error.

---

### Step 2: The variant switch actually switches

**Maps to**: S1, plan Decisions D2 and D3

Run each of the following from the repository root and read the printed identity:

1. `APP_VARIANT=development node -e "const c=require('./apps/mobile/app.config.js').expo; console.log(c.name, c.ios.bundleIdentifier, c.android.package, c.scheme, c.version)"`
2. The same command with `APP_VARIANT=preview`
3. The same command with `APP_VARIANT=production`
4. The same command with the variable unset
5. The same command with `APP_VARIANT=staging`

**Expected result**:

- development → `Finanzas [DEV] cl.finanzas.mobile.dev cl.finanzas.mobile.dev finanzas <version>`
- preview → `Finanzas [BETA] cl.finanzas.mobile.preview cl.finanzas.mobile.preview finanzas <version>`
- production → `Finanzas cl.finanzas.mobile cl.finanzas.mobile finanzas <version>`
- unset → identical to development
- `staging` → the command **throws**, and the error names `APP_VARIANT` and lists the accepted
  values. A silent fallback here is a FAIL, not a convenience.

`<version>` is the same string in all four successful cases and equals the `version` field of
`apps/mobile/package.json`.

---

### Step 3: The dev client still builds and boots on the Simulator

**Maps to**: the dispatch constraint ("the app must remain buildable as a dev client for the
simulator"), plan Decision D5

This is the step that protects the design-fidelity kit (#47) and every existing mobile runbook.
Run it in full; do not substitute a Metro reload.

1. Delete any previously installed `Finanzas` app from the Simulator (long-press → remove). It
   carries the pre-item bundle identifier and will otherwise sit next to the new one and confuse
   the next steps.
2. `cd apps/mobile && pnpm exec expo prebuild --platform ios --clean`
3. `cd apps/mobile/ios && pod install` (skip if the prebuild already ran it)
4. `cd apps/mobile && pnpm exec expo run:ios`
5. When the app is running, note the home-screen label under the icon.
6. From another terminal: `xcrun simctl get_app_container booted cl.finanzas.mobile.dev data`
7. Open a deep link the existing runbooks rely on: `xcrun simctl openurl booted finanzas://gallery`

**Expected result**: the build succeeds; the Simulator shows an app labelled **`Finanzas [DEV]`**;
`get_app_container` returns a path for `cl.finanzas.mobile.dev` (and would fail for
`cl.finanzas.mobile`, which is now the production identity); the deep link opens the design-system
gallery. The app's database is empty — that is expected and intended: the new identifier means a
new sandbox.

---

### Step 4: The bundle check and layout check are unaffected

**Maps to**: the dispatch constraint ("the existing iOS bundle CI job stays"), plan Decision D5

1. From the repository root: `pnpm check:layout`
2. `cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false`
3. Open `.github/workflows/ci.yml` and confirm the `bundle` job is byte-for-byte what it was
   before this branch (`git diff origin/develop -- .github/workflows/ci.yml` prints nothing).

**Expected result**: both commands succeed; the CI workflow diff is empty. Adding
`expo-dev-client` did not change what Metro can produce.

---

### Step 5: The unit tests fail when the build configuration drifts

**Maps to**: S1 — this is the prove-the-control step

Perform each break, run `pnpm --filter @finanzas/mobile test`, record the failure, then revert.

1. **Identity drift**: in `app.config.js`, change the production bundle identifier to
   `cl.finanzas.app`. Expected: the production identity assertion fails and names both the
   expected and the received identifier. Revert.
2. **Profile drift**: in `eas.json`, change the `preview` profile's `env.APP_VARIANT` to
   `previews`. Expected: the `eas.json` ↔ `app.config.js` agreement assertion fails. Revert.
3. **Version drift**: in `app.config.js`, replace the `require('./package.json').version`
   expression with a hard-coded `'9.9.9'`. Expected: the version assertion fails. Revert.
4. After the third revert, run the suite once more.

**Expected result**: three distinct, readable failures, then a clean pass. Paste all three failure
outputs into the implementation PR. If any break passes, the corresponding assertion is not
actually testing what the plan says it tests — that is a FAIL for this step.

---

### Step 6: Nothing signable can be committed

**Maps to**: AC2 ("secrets are referenced by name only; none are committed"), plan Decision D12

1. `printf '{}' > apps/mobile/credentials.json`
2. `printf 'not a real key' > apps/mobile/AuthKey_TEST.p8`
3. `printf 'not a real keystore' > apps/mobile/release.keystore`
4. `git status --short`
5. Delete all three files.
6. `git grep -nEi "BEGIN (RSA )?PRIVATE KEY|ascApiKey|serviceAccountKeyPath|-----BEGIN"` across the
   working tree.
7. Read `apps/mobile/eas.json` and `.github/workflows/eas-build.yml` end to end.

**Expected result**: `git status` lists none of the three files; the `git grep` returns no hit in
committed project files; `eas.json` contains no key, password or path to key material; the
workflow references `secrets.EXPO_TOKEN` **by name only** and never echoes it. Any credential
value found in the repository is an immediate FAIL and blocks the PR.

---

### Step 7: The delivery workflow skips cleanly with no `EXPO_TOKEN`

**Maps to**: AC1 (the mapping exists), plan Decision D7 — the trigger-matrix rows marked
*verifiable now*

Run this **before** the owner adds the secret. If the secret already exists, skip to step 8 and
record this step as N/A with that reason.

`workflow_dispatch` may only be dispatchable once the workflow file exists on the repository's
default branch (plan claim **T5**, unverified). The push probe below therefore comes first; manual
dispatch is the fallback. Record which technique actually worked.

1. Confirm the secret is absent: `gh secret list` shows no `EXPO_TOKEN`.
2. **Push probe (primary).** On the implementation branch, temporarily add that branch to the
   workflow's `push.branches` list, commit, and push. This is the same push-to-CI-and-revert
   technique item #35 used to prove its controls.
3. `gh run list --workflow "EAS build" --limit 1` then `gh run view <run-id>`
4. Revert the temporary trigger change in a follow-up commit and confirm the workflow no longer
   runs on a push to the implementation branch.
5. **Manual dispatch (fallback).** If the workflow file is already on the default branch, the
   probe can be replaced by
   `gh workflow run "EAS build" --ref <implementation-branch> -f profile=preview -f platform=ios`
   followed by the same `gh run view` inspection.
6. Confirm `.github/workflows/deploy.yml` is untouched:
   `git diff origin/develop -- .github/workflows/deploy.yml` prints nothing.
7. Confirm the framework placeholder test still passes:
   `bash scripts/development-workflow/tests/test-placeholder-workflows-opt-in.sh`

**Expected result**: the run is **green**; `preflight` succeeded and annotated the run with a
notice naming `docs/project/5-release-and-signing-runbook.md`; the `preview` and `production` jobs
are **skipped**, not failed. The temporary trigger is reverted and the final branch state contains
only the intended `develop` / `main` triggers. The placeholder workflow diff is empty and its test
passes. A red run here means an unconfigured repository would block every merge — that is a FAIL.

---

### Step 8 (HUMAN): Expo account, EAS project, repository secret

**Maps to**: S4 preconditions H1–H3

**Already satisfied as of the implementation PR** (#23): the owner had an active EAS session and
had already set the `EXPO_TOKEN` repository secret before implementation began; the
implementation PR itself ran `eas init` non-interactively and committed the resulting
`extra.eas.projectId`. `app.config.js` is a **dynamic** config (`.js`, not `.json`), so `eas init`
could not write the field automatically — it required a manual commit (see
[`5-release-and-signing-runbook.md`](../../project/5-release-and-signing-runbook.md#human-steps-h1h8)).
The steps below remain the reference procedure for a from-scratch setup on a different project.

1. `cd apps/mobile && pnpm dlx eas-cli@21.5.0 login`
2. `pnpm dlx eas-cli@21.5.0 init` — accept the project creation. Commit the
   `extra.eas.projectId` it writes into `app.config.js` (or, for a dynamic config, add it
   manually from the command's printed output).
3. Create a personal access token at expo.dev → Account settings → Access tokens.
4. `gh secret set EXPO_TOKEN` and paste the token.
5. `gh secret list` to confirm it exists.

**Expected result**: `app.config.js` carries a committed, non-secret `projectId`; `EXPO_TOKEN`
exists as a repository secret; nothing else was added to the repository.

---

### Step 9 (HUMAN): The first preview build

**Maps to**: AC1 (`develop` produces an internal build), plan Decision D8

1. `pnpm mobile:build:preview` — or dispatch `EAS build` with `profile: preview`.
2. Follow the EAS dashboard link the command prints.
3. When the build finishes, install it on the iPhone from the internal-distribution link
   (register the device first with `pnpm dlx eas-cli@21.5.0 device:create` if EAS asks).
4. Launch it.
5. Merge something app-relevant into `develop` and confirm the workflow enqueues a preview build
   automatically.

**Expected result**: the build succeeds on EAS servers (the pnpm workspace installs there without
manual intervention); the installed app is labelled **`Finanzas [BETA]`** with bundle identifier
`cl.finanzas.mobile.preview`; it launches; it sits alongside `Finanzas [DEV]` without either
replacing the other. The automatic run on `develop` appears in the Actions tab.

---

### Step 10 (HUMAN): The first production build

**Maps to**: AC1 (`main` produces a store build), plan Decision D9

1. Ensure the Apple Developer Program membership is active.
2. `pnpm mobile:build:production-store`, answering the credential prompts once and letting **EAS
   generate and store** the distribution certificate and provisioning profile.
3. Confirm in the EAS dashboard that the credentials are stored server-side.
4. Confirm nothing new appeared in the working tree: `git status --short` is clean.

**Expected result**: a store-signed build exists on EAS; the signing material lives in EAS, not in
this repository and not in a downloaded file; `git status` is clean. Any `.p8`, `.p12` or
`.mobileprovision` file appearing in the working tree is a FAIL — delete it and re-read
`docs/project/5-release-and-signing-runbook.md`.

---

### Step 11 (HUMAN): TestFlight submission, installed and launched on a real device

**Maps to**: AC3 and S4 — **this is the acceptance bar for the item**

1. Create the App Store Connect app record for `cl.finanzas.mobile`.
2. `pnpm mobile:submit:ios` — the first submission is deliberately interactive so any missing
   identifier surfaces with a human present. Upload the App Store Connect API key to EAS when
   prompted.
3. Wait for App Store Connect to finish processing.
4. Install the build from TestFlight on the physical iPhone and open it.
5. `gh variable set EAS_AUTO_SUBMIT --body true`
6. Configure the GitHub `production` Environment with a required reviewer.

**Expected result**: the build reaches TestFlight, installs on the phone, launches, and shows the
app named **`Finanzas`**. Record the version, the EAS build id and the date in the PR or the issue
— that record is the S4 evidence. Until this step passes, item #23 is not done, no matter how
green CI is.

---

### Step 12 (HUMAN): The release path end to end

**Maps to**: S2 (`/prepare-release` integration)

1. Run `/prepare-release` for the next version.
2. Confirm it bumps **both** manifests named in `docs/project/5-release-and-signing-runbook.md`
   (the root `package.json` and `apps/mobile/package.json`).
3. Merge the `main` PR.
4. Confirm `auto-tag-release.yml` creates the tag **and** that `EAS build` runs on the push to
   `main` (they are independent triggers — the tag does not cause the build).
5. Confirm the production job waited for the environment approval.
6. Approve it and confirm the build is enqueued with `--auto-submit`.
7. Confirm the version reported by the resulting build matches the released version.

**Expected result**: one release produces one tag and one store build with a matching version, and
the store submission happened only after a human approved the environment.

---

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below
- Delete any scratch files created in steps 5 and 6
- Confirm `git status --short` is clean apart from the intended implementation changes
- Stop Metro and shut down the Simulator

---

## Assertions Checklist

Each checkbox maps to a criterion from the work item brief.

- [ ] `eas.json` defines `development`, `development-device`, `preview` and `production`, each
      exporting its own `APP_VARIANT` (S1 — steps 1, 2)
- [ ] Each variant produces its own app name and bundle identifier, and an unknown variant throws
      (S1 — step 2)
- [ ] The app version comes from `apps/mobile/package.json`, not from a hard-coded literal
      (S2 — steps 1, 2, 12)
- [ ] A dev client still builds and boots on the iOS Simulator, and `finanzas://` deep links still
      work (dispatch constraint — step 3)
- [ ] `pnpm check:layout` and the CI `bundle` job are unchanged and green (dispatch constraint —
      step 4)
- [ ] Every build-config assertion has been seen to fail on a deliberate break (S1 — step 5)
- [ ] No credential, key or token is committed; `.gitignore` blocks the signing patterns and was
      proved to; `EXPO_TOKEN` is referenced by name only (AC2 — step 6)
- [ ] With no `EXPO_TOKEN`, the delivery workflow runs green and skips its build jobs; the
      framework placeholder `deploy.yml` and its test are untouched (AC1, D6, D7 — step 7)
- [ ] `develop` produces an internal build (AC1 — step 9)
- [ ] `main` produces a store build, gated by environment approval (AC1 — steps 10, 12)
- [ ] Signing material lives in EAS, never in the repository (S3 — step 10)
- [ ] **A production build installs and launches on a real device** (AC3, S4 — step 11)
- [ ] `/prepare-release` bumps both version manifests and the released version reaches the store
      build (S2 — step 12)

---

## Seed Data Reference

None. This item ships no data path. The one data-adjacent effect is intended: the development
variant's new bundle identifier gives the dev build a fresh, empty database on first launch
(step 3).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| The Simulator app is labelled `Finanzas`, not `Finanzas [DEV]` | A build from before this item is still installed | Delete it from the Simulator and repeat step 3 from the clean prebuild |
| `xcrun simctl get_app_container booted cl.finanzas.mobile` fails | Correct behaviour — that is now the production identifier | Use `cl.finanzas.mobile.dev` for a dev build |
| `finanzas://…` opens the wrong app | Two variants are installed and iOS resolved the shared scheme arbitrarily (plan Decision D4) | Uninstall the variant you are not testing |
| The app cannot resolve a native module after this branch | The dev client predates the `expo-dev-client` install | Rebuild: `expo prebuild --clean` then `expo run:ios` |
| `expo run:ios` fails inside CocoaPods after the clean prebuild | Pod cache out of sync with the regenerated `ios/` | Follow the Environment Setup sequence in `docs/project/2-repo-architecture.md`, which was verified end to end under #35 |
| The `EAS build` workflow does not appear in `gh workflow list`, or `gh workflow run` reports it does not exist | The workflow file is not yet on the default branch (plan claim T5) | Use the push probe in step 7 instead of manual dispatch, and record that T5 held |
| The workflow ran but both build jobs are skipped | `EXPO_TOKEN` is absent, or `EAS_PREVIEW_ON_PUSH` is `false` | Expected before step 8. Afterwards, check `gh secret list` and `gh variable list` |
| A merge to `develop` did not trigger a build | The push touched only paths outside the workflow's filter (docs, workflow-framework files) | Expected. Dispatch manually if a build is wanted |
| `eas build` fails on EAS servers while installing dependencies | The workspace layout did not reproduce remotely | Confirm `pnpm-workspace.yaml` still declares `nodeLinker: hoisted` (#35) and that `pnpm-lock.yaml` is committed and current |
| `eas submit --non-interactive` refuses for want of an app id | The App Store Connect app record does not exist, or the identifier is not discoverable | Do step 11 interactively first. Add only non-secret identifiers to `eas.json`; never key material |
| The store build carries the wrong version | The release bumped only one manifest | Re-read the manifest list in `docs/project/5-release-and-signing-runbook.md` and re-run the check in step 12 |

---

## Known Limitations

- Steps 8–12 cannot be automated from this repository. They require the owner's Expo and Apple
  accounts, and step 11 requires physically holding the device. The item's acceptance bar
  therefore waits on a human by design, not by omission.
- Android is configured in `eas.json` but is not part of the acceptance path: automated Play
  submission needs a Google Play developer account and a service-account key that this item does
  not introduce (plan Decision D13).
- `--no-wait` means an EAS build failure is visible in the EAS dashboard rather than as a red
  GitHub check (plan Decision D8). Step 9 and step 12 both require reading the dashboard, not just
  the Actions tab.
- This runbook contains no design-fidelity step: no design assets exist for this item, and the
  item changes no UI surface. No visual baseline is invented.
