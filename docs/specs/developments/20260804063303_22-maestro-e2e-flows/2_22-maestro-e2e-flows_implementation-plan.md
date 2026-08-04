# Maestro end-to-end flows — Implementation Plan

**Work item**: [lhpaul/personal-finances#22](https://github.com/lhpaul/personal-finances/issues/22) — `Type: Refactor` (scope:infra)
**Spec**: None. This is a **Refactor-route** item — the specification is the work item brief
(issue #22 body), reproduced verbatim under [Work Item Brief](#work-item-brief).
**Smoke test runbook**: `docs/testing/mobile/22-maestro-e2e-flows.smoke-test.md`
**Depends on**: #13 (merged), #16 (merged), #20 (**not merged** — PR #91 open; see
[D2](#d2--flow-scope-is-what-is-merged-on-develop-everything-else-is-a-declared-extension)).

---

## Work Item Brief

Recorded so this plan is self-contained and every change below cites a criterion.

> ## Scope
>
> `.maestro/` flows for the happy paths: onboarding through bank connection, a categorization
> session, excluding a movement, and re-syncing.
>
> Uses a seeded fixture database and a stubbed scraper — no real bank, no real credentials.
>
> ## Acceptance criteria
>
> - **AC1**: Flows run against a booted simulator via `maestro test .maestro/`
> - **AC2**: No real credential appears in any flow file
> - **AC3**: Documented in a smoke-test runbook under `docs/testing/`
>
> ## Depends on
>
> - #13
> - #16
> - #20

### Planning constraints recorded at dispatch

- Never a real bank credential in a flow file, a fixture, a log or a CI secret. The suite reaches
  the credential form with a **fixture** RUT and password and never reaches a real bank.
- Flows are designed around the `__DEV__` fixture surfaces the screen items already shipped, not
  around host-side database surgery.
- The CI half is **explicitly contingent on macOS runner capacity**. It is wired but disabled by
  default and flagged as an owner decision — see
  [Owner decision required](#owner-decision-required-ci-runner-capacity).
- Screens still in flight (#18, #19, #20, #21) get **declared extensions**, not blocking
  dependencies.

---

## Summary

**Approach**: `.maestro/` does not exist yet. This item creates it as a **contract-driven flow
suite**, following the shape the design-fidelity gate (#47) already established for the mockup
comparison: a machine-readable contract (`.maestro/flow-contract.json`) enumerates every flow,
the deterministic fixture state it needs, the screens it covers and whether it is `wired` or
`planned`; two Node validators (`scripts/e2e/flow-contract.mjs`, `scripts/e2e/flow-lint.mjs`)
prove the contract and the flow files agree and that no credential-shaped literal and no
unknown copy selector ever enters `.maestro/`; and those two validators plus their unit tests run
in the ordinary CI `test` job, with **no simulator**. The device leg — `maestro test .maestro/` —
runs locally from `scripts/e2e/run-e2e.sh` and, in CI, from a new label-gated `maestro-ios` job in
`e2e-regression.yml` that is inert until the owner opts in.

Determinism comes from the app itself, not from `sqlite3` surgery on the simulator container.
Three `__DEV__` fixture panels already exist (`/(dev)/sample-data`, `/(dev)/connect-fixtures`,
`/(dev)/sync-fixtures`); this item adds a fourth, `/(dev)/e2e-fixtures`, that exposes exactly the
named states the suite needs, each idempotent and reachable by deep link — plus one new stubbed
scraper script, `complete_with_data`, that returns a deterministic non-empty `ScrapeResult` so
"sync → home with data" and "re-sync is idempotent" run through the **real** sync engine write
path instead of being faked at the database.

**Estimated complexity**: L

**Rationale**: three separable pieces (in-app fixture surface + Node contract/lint tier +
`.maestro/` suite and runner), a new CI job on a runner class this repository has never used, and
six device flows that each need a first-run confirmation pass on a simulator. Nothing here is
architecturally deep; the size is breadth plus device iteration.

**Dependencies**: #13 (merged), #16 (merged), and the screens each flow traverses (#8, #9, #10,
#11, #12, #14, #15, #17 — all merged). #20 is listed as a dependency on the issue but is **not
merged**; its flow is declared as an extension so this item is not blocked. No external service
dependency: the suite never reaches a network.

---

## Verification Log

Every scope statement below is derived from these commands, run in the item worktree.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `23da690` (branch `implementation-plan/22-maestro-e2e-flows`, created from `origin/develop`) |
| `.maestro/` exists? | `git ls-files \| grep -i maestro` | **No match** — the directory is not tracked and does not exist on disk. This item creates it |
| Maestro CLI available | `maestro --version` | `2.6.0` at `/Users/lhpaul/.maestro/bin/maestro` |
| Simulator available | `xcrun simctl list devices booted` | `Finanzas Fidelity` booted on iOS 26.5 (the #47 profile device) |
| `__DEV__` fixture routes | `git ls-files 'apps/mobile/app/(dev)/*.tsx'` (excluding tests) | 4 routes: `connect-fixtures.tsx`, `gallery.tsx`, `sample-data.tsx`, `sync-fixtures.tsx` |
| Stubbed scraper scripts | `SyncFixtureScriptId` in `apps/mobile/src/dev/scripted-runner.ts` | 9 ids: 3 `hold_*`, `play_full`, `complete`, 4 `fail_*`. All return **empty** `products`/`movements` |
| Deterministic SQL fixtures | `git ls-files apps/mobile/src/db/__fixtures__` | `store-v1.sql`, `stage-queue-v1.sql`, `transaction-detail-v1.sql` (plus JSON read fixtures for the sync engine) |
| How SQL fixtures are applied today | `docs/testing/mobile/13-categorization-flow.smoke-test.md` Step 0 | Host-side `sqlite3 "$DB_PATH" < …` into the simulator container. Only `store-v1.sql` has an in-app loader (`/(dev)/sample-data`) |
| Screen `testID` coverage | `grep -rn "testID" apps/mobile/app apps/mobile/src --include="*.tsx"` | Root `fidelityTestId(...)` anchors on 13 screens; `home`, the three onboarding screens and every settings screen have **none** |
| Fidelity target status | `jq` over `scripts/mobile-ui/fidelity-targets.json` | 36 `wired`, 28 `planned`. `home` and `onboarding-*` are still `planned` despite #8/#12 being merged |
| Copy catalogue size | `apps/mobile/src/i18n/es.json` key count | 591 flat keys. Copy is the only stable selector surface on screens without a `testID` |
| Merged screen items on `develop` | `gh pr list --state all` | Merged: #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, #24, #47. **Open**: #89 (#19 settings hub), #91 (#20 settings banks), #92 (`fix/76`). Not started: #18, #21 |
| Existing regression workflow | `.github/workflows/e2e-regression.yml` | Label-gated on `ready-for-regression` **and** `vars.ENABLE_TEMPLATE_PLACEHOLDER_REGRESSION == 'true'`; runs the template's Playwright placeholder in `e2e/` on `ubuntu-latest` |
| `ready-for-regression` label exists | `gh label list` | Present (`#e4e669`, "PR is ready for regression testing") |
| Duplicate artifact check | `gh pr list --state open` | No open PR for issue #22 |
| Resolved review runner | YAML parse of `.ai-dev-workflow.yaml` + `.ai-dev-workflow.local.yaml` | Repo `on_draft.runner: [codex]`; local override (gitignored) `on_draft.runner: [claude]`. Parsed with `python3 -c "import yaml…"`, not `grep` (the file's own warning) |

### Claims requiring first-run confirmation on device

These are **not** verified by the commands above. The implementer confirms each on the first
device run and records the result in the runbook's *Known Limitations* section rather than
assuming it.

1. **`clearState` on iOS**: whether `launchApp: { clearState: true }` in Maestro 2.6.0 clears the
   `expo-sqlite` database file **and** the `expo-secure-store` keychain items for
   `cl.finanzas.mobile`. The suite does not depend on the keychain half — the
   `reset` fixture state deletes the credential entries explicitly (D6) — but the observed
   behaviour must be written down.
2. **Deep-link form**: the fidelity gate uses `finanzas:///bank-picker` (three slashes) and the
   #12/#11 runbooks use `finanzas://sample-data` (two). Both are reported working. The flows
   standardise on the three-slash form (D5); the implementer confirms every link resolves.
3. **Metro requirement**: a Debug (`__DEV__`) build is mandatory because every fixture surface is
   `__DEV__`-guarded, so a JS bundle server must be reachable at launch. The exact wait condition
   (`http://localhost:8081/status` returning `packager-status:running`) is confirmed on first run.
4. **Tap targets**: the `Button` primitive sets `accessibilityLabel={label}` and renders the same
   string, so `tapOn: "<copy>"` is expected to resolve. Rows (`TransactionRow`, `CategoryChip`)
   are confirmed individually.

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Plan artifact base branch | `develop` | `AGENTS.md` → *Git & Branching*; branch created from `origin/develop` | 2026-08-04T10:33Z, repo `23da690` | Current invocation (item #22) only | `Verified` |
| Which MVP screens exist on `develop` (drives which flows can be written now) | #8, #9, #10, #11, #12, #13, #14, #15, #16, #17 merged; #19 and #20 open; #18 and #21 not started | `gh pr list --state all`; `apps/mobile/app/settings/index.tsx` is still a `RoutePlaceholder` at `23da690` | 2026-08-04T10:33Z, repo `23da690` | Same-surface open PRs only: #89 (#19), #91 (#20), #92 | `Verified` |
| Ownership of `.github/workflows/e2e-regression.yml` and the `ready-for-regression` gate | This item is the only in-flight change to the regression workflow | `gh pr view {89,91,92} --json files` — none touches `.github/workflows/**` | 2026-08-04T10:33Z, repo `23da690` | Same-surface open PRs only: #89, #91, #92 | `Verified` |
| Ownership of `apps/mobile/src/dev/**` (the fixture surface this item extends) | Only `src/dev/DesignSystemGallery.tsx` is touched by an open PR (#89); no open PR touches `sample-store.ts`, `sync-fixtures-store.ts`, `connect-fixtures-store.ts` or `scripted-runner.ts` | `gh pr view 89 --json files` | 2026-08-04T10:33Z, repo `23da690` | Same-surface open PRs only: #89, #91, #92 | `Verified` |

No conflict found. The dispatch note that "settings hub+wipe #19 is merged" does **not** match
`origin/develop` at `23da690` — PR #89 is open. That divergence is recorded here rather than
encoded silently: the settings-wipe flow is declared `planned` in the contract and promoted by
whichever run finds #19 merged (D2, Implementation Order step 12).

---

## Decisions

### D1 — The suite is contract-driven, mirroring the #47 fidelity gate

`.maestro/flow-contract.json` is the single source for: the declared fixture states, the flow
list (id, file, fixture state, covered `screen_id`s, status, owning issue), the fixture credential
constants, and the data-derived selector allowlist. `scripts/e2e/flow-contract.mjs` validates it;
`scripts/e2e/flow-lint.mjs` scans the flow files against it. Both run in CI with no simulator, in
the existing `test` job — exactly the split `fidelity:contract` / `fidelity:test` already uses.

Rejected alternative: a bare folder of YAML files. It cannot express "this flow is waiting on
#21", cannot mechanically prove AC2, and gives a future feature no place to register its flow.

### D2 — Flow scope is what is merged on `develop`; everything else is a declared extension

Six flows are `wired` in this item. Four are declared `planned`, each naming the issue that must
promote it. A `planned` entry is a contract row with `file` set and `status: "planned"`; the
validator requires the file to exist **only** for `wired` rows, and `maestro test .maestro/`
never sees a `planned` flow because `.maestro/config.yaml` enumerates the wired files explicitly.

Promotion is a three-line change (write the file, flip `status`, add the file to
`.maestro/config.yaml`) and is listed as an obligation in `.maestro/README.md` the same way #47's
`planned` → `wired` obligation is documented in `docs/best-practices/stack/mobile-ui-fidelity.md`.

### D3 — Debug (`__DEV__`) simulator build only; a release build cannot run this suite

Every fixture surface — the four `(dev)` routes, the stubbed scraper, the new panel — returns
`null` or `null`-equivalent when `__DEV__` is false, by design (AGENTS.md non-negotiable 7 and the
route guards in `app/(dev)/*.tsx`). A release build therefore has **no** deterministic entry
point, and no flow in this suite can run against one. This is stated in the runbook prerequisites
and in the CI job comments so nobody later "optimises" the job onto a release artifact.

Consequence: a Metro dev server must be running and reachable when the app launches. The runner
script checks it before invoking `maestro` and fails with an actionable message rather than
letting a red box become a mysterious `assertVisible` timeout.

### D4 — A dedicated simulator named `Finanzas E2E`

`scripts/e2e/run-e2e.sh` resolves the target device by exact name `Finanzas E2E`, falling back
through the same device-type list `scripts/mobile-ui/fidelity-targets.json` already declares
(`iPhone 16`, `iPhone 15`, `iPhone 14`) and printing the exact `xcrun simctl create` command when
it finds none — the behaviour of `scripts/mobile-ui/capture-simulator.sh`, deliberately copied.

Two reasons this is not `Finanzas Fidelity`: the `reset` fixture state deletes secure-store
entries (D6), which must never happen on a device someone is mid-way through a fidelity capture
on; and an E2E run leaves the database in a flow-specific state, which would silently corrupt a
subsequent `pnpm fidelity` comparison. `--allow-any-device` exists as an explicit escape hatch and
prints a warning.

### D5 — Deterministic state is injected in-app, by deep link, never by host-side `sqlite3`

Today the categorization and transaction-detail runbooks tell the tester to stop the app, find the
container, and pipe a `.sql` file into it. That is fine for a human runbook and unusable from a
flow: Maestro has no shell command, so the state would have to be set up outside the flow, which
makes a flow non-self-contained and non-repeatable.

Instead, flows open `finanzas:///e2e-fixtures`, tap one named state, and continue. Deep links use
the three-slash form (`finanzas:///<route>`) throughout, matching the fidelity gate's proven
`xcrun simctl openurl` usage.

### D6 — The five named fixture states (the fixture contract)

`/(dev)/e2e-fixtures` exposes exactly these, each **idempotent** (running it twice converges on
the same state) and each composed from the existing dev stores wherever one exists:

| State id | What it establishes | Built from |
| --- | --- | --- |
| `reset` | First launch: `app_settings.onboarding_completed` cleared, the sample fixture's connection/movement rows reset, secure-store entries for `banco-de-chile` and `santander` deleted, any installed scraper script cleared | new `src/db/dev-e2e-fixture.ts` + existing `clearSampleFixture` + `deleteCredentials` + `clearScript` |
| `synced-home` | Onboarding complete and `store-v1.sql` loaded — home, transactions and dashboard have data | existing `loadSampleData` + the onboarding flag write |
| `stage-queue` | Onboarding complete and `stage-queue-v1.sql` applied — 4 pending movements for a categorization session | new `src/db/dev-e2e-fixture.ts` (inlined `.sql`) |
| `transaction-detail` | Onboarding complete and `transaction-detail-v1.sql` applied — the categorized / uncategorized / excluded rows #16's runbook uses | new `src/db/dev-e2e-fixture.ts` (inlined `.sql`) |
| `scripted-read` | Onboarding complete, a fixture connection exists, and the `complete_with_data` script is installed, ready for a sync run | existing `ensureFixtureConnection` + `installScript` |

`.sql` text is inlined at bundle time by `babel-plugin-inline-import`, the mechanism
`src/dev/sample-store.ts` already uses for `store-v1.sql` — no new build machinery.

**Extension rule, stated in `.maestro/README.md` and enforced by the contract validator**: a
future feature that needs a new device state adds a row to `E2E_FIXTURE_STATES` **and** declares
it in `.maestro/flow-contract.json`. A flow may not reference a state that is not declared, and a
declared state that no flow uses is a validation error — so the fixture surface cannot rot.

### D7 — `reset` deletes credentials; that is why D4 exists

`reset` calls `deleteCredentials` unconditionally for the two fixture institutions rather than
using `connect-fixtures-store.ts`'s "restore whatever was there before" bookkeeping. It has to:
flow 01 types a credential into the **real** form, so the entry it must remove was not written by
that module and is not tracked by it.

The blast radius is bounded by D4 (a dedicated simulator), by the panel copy, which says so, and
by the runbook, which says so. This is recorded as an accepted risk, not an oversight.

### D8 — One new stubbed script, `complete_with_data`, feeding the real sync engine

`scripted-runner.ts`'s nine existing scripts all return `products: []` and `movements: []` — they
were built to make the syncing **screen** reachable, not to produce data. A tenth id,
`complete_with_data`, returns a deterministic `ScrapeResult` built by a new pure module,
`src/dev/e2e-read-fixture.ts`. Because the scripted path is checked **before** `readCredentials`
in `ScraperAttemptController`, the result flows through `runSync` → `applySyncWrite` → the dedup
upsert exactly as a genuine read would, with no keychain access and no WebView mount.

This is what makes two acceptance-relevant assertions real rather than staged: "sync → home with
data" and "re-syncing is idempotent" (brief scope; AGENTS.md non-negotiable 4).

### D9 — Fixture identity is frozen; fixture dates are offsets from the run's local day

`store-v1.sql` and `buildDemoMovements` both anchor on literal `2026-01` dates. That is correct
for a hand-run runbook and wrong for a suite that must pass in any month: home and dashboard scope
their reads to the **current** month, so a January-anchored fixture makes every current-month
assertion an assertion about zero.

`e2e-read-fixture.ts` therefore freezes everything that constitutes movement identity — product
`instanceId`s, `rawDescription`s, `amountMinorUnits`, `direction`, `currencyCode` — as literals,
and derives `dateLocal` as a fixed negative day-offset from an anchor. The anchor is
`deriveDateLocal(new Date())` **memoised at module scope on first call**, so every read within one
app session shares one anchor and a re-sync inside a session is bit-identical (which is the
property the idempotency flow asserts). A test-only reset clears the memo.

Consequence, stated in the runbook: two runs on different calendar days produce different
`dateLocal` values and therefore different dedup hashes. That is correct behaviour, not a leak —
each run starts from `reset`.

### D10 — Selectors are Spanish copy from `es.json`, plus a small declared data allowlist

13 screens carry a root `fidelityTestId(...)` anchor; `home`, the onboarding screens and every
settings screen carry none, and the `Button` primitive does not forward `testID` at all. Adding
`testID`s would mean editing product screens owned by items that are merged (#8, #12) or in flight
(#19, #20) for the benefit of the test tier.

This item touches **no product screen**. Flows select by the accessibility label / visible text
that `es.json` already supplies (the same string the mockup declares — AGENTS.md non-negotiable
8), and `flow-lint.mjs` proves every selector string is either an exact `es.json` value or a
declared `data_selectors` entry naming the fixture that produces it. Copy drift then fails a
cheap CI check instead of a 40-minute device run.

Two hazards this makes explicit rather than hiding: `onboarding_intro.cta` and
`onboarding_ready.cta` are both `Comenzar`, and `categorize.exclude_title` and
`transaction_detail.action_exclude` are both `Excluir del análisis`. Every flow therefore asserts
a screen-unique anchor **before** tapping an ambiguous label. Copy containing an interpolation
placeholder (`{{count}}`) is not a legal selector; the validator rejects it.

Missing `testID`s on `home` and the onboarding screens are recorded as an observation for the
owning items, not fixed here.

### D11 — `.maestro/config.yaml` enumerates the wired flows, so `maestro test .maestro/` is exact

AC1 asks for `maestro test .maestro/`. Pointed at a directory, Maestro would otherwise also try to
execute `shared/*.yaml`, which are subflows, not flows. `.maestro/config.yaml`'s `flows:` list
names the six wired files, so the AC1 command runs the suite and nothing else. The runner script
invokes the same command — there is one execution path, not two.

### D12 — Two Node validators, one shared file walk, both in the existing CI `test` job

- `scripts/e2e/flow-contract.mjs` — structural: every declared state is used, every used state is
  declared, every `wired` flow file exists, every file on disk is declared, every `screen_id`
  exists in `design/mockups/mobile/mockup-manifest.js`, every `planned` row names an issue.
- `scripts/e2e/flow-lint.mjs` — textual: the AC2 credential scan and the D10 selector check.

They ship as `pnpm e2e:contract` and `pnpm e2e:lint`, with `pnpm e2e:test` running their
`node --test` suites — three steps appended to the CI `test` job, alongside the fidelity and
mockup-manifest steps already there. No macOS, no simulator, no cost.

### D13 — AC2 is enforced by shape rules with no suppression directive

`flow-lint.mjs` implements three credential rules over every file under `.maestro/`, recursively:

- **R1 — RUT shape**: `\d{1,2}\.\d{3}\.\d{3}-[\dkK]` and `\d{7,8}-[\dkK]`, anywhere in the file,
  including inside comments. Allowed only if the literal equals `credential_fixtures.rut`.
- **R2 — credential-shaped YAML key**: a line whose key is `password`, `clave`, `contraseña`,
  `contrasena`, `secret`, `token` or `apiKey` with a literal scalar value. Allowed only if the
  value equals `credential_fixtures.password`, or is a `${…}` reference (no literal present).
- **R3 — real-bank host**: a hostname under `bancochile.cl` (or any host in the contract's
  `forbidden_hosts` list). Never allowed. Matches hosts only, so the prose "Banco de Chile" and
  the `banco-de-chile` institution id do not trip it.

**Suppression semantics**: none. There is no inline directive, no `disable-next-line`, no
allowlist beyond the two declared fixture constants and `forbidden_hosts`. A credential scanner
with a mute button is a credential scanner with a hole. This is a deliberate design decision and
is stated in `scripts/e2e/flow-lint.mjs`'s module comment.

### D14 — CI is wired, doubly gated, and off by default

A new `maestro-ios` job joins `.github/workflows/e2e-regression.yml`, gated on **both** the
existing `ready-for-regression` label condition **and** a new repository variable
`vars.ENABLE_MAESTRO_E2E == 'true'` — the same "declared but inert until the owner opts in"
pattern `vars.ENABLE_TEMPLATE_PLACEHOLDER_REGRESSION` already uses in that file, and the same
posture #23's plan takes for `EXPO_TOKEN`. With the variable unset, the job does not start and
bills nothing.

The template's Playwright placeholder job is left untouched: `docs/project/2-repo-architecture.md`
already records that this product has no web surface and that the placeholder stays disabled.
The workflow's `name:` drops "(Template Placeholder)" because it will no longer be only that.

### D15 — CI builds the app on the runner; EAS-artifact reuse is a documented follow-up

The `maestro-ios` job runs `expo prebuild` → `xcodebuild -sdk iphonesimulator -configuration
Debug` → `simctl install` → start Metro → `pnpm e2e`. That is self-contained and depends on
nothing outside this repository.

The cheaper long-run option — download a simulator build produced by #23's EAS `development`
profile instead of compiling on the runner — is recorded in the runbook and in
`docs/project/3-software-architecture.md` as a follow-up, not adopted here: #23 is not merged, and
a Debug build with `__DEV__` true and a reachable Metro (D3) is not the artifact its `development`
profile is defined to produce today.

### D16 — Maestro is pinned

`MAESTRO_VERSION: 2.6.0` (the locally verified version) is an env var in the CI job and the
default in `scripts/e2e/run-e2e.sh`, which warns when the local CLI reports a different version.
An unpinned `curl … | bash` installer is how a green suite turns red on a Tuesday.

### D17 — Artifacts land under `.tmp/`

`scripts/e2e/run-e2e.sh` passes `--debug-output .tmp/e2e` (already gitignored, and the directory
the fidelity gate uses). CI uploads that directory with `if: failure()`.

### D18 — No product code, no schema change, no migration

The only `apps/mobile` changes are `__DEV__`-only modules, one new `__DEV__` route, two new i18n
key groups, and one added union member in the `__DEV__` stubbed-scraper module. No table, no
column, no migration, no production code path. AGENTS.md non-negotiable 5 is untouched by
construction.

---

## Layer-by-Layer Changes

### Database / Data Layer

- [ ] `apps/mobile/src/db/dev-e2e-fixture.ts` (new) — the only place in this item allowed to touch
      SQL, mirroring `dev-fixture.ts` / `dev-connect-fixture.ts`. Exports:
      `applyFixtureSql(db, sql)` (statement-per-line application of an inlined `.sql` delta, the
      files being `INSERT OR REPLACE` by construction), `setOnboardingCompleted(db, value)`, and
      `resetE2eState(db, fixtureSql)` (delegates row handling to `clearSampleFixture` so
      non-negotiable 3 — movements are excluded, never deleted — is stated in exactly one place).
- [ ] No migration, no schema change, no seed change. `apps/mobile/drizzle/` is untouched.

### Shared Packages / Libraries

- [ ] None. `@finanzas/shared-domain`, `@finanzas/shared-utils` and `@finanzas/bank-scraper` are
      unchanged; `e2e-read-fixture.ts` **imports** `ScrapeResult` from `@finanzas/bank-scraper` and
      `deriveDateLocal` from `@finanzas/shared-utils` without modifying either.

### Frontend / UI (`apps/mobile`, all `__DEV__`-only)

- [ ] `apps/mobile/app/(dev)/e2e-fixtures.tsx` (new) — route guard in the exact shape of
      `app/(dev)/sample-data.tsx`: hook-free, returns `null` when `__DEV__` is false, `require()`s
      the panel **inside** the guard so Metro drops it from a release bundle.
- [ ] `apps/mobile/src/dev/E2eFixtures.tsx` (new) — one `Button` per declared fixture state plus a
      success/error line, following `SampleDataPanel.tsx` literally (literal `t()` keys only).
- [ ] `apps/mobile/src/dev/e2e-fixture-store.ts` (new) — `getAppDatabase()`-calling wrappers, the
      `app/ → feature hooks → src/db` layering applied to a dev surface. Exports
      `E2E_FIXTURE_STATES` (the ordered id list) and `applyE2eFixtureState(id, port?)`. The
      optional `SecureStorePort` parameter mirrors `connect-fixtures-store.ts` so the credential
      half is testable without `expo-secure-store`.
- [ ] `apps/mobile/src/dev/e2e-read-fixture.ts` (new) — pure builder for the deterministic
      `ScrapeResult` (D9): 2 products, 6 movements (5 debit, 1 credit) across the current and
      previous local month, frozen identity fields, memoised anchor,
      `__resetE2eReadFixtureForTests()`.
- [ ] `apps/mobile/src/dev/scripted-runner.ts` (edit) — add `'complete_with_data'` to
      `SyncFixtureScriptId` and one branch that emits the same progress sequence as `play_full`
      but settles with `buildE2eScrapeResult()`. `SCRIPTS` in `SyncFixtures.tsx` and
      `SCRIPT_ACTION_KEY` gain the matching entry (the `satisfies Record<SyncFixtureScriptId, …>`
      constraint makes omitting it a type error).
- [ ] `apps/mobile/src/i18n/es.json` and `en.json` (edit) — `dev.e2e_fixtures.*` (title,
      description, one action key per state, success, error) and
      `dev.sync_fixtures.complete_with_data_action`. `es` is primary; these are dev-surface
      strings with no mockup, so `en` mirrors them.
- [ ] **No product screen is edited.** No `testID` is added to `app/**` or to
      `src/components/ui/**` (D10).

### Test tier (`.maestro/`, new)

- [ ] `.maestro/config.yaml` — `flows:` enumerating the six wired files (D11); `appId`.
- [ ] `.maestro/flow-contract.json` — `schema_version`, `app_id`, `fixture_states`,
      `credential_fixtures`, `forbidden_hosts`, `data_selectors`, `flows`.
- [ ] `.maestro/README.md` — how to run the suite, the extension obligation (D2/D6), the
      selector rule (D10), and the "never a real credential" rule (D13).
- [ ] `.maestro/shared/reset.yaml` — `launchApp` with `clearState`, then apply the `reset` state.
- [ ] `.maestro/shared/fixture.yaml` — parameterised subflow: open `finanzas:///e2e-fixtures`,
      tap the state passed as `STATE_LABEL`, assert its success line.
- [ ] `.maestro/flows/01-onboarding-connect.yaml` — `reset` → intro → 3 value pages → connect
      intro → picker (Banco de Chile) → credentials (fixture RUT/password) → syncing (scripted
      `complete_with_data`) → bank connected → ready → lands on the stage intro.
- [ ] `.maestro/flows/02-home-with-data.yaml` — `synced-home` → home: hero, financial summary,
      trend card, category breakdown, recent movements, connected banks.
- [ ] `.maestro/flows/03-categorize-batch.yaml` — `stage-queue` → stage intro → categorise the
      four pending movements (suggested chip + `Siguiente →`, one `Omitir`) → completion screen →
      `Continuar a inicio`.
- [ ] `.maestro/flows/04-transaction-detail-exclude.yaml` — `transaction-detail` → transactions
      list → open a movement → `Excluir del análisis` → choose a reason → confirm → detail shows
      the excluded badge and note.
- [ ] `.maestro/flows/05-dashboard.yaml` — `synced-home` → dashboard → month/week segment →
      spending overview and category report render.
- [ ] `.maestro/flows/06-resync-idempotent.yaml` — `scripted-read` → sync → record the
      transactions month-header count → `scripted-read` again → sync again → the same count
      (non-negotiable 4).
- [ ] Declared `planned` (files not written here): `07-settings-wipe.yaml` (#19),
      `08-settings-banks.yaml` (#20), `09-settings-categories.yaml` (#21),
      `10-notifications.yaml` (#18).

### Toolchain (`scripts/e2e/`, new)

- [ ] `scripts/e2e/flow-contract.mjs` — exports `validateFlowContract({ root })`; CLI entry prints
      a summary table and exits non-zero on any violation.
- [ ] `scripts/e2e/flow-lint.mjs` — exports `scanFlows({ root })` returning per-occurrence
      findings; CLI entry prints `file:line:rule` and exits non-zero on any finding.
- [ ] `scripts/e2e/flow-contract.test.mjs`, `scripts/e2e/flow-lint.test.mjs` — `node --test`.
- [ ] `scripts/e2e/run-e2e.sh` — **shell contract: `bash`** (`#!/usr/bin/env bash`, `set -euo
      pipefail`, arrays and `[[ ]]`, invoked as `bash scripts/e2e/run-e2e.sh`, matching
      `scripts/mobile-ui/capture-simulator.sh` and `verify-gate.sh`). Resolves the `Finanzas E2E`
      device (D4), checks Metro, checks the app is installed, warns on a Maestro version mismatch
      (D16), then runs `maestro test .maestro/ --debug-output .tmp/e2e`, forwarding extra
      arguments so a single flow can be run during development.
- [ ] The diff-aware snippet linter must pass on the new shell guidance:
      `python3 scripts/lint/workflow-shell-snippet-lint.py --base-ref origin/develop`.

### Infrastructure / Configuration

- [ ] `package.json` (root) — four scripts: `e2e:contract`, `e2e:lint`, `e2e:test`, `e2e`.
- [ ] `.github/workflows/ci.yml` — three steps appended to the `test` job: *E2E flow contract*,
      *E2E flow lint*, *E2E toolchain unit tests*.
- [ ] `.github/workflows/e2e-regression.yml` — `name:` updated; new `maestro-ios` job on
      `macos-15`, gated per D14, `timeout-minutes: 60`, artifact upload on failure. The existing
      placeholder job is untouched.
- [ ] No new secret. No environment variable beyond the opt-in repository variable
      `ENABLE_MAESTRO_E2E` and the pinned `MAESTRO_VERSION`.

### Documentation

- [ ] Listed in [Documentation Updates](#documentation-updates); not written during Plan Ready.

---

## Testing Strategy

**Test types**: Unit (`node --test` for the two validators; Jest for the new `__DEV__` modules),
Device E2E (the suite itself), Smoke (the runbook).

### Key scenarios

Each maps to a brief criterion or to a scope sentence in the brief.

1. `maestro test .maestro/` runs six flows to green against a booted simulator — **AC1**.
2. `pnpm e2e:lint` fails on a planted non-fixture RUT, on a planted `password:` literal, and on a
   planted real-bank host — **AC2**, proven in both directions.
3. The runbook walks the whole suite, including the local build prerequisites — **AC3**.
4. Onboarding through bank connection completes with no real bank and no real credential — brief
   scope sentence 1.
5. A categorization session moves four pending movements to done — brief scope sentence 1.
6. Excluding a movement is visible on the detail screen afterwards — brief scope sentence 1.
7. Re-syncing the same scripted read leaves the movement count unchanged — brief scope sentence 1
   and AGENTS.md non-negotiable 4.
8. Every fixture state is idempotent: applying it twice in one session leaves the same state.

### Unit tests — toolchain

`scripts/e2e/flow-contract.test.mjs`:

- a valid contract passes;
- a `wired` row whose file is missing fails; a `planned` row whose file is missing passes;
- a flow referencing an undeclared fixture state fails;
- a declared fixture state no flow uses fails;
- a `screen_id` absent from the mockup manifest fails;
- a flow file present on disk but absent from the contract fails;
- an empty `.maestro/flows` directory fails loudly (a broken walk must not pass vacuously —
  the assertion `db-access-boundary.test.ts` already makes for its own file walk).

`apps/mobile/src/db/__tests__/dev-e2e-fixture.test.ts` (Jest `db` project, real SQLite),
`apps/mobile/src/dev/__tests__/e2e-read-fixture.test.ts` and
`apps/mobile/src/dev/__tests__/e2e-fixture-store.test.ts` (with an in-memory `SecureStorePort`):

- `applyFixtureSql` is idempotent — applying `stage-queue-v1.sql` twice yields identical rows;
- `resetE2eState` excludes fixture movements and never deletes a `transactions` row;
- `setOnboardingCompleted(false)` makes `isOnboardingCompleted` false;
- `buildE2eScrapeResult()` returns bit-identical output on repeated calls within a session;
- its `dateLocal` values fall in the current and previous local month for a frozen clock;
- `complete_with_data` settles exactly once and never calls `readCredentials`;
- `E2E_FIXTURE_STATES` equals the `fixture_states` ids declared in `.maestro/flow-contract.json`
  (the two halves of the fixture contract cannot drift).

### Parser-risk addendum

**Classification**: applicable. `scripts/e2e/flow-lint.mjs` is a regex scanner over structured
text (YAML, JSON, Markdown) living in a tooling path, and it is the mechanism that proves AC2.

**Edge-case enumeration** (`scripts/e2e/flow-lint.test.mjs`, one automated test per case, planted
input and planted-clean counterpart where the case is a negative):

| Case | Input | Expected |
| --- | --- | --- |
| E1 | `rut: "12.345.678-5"` (the declared fixture RUT) | no finding |
| E2 | `rut: "11.111.111-1"` | R1 finding |
| E3 | `rut: "12345678-5"` (unformatted, dashed) | R1 finding |
| E4 | `12.345.678-K` and `12.345.678-k` | R1 finding for both — the check digit is case-insensitive |
| E5 | `# real RUT 9.876.543-3` inside a YAML comment | R1 finding — a comment is not an escape hatch |
| E6 | two non-fixture RUTs on one line | two findings, each with its own column — per-occurrence reporting, matching `peso-total-scan.ts`'s precedent |
| E7 | `password: "ZZE2EPASSZZ"` (the declared fixture password) | no finding |
| E8 | `password: "hunter2"` | R2 finding |
| E9 | `password: ${E2E_PASSWORD}` | no finding — no literal is present |
| E10 | `- tapOn: "Clave de internet"` (copy that contains a credential word in a selector value, not as a key) | no finding — R2 matches keys, not values |
| E11 | `passwordless: true` | no finding — the key must match exactly |
| E12 | `https://portalpersonas.bancochile.cl/…` | R3 finding |
| E13 | the prose `Banco de Chile` and the id `banco-de-chile` | no finding — R3 matches hosts |
| E14 | a credential-shaped literal in `.maestro/shared/fixture.yaml` and in `.maestro/README.md` | findings — the walk is recursive and extension-agnostic |
| E15 | a file with CRLF line endings | scanned; line numbers correct |
| E16 | selector text equal to an `es.json` value | no finding |
| E17 | selector text matching no `es.json` value and no `data_selectors` entry | selector finding, naming the file and line |
| E18 | selector text equal to an `es.json` value that contains `{{count}}` | selector finding — interpolated copy is not a legal selector (D10) |
| E19 | selector text listed in `data_selectors` | no finding |
| E20 | an empty `.maestro/` tree | hard error — the scanner must not pass vacuously |

**Suppression semantics**: **none**, deliberately (D13). No inline directive is recognised, in any
position; the only permitted exceptions are the two `credential_fixtures` constants and the
`data_selectors` allowlist, both declared in `.maestro/flow-contract.json` and both reviewable in
one place. Because there is no directive, there is no multi-suppression-on-one-line behaviour to
define.

### Concurrent-event-source addendum

**Classification**: applicable, narrowly — `complete_with_data` schedules timers inside
`runInstalledScript`, whose handle can race a `cancel()`, and `e2e-read-fixture.ts` holds a
module-level memoised anchor shared across runs.

- **Shared mutable state guards**: the only new shared state is the memoised date anchor in
  `e2e-read-fixture.ts`. It is written once, on first read, and never mutated afterwards
  (write-once, then read-only); a test-only reset is the sole other writer. `installedScript`
  remains a single module-level slot written only from the panel, unchanged by this item.
- **Re-entrancy / in-flight tracking**: unchanged. `use-bank-sync.ts`'s `inFlightRef` and
  `ScraperAttemptController`'s `attemptId` already serialise attempts; `complete_with_data` adds a
  branch inside the existing controller, not a new entry point.
- **Event deduplication**: the existing `settle()` once-only guard covers the new branch — a
  scheduled settle after a `cancel()` is dropped, exactly as for `play_full`. The new branch adds
  no new `onResult` call site outside `settle()`.
- **Listener and resource cleanup**: the new branch pushes its timers into the same `timers` array
  `cancel()` clears. No listener, subscription or native handle is added.
- **Race conditions at initialization**: a deep link can land on `bank-syncing` before the fixture
  state finishes applying. Flows do not do this — `shared/fixture.yaml` asserts the panel's
  success line before returning, which is the ordering barrier.
- **Race conditions at teardown**: leaving the syncing screen mid-script cancels through the
  existing handle and settles `cancelled`; the flows never do it, and the behaviour is unchanged.
- **Error propagation across async boundaries**: `applyE2eFixtureState` rejects into the panel's
  own `try`/`catch`, which renders the error line — so a failed fixture application fails the flow
  at the `assertVisible` of the success line, loudly, instead of leaving a green run on wrong data.
- **New concurrent patterns**: none. Every mechanism above already exists in
  `scripted-runner.ts` / `scraper-attempt-controller.ts`.

### Design assets

Discovered per `docs/workflow/development-workflow/design-assets.md`: issue #22 has no
`## Design assets` section, no tracker attachment and no linked file. The repository's mockups
(`design/mockups/mobile/`) declare no screen for a `__DEV__` fixture panel, and the product screens
the flows traverse are already covered by #47's pixel-diff gate under their own items. The runbook
therefore contains **no** expected-vs-actual fidelity step, and no baseline is invented.

### Regression suite

This item **is** a regression tier. Its own regression protection is `pnpm e2e:contract`,
`pnpm e2e:lint` and `pnpm e2e:test` in the CI `test` job on every PR; the device suite is
label-gated (D14).

---

## Residual verification strategy

The flow set is a completeness claim ("the flows that matter"), so residual coverage must be
evidenced, not asserted:

- **Evidence source**: `pnpm e2e:contract` prints one row per declared flow with its status,
  fixture state, covered `screen_id`s and owning issue. The implementation PR attaches that table.
- **Residual definition**: every MVP `screen_id` in `design/mockups/mobile/mockup-manifest.js`
  that no `wired` flow covers must appear either in a `planned` contract row naming the issue that
  will cover it, or in the contract's `exclusions` array with a reason — the same
  covered/planned/excluded trichotomy `scripts/mobile-ui/fidelity-targets.json` uses. The
  validator fails when a screen is in none of the three.
- **Before `ready-for-human-review`**: the PR body carries the contract table plus the
  `maestro test .maestro/` output showing six flows passing, and states which screens are residual
  and why.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Bootstrapped store snapshot | 1 connection, 3 products, 13 movements, full starter catalogue — home, transactions, dashboard | `apps/mobile/src/db/__fixtures__/store-v1.sql` (existing, unchanged) |
| Categorization queue | 4 pending + 9 categorized movements, 2 merchants, ids prefixed `stage-` | `apps/mobile/src/db/__fixtures__/stage-queue-v1.sql` (existing, unchanged) |
| Transaction detail rows | categorized / uncategorized / excluded movements at fixed ids | `apps/mobile/src/db/__fixtures__/transaction-detail-v1.sql` (existing, unchanged) |
| Deterministic scraper read | 2 products (1 checking, 1 credit card), 6 movements: 5 debit + 1 credit, frozen descriptions and amounts, `dateLocal` at fixed offsets from the run's local day (D9) | `apps/mobile/src/dev/e2e-read-fixture.ts` (new) |
| Fixture credential | RUT `12.345.678-5` (valid check digit — the same value #9's runbook and `connect-fixtures-store.ts` use), password `ZZE2EPASSZZ`. Declared once, in `.maestro/flow-contract.json` → `credential_fixtures`, and typed by flow 01 into the real form | `.maestro/flow-contract.json` (new) |
| Named device states | `reset`, `synced-home`, `stage-queue`, `transaction-detail`, `scripted-read` (D6) | `apps/mobile/src/dev/e2e-fixture-store.ts` (new) |

No seed file is modified. Every new fixture is additive and `__DEV__`-only.

---

## Documentation Updates

To be performed by the developer during implementation, not now.

- [ ] `docs/project/3-software-architecture.md` — the *Device E2E* row still reads "Happy paths
      only: onboarding, categorization, exclusion"; replace with the actual flow list and the
      contract/lint tier. The *Automated Suite* block advertises
      `pnpm --filter @finanzas/mobile exec maestro test .maestro/`, which is wrong — Maestro is not
      a workspace dependency (`docs/best-practices/stack/turborepo-pnpm.md` says so explicitly).
      Replace with `pnpm e2e` and the AC1 command `maestro test .maestro/`. Add the
      `ENABLE_MAESTRO_E2E` gate and the EAS-artifact follow-up (D15).
- [ ] `docs/project/2-repo-architecture.md` — `.maestro/` is annotated "arrives with #22"; drop the
      annotation and describe the layout. Extend *A note on `e2e/`* to say the label-gated workflow
      now also carries the (opt-in) Maestro job.
- [ ] `docs/best-practices/3-testing.md` — add a short *Device E2E* section: the selector rule
      (D10), the fixture-state extension obligation (D6), and the no-real-credential rule (D13).
- [ ] `docs/best-practices/stack/turborepo-pnpm.md` — the `.maestro/` row says "no scripts"; the
      root now owns `e2e`, `e2e:contract`, `e2e:lint`, `e2e:test`.
- [ ] `AGENTS.md` — add the four `pnpm e2e*` commands to *Common Commands*, and one
      *Troubleshooting* row: a flow that fails at the first `assertVisible` usually means Metro is
      not running or the build is not a Debug build (D3).
- [ ] `docs/testing/README.md` — Section 2's "committed spec" path is still a template TODO; point
      it at `.maestro/flows/` and `pnpm e2e` for mobile device tests.
- [ ] `docs/testing/mobile/13-categorization-flow.smoke-test.md` and
      `docs/testing/mobile/16-transaction-detail-exclusion.smoke-test.md` — add a one-line pointer
      that the `stage-queue` / `transaction-detail` states are now loadable in-app from
      `finanzas:///e2e-fixtures`, as a faster alternative to the host-side `sqlite3` step. Do not
      rewrite those runbooks.
- [ ] `CHANGELOG.md` — see Implementation Order step 14.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Maestro `clearState` does not clear the keychain on iOS, so flow 01 finds a locked RUT | Med | Med | The `reset` state deletes the credential entries explicitly (D6/D7); `clearState` is belt, not braces. Confirmed on first run and recorded in the runbook |
| Copy changes in `es.json` silently break flows | High over time | Med | `pnpm e2e:lint` fails in the ordinary CI job the moment a selector no longer matches a catalogue value (D10) — before any device run |
| Ambiguous copy (`Comenzar`, `Excluir del análisis`) taps the wrong element | Med | High (false green) | Every flow asserts a screen-unique anchor before an ambiguous tap (D10), and the runbook's assertion list names the anchor per flow |
| Fixed-date fixtures make current-month assertions vacuous | High | High (false green) | `e2e-read-fixture.ts` derives dates from the run's local day (D9); flows 02 and 05 assert against it, not against `store-v1.sql`'s January anchor |
| macOS CI cost | High if enabled | Med | Double gate: label **and** `ENABLE_MAESTRO_E2E` (D14). Off by default; owner decision recorded below |
| Runner build time (`expo prebuild` + `xcodebuild`) exceeds the job timeout | Med | Med | `timeout-minutes: 60`, artifact upload on failure, and the EAS-artifact alternative documented as the next step if it proves too slow (D15) |
| `reset` deletes a developer's own Banco de Chile credential | Low | Med | Dedicated `Finanzas E2E` simulator (D4), panel copy, runbook warning, and `--allow-any-device` required to run anywhere else |
| Flows drift out of sync with new screens | High over time | Med | `planned` contract rows name the owning issue; the validator fails when a manifest screen is neither covered, planned, nor excluded (Residual verification) |
| A future contributor adds a suppression comment to silence the credential scanner | Low | High | No directive exists to add (D13); the only exceptions are two declared constants |

---

## Code Samples

> Every sample below is **illustrative** — adapt during implementation.

### `.maestro/flow-contract.json` (illustrative — adapt during implementation)

```json
{
  "schema_version": 1,
  "app_id": "cl.finanzas.mobile",
  "credential_fixtures": {
    "rut": "12.345.678-5",
    "password": "ZZE2EPASSZZ",
    "note": "Fixture values. Never a real credential (issue #22 AC2)."
  },
  "forbidden_hosts": ["bancochile.cl", "portalpersonas.bancochile.cl"],
  "fixture_states": [
    { "id": "reset", "action_key": "dev.e2e_fixtures.reset_action" },
    { "id": "synced-home", "action_key": "dev.e2e_fixtures.synced_home_action" },
    { "id": "stage-queue", "action_key": "dev.e2e_fixtures.stage_queue_action" },
    { "id": "transaction-detail", "action_key": "dev.e2e_fixtures.transaction_detail_action" },
    { "id": "scripted-read", "action_key": "dev.e2e_fixtures.scripted_read_action" }
  ],
  "data_selectors": [
    { "text": "MercadoLibre Chile", "fixture_state": "stage-queue" },
    { "text": "Banco de Chile", "fixture_state": "synced-home" }
  ],
  "flows": [
    {
      "id": "01-onboarding-connect",
      "file": "flows/01-onboarding-connect.yaml",
      "fixture_state": "reset",
      "screens": ["onboarding-intro", "onboarding-value", "connect-bank-intro", "bank-picker", "bank-credentials", "bank-syncing", "bank-connected", "onboarding-ready"],
      "status": "wired",
      "issue": 22
    },
    {
      "id": "07-settings-wipe",
      "file": "flows/07-settings-wipe.yaml",
      "fixture_state": "synced-home",
      "screens": ["settings", "settings-account"],
      "status": "planned",
      "issue": 19
    }
  ],
  "exclusions": [
    { "screen_id": "ds-components", "reason": "Design-system reference page, not a product screen" }
  ]
}
```

### `.maestro/flows/01-onboarding-connect.yaml` (illustrative — adapt during implementation)

```yaml
appId: cl.finanzas.mobile
name: 01 first launch, onboarding and bank connection
tags:
  - core
---
- runFlow: ../shared/reset.yaml

# Onboarding. `Comenzar` is also onboarding-ready's CTA, so anchor first (D10).
- assertVisible: 'Bienvenido a Finanzas'
- tapOn: 'Comenzar'
- repeat:
    times: 3
    commands:
      - tapOn: 'Continuar'

# Install the stubbed read before entering the credential form: the scripted path is
# checked before readCredentials, so no keychain value is ever used (D8).
- runFlow:
    file: ../shared/fixture.yaml
    env:
      STATE_LABEL: 'Instalar lectura determinista'

- openLink: 'finanzas:///connect-bank'
- tapOn: 'Conectar con mi banco'
- assertVisible: 'Selecciona tu banco'
- tapOn: 'Banco de Chile'
- assertVisible: 'RUT'
- tapOn:
    below: 'RUT'
- inputText: '12.345.678-5'   # fixture RUT — flow-contract.json credential_fixtures.rut
- tapOn: 'Conectar'

- assertVisible: '¡Banco conectado!'
- tapOn: 'Estoy listo'
```

### `.github/workflows/e2e-regression.yml` — new job (illustrative — adapt during implementation)

```yaml
  maestro-ios:
    name: Maestro E2E (iOS simulator)
    # Doubly gated (D14): the ready-for-regression label AND an opt-in repository
    # variable, because macOS runners are billed at a multiple of Linux minutes.
    if: >-
      vars.ENABLE_MAESTRO_E2E == 'true' &&
      (
        (github.event.action == 'labeled' && github.event.label.name == 'ready-for-regression') ||
        (github.event.action != 'labeled' && contains(github.event.pull_request.labels.*.name, 'ready-for-regression'))
      )
    runs-on: macos-15
    timeout-minutes: 60
    env:
      MAESTRO_VERSION: 2.6.0
    steps:
      - name: Checkout
        uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
        with:
          persist-credentials: false
      # setup pnpm/node, pnpm install --frozen-lockfile, pnpm check:layout
      - name: Validate flow contract and flow lint
        run: |
          pnpm e2e:contract
          pnpm e2e:lint
      # xcode-select, simctl create/boot "Finanzas E2E",
      # expo prebuild, xcodebuild -sdk iphonesimulator -configuration Debug,
      # simctl install, start Metro and wait for packager-status:running
      - name: Run Maestro suite
        run: bash scripts/e2e/run-e2e.sh
      - name: Upload Maestro artifacts
        if: failure()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: maestro-debug-output
          path: .tmp/e2e
```

---

## Owner decision required (CI runner capacity)

The CI half of this item is written, wired and **inert**. Enabling it is the owner's call, and
this plan does not assume the answer.

- **What is being asked**: set the repository variable `ENABLE_MAESTRO_E2E` to `true`
  (`gh variable set ENABLE_MAESTRO_E2E --body true`). Until then, the `maestro-ios` job never
  starts and bills nothing.
- **Cost shape**: GitHub-hosted macOS minutes bill at a multiple of Linux minutes, and the job's
  dominant cost is the native build (`expo prebuild` + `xcodebuild`), not Maestro. The job only
  ever runs on a PR that already carries `ready-for-regression`, so the frequency is
  "once per item at the end", not "every push".
- **Alternatives, in the order the runbook records them**: (a) leave it off and run
  `pnpm e2e` locally at the regression step — the suite is fully usable this way and AC1 is
  satisfied locally; (b) enable it and accept the bill; (c) register a self-hosted macOS runner on
  the owner's machine and change `runs-on`, which is a one-line change; (d) once #23 lands, consume
  an EAS-built simulator artifact instead of compiling on the runner (D15).
- **Nothing in AC1–AC3 depends on this decision.** The acceptance command is a local one.

---

## Implementation Order

1. **Fixture data layer**: add `apps/mobile/src/db/dev-e2e-fixture.ts` and its Jest test. Verify:
   `pnpm --filter @finanzas/mobile test` passes and the new test proves double application is a
   no-op and that no `transactions` row is deleted.
2. **Deterministic read fixture**: add `apps/mobile/src/dev/e2e-read-fixture.ts` and its test.
   Verify: repeated calls in one session are identical, and dates land in the current and previous
   local month under a frozen clock.
3. **Stubbed script**: extend `scripted-runner.ts` with `complete_with_data`; add the
   `SCRIPTS` / `SCRIPT_ACTION_KEY` entries in `SyncFixtures.tsx` and the two i18n keys. Verify:
   `pnpm typecheck` passes (the `satisfies Record<SyncFixtureScriptId, …>` constraint is what
   catches an omission) and the existing `no-secure-store-import` guard still passes.
4. **Fixture store and panel**: add `src/dev/e2e-fixture-store.ts`, `src/dev/E2eFixtures.tsx`,
   `app/(dev)/e2e-fixtures.tsx`, the `dev.e2e_fixtures.*` keys in `es.json`/`en.json`, and the
   route guard test. Verify: `pnpm lint`, `pnpm typecheck`, `pnpm --filter @finanzas/mobile test`;
   and on the simulator, `finanzas:///e2e-fixtures` opens the panel and each button reports success.
5. **Contract**: write `.maestro/flow-contract.json` with all ten rows (six `wired`, four
   `planned`) and `.maestro/config.yaml`. At this point no flow file exists yet, so the contract's
   `wired` rows are written last in this step, immediately before step 7.
6. **Contract validator**: add `scripts/e2e/flow-contract.mjs` and `flow-contract.test.mjs`; wire
   `pnpm e2e:contract` and `pnpm e2e:test`. Verify: `pnpm e2e:test` passes and `pnpm e2e:contract`
   currently **fails** on the missing flow files — that failure is the proof the validator works;
   it goes green in step 8.
7. **Shared subflows**: `.maestro/shared/reset.yaml` and `.maestro/shared/fixture.yaml`.
8. **Flows, one at a time, each confirmed on the simulator before the next**: 01 → 02 → 03 → 04 →
   05 → 06. After each, run `bash scripts/e2e/run-e2e.sh .maestro/flows/<file>` and fix the
   selectors against reality. Verify at the end: `pnpm e2e:contract` is green and
   `maestro test .maestro/` runs exactly six flows.
9. **Runner script**: add `scripts/e2e/run-e2e.sh` (it can be written earlier and refined here) and
   `pnpm e2e`. Verify: `pnpm e2e` from a clean shell gives an actionable error when Metro is down,
   when the app is not installed, and when no `Finanzas E2E` device is booted — check all three.
   Then run `python3 scripts/lint/workflow-shell-snippet-lint.py --base-ref origin/develop`.
10. **Flow lint**: add `scripts/e2e/flow-lint.mjs` and `flow-lint.test.mjs` covering E1–E20; wire
    `pnpm e2e:lint`. Verify **in both directions**: the committed suite passes, and each of the
    three rules fails on a planted violation (the planted files live in the test's own fixtures,
    never in `.maestro/`).
11. **CI**: append the three steps to `ci.yml`'s `test` job and add the `maestro-ios` job to
    `e2e-regression.yml`. Verify: the PR's CI run shows the three new steps green, and the
    `maestro-ios` job is skipped (the repository variable is unset).
12. **Extension promotion check**: re-read `origin/develop`. If #19 has merged since this plan was
    written, write `.maestro/flows/07-settings-wipe.yaml` (the destructive flow — it runs **last**,
    after every other flow, because it wipes the store), flip its contract row to `wired`, and add
    it to `.maestro/config.yaml`. If #19 is still open, leave the row `planned` and note it in the
    PR body. Do the same check for #20 → flow 08.
13. **Docs**: perform every item in [Documentation Updates](#documentation-updates).
14. **CHANGELOG**: add under `[Unreleased]`, in the project's `**Bold Title** (#N):` format —

    ```markdown
    - **Maestro end-to-end flows** (#22): a contract-driven device E2E suite in `.maestro/` —
      six flows covering first-launch onboarding through bank connection, sync to a populated
      home, a categorization session, transaction detail and exclusion, the dashboard, and
      re-sync idempotency. Adds the `__DEV__` `/(dev)/e2e-fixtures` panel with five named,
      idempotent device states, a deterministic stubbed read (`complete_with_data`), and
      `pnpm e2e` / `e2e:contract` / `e2e:lint` / `e2e:test`. No flow file contains a real
      credential, and the credential scanner proves it in CI. The macOS `maestro-ios` job is
      wired but off until `ENABLE_MAESTRO_E2E` is set.
    ```

15. **Runbook**: walk `docs/testing/mobile/22-maestro-e2e-flows.smoke-test.md` end to end, record
    the first-run confirmations from
    [Claims requiring first-run confirmation on device](#claims-requiring-first-run-confirmation-on-device),
    and attach the `pnpm e2e:contract` table plus the `maestro test .maestro/` output to the PR.
</content>
</invoke>
