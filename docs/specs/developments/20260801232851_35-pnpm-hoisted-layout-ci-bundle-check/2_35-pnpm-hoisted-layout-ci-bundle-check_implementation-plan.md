# Fix the pnpm hoisted layout and add a CI bundle check — Implementation Plan

**Work item**: [lhpaul/personal-finances#35](https://github.com/lhpaul/personal-finances/issues/35) — `Type: Refactor`
**Spec**: None. This is a **Refactor-route** item — see
[`docs/project/2-repo-architecture.md` → Backlog routing](../../../project/2-repo-architecture.md).
The specification is the work item brief (issue #35 body, reproduced under
[Work Item Brief](#work-item-brief)).
**Smoke test runbook**: [`docs/testing/mobile/35-pnpm-hoisted-layout-ci-bundle-check.smoke-test.md`](../../../testing/mobile/35-pnpm-hoisted-layout-ci-bundle-check.smoke-test.md)
**Depends on**: #1 (merged).

---

## Work Item Brief

Recorded so this plan is self-contained and every change below cites an acceptance criterion.

> **Context**: Item #1's monorepo bootstrap added `.npmrc` with `node-linker=hoisted`, but **a
> plain `pnpm install` does not apply it**. The installed tree is the isolated layout, so
> `@expo/metro-runtime` is never hoisted to the root where Metro's resolver looks, and the app
> cannot bundle: `Unable to resolve "@expo/metro-runtime" from expo-router/entry-classic.js`.
> Forcing the flag fixes it. On a cleaned tree, `pnpm install --node-linker=hoisted` takes
> `node_modules` from 9 entries to 735, and `expo export:embed --eager --platform ios --dev false`
> then succeeds — 1022 modules, 3.9 MB bundle, 22 assets. The code is fine; only the module
> layout was wrong. **No native build in this repository can succeed until this is fixed.**
>
> **Why CI did not catch it**: CI runs exactly `pnpm lint`, `pnpm typecheck`, `pnpm test` after
> `pnpm install --frozen-lockfile`. None of them resolves through Metro, and no workflow produces
> a bundle. CI has been green on a tree that cannot build the app.
>
> **The pattern these share**: *a control that is declared is not a control that is verified.*
> (1) `.npmrc` declares `node-linker=hoisted`; nothing checks the resulting layout.
> (2) `eslint.config.mjs` declares `no-restricted-imports`; no test exercises it.
> (3) Item #1's simulator criterion was closed by inspection, not by a run.
>
> **Scope**:
>
> 1. Make the hoisted layout actually apply — locally and in CI. Diagnose why `.npmrc` is not
>    honoured by a plain install. Add a check that **fails when the layout is isolated**, and run
>    it in CI as well as locally.
> 2. Add a bundle job to CI: `expo export:embed --eager --platform ios --dev false`. Sub-items 1
>    and 2 are not independent and must land together.
> 3. Sweep item #1's acceptance criteria for the same shape: `no-restricted-imports` needs a test
>    that proves it fires on a deliberate violation; "boots the app in the iOS Simulator" needs
>    evidence or an explicit reclassification.
> 4. Document a native setup sequence that actually works. Reaching a green Metro bundle took four
>    distinct failures (`.npmrc` layout, CocoaPods out of sync, no `ios/` directory, prebuild
>    refusing on an existing `ios/`). `docs/project/2-repo-architecture.md` "Environment Setup"
>    must end with a sequence that produces a running simulator build, **verified by whoever does
>    this item, not asserted.**
>
> **Out of scope**: `.gitignore` already ignores `apps/mobile/ios/` and `apps/mobile/android/`.
> No change needed.
>
> **Acceptance criteria**:
>
> - **AC1**: A plain `pnpm install` (no flags) produces a hoisted layout with
>   `@expo/metro-runtime` at the root
> - **AC2**: A layout check **fails** on a tree deliberately installed isolated, and passes on a
>   hoisted one
> - **AC3**: `expo export:embed --eager --platform ios --dev false` succeeds in CI
> - **AC4**: The bundle job **fails** on a deliberately isolated tree — prove the check fires
>   before trusting that it passes
> - **AC5**: A test proves `no-restricted-imports` rejects a deliberate violation from
>   `@finanzas/shared-domain`
> - **AC6**: `2-repo-architecture.md` carries a setup sequence the implementer ran end to end to a
>   running simulator build
> - **AC7**: Item #1's simulator criterion has evidence or an explicit reclassification

---

## Summary

**Approach**: The root cause is not a git worktree and not a stale store — **pnpm 11 no longer
reads pnpm-specific settings from `.npmrc`**, and this repository pins
`packageManager: pnpm@11.12.0`. `node-linker=hoisted` sits in a file pnpm 11 only consults for
npm-compatible registry/auth keys, so it is silently ignored and every install falls back to the
isolated linker (evidence V3–V7 below). The fix is to declare `nodeLinker: hoisted` in
`pnpm-workspace.yaml`, which is where pnpm 11 reads its settings, and to delete the `.npmrc` that
now only tells a lie. Around that fix this item installs three controls that fail loudly:
a dependency-free layout check (`scripts/check-node-linker-layout.mjs`) wired to `pnpm check:layout`
and to the root `postinstall` so a plain install cannot end in an isolated tree; a new `bundle` job
in `.github/workflows/ci.yml` that runs the layout check and then
`expo export:embed --eager --platform ios --dev false`; and a Jest test in
`packages/shared-domain` that drives the real ESLint CLI over a deliberate violation and asserts
`no-restricted-imports` rejects it. Every one of those three controls must be **proved to fail**
before it is trusted to pass, with the failing output pasted into the implementation PR. The item
closes by running the native setup sequence end to end on macOS to a booted simulator and writing
down what actually worked in `docs/project/2-repo-architecture.md`.

**Estimated complexity**: M

**Rationale**: The code change is small (one settings line, one ~90-line script, one CI job, one
test file, docs). The cost is in the evidence: five deliberate-failure runs, one of them a
push-to-CI-and-revert cycle, plus a real iOS prebuild + CocoaPods + simulator boot that cannot be
faked. 1–2 days.

**Dependencies**: #1 (merged). No other item must land first. This item unblocks every native
build in the repository, so it should merge ahead of any item that needs to run the app.

---

## Verification Log

Repo revision for every row: `dc4eac6` (branch `implementation-plan/35-pnpm-hoisted-layout-ci-bundle-check`,
checked out from `origin/develop`). Verified 2026-08-01.

| # | Check | Command / query | Result |
| --- | --- | --- | --- |
| V1 | Repo revision | `git rev-parse --short HEAD` | `dc4eac6`, clean tree |
| V2 | Declared linker setting today | `cat .npmrc` | single line `node-linker=hoisted`; `pnpm-workspace.yaml` has `packages` + `allowBuilds`, no `nodeLinker` |
| V3 | Effective pnpm setting in this repo | `pnpm config list` (resolves to pnpm 11.12.0 via `packageManager`) | JSON with `allowBuilds`, `packages`, `registry`, `@jsr:registry`, `userAgent` — **no `nodeLinker` key**. `pnpm config get nodeLinker` → `undefined` |
| V4 | Same `.npmrc` under pnpm 10.10.0 | `pnpm config list` in a scratch dir with no `packageManager` pin (homebrew pnpm 10.10.0) | prints `node-linker=hoisted` — the key is read by pnpm 10, not by pnpm 11 |
| V5 | Isolation of the cause (not the worktree, not the store) | scratch dir **outside** any git worktree: `package.json` pinning `pnpm@11.12.0`, `.npmrc` = `node-linker=hoisted`, one dep `chalk@4.1.2`, fresh `pnpm install` | root `node_modules` = 1 entry (`chalk` → symlink into `.pnpm`); `node_modules/.modules.yaml` records `"nodeLinker": "isolated"`; **no warning printed** |
| V6 | The fix, same scratch dir | replace `.npmrc` with `pnpm-workspace.yaml` containing `nodeLinker: hoisted`, delete `node_modules`, plain `pnpm install` (no flags) | root `node_modules` = 6 real directories (`chalk`, `ansi-styles`, `color-convert`, `color-name`, `has-flag`, `supports-color`); `.modules.yaml` records `"nodeLinker": "hoisted"`; `pnpm config get nodeLinker` → `hoisted` |
| V7 | Lockfile is linker-independent | compare `settings:` block of the generated `pnpm-lock.yaml` between V5 and V6 | identical (`autoInstallPeers`, `excludeLinksFromLockfile` only) — the fix does **not** invalidate `pnpm install --frozen-lockfile` in CI |
| V8 | `.modules.yaml` is machine-readable JSON under pnpm 11 | `python3 -c "import json; json.load(open('node_modules/.modules.yaml'))"` on the V6 tree | parses; keys include `nodeLinker`, `hoistPattern`, `hoistedLocations`, `packageManager`, `virtualStoreDir` |
| V9 | CLI flag still overrides the file (needed for the negative tests) | `pnpm install --node-linker=isolated` in the V6 scratch dir | 1 root entry, `.modules.yaml` `"nodeLinker": "isolated"` — a deliberately isolated tree is reproducible on demand |
| V10 | A failing root `postinstall` fails the install | scratch dir with root `"postinstall": "node -e \"process.exit(3)\""`, `pnpm install` | `pnpm install` exits `3` — root lifecycle scripts run and their exit code propagates |
| V11 | Current install state of this checkout | `ls node_modules` in the worktree and in the main checkout | both empty / absent — nothing in the repository can bundle today, consistent with the issue |
| V12 | Existing CI surface | `cat .github/workflows/ci.yml` | three jobs (`lint`, `typecheck`, `test`), each: checkout → `pnpm/action-setup` (no version input; reads `packageManager`) → `actions/setup-node` with `node-version-file: .nvmrc`, `cache: pnpm` → `pnpm install --frozen-lockfile` → one command. No bundle job anywhere in `.github/workflows/` |
| V13 | The rule under test | `eslint.config.mjs` lines 71–103 | `sharedDomainPurity` exports a `no-restricted-imports` entry with one pattern group (16 patterns: `expo`, `expo-*`, `react-native`, `react-native-*`, `@finanzas/mobile`, `**/apps/**`, `drizzle-orm`, `drizzle-orm/*`, `expo-sqlite`, `better-sqlite3`, `sqlite3`, `knex`, `kysely`, `typeorm`, `@prisma/client`) and the message `@finanzas/shared-domain may not depend on the app, on Expo modules, or on any SQL library.` |
| V14 | How the rule is applied | `cat packages/shared-domain/eslint.config.mjs` | `export default [...rootConfig, sharedDomainPurity]` — the rule reaches domain files only through this file, so the test must exercise the real config resolution, not the exported object alone |
| V15 | Test tooling already present in `shared-domain` | `cat packages/shared-domain/package.json`, `jest.config.js` | `jest` 29 + `ts-jest` + `@types/jest`, `preset: ts-jest`, `testEnvironment: node`; one existing colocated test (`src/index.test.ts`). No `eslint` and no `@types/node` declared |
| V16 | Versions already resolved in the lockfile | `grep -nE "^  (eslint\|@types/node)@" pnpm-lock.yaml` and the `packages/shared-domain` importer block | `eslint@9.39.5` and `@types/node@26.1.2` are already in the tree — adding them as devDependencies of `shared-domain` adds no new resolution |
| V17 | Item #1 acceptance criteria (frozen enumeration) | `docs/testing/mobile/1-bootstrap-monorepo-expo-app.smoke-test.md` "Assertions Checklist" | AC1–AC14, quoted in the [Item #1 acceptance-criteria audit](#item-1-acceptance-criteria-audit) below |
| V18 | Stale references to `.npmrc` in tracked files | `grep -rn "node-linker\|nodeLinker\|npmrc" --include=*.md --include=*.js --include=*.mjs --include=*.yaml . ` (excluding `node_modules`, `docs/workflow/`) | `apps/mobile/metro.config.js:2`, `docs/project/2-repo-architecture.md:52`, and four historical lines in item #1's merged plan (historical record — not edited) |
| V19 | Native toolchain available on the planning machine | `xcodebuild -version`, `xcrun simctl list devices available \| grep -c iPhone`, `pod --version`, `sw_vers -productVersion` | Xcode 26.6 (17F113), 7 available iPhone simulators, CocoaPods present, macOS 26.5.2 — the simulator route in AC6/AC7 is reachable in this environment |
| V20 | `.gitignore` scope confirmation (issue's out-of-scope claim) | `cat .gitignore` | lines 29–30 ignore `apps/mobile/ios/` and `apps/mobile/android/`; `.expo/` also ignored, so eager-bundle output needs no new ignore entry |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Artifact base branch for this plan | `develop` | Parent orchestrator handoff; branch created from `origin/develop` at `dc4eac6` | 2026-08-01, `dc4eac6` | Current invocation only: batch `[#2 impl, #3 plan, #6 spec, #35 this item]` | `Verified` |
| Artifact owner / repository mode | Current repository owns the plan (`single_repo`; no `repository.mode` hub configuration in `.ai-dev-workflow.yaml`) | `.ai-dev-workflow.yaml`, orchestrator handoff | 2026-08-01, `dc4eac6` | Same bounded batch | `Verified` |
| Canonical package-manager pin | `pnpm@11.12.0` (`package.json` `packageManager`), Node 22 (`.nvmrc`) | `package.json`, `.nvmrc` | 2026-08-01, `dc4eac6` | Same bounded batch; no in-flight item changes the toolchain pin | `Verified` |
| Canonical node-linker declaration surface | `pnpm-workspace.yaml` (`nodeLinker: hoisted`) — **changed by this plan** from `.npmrc` | V3–V6 in the Verification Log | 2026-08-01, `dc4eac6` | Same bounded batch; open PRs #31, #32, #33 touch none of `.npmrc`, `pnpm-workspace.yaml`, `.github/workflows/`, `eslint.config.mjs`, `docs/project/2-repo-architecture.md` (evidence supplied by the parent orchestrator with the dispatch) | `Verified` |
| CI workflow ownership for this item | `.github/workflows/` is owned by #35 for this batch | Orchestrator scoping in the dispatch | 2026-08-01, `dc4eac6` | Same bounded batch | `Verified` |

No conflict found inside the bounded scope. This check was **not** expanded into a repository-wide
scan of every open pull request; the bounded scope above is the whole of it. If the implementer
finds, at implementation start, that any row's source has changed (in particular the
`packageManager` pin or `.github/workflows/ci.yml` structure), stop before editing files and
return the evidence to the orchestrator rather than resolving it in-flight.

---

## Root Cause Diagnosis

This section is the deliverable that the rest of the plan depends on. Read it before writing code.

### What is actually wrong

pnpm 11 does not read pnpm-specific settings from `.npmrc`. It still reads npm-compatible
registry and auth keys from rc files (that is why `registry` and `@jsr:registry` appear in
`pnpm config list`), but behavioural settings such as `nodeLinker` are read from
`pnpm-workspace.yaml`. This repository pins `packageManager: pnpm@11.12.0`, and pnpm's automatic
package-manager version management means **every** `pnpm` invocation inside the repository runs
11.12.0 — even on the machine where `which pnpm` resolves to a homebrew pnpm 10.10.0 (V3 vs V4).
So `node-linker=hoisted` in `.npmrc` is inert: it is not mapped to the pnpm setting, and **no
warning is printed** (V5). The install silently uses the default `isolated` linker,
`@expo/metro-runtime` — a transitive dependency, never a direct one — is never placed at the
workspace root, and Metro's resolver (which `apps/mobile/metro.config.js` points at
`<root>/node_modules` with `disableHierarchicalLookup = true`) cannot find it.

`pnpm install --node-linker=hoisted` works because CLI flag parsing is unaffected by the rc-file
migration. That is why forcing the flag fixed the tree while the file did nothing.

Corroborating detail: `pnpm-workspace.yaml` in this repo already carries `allowBuilds`, a
pnpm-11-era settings key. The settings surface had already moved; `node-linker` was simply left
behind in `.npmrc` when item #1 was written.

### Candidate hypotheses from the issue, and how each was ruled out

| Hypothesis | Verdict | Evidence |
| --- | --- | --- |
| Root `.npmrc` is not read when the install runs inside a git worktree (`.claude/worktrees/<slug>/`) | **Ruled out** | V5 reproduces the isolated layout in a plain scratch directory that is not a git repository at all. The worktree is irrelevant; a fresh clone behaves identically |
| An earlier install in a different linker mode left stale lockfile or store state that short-circuits later installs | **Ruled out** | V5 and V6 each start from a fresh directory with no `node_modules`; the outcome tracks the config source, not install history. V7 additionally shows the lockfile `settings:` block is identical in both modes, so no lockfile state can carry the linker |
| `.npmrc` is read but the value is overridden somewhere | **Ruled out** | There is no user-level `~/.npmrc` and no `~/.config/pnpm/rc` on the machine checked (V3 context). The key simply never appears in pnpm 11's resolved config |
| pnpm 11 ignores pnpm settings in `.npmrc`; they belong in `pnpm-workspace.yaml` | **Confirmed** | V3 (absent under 11) vs V4 (present under 10); V5 (isolated with `.npmrc`) vs V6 (hoisted with `pnpm-workspace.yaml`), same pnpm version, same dependency, fresh installs |

### Why CI never noticed

`pnpm lint`, `pnpm typecheck` and `pnpm test` all resolve modules through Node/TypeScript/Jest,
which walk parent directories and are perfectly happy with the isolated layout. Only Metro — with
`disableHierarchicalLookup = true` and an explicit `nodeModulesPaths` list — needs the hoisted
tree. No CI job ran Metro (V12). The layout was therefore unconstrained in both directions: nothing
forced it, and nothing observed it.

---

## Classification Results

| Classifier | Result | Rationale |
| --- | --- | --- |
| Parser-risk | **Not applicable** | The new check script performs no text scanning: assertion A shells out to `pnpm config get nodeLinker` and compares a string; assertion B `JSON.parse`s the machine-written `node_modules/.modules.yaml` (V8); assertion C uses `fs.lstatSync`. No regex, no structured-text parsing, no lint/scanner module. This was a deliberate design choice (Decision 2) precisely to keep a verification control free of parser risk |
| Concurrent-event-source | **Not applicable** | No listeners, sockets, timers, async queues or shared mutable state. The script is synchronous and single-shot; the CI job is a sequence of steps |
| Cross-cutting checklist | **Not applicable** | No checklist category is added to `REVIEW.md` or to any planning/implementation protocol. The controls added here are repository CI checks, not workflow-framework gates. No agent, skill or protocol file changes |
| Design assets | **None discovered** | Issue #35 has no `## Design assets` section, no tracker attachments, and this item ships no UI. Per `docs/workflow/development-workflow/design-assets.md`, fidelity steps are omitted from the runbook rather than invented |
| Sweep / pattern-completeness | **Applicable** | Scope item 3 sweeps item #1's acceptance criteria. The enumeration is frozen to the merged runbook's Assertions Checklist (AC1–AC14, V17) and audited in full below; residual strategy in [Testing Strategy](#residual-verification-before-ready-for-human-review) |

---

## Decisions

### Decision 1: `nodeLinker: hoisted` moves to `pnpm-workspace.yaml`, and `.npmrc` is deleted

`pnpm-workspace.yaml` is the only file pnpm 11 reads this setting from (V6). The setting is added
there with a comment naming the reason. `.npmrc` contains exactly one line — the inert one — so
the file is deleted rather than kept as a comment-only stub: a file whose only content is a
setting the tool ignores is the exact failure this item exists to remove. Nothing else in the
repository reads `.npmrc` (V18: only prose references remain, and they are updated).

The alternative — keeping `.npmrc` in case someone runs pnpm 10 — is rejected: `packageManager`
pins 11.12.0 and `engines.pnpm` requires `>=11`, so pnpm 10 is already unsupported, and the
layout check's assertion A (below) catches the case where the effective setting is not `hoisted`
regardless of which file someone put it in.

### Decision 2: the layout check is a dependency-free Node script with three assertions

`scripts/check-node-linker-layout.mjs`, Node 22 built-ins only, no npm dependency (so it runs even
when the install is broken — which is exactly when it is needed). It exits `0` or `1` and prints
one line per assertion:

- **A — the declaration is where pnpm actually reads it.** Run `pnpm config get nodeLinker` in the
  repository root; require the trimmed output to be `hoisted`. This is the assertion that would
  have caught the original bug on day one: today it prints `undefined` (V3). It also catches a
  future regression where someone moves the setting back into `.npmrc`, because it asks pnpm what
  it resolved rather than reading a file.
- **B — the installed tree was linked hoisted.** `JSON.parse` `node_modules/.modules.yaml` and
  require `nodeLinker === "hoisted"` (V8). Distinct failure messages for "file missing → run
  `pnpm install`" and "unexpected format → this script expects pnpm 11".
- **C — the modules Metro needs are really at the root.** For each entry of
  `REQUIRED_ROOT_MODULES = ['@expo/metro-runtime', 'react-native']`, require
  `<root>/node_modules/<name>` to exist, to be a **real directory and not a symlink**
  (`fs.lstatSync(...).isSymbolicLink() === false`), and to contain a `package.json`.
  `@expo/metro-runtime` is the module named in the resolver error and is only ever at the root
  when the tree is hoisted, because it is a transitive dependency; `react-native` is a direct
  dependency of `@finanzas/mobile`, so under the isolated linker it lives in
  `apps/mobile/node_modules` and is absent from the root. Together they distinguish "hoisted" from
  "isolated" without counting entries (entry counts drift as dependencies change).

The script resolves the repository root from its own location
(`path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')`), so it behaves identically whether it is
invoked from the root, from a workspace directory, from CI, or from a git worktree.

### Decision 3: the check runs on every install (`postinstall`) and by name (`check:layout`)

Root `package.json` gains two scripts:

```jsonc
"check:layout": "node scripts/check-node-linker-layout.mjs",
"postinstall": "node scripts/check-node-linker-layout.mjs"
```

`postinstall` is what makes AC1 self-enforcing for humans: a plain `pnpm install` that somehow ends
in an isolated tree fails the install itself with the diagnostic, instead of failing hours later
inside Metro. Root lifecycle scripts run under pnpm 11 and their exit code propagates (V10).
`check:layout` is the named command for documentation, for CI, and for running the check without
reinstalling. `pnpm install --ignore-scripts` skips `postinstall` — that is used deliberately by
the negative test (Evidence E1) and is documented in the runbook.

Rejected alternative: check only in CI. It would leave the local `pnpm install` in exactly the
state that produced this issue.

### Decision 4: one new `bundle` job inside `.github/workflows/ci.yml`, not a new workflow file

`ci.yml` already holds the three per-PR checks with an identical five-step preamble and a shared
`concurrency` group; a fourth job matches that structure and inherits the same trigger
(`pull_request` → `develop`/`main`) and cancellation semantics. A separate workflow file would
duplicate the trigger and the concurrency group for no benefit. The job:

```yaml
  bundle:
    name: iOS bundle
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      # checkout / pnpm / node steps identical to the other jobs, same pinned action SHAs
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Check node_modules layout
        run: pnpm check:layout
      - name: Bundle iOS (Metro only, no native build)
        working-directory: apps/mobile
        run: pnpm exec expo export:embed --eager --platform ios --dev false
```

It runs on `ubuntu-latest`: `export:embed` is a Metro bundle, not an Xcode build, so it needs no
macOS runner. The explicit `Check node_modules layout` step stays even though `postinstall` already
ran the same check during install — a named failing step is the readable signal in the PR checks
list, and it keeps the control visible if `postinstall` is ever removed.

The bundle command is **not** added as a script to `apps/mobile/package.json`: that file is a
merge surface for the concurrently running items #2, #3 and #6, and this item's ownership boundary
is `.github/workflows/`, `pnpm-workspace.yaml`, `.npmrc`, `eslint.config.mjs`, the new script and
the docs. The identical command is documented for local use instead.

### Decision 5: the ESLint control is a Jest test that drives the real ESLint CLI over stdin

`packages/shared-domain/src/domain-purity-lint.test.ts`, run by the existing `jest` + `ts-jest`
setup, therefore by `pnpm test` and by the existing CI `test` job — no new CI wiring.

It spawns the real CLI rather than importing the ESLint Node API:

```ts
// Illustrative — adapt during implementation.
const eslintBin = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin/eslint.js');
const run = (source: string) =>
  spawnSync(process.execPath, [eslintBin, '--no-color', '--format', 'json',
                               '--stdin', '--stdin-filename', 'src/purity-probe.ts'],
            { cwd: packageRoot, input: source, encoding: 'utf8' });
```

Why the CLI and not `new ESLint(...)`: `packages/shared-domain/eslint.config.mjs` is an ES module,
and ESLint loads it with a dynamic `import()`; doing that inside Jest's CommonJS module registry is
a known source of environment-dependent failures. A child process runs the same code path a
developer runs, with the same config resolution from `cwd`, and cannot be fooled by Jest's loader.
`require.resolve('eslint/package.json')` is used because ESLint's `exports` map does not expose
`bin/eslint.js` directly.

Why stdin and not a fixture file on disk: a committed violating file would either fail
`pnpm lint` for everyone or have to be added to an ignore list, and an ignore list is one more
declared-but-unverified control. Nothing is written to the working tree.

Cases (all in one test file, ~3 CLI invocations, `jest.setTimeout(60_000)`):

1. **Fires** — a probe importing `expo-sqlite`, `drizzle-orm`, `react-native` and
   `../../apps/mobile/src/theme` reports `no-restricted-imports` for each, with the message from
   `sharedDomainPurity` (V13). Asserts the rule id **and** the message text, so a silently
   rewritten message is caught.
2. **Does not over-fire** (negative control) — a probe importing `@finanzas/shared-utils` and
   `node:assert` reports zero errors. Without this, a rule that rejected everything would pass
   case 1 and still be broken.
3. **Reaches domain files through the real config chain** — the same violating probe run with
   `cwd` set to `packages/shared-utils` must **not** report the shared-domain message, proving the
   rule is scoped by `packages/shared-domain/eslint.config.mjs` (V14) and not leaking repo-wide.

`packages/shared-domain/package.json` gains `eslint` and `@types/node` devDependencies at the
versions already resolved in the lockfile (V16), so the test does not depend on hoisting to find
its own tooling — a test of the layout must not silently rely on the layout.

### Decision 6: every control is proved to fail before it is trusted to pass

Six pieces of evidence (E1–E6, defined in [Testing Strategy](#testing-strategy)) are **required
artifacts of implementation**, pasted as terminal output or run URLs into the implementation PR
description. A plan step that says "confirm the check works" without a captured failure is the
exact shape this item was filed to eliminate. Reviewers should treat a missing E-item as a blocking
finding.

### Decision 7: the simulator criterion is closed by a run or left open in writing — never by inspection

The implementer runs the native sequence end to end on macOS and records real output (E6). The
planning machine has Xcode 26.6, CocoaPods and seven available iPhone simulators (V19), so this is
expected to be reachable. If the implementation environment lacks Xcode or a simulator, the
implementer must **not** mark AC6/AC7 done: they record in the runbook and in a comment on issue
#35 exactly which steps were executed, which were not, and what remains unverified, and leave the
criteria open. Reclassification is an explicit, written act; silence is not reclassification.

### Decision 8: documentation records what was run, not what should work

`docs/project/2-repo-architecture.md` "Environment Setup" is rewritten from the transcript of E6,
including the recovery steps for the four failures the issue names (ignored linker setting,
CocoaPods out of sync, missing `ios/`, prebuild refusing on an existing `ios/`). Tool versions used
are recorded next to the sequence so a future reader can tell whether the sequence has aged.

---

## Item #1 acceptance-criteria audit

Scope item 3 asks for a sweep of item #1's criteria for the "declared but unverified" shape. The
enumeration is **frozen** to the merged runbook's Assertions Checklist (V17) — that document is the
authoritative record of what #1 claimed. Each row states how the criterion is verified *after* this
item lands.

| #1 criterion (abbreviated) | Verified by, after this item | Action in #35 |
| --- | --- | --- |
| AC1 — `pnpm install` succeeds from a clean clone with no manual repair | `pnpm install` + `postinstall` layout check (Decision 3) | Strengthened: "succeeds" now also means "produces a usable tree" |
| AC2 — root `pnpm lint` / `typecheck` / `test` cover app and packages | Existing CI jobs | None |
| AC3 — each package builds/develops/cleans/lints alone | Existing CI + Turbo | None |
| AC4 — `pnpm dev:mobile:ios` boots the app in the iOS Simulator | **Human run, never performed** | **Evidence E6, or explicit written reclassification (Decision 7)** |
| AC5 — every MVP route exists and is reachable | `route-manifest-parity.test.ts`, `route-inventory.test.ts` | None |
| AC6 — no route for out-of-MVP screens | Same route tests | None |
| AC7 — a deliberate restricted import fails lint with the message | **Manual runbook step only** | **Automated by Decision 5** |
| AC8 — the PR shows lint / typecheck / test individually | Three separate CI jobs | None (the new `bundle` job adds a fourth) |
| AC9 — checks install from the committed lockfile | `pnpm install --frozen-lockfile` in CI | None; V7 confirms this item does not disturb it |
| AC10 — no browser e2e on the PR | Absence of the workflow | None |
| AC11 — markdown lint / format commands unchanged | `markdown-lint.yml` | None |
| AC12 — no credential, amount, schema or scraping logic introduced | Human review | None |
| AC13 — workspace names/layout/commands match `2-repo-architecture.md` | Human review | Touched: the doc is updated here, so the correspondence is re-checked as part of the docs step |
| AC14 — exactly two tabs, no `(auth)` group | `route-inventory.test.ts` | None |

**Residual, stated deliberately**: AC2, AC3, AC5, AC6, AC8–AC12 and AC14 are already backed by a
machine check or are one-time review facts, so #35 adds nothing for them. The two rows the issue
names (AC4, AC7) are the only genuine instances of the pattern, and both are addressed above. This
audit covers all 14 rows; no row is skipped without a reason in the table.

---

## Layer-by-Layer Changes

### Database / Data Layer

- None. This item introduces no schema, no migration, no seed data.

### Backend / API

- None. There is no backend.

### Frontend / UI

- No source change in `apps/mobile/src/` or `apps/mobile/app/` — those directories belong to items
  #2 and #3 in this batch and are not touched.
- [ ] `apps/mobile/metro.config.js` — comment-only edit: line 2 cites
      "`.npmrc` `node-linker=hoisted`", which becomes false. Point it at
      `pnpm-workspace.yaml` `nodeLinker: hoisted` and at `pnpm check:layout`. No code change.

### Shared Packages / Libraries

- [ ] `packages/shared-domain/src/domain-purity-lint.test.ts` — new. The three cases of
      Decision 5 (AC5).
- [ ] `packages/shared-domain/package.json` — add `eslint` (`^9.39.5`) and `@types/node`
      (`^26.1.2`) to `devDependencies`, matching versions already resolved in the lockfile (V16).
- [ ] `pnpm-lock.yaml` — regenerated by `pnpm install` after the devDependency addition. Expect
      only the `packages/shared-domain` importer block to change (V16 predicts no new package
      resolution).

### Infrastructure / Configuration

- [ ] `pnpm-workspace.yaml` — add `nodeLinker: hoisted` with a comment explaining that pnpm 11
      reads settings here and not from `.npmrc` (Decision 1, AC1).
- [ ] `.npmrc` — **delete** (Decision 1). Its only line is inert under pnpm 11.
- [ ] `scripts/check-node-linker-layout.mjs` — new, executable-by-`node`, zero dependencies.
      Assertions A/B/C and `REQUIRED_ROOT_MODULES` per Decision 2 (AC2).
- [ ] `package.json` (root) — add `check:layout` and `postinstall` scripts (Decision 3, AC1/AC2).
- [ ] `.github/workflows/ci.yml` — add the `bundle` job of Decision 4 (AC3/AC4). Reuse the exact
      pinned action SHAs already in the file; do not bump them in this item.

### Documentation

Listed here and executed by the developer during implementation (see
[Documentation Updates](#documentation-updates)).

---

## Testing Strategy

**Test types**: Unit (Jest), CI integration (GitHub Actions), manual/native smoke (macOS + iOS
Simulator). No new test framework is introduced.

### Automated coverage

| Control | Mechanism | Runs in | Criterion |
| --- | --- | --- | --- |
| Hoisted layout is declared where pnpm reads it | `check-node-linker-layout.mjs` assertion A | `pnpm check:layout`, `postinstall`, CI `bundle` job | AC1, AC2 |
| Installed tree is actually hoisted | assertions B and C | same | AC1, AC2 |
| App can bundle | `expo export:embed --eager --platform ios --dev false` | CI `bundle` job | AC3 |
| Domain purity rule fires | `packages/shared-domain/src/domain-purity-lint.test.ts` | `pnpm test`, CI `test` job | AC5 |

### Proof-of-failure evidence (required artifacts)

Each item below must be executed during implementation and its output captured in the PR
description. "Confirmed by inspection" is not acceptable for any of them (Decision 6).

**E1 — the layout check fails on a deliberately isolated tree** (AC2):

```bash
pnpm install --node-linker=isolated --ignore-scripts   # deliberately wrong; skip postinstall
pnpm check:layout                                       # EXPECT: exit 1, FAIL lines for B and C
pnpm install                                            # plain, no flags — this also proves AC1
pnpm check:layout                                       # EXPECT: exit 0, three ok lines
```

Capture both `check:layout` outputs and both exit codes.

**E2 — a plain install cannot end isolated** (AC1, enforcement half of Decision 3):

```bash
pnpm install --node-linker=isolated                     # postinstall NOT skipped
echo "exit=$?"                                          # EXPECT: non-zero; install itself fails
pnpm install                                            # restore
```

**E3 — the bundle command fails on a deliberately isolated tree, locally** (AC4):

```bash
pnpm install --node-linker=isolated --ignore-scripts
cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false
# EXPECT: non-zero exit, "Unable to resolve \"@expo/metro-runtime\" from expo-router/entry-classic.js"
cd ../.. && pnpm install
cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false
# EXPECT: success; record module count, bundle size, asset count
```

**E4 — the bundle job fails in CI on a deliberately isolated tree** (AC4, the CI half):

On the implementation PR branch, push one scratch commit that flips `pnpm-workspace.yaml` to
`nodeLinker: isolated`, let the `bundle` job run, record the **failing run URL** and the failing
step, then revert that commit in the next push and record the **passing run URL**. Both URLs go in
the PR description. This is the only way to prove the job fires in the environment it will guard;
a green job on a correct tree proves nothing on its own.

**E5 — the ESLint control is proved to fire, and proved to be able to fail** (AC5):

```bash
pnpm --filter @finanzas/shared-domain test              # EXPECT: pass, including the new file
# mutation: temporarily empty the `patterns` group of `sharedDomainPurity` in eslint.config.mjs
pnpm --filter @finanzas/shared-domain test              # EXPECT: fail on case 1
git checkout -- eslint.config.mjs                       # restore
pnpm --filter @finanzas/shared-domain test              # EXPECT: pass again
```

**E6 — the native sequence, run end to end** (AC6, AC7): see
[Native setup sequence](#native-setup-sequence-to-be-executed-not-asserted) below. Record the
terminal transcript, the tool versions, and a screenshot or `xcrun simctl` output showing the app
running in the simulator. If any step cannot be executed in the implementation environment, apply
Decision 7 and leave AC6/AC7 open in writing.

### Native setup sequence (to be executed, not asserted)

This is the **starting hypothesis** for the sequence that lands in
`docs/project/2-repo-architecture.md`. The implementer runs it, fixes what breaks, and documents
what actually worked — including any step below that turns out to be unnecessary or wrong.

```bash
node -v                                   # 22.x, per .nvmrc
pnpm install                              # plain; postinstall runs the layout check
pnpm check:layout                         # explicit confirmation
cd apps/mobile
pnpm exec expo prebuild --platform ios --clean   # creates ios/, runs pod install; --clean is the
                                                 # answer to "prebuild refuses on an existing ios/"
# if CocoaPods is out of sync after the module tree changed:
cd ios && pod install --repo-update && cd ..
pnpm exec expo run:ios                    # builds and boots the simulator
# alternative once a dev build exists:
cd ../.. && pnpm dev:mobile:ios
```

Known failure modes to document alongside it (all four named in the issue): the linker setting
being ignored (now impossible — the check fires), CocoaPods out of sync after the module tree
changes, `ios/` absent on a fresh clone because it is gitignored, and `expo prebuild` refusing to
run over an existing `ios/` directory without `--clean`.

### Residual verification before `ready-for-human-review`

- **Evidence source**: the E1–E6 artifacts in the implementation PR description. The reviewer
  checks presence and content, not just the claim.
- **Sweep residual**: the [Item #1 acceptance-criteria audit](#item-1-acceptance-criteria-audit)
  table covers all 14 of item #1's criteria; rows marked "None" are explicit out-of-scope
  decisions with a stated reason, not omissions.
- **Stale-reference residual**: re-run the V18 query after the edits and confirm the only remaining
  `node-linker` / `.npmrc` hits are in item #1's merged plan (a historical document that is not
  rewritten) — no live config, script, comment or current doc may still point at `.npmrc`.
- **Open criteria**: if AC6/AC7 are left open under Decision 7, the PR description must say so in
  the same words used in the runbook, and the issue must carry a comment stating what remains
  unverified.

**Smoke test runbook**:
`docs/testing/mobile/35-pnpm-hoisted-layout-ci-bundle-check.smoke-test.md`

**Regression suite**: no automated regression suite exists for this repository (the Playwright
`e2e/` placeholder is deliberately disabled; device flows are Maestro and arrive with #22). No
regression spec is added.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| — | None. This item introduces no database and no product data. | — |

---

## Documentation Updates

To be executed by the developer during implementation, not now.

- [ ] `docs/project/2-repo-architecture.md` — (a) rewrite **Environment Setup** with the sequence
      actually executed in E6, its tool versions, and the four failure modes with their fixes;
      (b) **Common Commands** — add `pnpm check:layout` and the local bundle command
      `cd apps/mobile && pnpm exec expo export:embed --eager --platform ios --dev false`;
      (c) repository tree line 52 — remove `.npmrc`; (d) **Conventions inherited from
      `zeki-platform`** — state that `pnpm-workspace.yaml` declares `nodeLinker: hoisted` and why
      pnpm 11 will not read it from `.npmrc`.
- [ ] `docs/project/3-software-architecture.md` — Testing Strategy overview table: add the
      toolchain tier (layout check + iOS bundle check, run in CI) so the tiers listed match what
      CI actually runs.
- [ ] `AGENTS.md` — Common Commands block: add `pnpm check:layout`; Troubleshooting table: add a
      row for `Unable to resolve "@expo/metro-runtime"` → isolated `node_modules` layout → run
      `pnpm check:layout`, then `pnpm install`.
- [ ] `docs/testing/mobile/1-bootstrap-monorepo-expo-app.smoke-test.md` — record the outcome of
      item #1's AC4 (simulator) and AC7 (restricted import): either "executed under #35 on
      <date>, evidence in <PR/issue link>" or the explicit statement of what remains unverified
      (Decision 7). Do not tick a box without a link.
- [ ] `CHANGELOG.md` — see Implementation Order step 9.
- [ ] Not updated: item #1's merged implementation plan
      (`docs/specs/developments/20260801113404_1-bootstrap-monorepo-expo-app/`). It is a historical
      record of what was decided then; its `.npmrc` references stay as written.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `expo export:embed --eager` needs arguments or native files we did not anticipate on a Linux runner | Medium | Medium | Run E3 locally **before** pushing the CI job. Documented fallbacks, in order: add explicit `--bundle-output`/`--assets-dest` under `apps/mobile/.expo/` (already gitignored, V20); or substitute `pnpm exec expo export --platform ios --dev false`, which exercises the same Metro resolution and fails on the same missing module. Record in the PR which form was used and why |
| `pnpm exec expo` cannot find the `expo` binary from `apps/mobile` in CI | Low | Medium | `expo` is a direct dependency of `@finanzas/mobile` and, under the hoisted linker, is also at the root `node_modules/.bin`. E3 exercises the exact command locally first. Fallback: `pnpm --filter @finanzas/mobile exec expo …` from the root |
| Root `postinstall` failing makes `pnpm install` fail in an unfamiliar way | Medium | Low | Intended behaviour, but the failure message must be actionable: each FAIL line names the file to fix and the command to re-run. `--ignore-scripts` is documented as the escape hatch |
| The bundle job slows every PR | Medium | Low | `timeout-minutes: 20`, runs in parallel with the other three jobs, `cache: pnpm` reused. Bundling ~1000 modules is a low-minutes job |
| Lockfile conflicts with the concurrently running items #2, #3, #6 | Medium | Low | The only lockfile change is the `packages/shared-domain` importer block (V16). On conflict, take both sides' importer entries and re-run `pnpm install --lockfile-only`, then re-run `pnpm check:layout` |
| The implementation environment has no Xcode/simulator, so AC6/AC7 cannot be closed | Low (V19 shows Xcode 26.6 and 7 simulators on the planning machine) | Medium | Decision 7: leave the criteria open **in writing** with a precise statement of what was and was not executed. Never close by inspection |
| CocoaPods or Xcode version drift makes the documented sequence stale later | Medium | Low | Record tool versions next to the sequence so a future reader can date it |
| `.modules.yaml` format changes in a future pnpm | Low | Low | Assertion B fails with an explicit "unexpected format — this script expects pnpm 11" message rather than passing silently; assertion C is format-independent |
| E4's scratch commit is forgotten on the branch | Low | High | The revert commit is part of the same step; the reviewer checks that the final diff contains `nodeLinker: hoisted`, and CI's own final run is the passing URL recorded in the PR |

---

## Code Samples

All samples in this document are **illustrative** — adapt during implementation.

```js
// Illustrative — scripts/check-node-linker-layout.mjs (shape, not final code).
// Node 22 built-ins only: this must run when the install is broken.
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED_ROOT_MODULES = ['@expo/metro-runtime', 'react-native'];

// A — pnpm 11 reads settings from pnpm-workspace.yaml, never from .npmrc.
// B — node_modules/.modules.yaml is JSON under pnpm 11 and records the linker used.
// C — the modules Metro resolves from the workspace root must be real directories.
// Each failure prints what to fix and which command to re-run; process.exitCode = 1 on any FAIL.
```

```yaml
# Illustrative — the new job in .github/workflows/ci.yml.
# Reuse the pinned action SHAs already present in that file; do not bump them here.
bundle:
  name: iOS bundle
  runs-on: ubuntu-latest
  timeout-minutes: 20
  steps:
    - name: Checkout
      uses: actions/checkout@<same SHA as the other jobs> # v5
    - name: Setup pnpm
      uses: pnpm/action-setup@<same SHA as the other jobs> # v4
    - name: Setup Node.js
      uses: actions/setup-node@<same SHA as the other jobs> # v6
      with:
        node-version-file: .nvmrc
        cache: pnpm
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    - name: Check node_modules layout
      run: pnpm check:layout
    - name: Bundle iOS (Metro only, no native build)
      working-directory: apps/mobile
      run: pnpm exec expo export:embed --eager --platform ios --dev false
```

```yaml
# Illustrative — pnpm-workspace.yaml after the change.
packages:
  - 'apps/*'
  - 'packages/*'
# pnpm 11 reads its settings from this file. A `node-linker` line in .npmrc is silently
# ignored (see implementation plan for #35), which is why the app could not bundle.
# Metro resolves from the workspace root with disableHierarchicalLookup, so the tree must
# be hoisted. Enforced by `pnpm check:layout` (also run as postinstall and in CI).
nodeLinker: hoisted
allowBuilds:
  unrs-resolver: true
```

---

## Implementation Order

Steps 1–3 must land together — see the brief: a forced layout without a bundle check is
unverified, and a bundle check without the layout fix fails for the original reason.

### Step 1 — Make the hoisted layout apply (AC1)

1. Add `nodeLinker: hoisted` to `pnpm-workspace.yaml` with the explanatory comment; delete
   `.npmrc`.
2. Run `pnpm install` (plain, no flags). **Verify**: the install succeeds and
   `ls node_modules/@expo/metro-runtime` resolves at the workspace root.
3. **Verify**: `pnpm config get nodeLinker` prints `hoisted` (it prints `undefined` before this
   step — V3).
4. **Verify**: `git status` shows `pnpm-lock.yaml` unchanged by the linker switch (V7). If the
   lockfile did change, stop and investigate before continuing.

### Step 2 — Add the layout check and wire it up (AC2)

1. Write `scripts/check-node-linker-layout.mjs` per Decision 2.
2. Add `check:layout` and `postinstall` to the root `package.json` (Decision 3).
3. Execute **E1** and **E2** and capture the output. Do not proceed until the check has been seen
   to fail on an isolated tree and pass on a hoisted one.
4. **Verify**: `pnpm check:layout` run from `apps/mobile/` behaves identically to running it from
   the root (the script resolves its own repo root).

### Step 3 — Add the CI bundle job (AC3, AC4)

1. Execute **E3** locally first; settle the exact command form (see the Risks row on
   `--eager`) before touching CI.
2. Add the `bundle` job to `.github/workflows/ci.yml` per Decision 4, reusing the existing pinned
   action SHAs.
3. After the PR is open, execute **E4**: scratch commit flipping `nodeLinker` to `isolated`,
   record the failing run URL and failing step, revert, record the passing run URL.
4. **Verify**: the PR checks list shows four jobs (`Lint`, `Type check`, `Test`, `iOS bundle`),
   each reporting individually (this also preserves item #1's AC8).

### Step 4 — Prove the domain-purity rule fires (AC5)

1. Add `eslint` and `@types/node` to `packages/shared-domain/package.json` devDependencies at the
   versions already in the lockfile (V16); run `pnpm install`.
2. Write `packages/shared-domain/src/domain-purity-lint.test.ts` with the three cases of
   Decision 5.
3. Execute **E5** including the mutation run. Capture the failing output.
4. **Verify**: `pnpm lint` and `pnpm typecheck` still pass at the root — the new test file lives
   inside the linted, type-checked package.

### Step 5 — Run the native sequence end to end (AC6, AC7)

1. Execute **E6** from the [Native setup sequence](#native-setup-sequence-to-be-executed-not-asserted),
   correcting it as reality requires.
2. Capture: terminal transcript, `node -v`, `pnpm -v`, `xcodebuild -version`, `pod --version`,
   `sw_vers -productVersion`, and evidence of the app running in the simulator.
3. If the environment cannot reach a booted simulator, apply Decision 7 — write down what was and
   was not executed and leave AC6/AC7 open. Do not tick them.
4. Update `apps/mobile/metro.config.js`'s stale comment (Layer-by-Layer → Frontend / UI).

### Step 6 — Documentation

1. Apply every item in [Documentation Updates](#documentation-updates).
2. **Verify**: re-run the V18 stale-reference query; the only surviving `.npmrc` /
   `node-linker` mentions are in item #1's merged plan.
3. **Verify**: run the repository's markdown checks on the edited documents —
   `node_modules/.bin/markdownlint-cli2` on the changed `.md` files, and
   `python3 scripts/lint/markdown-heuristic-lint.py` over them.

### Step 7 — Smoke test

Execute `docs/testing/mobile/35-pnpm-hoisted-layout-ci-bundle-check.smoke-test.md` end to end and
record the result, including which assertions are left open.

### Step 8 — Evidence roll-up

Paste E1–E6 (output blocks and CI run URLs) into the implementation PR description under an
`Evidence` heading, one subsection per item, each naming the acceptance criterion it discharges.

### Step 9 — CHANGELOG

Add to `CHANGELOG.md` under `[Unreleased]`, in a `### Fixed` section (create it directly below the
existing `### Added` section if it does not exist yet — do not add a second `### Added`), exactly:

```markdown
- **Fix the pnpm hoisted layout and add a CI bundle check** (#35): `nodeLinker: hoisted` now lives
  in `pnpm-workspace.yaml`, where pnpm 11 actually reads it — a plain `pnpm install` produces the
  hoisted layout the Expo/Metro resolver needs, and `.npmrc` (which pnpm 11 silently ignored) is
  gone. A new `pnpm check:layout` check runs on every install and in CI, a new `iOS bundle` CI job
  runs `expo export:embed` so a tree that cannot build the app can no longer be green, and a test
  now proves the `@finanzas/shared-domain` import restriction rejects a deliberate violation.
```

---

## Open Questions

None blocking. Two items resolve during implementation and must be recorded in the PR:

1. The exact `expo export:embed --eager` invocation that works on `ubuntu-latest` (settled by E3
   plus the first CI run; fallbacks in Risks).
2. Whether the native sequence reaches a booted simulator in the implementation environment —
   answered by E6, with Decision 7 as the written fallback.
