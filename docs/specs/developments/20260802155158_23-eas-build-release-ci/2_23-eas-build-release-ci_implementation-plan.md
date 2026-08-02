# EAS build profiles and release CI — Implementation Plan

**Work item**: [lhpaul/personal-finances#23](https://github.com/lhpaul/personal-finances/issues/23) — `Type: Refactor`
**Spec**: None. This is a **Refactor-route** item — the specification is the work item brief
(issue #23 body, consolidated with the scope notes carried over when duplicate
[#48](https://github.com/lhpaul/personal-finances/issues/48) was closed into it). Both are
reproduced under [Work Item Brief](#work-item-brief).
**Smoke test runbook**: [`docs/testing/mobile/23-eas-build-release-ci.smoke-test.md`](../../../testing/mobile/23-eas-build-release-ci.smoke-test.md)
**Depends on**: #1 (merged — it declared `apps/mobile/eas.json` without ever running it), #35 (merged — the hoisted layout is what makes any native build possible).

---

## Work Item Brief

Recorded so this plan is self-contained and every change below cites a criterion.

### From issue #23

> **Scope**
>
> `eas.json` with `dev`, `preview` and `production` profiles; app name suffixes per profile;
> GitHub Actions for build and submit; branch-to-environment mapping per
> [`docs/project/3-software-architecture.md`](../../../project/3-software-architecture.md).
>
> **Acceptance criteria**
>
> - **AC1**: `develop` produces an internal build; `main` produces a store build
> - **AC2**: Secrets are referenced by name only; none are committed
> - **AC3**: A production build installs and launches on a real device
>
> **Depends on**: #1

### Carried over from the closed duplicate #48

> **Problem / outcome**: CI covers lint, types, tests, layout and bundle, but there is no CD: no
> reproducible pipeline that produces installable builds (TestFlight / Play internal) or store
> releases. Releases must be a pipeline, not a ritual.
>
> **Scope**
>
> - **S1**: EAS build configuration (profiles for dev-client, preview, production) for `@finanzas/mobile`.
> - **S2**: A release workflow that ties into the existing `/prepare-release` protocol:
>   version bump → build → store track submission.
> - **S3**: Documentation of the runbook, including signing/credentials handling
>   (credentials never in the repo).
> - **S4**: Verification per house rule: the pipeline has shipped at least one end-to-end build to
>   a real track before the item closes.
>
> **Timing**: Needed before the first release; not blocking screen development.

### Planning constraints recorded at dispatch

- No backend, no secret committed. Signing material lives in EAS-managed credentials or in a
  documented local keychain flow — never in the repository.
- The app must **remain buildable as a dev client for the iOS Simulator**. The design-fidelity
  kit (#47) and every existing mobile smoke runbook depend on that build.
- The existing CI `bundle` job (`expo export:embed`) stays exactly as it is.
- Every step that needs the owner's Expo or Apple account is a **HUMAN step**, marked as such,
  with everything scriptable prepared around it. S4 (one shipped end-to-end build) is expected to
  **wait** on those steps.

---

## Summary

**Approach**: Today `apps/mobile/eas.json` declares three build profiles that have never been
run, `app.config.js` declares one app identity for every environment, and
`.github/workflows/deploy.yml` is still the framework's echo-only placeholder. This item turns
that declaration into a pipeline in three separable pieces. First, **build configuration**:
`eas.json` gains a real `development` profile (dev client, iOS Simulator), a `preview` profile
(internal distribution) and a `production` profile (store distribution, auto-incrementing build
number), each exporting `APP_VARIANT`; `app.config.js` reads `APP_VARIANT` and maps it to a
distinct app name and bundle identifier, so a dev build can never share a sandbox — or a
credential store — with the real installed app. Second, **delivery**: a new
`.github/workflows/eas-build.yml` maps `develop` → `preview` and `main` → `production` exactly as
[`3-software-architecture.md`](../../../project/3-software-architecture.md) already promises. It
opens with a preflight job that reads `EXPO_TOKEN`; when the secret is absent the build jobs skip
cleanly and the run stays green, so the workflow can be merged and proved **before** the owner
has an Expo account. Third, **documentation**: a new
`docs/project/5-release-and-signing-runbook.md` records the credential model, the exact
`/prepare-release` touch points (which manifests carry a version, where the build fits, how the
store submission is authorised), and the numbered HUMAN steps H1–H8 that this repository cannot
perform on its own.

The item is deliberately split so that everything except S4 is verifiable today, on this machine,
with no account: unit tests over `app.config.js` and `eas.json`, an unchanged `expo export:embed`
CI job, a rebuilt local dev client on the Simulator, and a `workflow_dispatch` run that proves the
"not configured" path is a skip and not a red X. S4 — one build shipped end to end to TestFlight
and launched on the owner's iPhone — is parked on H1–H8 and is the only thing standing between
this item and closure.

**Estimated complexity**: M

**Rationale**: The code surface is small (one JSON file, one config file with a variant map, one
workflow, one test file, `.gitignore`, two root scripts) but it is spread across four
documentation surfaces, changes an identifier that several existing runbooks hard-code, and
carries an irreducible human-account tail. 1–3 days of machine work, plus a wait on H1–H8.

**Dependencies**: #1 and #35 are merged. No open item blocks this one. Merge-order note: PR #61
(design-fidelity gate) also edits root `package.json` scripts and `.github/workflows/ci.yml`;
those are textual neighbours, not semantic conflicts — see the
[Cross-Cutting Operational Assumption Check](#cross-cutting-operational-assumption-check).

---

## Verification Log

Repo revision for every row: `3ac49ee` (`Merge PR #71 (implementation-plan/20-settings-banks-bank-review)`),
which is `origin/develop` at plan time; branch `implementation-plan/23-eas-build-release-ci`,
worktree clean. Verified 2026-08-02.

| # | Check | Command / query | Result |
| --- | --- | --- | --- |
| V1 | Repo revision and branch point | `git show --no-patch --format='%H %s' HEAD` and the same for `origin/develop` | Identical SHA `3ac49ee…`; the plan branch is exactly `origin/develop`. Note: `git log --oneline` returned a stale cached listing on this machine (`df7d020`); `git show`/`git rev-parse` are the authority used here |
| V2 | Current EAS configuration | `cat apps/mobile/eas.json` | `cli.appVersionSource: "remote"`; three profiles — `development` (`developmentClient: true`, `distribution: internal`), `preview` (`distribution: internal`), `production` (`{}`). No `env`, no `ios`/`android` blocks, no `submit` section |
| V3 | Current app identity | `cat apps/mobile/app.config.js` | Single identity for every environment: `name: 'Finanzas'`, `version: '0.0.0'`, `ios.bundleIdentifier` and `android.package` both `cl.finanzas.mobile`, `scheme: 'finanzas'`. A leading comment states no environment variable is read here |
| V4 | Dev-client package present? | `grep -n "expo-dev-client" apps/mobile/package.json` | No match. `developmentClient: true` in `eas.json` currently has no package behind it |
| V5 | Existing CI surface | `cat .github/workflows/ci.yml` | Five jobs: `lint`, `typecheck`, `test`, `db-check`, `bundle`. The `bundle` job runs `pnpm check:layout` then `pnpm exec expo export:embed --eager --platform ios --dev false`. Nothing runs `eas` |
| V6 | Deploy workflow state | `cat .github/workflows/deploy.yml` | Framework placeholder: `workflow_dispatch` only, `confirm_placeholder` input, two echo-only jobs (`deploy-develop`, `deploy-production`) |
| V7 | Is the placeholder guarded? | `sed -n 1,60p scripts/development-workflow/tests/test-placeholder-workflows-opt-in.sh` | It asserts `deploy.yml` still exposes `confirm_placeholder`, still gates on `inputs.confirm_placeholder == true`, and contains **no** `push:` trigger. Repurposing `deploy.yml` would break this test — hence Decision D6 |
| V8 | Is that test wired into CI? | `grep -rn "test-placeholder-workflows-opt-in" .github/workflows/` | No match — it is not a required check, but it is a repository-owned test a reviewer or `/sync-template` can run. Decision D6 keeps it green regardless |
| V9 | Documented branch → environment mapping | `sed -n 161,182p docs/project/3-software-architecture.md` | Environments `dev` / `preview` / `production`; `develop` → preview (EAS internal), `main` → production (EAS store submit), both attributed to `.github/workflows/deploy.yml`; secret names listed as `EXPO_TOKEN`, `EAS_PROJECT_ID`, `APPLE_TEAM_ID` |
| V10 | Existing EAS entry points | `grep -n "eas-cli" package.json` | Two root scripts: `mobile:build:dev-store` and `mobile:build:production-store`, both `pnpm --dir apps/mobile dlx eas-cli build --profile …`. `eas-cli` is deliberately not a dependency (item #1, Decision recorded in its plan) |
| V11 | Bundle identifier hard-coded in existing runbooks (residual sweep source) | `grep -rn "cl\.finanzas\.mobile" --include="*.md" .` | Live occurrences in `docs/testing/mobile/9-connect-a-bank-picker-credentials-secure-storage.smoke-test.md`, `docs/testing/mobile/13-categorization-flow.smoke-test.md`, `docs/testing/mobile/16-transaction-detail-exclusion.smoke-test.md`, and `docs/testing/mobile/35-pnpm-hoisted-layout-ci-bundle-check.smoke-test.md`. See [Residual verification strategy](#residual-verification-strategy) for how each is dispositioned |
| V12 | Jest project layout | `cat apps/mobile/jest.config.js` | Two projects: `app` (`jest-expo`, ignores `src/db`) and `db` (node). A test at `apps/mobile/__tests__/**` is picked up by the `app` project, so `pnpm test` covers it with no new command |
| V13 | TypeScript include covers a root-level test dir | `cat apps/mobile/tsconfig.json` | `include: ["**/*.ts", "**/*.tsx", …]` — `apps/mobile/__tests__/*.ts` is type-checked with no config change |
| V14 | Markdown lint contract for this document | `cat .markdownlint-cli2.jsonc` | `default: false`; only `MD009` (trailing spaces, two-space hard break allowed) and `MD047` (single trailing newline) are enforced; `relative-links` is disabled |
| V15 | Shell-snippet lint scope | `sed -n 1,20p scripts/lint/workflow-shell-snippet-lint.py` | `ROOTS` covers `AGENTS.md`, `docs/workflow/`, `docs/best-practices/`, agent/skill/command trees and `scripts/development-workflow/`. `docs/specs/` is out of scope, so this plan's snippets are not scanned — they are still written to the `bash` contract (Decision D14) |
| V16 | Release protocol touch points | `sed -n 68,110p docs/workflow/development-workflow/protocols/05-prepare-release-protocol.md` | Step 4 says "Update the version field in any manifest files that track it … Ask the human which files apply if it's not obvious." Step 6 opens the `main` and backport PRs. Step 8 says the tag is created by `auto-tag-release.yml` on merge |
| V17 | How the release tag is produced | `sed -n 1,40p .github/workflows/auto-tag-release.yml` | Tag `vX.Y.Z` is created by a job using the workflow `GITHUB_TOKEN` after a `release/*` or `hotfix/*` PR merges into `main`. Decision D9 therefore triggers production builds on `push: main`, never on the tag |
| V18 | Version fields that exist today | `grep -n '"version"' package.json apps/mobile/package.json` | Both are `0.0.0`; `app.config.js` separately hard-codes `version: '0.0.0'` — three places, none linked |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Plan artifact base branch / repository mode | `develop`; `mode` absent in `.ai-dev-workflow.yaml` → `single_repo`, this repository owns the plan | `.ai-dev-workflow.yaml`, `AGENTS.md` → Git & Branching | 2026-08-02, SHA `3ac49ee` | This invocation (item #23) only | `Verified` |
| Branch → environment mapping (`develop` → preview, `main` → production) | As published in `3-software-architecture.md` → Deployment Mapping | `docs/project/3-software-architecture.md` lines 171–178 (V9) | 2026-08-02, SHA `3ac49ee` | Open PRs #72, #61, #46 — the only open PRs. Each touches `3-software-architecture.md`, but in the Testing Strategy / stack tables, not the Environment Strategy or Deployment Mapping section | `Verified` |
| Deployment workflow file ownership | `.github/workflows/deploy.yml` stays the framework placeholder; this item adds `.github/workflows/eas-build.yml` | `scripts/development-workflow/tests/test-placeholder-workflows-opt-in.sh` (V7), `docs/workflow/development-workflow/integrations/ci-cd-deployment.md` | 2026-08-02, SHA `3ac49ee` | Same-surface scan of the three open PRs: none modifies `deploy.yml` or the placeholder test | `Verified` |
| Concurrent edits to root `package.json` scripts and `.github/workflows/ci.yml` | PR #61 adds `fidelity:*` scripts and two steps to the CI `test` job | `gh api repos/lhpaul/personal-finances/pulls/61/files` | 2026-08-02, SHA `3ac49ee` | PRs #72, #61, #46 | `Verified` — textual adjacency only. This item appends different scripts and adds a **separate** workflow file; it changes no `ci.yml` job. If #61 merges first, re-read both files before editing |
| Only repository secret required | `EXPO_TOKEN` | This plan (Decision D12), reconciled against `3-software-architecture.md` line 178 | 2026-08-02, SHA `3ac49ee` | Same-surface scan: no open PR edits the secrets line | `Verified` — the architecture doc's `EAS_PROJECT_ID` / `APPLE_TEAM_ID` entries are corrected by this item, see [Documentation Updates](#documentation-updates) |

No conflict was found, so nothing is returned to the parent orchestrator for resolution.

---

## Decisions

Each decision is referenced by index elsewhere in this document. Indices are stable.

### D1 — Profile names are `development`, `preview`, `production`

Issue #23 says "`dev`, `preview` and `production`"; `eas.json` and the two root `package.json`
scripts already say `development`. `development` is also the name `eas build` prints and the name
Expo's own documentation uses. Keeping `development` avoids renaming two working scripts, and the
`dev` label in `3-software-architecture.md` is corrected to `development` instead. This is a
naming alignment, not a scope change.

### D2 — Variant selection is an explicit `APP_VARIANT` environment variable

`app.config.js` reads `process.env.APP_VARIANT`, defaulting to `development` when unset, and
**throws** on an unrecognised value. Each `eas.json` build profile sets `env.APP_VARIANT` to its
own profile name.

Rejected alternative: reading `EAS_BUILD_PROFILE` (which EAS sets automatically). It is only set
on EAS servers, so local `expo run:ios` and the CI `bundle` job would fall through to a different
code path than a real build — the exact class of "declared but never verified" gap that #35 was
about. `APP_VARIANT` is set in one place per profile, is testable off-device, and is what the
unit test in [Testing Strategy](#testing-strategy) asserts.

The `app.config.js` header comment that currently says no environment variable is read must be
rewritten, not deleted: the variable is now read **and documented**, which is what item #1's
criterion actually required.

### D3 — One bundle identifier per variant; production keeps `cl.finanzas.mobile`

| Variant | App name | iOS bundle identifier / Android package |
| --- | --- | --- |
| `development` | `Finanzas [DEV]` | `cl.finanzas.mobile.dev` |
| `preview` | `Finanzas [BETA]` | `cl.finanzas.mobile.preview` |
| `production` | `Finanzas` | `cl.finanzas.mobile` |

This is a safety decision, not cosmetics. iOS scopes the app sandbox **and the Keychain** by
bundle identifier. If a dev build shared `cl.finanzas.mobile` with the installed production app,
installing it over the top would put real bank credentials (`expo-secure-store`,
non-negotiable 1) and the real SQLite file (non-negotiable 5) inside a build carrying unreviewed
code. Distinct identifiers make that impossible and let both variants sit on the same phone.

Cost, stated plainly: the local dev client must be rebuilt and reinstalled once after this item,
and the runbooks that hard-code `cl.finanzas.mobile` for `xcrun simctl get_app_container` must be
updated — see [Residual verification strategy](#residual-verification-strategy).

### D4 — One URL scheme, `finanzas`, for every variant

Deep links are load-bearing in existing runbooks (`finanzas://gallery`, `finanzas:///ready`) and
in the fidelity kit's `finanzas:///<route>?fidelity=1…` links. Varying the scheme per variant
would silently break all of them for zero safety gain (the scheme does not scope storage). The
one caveat — with two variants installed, iOS resolves `finanzas://` to one of them arbitrarily —
goes in the runbook's troubleshooting table, with "uninstall the other variant" as the fix.

### D5 — `expo-dev-client` is added; `development` builds target the iOS Simulator

`developmentClient: true` without the `expo-dev-client` package produces a build with no
Metro-connect launcher (V4) — the profile is currently a declaration with nothing behind it.
Adding the package makes the profile real and leaves the existing local flow intact:
`expo prebuild` + `expo run:ios` still produce the Simulator build every runbook depends on, now
with the dev-client launcher embedded.

`development` sets `ios.simulator: true`, which matters for the human-step budget: **a Simulator
build requires no Apple account and no signing**. The dev-client half of S1 is therefore fully
verifiable before H1. A `development-device` profile extends it with `ios.simulator: false` for
the day a physical dev build is wanted.

### D6 — A new `.github/workflows/eas-build.yml`; `deploy.yml` is left alone

`.github/workflows/deploy.yml` is framework-owned and guarded by
`scripts/development-workflow/tests/test-placeholder-workflows-opt-in.sh`, which asserts it has
no `push:` trigger and still requires `confirm_placeholder` (V7). Repurposing it would break that
test and collide with `/sync-template` on the next framework update. The real pipeline therefore
lands in a project-owned file, and `3-software-architecture.md`'s Deployment Mapping is updated to
name it. `deploy.yml` stays exactly as it is, and the architecture doc gains one line saying it is
an unused framework placeholder.

### D7 — A preflight job gates on `EXPO_TOKEN`; an unconfigured repository skips, it does not fail

The `secrets` context is **not** available in a job-level `if:`. The workflow therefore opens with
a `preflight` job that reads `EXPO_TOKEN` into a step `env:` (where secrets are allowed), writes
`configured=true|false` to `$GITHUB_OUTPUT`, and emits a `::notice::` pointing at the release
runbook when it is false. Every build job carries `if: needs.preflight.outputs.configured == 'true'`.

Consequence, and the reason this design was chosen: this workflow can be merged **before** H1–H3
exist. Until the owner creates an Expo account, every push to `develop` produces a green run whose
build job is skipped, and no merge is ever blocked by an absent account.

### D8 — Builds are enqueued with `--no-wait`; EAS compiles, GitHub does not

`eas build … --non-interactive --no-wait` uploads the project and returns. No macOS runner
minutes are spent, a run finishes in about a minute, and a 25-minute native build never holds a
job open. The trade-off is that build failure surfaces in the EAS dashboard and in the owner's
email, not as a red GitHub check — recorded in [Risks](#risks--mitigations), with the mitigation
being that the pre-existing CI `bundle` job already catches the failure mode that matters
(a project that cannot bundle) on every PR, before merge.

### D9 — Production builds trigger on `push: main`; store submission is doubly gated

The release tag `vX.Y.Z` is created by `auto-tag-release.yml` using the workflow `GITHUB_TOKEN`
(V17). GitHub does not re-trigger workflows from events raised with that token, so a `push: tags`
trigger would be a pipeline that silently never runs. `push: branches: [main]` is the reliable
signal, and it fires exactly when a `release/*` or `hotfix/*` PR merges.

Store submission is gated twice: the job declares `environment: production` (so GitHub
Environment protection rules — required reviewers — apply, matching what
`3-software-architecture.md` already promises), and `--auto-submit` is appended only when the
repository variable `EAS_AUTO_SUBMIT` is `true`. `vars` **is** available in a job-level `if:`,
unlike `secrets`. The owner flips that variable after H6 proves an interactive submit works, so
the first ever store submission is never an unattended one.

### D10 — One version source: `apps/mobile/package.json`; build numbers stay remote

`app.config.js` sets `version: require('./package.json').version` instead of a hard-coded
`0.0.0` (V18). `cli.appVersionSource: "remote"` is kept, and `preview` and `production` set
`autoIncrement: true`, so EAS owns `ios.buildNumber` / `android.versionCode` and two builds of the
same version never collide.

That makes `/prepare-release` Step 4 ("Update the version field in any manifest files that track
it", V16) deterministic for this repository: the manifests are the root `package.json` and
`apps/mobile/package.json`. Because protocol 05 is framework-owned and rewritten by
`/sync-template`, that list is **not** written into the protocol; it is written into
`docs/project/5-release-and-signing-runbook.md`, and `AGENTS.md` gains a pointer to it in the
CHANGELOG & Versioning section.

### D11 — No EAS Update / OTA in this item

EAS Update would let JavaScript change on a user's device without store review, and it adds a
first-party network call to Expo's servers — which contradicts "the app makes no requests to
first-party servers" in the Security Model. Introducing it is a product decision, not a build
decision. No `channel`, no `runtimeVersion`, no `expo-updates` dependency. Recorded here so a
reviewer does not read the omission as an oversight.

### D12 — Credential model: EAS-managed, nothing signable in the repository

- **iOS distribution certificate and provisioning profiles**: generated and stored by EAS
  (`eas credentials`), created on first build. Never downloaded into the repository.
- **App Store Connect API key**: uploaded once to EAS by the owner (H6). It is what lets
  `eas submit` run without an interactive Apple login. It never touches GitHub.
- **Android keystore**: generated and stored by EAS when the first Android build runs. Not needed
  for the acceptance bar (D13).
- **The only repository secret is `EXPO_TOKEN`** — an Expo personal access token, referenced by
  name in the workflow, created in H2.
- **Non-secret identifiers** (the EAS `projectId` written into `app.config.js` by `eas init`, and
  the bundle identifiers) are committed. They are public identifiers, not credentials. The
  architecture doc's current line listing `EAS_PROJECT_ID` and `APPLE_TEAM_ID` as secrets is
  corrected accordingly.
- `.gitignore` gains the signing-material patterns so a downloaded key cannot be committed by
  accident: `credentials.json`, `*.p8`, `*.p12`, `*.mobileprovision`, `*.keystore`, `*.jks`.
  A test step in the runbook proves the ignore actually fires.

### D13 — iOS carries the acceptance bar; Android is configured, not delivered

AC3 needs one production build installed on a real device. iOS reaches that through TestFlight
with one Apple Developer account. Android would need a Google Play developer account plus a
service-account JSON for automated submission — a second paid account and a second credential
path that the brief never asked for. `eas.json` therefore configures Android for all three
profiles (so `eas build -p android --profile preview` works the day it is wanted) but no Play
submission is automated and no Android step appears in the acceptance path. This is called out as
an [escalation](#escalations--open-items), not buried.

### D14 — Shell contract for the workflow's `run:` steps is `bash`

Steps that branch or build an argument list declare `shell: bash` explicitly and use Bash arrays.
GitHub-hosted Ubuntu runners default to `bash` already; declaring it makes the contract legible
and stops a future edit from assuming POSIX `sh`. `.github/workflows/` is outside
`workflow-shell-snippet-lint.py`'s `ROOTS` (V15), so this is a convention this plan sets, not a
lint the repository enforces.

---

## Trigger and gate matrix

The delivery workflow's behaviour depends on four inputs. Every combination below must hold after
implementation; the runbook exercises the rows marked *verifiable now*.

| Event | `EXPO_TOKEN` present | Repository variable | Outcome | Next action | Verifiable now |
| --- | --- | --- | --- | --- | --- |
| `push` to `develop` touching a build-relevant path | no | — | `preflight` green, `preview` job **skipped**, run green | Owner completes H1–H3 | Yes |
| `push` to `develop` touching a build-relevant path | yes | `EAS_PREVIEW_ON_PUSH` unset or `true` | `preview` build enqueued on EAS (internal distribution) | Install from the EAS link | No — needs H1–H3 |
| `push` to `develop` touching a build-relevant path | yes | `EAS_PREVIEW_ON_PUSH` = `false` | `preview` job skipped, run green | Cost brake is engaged deliberately | No |
| `push` to `develop` touching only docs / workflow-framework files | either | — | Workflow does not run at all (path filter) | None | Yes |
| `push` to `main` (release or hotfix merge) | no | — | `production` job **skipped**, run green | Owner completes H1–H3 | Yes |
| `push` to `main` | yes | `EAS_AUTO_SUBMIT` unset or `false` | `production` build enqueued; **no** store submission | Owner runs the documented `eas submit` command | No — needs H1–H5 |
| `push` to `main` | yes | `EAS_AUTO_SUBMIT` = `true` | `production` build enqueued with `--auto-submit`; EAS submits to App Store Connect when the build finishes | TestFlight processes the build | No — needs H1–H6 |
| `workflow_dispatch` with `profile: preview` | yes | `EAS_PREVIEW_ON_PUSH` not consulted | `preview` build enqueued regardless of branch filters and of the push brake — the brake gates pushes only | — | No |
| `workflow_dispatch` with `profile: production` | yes | `EAS_AUTO_SUBMIT` respected | `production` build enqueued; `environment: production` approval applies first | Approve in the GitHub Actions UI | No |
| `workflow_dispatch`, any profile | no | — | Both build jobs skipped; `preflight` emits a `::notice::` naming the release runbook | This is the pre-H1 state | Yes |

`environment: production` on the production job means GitHub Environment protection rules (a
required reviewer) apply before the job starts. Configuring that reviewer is H7.

---

## Layer-by-Layer Changes

### Database / Data Layer

Not applicable. No migration, no schema change, no seed data. The variant split (D3) means a
`development` build gets its own empty database on first launch, which is the intended effect and
requires no code.

### Backend / API

Not applicable — there is no backend, and this item does not add one. EAS is a build service; the
shipped app makes no call to it (D11 keeps it that way).

### Shared Packages / Libraries

No change to `@finanzas/shared-domain`, `@finanzas/shared-utils` or `@finanzas/bank-scraper`.
`eas build` uploads the whole workspace, so all three are built from source by EAS exactly as
Metro builds them locally.

### Frontend / UI (`apps/mobile`)

- [ ] `apps/mobile/eas.json` — rewrite. `cli` keeps `appVersionSource: "remote"` and gains a
      `version` floor for `eas-cli`. Build profiles: `development` (dev client, internal,
      `ios.simulator: true`, `android.buildType: apk`, `env.APP_VARIANT: development`),
      `development-device` (`extends: development`, `ios.simulator: false`), `preview`
      (internal, `autoIncrement: true`, `env.APP_VARIANT: preview`, `android.buildType: apk`),
      `production` (store, `autoIncrement: true`, `env.APP_VARIANT: production`,
      `android.buildType: app-bundle`). A `submit.production.ios` section exists and holds **no**
      key material (D12). Covers S1, AC1.
- [ ] `apps/mobile/app.config.js` — read `APP_VARIANT` (D2), map it to `name` and to
      `ios.bundleIdentifier` / `android.package` (D3), take `version` from
      `./package.json` (D10), throw on an unknown variant, and rewrite the header comment to
      document the variable instead of claiming none is read. `scheme`, `plugins`, icons and
      splash are untouched (D4). Covers S1, AC2 (no credential enters the config).
- [ ] `apps/mobile/package.json` — add `expo-dev-client` to `dependencies` at the version
      `expo install` resolves for SDK 54 (D5). No script is added here: every EAS entry point is a
      **root** script, alongside the two that already exist (V10). Covers S1.
- [ ] `apps/mobile/__tests__/build-config.test.ts` — new. See
      [Testing Strategy](#testing-strategy). Covers S1 and is the control that keeps `eas.json`
      and `app.config.js` from drifting apart.

### Infrastructure / Configuration

- [ ] `.github/workflows/eas-build.yml` — new (D6). `push` on `develop` and `main`, path-filtered
      to `apps/**`, `packages/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` and the workflow file
      itself, plus `workflow_dispatch` with `profile` and `platform` choice inputs.
      `permissions: contents: read`. Jobs: `preflight` (D7), `preview`
      (`environment: develop`, concurrency group `eas-preview`, cancel-in-progress true),
      `production` (`environment: production`, concurrency group `eas-production`,
      cancel-in-progress **false**, `--auto-submit` gated on `vars.EAS_AUTO_SUBMIT`, D9).
      Shell contract `bash` (D14). Covers AC1, AC2, S2.
- [ ] `.github/workflows/ci.yml` — **no change**. The `bundle` job stays exactly as it is; the
      new unit test rides on the existing `test` job. Stated explicitly because the dispatch
      constraint requires it.
- [ ] `.github/workflows/deploy.yml` — **no change** (D6).
- [ ] `.gitignore` — add the signing-material patterns from D12.
- [ ] `package.json` (root) — pin the `eas-cli` version in `mobile:build:dev-store` and
      `mobile:build:production-store` to the version verified during implementation, and add
      `mobile:build:preview` and `mobile:submit:ios` so every EAS entry point is a named script
      rather than a remembered command line. Covers S2, S3.

### Documentation

Listed in full under [Documentation Updates](#documentation-updates). The load-bearing new file is
`docs/project/5-release-and-signing-runbook.md` (S3).

---

## Testing Strategy

**Test types**: Unit (Jest), toolchain (existing CI `bundle` job), smoke (runbook), manual/human
(H1–H8).

This plan is **not** parser-risk: it adds no lint script, no scanner, no regex over structured
text. It is **not** concurrent-event-source: no listener, timer, socket or shared mutable state is
introduced. It does **not** introduce or modify a cross-cutting review checklist: `REVIEW.md` and
the planning/implementation protocols are untouched. Those addenda are therefore omitted
deliberately.

### Unit tests — `apps/mobile/__tests__/build-config.test.ts`

Runs inside the existing `app` Jest project (V12) and is type-checked by the existing tsconfig
include (V13), so `pnpm test` and `pnpm typecheck` cover it with no new command and no CI change.

| Scenario | Assertion | Criterion |
| --- | --- | --- |
| `APP_VARIANT=development` | name `Finanzas [DEV]`, iOS bundle id and Android package `cl.finanzas.mobile.dev` | S1, D3 |
| `APP_VARIANT=preview` | name `Finanzas [BETA]`, identifiers `cl.finanzas.mobile.preview` | S1, D3 |
| `APP_VARIANT=production` | name `Finanzas`, identifiers `cl.finanzas.mobile` | S1, D3 |
| `APP_VARIANT` unset | resolves to the `development` identity — the local `expo run:ios` and CI `bundle` path | D2, D5 |
| `APP_VARIANT=nonsense` | the config **throws**, and the message names the variable and the accepted values | D2 |
| Any variant | `scheme` is `finanzas` | D4 |
| Any variant | `version` equals `require('apps/mobile/package.json').version` and is not hard-coded | D10 |
| `eas.json` ↔ `app.config.js` | every build profile's `env.APP_VARIANT` is a variant the config accepts, and each profile name matches its `APP_VARIANT` value | D2 — this is the anti-drift control |
| `eas.json` | `development` has `developmentClient: true` and `ios.simulator: true` | D5 |
| `eas.json` | `preview` and `production` set `autoIncrement: true`; `cli.appVersionSource` is `remote` | D10 |
| `eas.json` | `submit.production` exists and the whole file contains no key-like field (`*.p8`, `*.p12`, `password`, `keystore`, `apiKey`) | AC2, D12 |

Because `app.config.js` is a CommonJS module read once per require, each variant case must reset
the module registry (`jest.resetModules()`) and restore `process.env.APP_VARIANT` afterwards, so
case order cannot change results.

**Prove the control fires.** Following the house rule established by #35, the implementer must
break each control once and paste the failing output into the implementation PR: change one
bundle identifier in `app.config.js` without touching the test, and change one profile's
`env.APP_VARIANT` in `eas.json`. A control that has only ever been seen to pass has not been
verified.

### Toolchain

`pnpm check:layout` and the CI `bundle` job (`expo export:embed --eager --platform ios --dev false`)
must stay green after `expo-dev-client` is added. This is the check that proves D5 did not break
Metro; it already runs on every PR (V5) and needs no edit.

### Smoke / manual

`docs/testing/mobile/23-eas-build-release-ci.smoke-test.md`. Steps 1–7 need no account and are
runnable the day the branch exists; steps 8–12 are the HUMAN steps and are the only path to S4.

### Regression suite

The repository's device E2E tier is Maestro (`.maestro/`), which exercises product flows, not
build configuration. No regression spec is added: the unit tests above are the durable regression
for this item, and the fidelity kit (#47) covers the "the dev client still runs" question from the
UI side.

### Design assets

None. Asset discovery per
[`design-assets.md`](../../../workflow/development-workflow/design-assets.md) found no
`## Design assets` section in issue #23, no tracker attachment, and no `assets/` folder in this
item's development directory. This is a build-and-delivery item with no UI surface, so the
runbook contains **no** expected-vs-actual fidelity step and no baseline is invented.

---

## Residual verification strategy

Two claims in this plan are pattern-completeness claims. Each names the evidence the
implementation must produce before `ready-for-human-review`.

**1. Bundle identifier occurrences.** Changing the development variant's identifier (D3) breaks
any document that tells a reader to run `xcrun simctl get_app_container booted cl.finanzas.mobile`
against a dev build. The enumeration in V11 is a plan-time snapshot; the implementation must
**re-run the search** and disposition every live occurrence:

```bash
grep -rn "cl\.finanzas\.mobile" --include="*.md" .
```

| File | Disposition |
| --- | --- |
| `docs/testing/mobile/9-connect-a-bank-picker-credentials-secure-storage.smoke-test.md` | Update — it names the identifier in its Test Data table and in a `get_app_container` command against a dev build |
| `docs/testing/mobile/13-categorization-flow.smoke-test.md` | Update — `get_app_container` against a dev build |
| `docs/testing/mobile/16-transaction-detail-exclusion.smoke-test.md` | Update — `get_app_container` against a dev build |
| `docs/testing/mobile/35-pnpm-hoisted-layout-ci-bundle-check.smoke-test.md` | **Do not update.** It records an observation made on a specific date (`UIKitApplication:cl.finanzas.mobile` seen running). Rewriting an evidence record to match a later change would falsify it |
| Any occurrence the re-run finds that is not listed above | Disposition explicitly in the PR description: updated, or out of scope with a reason |

Evidence to attach to the implementation PR: the `grep` output before and after, and one line per
occurrence saying which disposition it received.

**2. Version-carrying manifests.** D10 claims the release version lives in exactly the root
`package.json` and `apps/mobile/package.json`. The implementation must re-run:

```bash
grep -rn '"version"' --include="package.json" . --exclude-dir=node_modules
```

and reconcile the result with the list written into
`docs/project/5-release-and-signing-runbook.md`. If a workspace package carries a version that
must move with a release, the runbook's list is wrong and must be corrected before readiness.

---

## Seed Data

None. This item ships no user-visible data path. The one data-adjacent consequence is that the
renamed development bundle identifier (D3) gives the dev build a fresh, empty database on first
launch — which is the point, and which the runbook calls out so nobody reads it as data loss.

---

## Documentation Updates

To be executed by the developer **during implementation**, not now.

- [ ] `docs/project/5-release-and-signing-runbook.md` — **new file.** The S3 deliverable. Must
      contain: the credential model from D12 (what lives in EAS, what lives in GitHub, what may
      never be committed); the numbered HUMAN steps H1–H8 with exact commands; the
      `/prepare-release` integration section naming the two version manifests, where the build
      fits between protocol 05 Step 6 and Step 8, and how the store submission is authorised
      (D9); the "what to do when a build fails" section pointing at the EAS dashboard (D8); and
      the local keychain fallback — if the owner ever chooses local credentials over EAS-managed
      ones, keys live outside the repository and are referenced by absolute path from a
      `credentials.json` that `.gitignore` blocks.
- [ ] `docs/README.md` — add the new runbook to the Project Documentation table.
- [ ] `docs/project/3-software-architecture.md` — Environment Strategy table: rename `dev` to
      `development` (D1) and add the app name / bundle identifier columns (D3). Deployment
      Mapping table: point both rows at `.github/workflows/eas-build.yml`, record the path filter
      and the `EXPO_TOKEN` gate (D7), and note that `deploy.yml` remains an unused framework
      placeholder (D6). Replace the secrets line with the D12 model: `EXPO_TOKEN` is the only
      repository secret; the EAS project id and bundle identifiers are non-secret and committed;
      Apple key material lives in EAS. Add one line recording D11 (no EAS Update).
- [ ] `docs/project/2-repo-architecture.md` — file map: note the new workflow. Environment Setup:
      after the `expo run:ios` sequence, record that the dev client is now `Finanzas [DEV]` with
      bundle id `cl.finanzas.mobile.dev`, that `expo-dev-client` is installed, and that an app
      installed before this item must be deleted from the Simulator once.
- [ ] `AGENTS.md` — Common Commands: the EAS build/submit scripts. Troubleshooting: two rows —
      "the app on the simulator is `Finanzas` not `Finanzas [DEV]`" (stale pre-item install,
      delete and rebuild), and "an EAS build never starts after a merge" (`EXPO_TOKEN` absent, or
      the path filter did not match). CHANGELOG & Versioning: a pointer to the release runbook for
      which manifests protocol 05 Step 4 must bump.
- [ ] `docs/best-practices/stack/expo-react-native.md` — a short "Build variants" section:
      `APP_VARIANT` is the only supported switch, `app.config.js` is the only place it is read,
      and no feature code may branch on it.
- [ ] `docs/best-practices/stack/turborepo-pnpm.md` — the line that already names
      `apps/mobile/eas.json` as needing a PR call-out: extend it to the new workflow file.
- [ ] `docs/testing/mobile/9-connect-a-bank-picker-credentials-secure-storage.smoke-test.md`,
      `docs/testing/mobile/13-categorization-flow.smoke-test.md`,
      `docs/testing/mobile/16-transaction-detail-exclusion.smoke-test.md` — dev-build bundle
      identifier, per [Residual verification strategy](#residual-verification-strategy).
- [ ] `CHANGELOG.md` — `[Unreleased]`, on the implementation branch only. Literal entry in
      [Implementation Order](#implementation-order) step 12.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The item cannot reach S4 because the owner's Expo/Apple accounts do not exist yet | High | High — S4 is the acceptance bar | Everything except S4 is designed to be verifiable without an account (D5, D7). The plan hands the owner a numbered H1–H8 list with exact commands. The item waits on H1–H8; it is not blocked on any further design work |
| Adding `expo-dev-client` breaks the local dev flow the fidelity kit and every runbook depend on | Med | High | Runbook step 3 rebuilds the dev client from a clean prebuild and boots it **before** anything else, and re-runs a deep link. The CI `bundle` job is the second, automatic net |
| The renamed development bundle identifier silently invalidates runbook commands | Med | Med | Treated as a residual sweep with re-run evidence, not a guess |
| A push-triggered preview build on every `develop` merge exhausts the EAS free build allowance | Med | Med | Path filter (docs-only and workflow-framework merges do not trigger), `cancel-in-progress: true` on the preview concurrency group, and the `EAS_PREVIEW_ON_PUSH=false` brake that needs no code change |
| `--no-wait` means a failing EAS build does not turn a GitHub check red (D8) | Med | Med | Accepted. The failure mode that actually blocks a release — a project that cannot bundle — is already caught pre-merge by the CI `bundle` job. The release runbook tells the owner to check the EAS dashboard before merging the release PR |
| `eas submit --non-interactive` refuses without an App Store Connect app id | Med | Med | H6 runs the submit **interactively** once, which is where any missing identifier surfaces. `EAS_AUTO_SUBMIT` stays `false` until that has succeeded (D9). If a non-secret identifier turns out to be required, it goes in `eas.json`; key material never does (D12) |
| `eas build` misreads the pnpm workspace and fails to install on EAS servers | Low | High | First discovered in H4, the first real preview build. `pnpm-workspace.yaml` already declares `nodeLinker: hoisted` (#35), which is the setting EAS's install step needs |
| A future `/sync-template` reverts a framework-owned file this item depends on | Low | Med | This item touches no framework-owned file (D6), and the placeholder test that protects `deploy.yml` stays green |
| An Apple signing key is downloaded and committed | Low | High | `.gitignore` patterns from D12, proved to fire by a runbook step that creates a dummy `credentials.json` and confirms `git status` stays clean |

---

## Code Samples

> All samples are **illustrative — adapt during implementation**. Versions marked `<pinned>` must
> be replaced with the exact version verified on the day of implementation; do not copy a version
> number from this plan.

### `apps/mobile/app.config.js` (illustrative — adapt during implementation)

```javascript
// Illustrative — adapt during implementation.
// APP_VARIANT is the one documented build-time variable (implementation plan Decision D2).
// It is set by every eas.json build profile and defaults to `development` for local
// `expo run:ios` and for the CI `bundle` job. No feature code may read it.
const APP_VARIANTS = {
  development: { name: 'Finanzas [DEV]', id: 'cl.finanzas.mobile.dev' },
  preview: { name: 'Finanzas [BETA]', id: 'cl.finanzas.mobile.preview' },
  production: { name: 'Finanzas', id: 'cl.finanzas.mobile' },
};

const variant = process.env.APP_VARIANT ?? 'development';
const identity = APP_VARIANTS[variant];
if (!identity) {
  throw new Error(
    `APP_VARIANT="${variant}" is not a known build variant. ` +
      `Expected one of: ${Object.keys(APP_VARIANTS).join(', ')}.`,
  );
}

module.exports = {
  expo: {
    name: identity.name,
    slug: 'finanzas',
    scheme: 'finanzas', // one scheme for every variant — Decision D4
    version: require('./package.json').version, // Decision D10
    // …orientation, icon, splash, plugins unchanged…
    ios: { supportsTablet: false, bundleIdentifier: identity.id },
    android: { package: identity.id /* …adaptiveIcon unchanged… */ },
  },
};
```

### `apps/mobile/eas.json` (illustrative — adapt during implementation)

```json
{
  "cli": { "version": ">= <pinned>", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_VARIANT": "development" },
      "ios": { "simulator": true },
      "android": { "buildType": "apk" }
    },
    "development-device": {
      "extends": "development",
      "ios": { "simulator": false }
    },
    "preview": {
      "distribution": "internal",
      "autoIncrement": true,
      "env": { "APP_VARIANT": "preview" },
      "android": { "buildType": "apk" }
    },
    "production": {
      "distribution": "store",
      "autoIncrement": true,
      "env": { "APP_VARIANT": "production" },
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": { "ios": {} }
  }
}
```

### `.github/workflows/eas-build.yml` (illustrative — adapt during implementation)

Action SHAs are copied from `.github/workflows/ci.yml` so the repository keeps one pinned version
per action.

```yaml
# Illustrative — adapt during implementation.
name: EAS build

on:
  push:
    branches: [develop, main]
    paths:
      - "apps/**"
      - "packages/**"
      - "pnpm-lock.yaml"
      - "pnpm-workspace.yaml"
      - ".github/workflows/eas-build.yml"
  workflow_dispatch:
    inputs:
      profile:
        description: "EAS build profile"
        required: true
        default: "preview"
        type: choice
        options: [preview, production]
      platform:
        description: "Target platform"
        required: true
        default: "ios"
        type: choice
        options: [ios, android, all]

permissions:
  contents: read

jobs:
  preflight:
    name: Check EAS configuration
    runs-on: ubuntu-latest
    outputs:
      configured: ${{ steps.check.outputs.configured }}
    steps:
      # `secrets` is not available in a job-level `if:` — Decision D7.
      - name: Check EXPO_TOKEN
        id: check
        shell: bash
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
        run: |
          if [ -n "${EXPO_TOKEN:-}" ]; then
            echo "configured=true" >> "$GITHUB_OUTPUT"
          else
            echo "configured=false" >> "$GITHUB_OUTPUT"
            echo "::notice::EXPO_TOKEN is not configured; EAS builds are skipped. See docs/project/5-release-and-signing-runbook.md steps H1-H3."
          fi

  preview:
    name: Preview build (internal)
    needs: preflight
    if: >-
      needs.preflight.outputs.configured == 'true' &&
      ((github.event_name == 'push' && github.ref == 'refs/heads/develop' &&
        vars.EAS_PREVIEW_ON_PUSH != 'false') ||
       (github.event_name == 'workflow_dispatch' && inputs.profile == 'preview'))
    runs-on: ubuntu-latest
    environment: develop
    concurrency:
      group: eas-preview
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4
      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
        with:
          node-version-file: .nvmrc
      - name: Enqueue EAS preview build
        working-directory: apps/mobile
        shell: bash
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          PLATFORM: ${{ inputs.platform || 'ios' }}
        run: |
          pnpm dlx eas-cli@<pinned> build \
            --platform "$PLATFORM" \
            --profile preview \
            --non-interactive \
            --no-wait

  production:
    name: Production build (store)
    needs: preflight
    if: >-
      needs.preflight.outputs.configured == 'true' &&
      ((github.event_name == 'push' && github.ref == 'refs/heads/main') ||
       (github.event_name == 'workflow_dispatch' && inputs.profile == 'production'))
    runs-on: ubuntu-latest
    environment: production
    concurrency:
      group: eas-production
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4
      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
        with:
          node-version-file: .nvmrc
      - name: Enqueue EAS production build
        working-directory: apps/mobile
        shell: bash
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          PLATFORM: ${{ inputs.platform || 'ios' }}
          AUTO_SUBMIT: ${{ vars.EAS_AUTO_SUBMIT }}
        run: |
          args=(build --platform "$PLATFORM" --profile production --non-interactive --no-wait)
          if [ "${AUTO_SUBMIT:-}" = "true" ]; then
            args+=(--auto-submit)
          fi
          pnpm dlx eas-cli@<pinned> "${args[@]}"
```

---

## HUMAN steps (owner's Expo and Apple accounts)

These are the only steps this repository cannot perform. Each is small, ordered, and has an exact
command. They are the S4 critical path and they belong verbatim in
`docs/project/5-release-and-signing-runbook.md`.

| # | Step | Command / place | Blocks |
| --- | --- | --- | --- |
| H1 | Create or sign in to an Expo account and link this app to an EAS project. Commit the `extra.eas.projectId` that `eas init` writes into `app.config.js` (non-secret, D12) | `cd apps/mobile && pnpm dlx eas-cli@<pinned> login` then `… init` | H2–H8 |
| H2 | Create an Expo personal access token | expo.dev → Account settings → Access tokens | H3 |
| H3 | Add the token as the repository secret `EXPO_TOKEN` | `gh secret set EXPO_TOKEN` | Every automated build |
| H4 | Run the first preview build and confirm the pnpm workspace installs on EAS | `pnpm mobile:build:preview` (or dispatch the workflow with `profile: preview`) | AC1 (preview half) |
| H5 | Enrol in the Apple Developer Program (if not already) and let EAS generate the distribution certificate and provisioning profile on the first production build. Register the test iPhone with `eas device:create` only if a `preview` build is wanted on a physical device | `pnpm mobile:build:production-store`, answering the credential prompts once | AC1 (store half), AC3 |
| H6 | Create the App Store Connect app record for `cl.finanzas.mobile`, then submit the finished build **interactively once** so any missing identifier surfaces with a human present. Upload the App Store Connect API key to EAS when prompted | App Store Connect → Apps → New App, then `pnpm mobile:submit:ios` | AC3, D9 |
| H7 | Configure the GitHub `production` Environment with a required reviewer, and the `develop` Environment with none | Repository → Settings → Environments | The production job's approval gate |
| H8 | Set the repository variable `EAS_AUTO_SUBMIT=true` once H6 has succeeded, so subsequent releases submit unattended | `gh variable set EAS_AUTO_SUBMIT --body true` | Unattended store submission |

Everything up to and including H3 is roughly fifteen minutes. H5 and H6 are gated by Apple
enrolment and App Store Connect processing, which are wall-clock waits, not work.

---

## Implementation Order

1. **Add `expo-dev-client`** (D5). `cd apps/mobile && pnpm exec expo install expo-dev-client`.
   Verification: it appears in `apps/mobile/package.json` dependencies and `pnpm install` is
   clean. Record the resolved version in the PR.
2. **Rewrite `apps/mobile/eas.json`** per D1, D3, D5, D10, D12. Verification: the file parses
   (`node -e "JSON.parse(require('fs').readFileSync('apps/mobile/eas.json','utf8'))"`) and every
   build profile carries an `env.APP_VARIANT`.
3. **Rewrite `apps/mobile/app.config.js`** per D2, D3, D4, D10, including the corrected header
   comment. Verification: `APP_VARIANT=production node -e "console.log(require('./apps/mobile/app.config.js').expo.ios.bundleIdentifier)"`
   prints `cl.finanzas.mobile`, and running it with a nonsense value throws with a message naming
   the accepted variants.
4. **Write `apps/mobile/__tests__/build-config.test.ts`** covering every row of the table in
   [Testing Strategy](#testing-strategy). Verification: `pnpm --filter @finanzas/mobile test`
   passes and `pnpm typecheck` is clean.
5. **Prove the tests fire.** Break the bundle identifier in `app.config.js`, run the suite,
   confirm it fails; revert. Break one `env.APP_VARIANT` in `eas.json`, run the suite, confirm the
   drift assertion fails; revert. Paste both failing outputs into the PR description.
6. **Harden `.gitignore`** with the D12 patterns. Verification: create an empty
   `apps/mobile/credentials.json` and a dummy `apps/mobile/AuthKey_TEST.p8`, run `git status`,
   confirm neither is listed, then delete both.
7. **Add `.github/workflows/eas-build.yml`** per D6, D7, D8, D9, D14, reusing the action SHAs
   already pinned in `ci.yml`. Resolve the `eas-cli` version with `pnpm dlx eas-cli --version` on
   the day of implementation, use it everywhere `<pinned>` appears, and record it in the PR; do
   not copy a version number from this plan. Verification: the file is valid YAML and GitHub
   lists the workflow after the branch is pushed.
8. **Update the root `package.json` scripts** — pin the same `eas-cli` version in the two existing
   scripts (`mobile:build:dev-store`, `mobile:build:production-store`) and add
   `mobile:build:preview` and `mobile:submit:ios`. Verification: `pnpm mobile:build:preview --help`
   reaches the EAS CLI help output without needing a login, and the pinned version string is
   identical in the workflow, the root scripts and the release runbook.
9. **Confirm the toolchain is untouched.** `pnpm check:layout`, then
   `cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false`.
   Verification: both succeed exactly as before the branch.
10. **Rebuild the local dev client** — `expo prebuild --clean` then `expo run:ios` — and confirm
    the Simulator shows `Finanzas [DEV]`, the app boots, and `finanzas://gallery` still resolves.
    This is the constraint the fidelity kit and every mobile runbook depend on; do not defer it.
11. **Execute the documentation updates** listed in
    [Documentation Updates](#documentation-updates), including the residual bundle-identifier
    sweep and the version-manifest re-check from
    [Residual verification strategy](#residual-verification-strategy). Attach both command outputs
    to the PR.
12. **Update `CHANGELOG.md`** under `[Unreleased]`, using this literal entry:

    ```markdown
    - **EAS build profiles and release CI** (#23): `eas.json` gains real `development`,
      `preview` and `production` profiles with per-variant app names and bundle identifiers, a
      new `.github/workflows/eas-build.yml` maps `develop` to internal builds and `main` to store
      builds, and `docs/project/5-release-and-signing-runbook.md` documents the credential model
      and the release procedure. Signing material stays in EAS-managed credentials; `EXPO_TOKEN`
      is the only repository secret.
    ```

13. **Run the runbook's non-account steps** (`docs/testing/mobile/23-eas-build-release-ci.smoke-test.md`
    steps 1–7) and record PASS/FAIL for each in the PR description.
14. **Hand H1–H8 to the owner** as an explicit escalation on the PR. S4 and AC3 stay open until
    H1–H8 are done; do not mark this item complete on the strength of a green CI run.

---

## Escalations & open items

Recorded here so the reviewer does not have to reconstruct them.

1. **S4 / AC3 wait on H1–H8.** No design work remains; the blocker is account access. The item
   should not be closed on the machine-verifiable half alone.
2. **Android delivery is configured, not delivered** (D13). A Google Play developer account and a
   Play service-account key are out of scope. If the owner wants Android in the acceptance bar,
   that is a scope change and needs its own item.
3. **`eas submit` identifier requirements are confirmed in H6, not assumed.** The plan
   deliberately does not commit an App Store Connect app id it has not seen. The invariant that
   survives either outcome: non-secret identifiers may live in `eas.json`, key material may not.
4. **`eas-cli` version is pinned at implementation time**, not by this plan. Every `<pinned>`
   marker above is a required substitution, and the same version must appear in the workflow, the
   root scripts and the release runbook.
5. **PR #61 merge order.** It edits root `package.json` scripts and `ci.yml`. Re-read both files
   before editing if #61 lands first.

---

## Definition of Done

- [ ] `eas.json` defines `development`, `development-device`, `preview` and `production`, each
      exporting its own `APP_VARIANT` (S1)
- [ ] `app.config.js` produces a distinct app name and bundle identifier per variant, takes its
      version from `apps/mobile/package.json`, and throws on an unknown variant (S1, D2, D3, D10)
- [ ] `apps/mobile/__tests__/build-config.test.ts` passes, and each of its controls has been seen
      to fail on a deliberate break (S1)
- [ ] `.github/workflows/eas-build.yml` maps `develop` to a preview build and `main` to a store
      build, and skips cleanly with no `EXPO_TOKEN` (AC1, D7)
- [ ] No credential, key or token is committed; `.gitignore` blocks the signing patterns and has
      been proved to (AC2, D12)
- [ ] `pnpm check:layout`, `pnpm test`, `pnpm typecheck` and the CI `bundle` job are green, and a
      dev client still builds and boots on the iOS Simulator (dispatch constraint)
- [ ] `docs/project/5-release-and-signing-runbook.md` exists and documents the credential model,
      the `/prepare-release` touch points and H1–H8 (S2, S3)
- [ ] Every file in [Documentation Updates](#documentation-updates) is updated, and both residual
      sweeps have evidence in the PR
- [ ] **Waits on the owner**: one build shipped end to end to TestFlight and launched on a real
      device (S4, AC3)
