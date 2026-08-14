# Release and Signing Runbook

**Work item**: [#23 — EAS build profiles and release CI](https://github.com/lhpaul/personal-finances/issues/23)
**Implementation plan**: [`2_23-eas-build-release-ci_implementation-plan.md`](../specs/developments/20260802155158_23-eas-build-release-ci/2_23-eas-build-release-ci_implementation-plan.md)
**Smoke test runbook**: [`23-eas-build-release-ci.smoke-test.md`](../testing/mobile/23-eas-build-release-ci.smoke-test.md)

This document is the authoritative record of how `@finanzas/mobile` gets built and delivered:
what lives where, which steps a human must run, and how the pipeline plugs into
[`/prepare-release`](../workflow/development-workflow/protocols/05-prepare-release-protocol.md).
It corrects the credential-model line in
[`3-software-architecture.md`](3-software-architecture.md) and is the canonical source from
here forward.

---

## Credential model

Nothing signable lives in this repository. Every credential either lives on the user's device
(bank credentials — unrelated to app signing) or in EAS's own credential store.

| Material | Where it lives | Who creates it |
| --- | --- | --- |
| iOS distribution certificate + provisioning profile | EAS-managed credentials (`eas credentials`) | EAS, generated on the first `production`-profile build (H5) |
| App Store Connect API key | Uploaded once to EAS | The owner, when prompted during the first interactive submit (H6) |
| Android keystore | EAS-managed credentials | EAS, generated on the first Android build (not required for the acceptance bar — see [Android scope](#android-scope)) |
| `EXPO_TOKEN` (Expo personal access token) | GitHub repository secret, referenced **by name only** in `.github/workflows/eas-build.yml` | The owner (H2–H3) |
| EAS project id (`extra.eas.projectId`) | Committed, plain text, in `apps/mobile/app.config.js` | `eas init` writes it (H1) for a **static** `app.json` — this project's `app.config.js` is a **dynamic** config, so `eas init` cannot write the field automatically; it was committed by hand after `eas init --account <owner> --non-interactive` printed it. Either way, this is a public identifier, not a credential |
| Bundle identifiers (`cl.finanzas.mobile[.dev\|.preview]`) | Committed, plain text, in `apps/mobile/app.config.js` | This item |

**Never commit**: a certificate, a provisioning profile, an API key, a keystore, or a password,
under any name. `.gitignore` blocks `credentials.json`, `*.p8`, `*.p12`, `*.mobileprovision`,
`*.keystore` and `*.jks` — proved to fire during implementation by creating one dummy file of
each pattern and confirming `git status --short` stayed clean.

**Local keychain fallback.** If the owner ever chooses to manage credentials locally instead of
letting EAS store them (`eas credentials` supports both), the local files still may never enter
this repository. They live outside the repository entirely, at an absolute path on the owner's
machine, referenced from an `apps/mobile/credentials.json` that `.gitignore` already blocks. This
is a fallback, not the default — the default, and the one every H-step below assumes, is
EAS-managed.

## Build variants

| Variant | `APP_VARIANT` | App name | Bundle id / package | Distribution | Apple account needed |
| --- | --- | --- | --- | --- | --- |
| `development` | `development` (default) | `Finanzas [DEV]` | `cl.finanzas.mobile.dev` | Simulator, dev client | No — `ios.simulator: true` skips credential resolution entirely |
| `development-device` | `development` (inherited via `extends`) | `Finanzas [DEV]` | `cl.finanzas.mobile.dev` | Physical device, dev client | Yes (ad hoc) |
| `preview` | `preview` | `Finanzas [BETA]` | `cl.finanzas.mobile.preview` | Internal (TestFlight internal / APK) | Yes |
| `production` | `production` | `Finanzas` | `cl.finanzas.mobile` | Store | Yes |

Each variant is a distinct bundle identifier, not a cosmetic label. iOS scopes the app sandbox
**and the Keychain** by bundle identifier, so a dev build can never share storage with the real
installed app, and a device may carry every variant side by side.

Version: `apps/mobile/app.config.js` reads `require('./package.json').version` —
`apps/mobile/package.json` is the single source. `eas.json`'s `cli.appVersionSource: "remote"`
means EAS owns `ios.buildNumber` / `android.versionCode` on its own servers; `preview` and
`production` set `autoIncrement: true` so two builds of the same `version` never collide on
those numbers. The named `version` string itself never comes from EAS — only the build/version
counters do.

## Delivery workflow

`.github/workflows/eas-build.yml` (display name **EAS build**) is the pipeline. It is a new,
project-owned file — `.github/workflows/deploy.yml` remains the framework's unused placeholder,
guarded by `scripts/development-workflow/tests/test-placeholder-workflows-opt-in.sh`, and is not
repurposed.

| Branch | Push trigger | Build profile | Environment (approval gate) |
| --- | --- | --- | --- |
| `develop` | Paths under `apps/mobile/**`, `packages/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or the workflow file itself | `preview` | `develop` (no required reviewer) |
| `main` | Same path filter | `production` | `production` (required reviewer — H7) |

It also accepts `workflow_dispatch` with `profile` (`preview` / `production`) and `platform`
(`ios` / `android` / `all`) inputs — usable once the workflow file is on the repository's
**default branch** (a GitHub Actions constraint, not a choice this repository made).

**No `EXPO_TOKEN` → the workflow stays green, builds are skipped.** A `preflight` job reads the
secret into a step-level `env:` (the `secrets` context is not available in a job-level `if:`)
and writes `configured=true|false`; every build job gates on that output. Before a repository's
H1–H3 are done, every push produces a green run with a `::notice::` pointing back at this
document — this repository's own H1–H3 are already done (see below), so this describes the
general design property new deployments of this pipeline rely on, not this repository's current
state.

**Builds are enqueued, not waited on** (`--non-interactive --no-wait`). EAS compiles remotely; a
build failure shows up on the [EAS dashboard](https://expo.dev) and in the owner's email, not as
a red GitHub check. The pre-merge safety net that *is* a red check is the existing CI `bundle`
job (`expo export:embed`), which already catches "this project cannot even bundle" before merge.

**If a build fails**: open the EAS dashboard link the CLI printed (or `eas build:list` from
`apps/mobile`), read the failed build's logs, fix the underlying issue, and re-enqueue — either
by pushing again or by dispatching the workflow manually.

Store submission is double-gated: the `production` job runs under the `production` GitHub
Environment (so a required reviewer approves before the job starts, once H7 is configured), and
`--auto-submit` is appended to the `eas build` command only when the repository variable
`EAS_AUTO_SUBMIT` is `true`. It stays `false` until H6 has proved an interactive submit works.

## `/prepare-release` integration

[Protocol 05](../workflow/development-workflow/protocols/05-prepare-release-protocol.md) drives
every release. Two points in it touch this pipeline:

- **Step 4 (Bump Version in Manifests)**: the manifests that carry the release version are
  **`package.json`** (root) and **`apps/mobile/package.json`** — exactly these two. Every other
  workspace `package.json` (`packages/shared-domain`, `packages/shared-utils`,
  `packages/bank-scraper`) stays at `0.0.0`: they are internal workspace packages consumed via
  the `workspace:*` protocol, never published to a registry, and carry no version a release needs
  to move. `hooks/package.json` is a git-hooks tool outside the pnpm workspace and is unrelated.
  Re-verify this list with `grep -rn '"version"' --include="package.json" . --exclude-dir=node_modules`
  before trusting it on a future release — a new publishable package would change the answer.
- **Step 8 (Inform the Human)**: merging the `main` PR pushes to `main`, which independently
  fires two workflows off the same event — `auto-tag-release.yml` (creates the `vX.Y.Z` tag) and
  `EAS build` (enqueues the `production` profile). They do not trigger each other; both are
  `push: branches: [main]` listeners. The production build therefore starts automatically at the
  moment Step 8's merge lands, before Step 9's post-merge cleanup runs.

No change was made to protocol 05 itself — it is framework-owned and rewritten by
`/sync-template`. This document is the place a project-specific detail like "which two manifests"
belongs.

## Android scope

`eas.json` configures Android for all three profiles (`apk` for `development`/`preview`,
`app-bundle` for `production`), so `eas build -p android --profile preview` works today. No Play
Store submission is automated: that needs a Google Play developer account and a service-account
key this item does not introduce. Android is **configured, not delivered** — it is not part of
the acceptance bar (AC3 / S4), which iOS satisfies alone.

## HUMAN steps (H1–H8)

These are the only steps this repository cannot perform on its own — each needs the owner's Expo
or Apple account. Everything else in this item is designed to be verified without one.

**H1–H3 status: done, as of this implementation PR.** The owner already had an active EAS
session and had set the `EXPO_TOKEN` repository secret before implementation began; the
implementation PR ran `eas init --account <owner> --non-interactive` and committed the resulting
`extra.eas.projectId` by hand (dynamic config — see the Credential model table above). The rows
below stay as the reference procedure for a from-scratch project.

| # | Step | Command / place | Blocks |
| --- | --- | --- | --- |
| H1 | Create or sign in to an Expo account and link this app to an EAS project. Commit the `extra.eas.projectId` that `eas init` writes into `app.config.js` (non-secret) — for a dynamic `app.config.js`, add it by hand from the command's printed output | `cd apps/mobile && pnpm dlx eas-cli@21.5.0 login` then `pnpm dlx eas-cli@21.5.0 init --account <owner> --non-interactive` | H2–H8 |
| H2 | Create an Expo personal access token | expo.dev → Account settings → Access tokens | H3 |
| H3 | Add the token as the repository secret `EXPO_TOKEN` | `gh secret set EXPO_TOKEN` | Every automated build |
| H4 | Run the first preview build and confirm the pnpm workspace installs on EAS. **Android half already proven** in the implementation PR (`eas build --profile preview --platform android --non-interactive --no-wait` reached `IN_QUEUE`); the **iOS half still needs H5** — iOS `preview` targets a real device and needs Apple signing credentials, unlike the Simulator-only `development` profile | `pnpm mobile:build:preview` (or dispatch **EAS build** with `profile: preview`) | AC1 (preview half) |
| H5 | Enrol in the Apple Developer Program (if not already) and let EAS generate the distribution certificate and provisioning profile on the first production build | `pnpm mobile:build:production-store`, answering credential prompts once | AC1 (store half), AC3 |
| H6 | Create the App Store Connect app record for `cl.finanzas.mobile`, then submit the finished build **interactively once** so any missing identifier surfaces with a human present. Upload the App Store Connect API key to EAS when prompted | App Store Connect → Apps → New App, then `pnpm mobile:submit:ios` | AC3, D9 |
| H7 | Configure the GitHub `production` Environment with a required reviewer, and the `develop` Environment with none | Repository → Settings → Environments | The production job's approval gate |
| H8 | Set the repository variable `EAS_AUTO_SUBMIT=true` once H6 has succeeded, so future releases submit unattended | `gh variable set EAS_AUTO_SUBMIT --body true` | Unattended store submission |

Everything up to and including H3 is roughly fifteen minutes of work. H5 and H6 are gated by
Apple enrolment and App Store Connect processing — wall-clock waits, not work.

**Until H1–H8 complete**, item #23's acceptance criterion AC3 ("a production build installs and
launches on a real device") and scope item S4 stay open. A green CI run on this branch proves
everything machine-verifiable; it does not prove S4.

## See also

- [`3-software-architecture.md`](3-software-architecture.md) — Environment Strategy, Deployment
  Mapping
- [`2-repo-architecture.md`](2-repo-architecture.md) — Environment Setup (local dev client)
- [`docs/best-practices/stack/expo-react-native.md`](../best-practices/stack/expo-react-native.md) —
  build variants convention
- [`docs/testing/mobile/23-eas-build-release-ci.smoke-test.md`](../testing/mobile/23-eas-build-release-ci.smoke-test.md) —
  the full verification runbook, including H1–H8 as smoke-test steps 8–12
