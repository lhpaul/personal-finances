# Design-fidelity gate: port the Zeki fidelity kit wired to the mockup manifest — Implementation Plan

**Work item**: [#47](https://github.com/lhpaul/personal-finances/issues/47) — `Workflow` type. The
issue body is the brief and replaces a spec (no `1_*_specs.md` exists for this item).
**Smoke test runbook**: [`docs/testing/mobile/47-design-fidelity-gate.smoke-test.md`](../../../testing/mobile/47-design-fidelity-gate.smoke-test.md)
**Reference implementation** (read-only, outside this repo): `~/Git/zeki/zeki-platform/scripts/mobile-ui/`

---

## Summary

**Approach**: Port the Zeki fidelity kit into `scripts/mobile-ui/`, driven by
`design/mockups/mobile/mockup-manifest.js` instead of a JSON manifest. A single contract file,
`scripts/mobile-ui/fidelity-targets.json`, enumerates every `mvp: true` screen/state pair as a
fidelity target with a per-screen mismatch threshold, and a validator (`pnpm fidelity:contract`)
fails when the contract and the manifest disagree — so a new mockup state cannot be added, and a
screen cannot be implemented, without the gate noticing. `pnpm fidelity --screen X --state Y`
captures the mockup with Playwright, captures the running dev build from the booted iOS
simulator with `xcrun simctl`, diffs them with pixelmatch, and **exits non-zero** when the
mismatch exceeds the target's threshold. The gate's own discriminating power is proved by
`pnpm fidelity:verify-gate`, a re-runnable script that asserts the comparison passes on a
faithful pair and fails on a deliberately broken one (wrong design token, wrong state).

**Estimated complexity**: M (1–3 days)

**Rationale**: Seven small Node/bash modules of known shape (the Zeki kit is a working
reference), one 64-entry contract file that is generated rather than hand-typed, ~35 unit tests,
and one genuinely uncertain piece of work — getting a native dev build onto a fidelity simulator
on this machine and proving the capture path end to end. No product behaviour changes; no
database, no domain logic, no screen implementation.

**Dependencies**: None blocking. Item #2 (theme and design-system primitives) and item #1
(bootstrap) are merged, which is all this needs. This item is a **prerequisite for the 13 screen
items** (#8, #9, #11–#21) and should land before the first of them reaches implementation.

**Deliberate non-goals** (v1, per the brief's "prefer a working v1 over completeness"):

- No CI simulator job. The device leg is a local command. See
  [Follow-ups](#follow-ups-explicitly-out-of-scope).
- No Maestro flow. Readiness is a screenshot-stability poll, not a `testID` assertion at
  runtime — although the contract does require a stable `testID` per wired target so the Maestro
  follow-up is a drop-in.
- No Android profile, no second device profile.
- No fixture-injection mechanism for data-dependent states beyond the existing bundled seed.

---

## Verification Log

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `6ab7d03` (`develop`, 2026-08-02) |
| MVP screen/state universe | `node -e "…"` over `design/mockups/mobile/mockup-manifest.js`, counting screens with `mvp !== false` and their states with `mvp !== false` | 36 screens total; **28 MVP screens**; **67 MVP screen/state targets** (a screen with no `states[]` counts as 1 stateless target) |
| State-level MVP exclusion | same query, listing states with `mvp === false` | exactly one: `categorize--advanced` |
| Screen ownership by issue | `gh issue view <n> --json body` for #8–#21, extracting `screen=<id>` occurrences | #8→3 screens, #9→4, #11→1, #12→1, #13→3, #14→1, #15→1, #16→1, #17→1, #18→2, #19→3, #20→2, #21→1 = 23 screens across **13 issues** |
| Unowned MVP screens | set difference of the above against the 28 MVP screens | `settings-notifications`, `ds-colors`, `ds-typography`, `ds-components` (see Decision 3 and Assumption A2) |
| Coverage after exclusions | same script with the seeded ownership map and the `ds-*` exclusion | **64 coverage targets** across **25 screens** and **13 coverage sets**; 64 covered + 3 `ds-*` excluded = 67 MVP targets |
| Simulator profile availability | `xcrun simctl list devicetypes \| grep -E "iPhone (14\|15\|16\|17)"` | `iPhone 14`, `iPhone 15`, `iPhone 16`, `iPhone 17` device types present |
| Booted simulator today | `xcrun simctl list devices booted` | `iPhone 17 (482DE8D1-…)` on iOS 26.5 — **402×874 pt**, does not match the mockup frame (Decision 5) |
| Installed runtimes | `xcrun simctl list runtimes` | iOS 18.2, 18.4, 18.5, 26.5 |
| Maestro present | `which maestro` | `/Users/lhpaul/.maestro/bin/maestro` (available, deliberately unused in v1 — Decision 6) |
| Playwright browsers cached | `ls ~/Library/Caches/ms-playwright` | multiple `chromium-*` builds present; a version-matched `npx playwright install chromium` is still a documented prerequisite |
| Mockup viewer API | `grep -n "window.go" design/mockups/mobile/index.html` | `window.go = go` at line 2751; `go(screenId, requestedStateId)` at line 2730 — same API the Zeki capture script drives |
| Mockup frame geometry | `grep -n -A3 "^    \.phone {" design/mockups/mobile/index.html` | `.phone { width: 393px; height: 852px; transform: scale(var(--phone-scale)) }` — capture must neutralise the scale, as the Zeki script already does |
| Token variable to mutate for the FAIL proof | `sed -n '/:root/,/}/p' design/mockups/mobile/index.html` | `--brand: #6366f1` (plus `--tab-active`, `--t-brand`, `--info` share that hex) |
| Template-owned vs project-owned surfaces | `sed -n '340,440p' .claude/commands/sync-template.md` | `REVIEW.md`, `docs/workflow/**`, `.claude/agents/**`, `.cursor/agents/**`, `.codex/skills/**`, `docs/best-practices/{1,2,3}-*.md` are **always-sync** (overwritten by `/sync-template`); `AGENTS.md`, `docs/project/`, `docs/best-practices/STACK-SPECIFIC.md`, `docs/best-practices/stack/` are project-specific (never overwritten). Drives Decision 8 |
| Existing fidelity doc | `docs/best-practices/stack/mobile-ui-fidelity.md` lines 38–39 | already says *"Tooling to automate this comparison (`mockups:capture`, `compare`) is tracked as a backlog item. Until it lands the check is manual, and the PR must say so."* — this item is that backlog item |
| Cross-cutting checklist live search | `grep -rl "02-generate-implementation-plan-protocol\|03-implement-development-protocol" .claude/agents/ .cursor/agents/ .codex/skills/ .agents/skills/` | `.claude/agents/{developer,tech-lead}.md`, `.cursor/agents/{developer,tech-lead}.md`, `.codex/skills/workflow-{implementer,plan-writer}/SKILL.md` — all **always-sync**, therefore excluded from the file list by Decision 8 |
| Same-surface open PRs | `gh pr list --state open` then `gh pr view <n> --json files` filtered to this plan's surfaces | #44 and #46 open; #46 touches none of them; #44 touches `AGENTS.md` only (different sections) |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Artifact base branch for this plan | `develop` | `AGENTS.md` → Git & Branching ("spec/plan/feature/fix PRs target `develop`"); repository mode is `single_repo` (no `repository_mode` key in `.ai-dev-workflow.yaml`) | 2026-08-02, repo `6ab7d03` | This invocation (item #47) only | `Verified` |
| Screen-item ownership of each MVP mockup screen (drives `coverage_sets[].issue`) | 13 issues: #8, #9, #11–#21 | Live `gh issue view` of each issue body's `#screen=` references, 2026-08-02 | 2026-08-02, repo `6ab7d03` | Open PRs #44 and #46; neither modifies `design/mockups/**` nor any issue-to-screen mapping | `Verified` |
| Files this plan will edit are not being rewritten by concurrent work | `scripts/mobile-ui/**` (new), `package.json`, `.github/workflows/ci.yml`, `docs/best-practices/stack/mobile-ui-fidelity.md`, `AGENTS.md` | `gh pr view 44/46 --json files` | 2026-08-02, repo `6ab7d03` | Same-surface files only, both open PRs | `Verified` — only `AGENTS.md` overlaps (PR #44), in different sections; implementation must make AGENTS.md edits additive and section-scoped |

### Implementation-start re-verification (mandatory before the first file edit)

Re-run the last two rows: `gh pr list --state open --json number` and, for each open PR,
`gh pr view <n> --json files`. If a PR now modifies `design/mockups/mobile/mockup-manifest.js`,
`scripts/mobile-ui/`, or `docs/best-practices/stack/mobile-ui-fidelity.md`, stop before editing
and return the evidence to the parent orchestrator (`Stale or conflicting`). A manifest change in
flight would silently change the 64-target universe this contract is seeded against.

---

## Key Decisions

### Decision 1 — The manifest is the source of truth; the contract may only ever be a *complete* projection of it

`scripts/mobile-ui/fidelity-contract.mjs` validates that

```text
{ all mvp:true screen/state pairs in the manifest }  ==  { coverage targets }  ∪  { exclusions }
```

with an empty intersection between coverage and exclusions. A manifest screen or state that is
neither covered nor explicitly excluded is a **hard validation failure**, and every exclusion
requires a `reason` string. This is the single most valuable property of the whole item: adding
a state to the mockups, or shipping a screen that quietly drops one, breaks `pnpm fidelity:contract`
in CI. It is also the residual-verification evidence for this plan (see
[Residual verification strategy](#residual-verification-strategy)).

### Decision 2 — Targets carry a lifecycle `status`, because no screen exists yet

Every route under `apps/mobile/app/` is currently a `RoutePlaceholder` (item #1 scaffolding). A
Zeki-style contract that requires `app_file` + `ready_test_id` for all 64 targets could not be
committed today. Each mapping therefore has:

- `status: "planned"` — registered against the manifest, not yet runnable. Must **not** carry
  `app_file`, `deep_link`, or `ready_test_id`. `run-fidelity.mjs` refuses to run it with a clear
  message naming the owning issue.
- `status: "wired"` — must carry all three; the validator asserts the file exists on disk and
  that the `ready_test_id` string literally appears in it, and that the deep link's
  `fidelityScreen` / `fidelityState` query parameters match the target.

Flipping a target from `planned` to `wired` is the concrete task each screen item inherits, and
it is machine-checked. All 64 targets start as `planned`.

### Decision 3 — `ds-colors`, `ds-typography`, `ds-components` are excluded, with a reason

These three manifest screens are `mvp: true` but their `route` values (`design-system/colors`,
`…/typography`, `…/components`) are documentation pages, not product routes. The app surface that
corresponds to them is the single `__DEV__`-only gallery route `/(dev)/gallery` (item #2), which
renders every primitive in one scroll — a 1:1 pixel comparison against three separate mockup
pages is not meaningful. They go in `exclusions` with that rationale, keeping the completeness
rule in Decision 1 satisfiable. `categorize--advanced` is excluded for the reason the manifest
itself gives (`mvp: false` at state level).

### Decision 4 — Thresholds live in the contract, per target, and may not be raised silently

`defaults.max_mismatch_pct = 3.0` and `defaults.pixel_threshold = 0.1` (pixelmatch per-pixel
colour tolerance). A mapping may override `max_mismatch_pct`; **any value above the default
requires a non-empty `threshold_note`**, and the validator rejects the contract otherwise. This
is the anti-gaming rule: the way to make a failing screen pass is to fix the screen, and if a
threshold genuinely must move, the reason is in the file and in the diff of the PR that moved it.
Seeded overrides (starting points, not measurements — nothing has been captured yet):

| Target(s) | `max_mismatch_pct` | `threshold_note` |
| --- | --- | --- |
| `home--*` | 5.0 | Donut chart antialiasing and the sparkline differ between SVG-in-Chromium and React Native rendering |
| `dashboard--*` | 5.0 | Same charts as `home`, plus the month/week bar series |
| `bank-syncing--*` | 6.0 | Progress animation is captured mid-flight; the frame is not deterministic |
| everything else | 3.0 (default) | — |

### Decision 5 — One profile, `iphone-393x852`, and a dedicated named simulator

The mockup frame is exactly `393×852` (verified above). The simulator booted on this machine
today is an iPhone 17 (`402×874`), which would force a resample on every comparison and hide real
layout drift. The kit therefore defines a single profile whose `simulator_name` is
`Finanzas Fidelity`, created from the first of `iPhone 16`, `iPhone 15`, `iPhone 14` that the
newest installed runtime accepts:

```bash
# Illustrative — adapt during implementation; the runbook records the runtime actually used.
xcrun simctl create "Finanzas Fidelity" "iPhone 16" "com.apple.CoreSimulator.SimRuntime.iOS-26-5"
```

`capture-simulator.sh` resolves the booted device **by name first**, then by device-type match,
and when neither is found prints the exact `simctl create` command rather than capturing the
wrong device. A capture whose logical size does not match the profile after normalisation is a
failure, not a resize.

### Decision 6 — `simctl` capture in v1; Maestro is a follow-up, but the `testID` contract is set now

Zeki drives the app with Maestro (`assertVisible: id: ${READY_TEST_ID}` then `takeScreenshot`).
Maestro is installed here, but it adds a moving part (Maestro × Expo dev client × iOS 26.5) to an
item whose whole job is to be trusted by 13 downstream items. v1 uses
`xcrun simctl openurl` + a screenshot-stability poll (see Decision 7) + `xcrun simctl io
screenshot` + `sips` normalisation. `ready_test_id` stays a **required, statically validated**
field for `wired` targets so screen items add a stable `testID` from day one and the Maestro
follow-up (#22, "Maestro end-to-end flows") is a drop-in replacement for one function.

### Decision 7 — Readiness is a stability poll with a floor, not a fixed sleep

After `openurl`, `capture-simulator.sh` waits `settle_ms` (default 2500, overridable per mapping),
then screenshots every 500 ms until two consecutive frames are byte-identical, up to a 20 s
ceiling. A fixed sleep either flakes on a cold Metro bundle or wastes seconds on every target;
the floor prevents locking onto a static splash screen. If the ceiling is hit without two stable
frames, the script fails loudly instead of capturing a mid-transition frame.

### Decision 8 — The review-flow wiring lives on project-owned surfaces only

`REVIEW.md`, `docs/workflow/**` (including `04-smoke-test-protocol.md`), `.claude/agents/**`,
`.cursor/agents/**`, `.codex/skills/**` and `docs/best-practices/3-testing.md` are **always-sync**
paths: `/sync-template` overwrites them from `lhpaul/ai-dev-framework-template`. A fidelity check
added there would be silently reverted at the next sync. The wiring is therefore:

1. **`docs/best-practices/stack/mobile-ui-fidelity.md`** (project-owned, already the canonical
   "how the UI contract is checked" doc, already linked from `STACK-SPECIFIC.md`) — replaces its
   "tooling is a backlog item, the check is manual" note with the automated gate, the commands,
   the threshold policy, and the required PR evidence block.
2. **`AGENTS.md`** non-negotiable #6 — extended so that "every UI item names the `#screen=…`
   it implements" also means "…registers its targets in `scripts/mobile-ui/fidelity-targets.json`,
   flips them to `wired`, and pastes the fidelity summary table into its PR".
3. **CI** (`.github/workflows/ci.yml`, project-owned) — `pnpm fidelity:contract` and
   `pnpm fidelity:test` run on every PR. No simulator, no browser; pure Node. This is what makes
   the gate non-optional: a screen PR that adds UI without registering or wiring its targets
   fails a required check.
4. The **framework hook already exists** and needs no edit: protocol `04` §3a ("Design fidelity
   steps (when present)") and `design-assets.md` already instruct the smoke tester to execute
   fidelity steps that a plan put in a runbook. Screen-item runbooks call `pnpm fidelity --issue N`;
   the framework consumes it as designed.

Consequence: the four always-sync agent/skill files found by the live search are **deliberately
not** in the file list. If the fidelity category should become framework-wide, that is an upstream
template item, not this one.

### Decision 9 — The app-side preview contract is two exported helpers, and nothing more

`apps/mobile/src/lib/fidelity-preview.ts`:

- `useFidelityPreview(): { active: boolean; state: string | null }` — reads the
  `fidelity` / `fidelityState` route params via `useLocalSearchParams()`; returns
  `{ active: false, state: null }` whenever `__DEV__` is false, so nothing about it can affect a
  release build.
- `fidelityTestId(screenId: string): string` — returns `fidelity-<screenId>`, the single source
  of the `ready_test_id` convention that the contract validates.

Screen items consume these; this item ships them with unit tests and no consumers. Without them,
"wired" would be undefined and each of the 13 screen items would invent its own preview hack.

### Decision 10 — The gate proves itself with `pnpm fidelity:verify-gate`, re-runnably

The house rule ("prove it fails on a deliberately broken screen and passes on a faithful build")
is implemented as a script, not a one-time manual ritual, so the proof survives refactors of the
comparator. It compares mockup captures against mockup captures — no simulator, no app — and
asserts *exit codes*, not just numbers. See
[Gate self-verification](#gate-self-verification-proving-both-directions).

---

## Layer-by-Layer Changes

### Tooling / scripts — `scripts/mobile-ui/` (new)

Shell contract for the two bash files in this item: `bash` (both declare `#!/usr/bin/env bash`
and are invoked as `bash scripts/mobile-ui/…`; they use `[[ ]]`, arrays and `set -euo pipefail`).
`scripts/lint/workflow-shell-snippet-lint.py` governs executable guidance in workflow docs, not
these scripts; `shellcheck.yml` already lints repository shell.

- [ ] `load-manifest.mjs` — reads `design/mockups/mobile/mockup-manifest.js` and evaluates it in a
      `node:vm` context with a `{ window: {} }` sandbox and a 2 s timeout, returning
      `window.__MOCKUP_MANIFEST__`. Exports `loadManifest(root)`, `mvpTargets(manifest)` (the
      canonical `{ screenId, stateId }[]` universe, `stateId: null` for stateless screens),
      `assertScreenInManifest`, `assertStateInManifest`, `initialStateForScreen`. The manifest is
      a `<script>`-tag file, not JSON — this is the one adaptation the Zeki port genuinely needs.
- [ ] `fidelity-contract.mjs` — schema + completeness validation and the `expandCoverage` /
      `targetId` / `renderInventory` helpers. CLI: `node scripts/mobile-ui/fidelity-contract.mjs
      [--check-docs]`, printing `Fidelity contract valid: 64 targets (0 wired, 64 planned),
      25 screens, 4 exclusions.` Exports `validateFidelityContract({ root, contract, manifest,
      checkDocs })` so tests can drive it against a temporary root.
- [ ] `fidelity-targets.json` — the contract (see [Contract file](#contract-file-scriptsmobile-uifidelity-targetsjson)).
- [ ] `capture-mockup.mjs` — Playwright Chromium; `--screen`, `--state`, `--profile`, `--output`,
      and `--override-css '<css text>'` (used only by the self-verification script to synthesise a
      broken build). Neutralises `transform: scale(var(--phone-scale))`, sets `.phone` /
      `.phone-slot` to the profile size, calls `window.go(screenId, stateId)`, waits for the frame,
      clips to exactly `width × height`. On a Chromium launch error it must print
      `npx playwright install chromium` in the message.
- [ ] `capture-simulator.sh` — `--profile`, `--output`, `--deep-link`, `--settle-ms`,
      `--check-only`. Resolves the booted device by `simulator_name` then device type; on
      `--check-only` prints the resolved UDID and exits; otherwise `xcrun simctl openurl`, the
      Decision 7 stability poll, `xcrun simctl io … screenshot`, then `sips --resampleWidth` to the
      profile width. Fails when the normalised height deviates from the profile height by more
      than 2 % (wrong device), rather than silently resizing.
- [ ] `compare-screenshots.mjs` — pixelmatch + pngjs. `--mock`, `--app`, `--diff`, `--report`,
      `--target`, `--profile`, `--max-mismatch-pct`, `--pixel-threshold`. Writes the diff PNG and a
      markdown report carrying an explicit `PASS` / `FAIL` verdict, the mismatch percentage, the
      threshold, and whether a resample occurred. **Exits 1 when the mismatch exceeds the
      threshold** — the behavioural difference from the Zeki original, which only reported. Size
      handling: identical sizes compare directly; different sizes whose aspect ratios agree within
      1 % are resampled and flagged `resampled: true` in the report; aspect-ratio disagreement is a
      hard failure.
- [ ] `run-fidelity.mjs` — orchestrator. Selectors `--screen <id> [--state <id>]`, `--issue <n>`,
      `--all`; modifiers `--profile`, `--output-dir`, `--dry-run`, `--summary <path>`, and
      `--app-from <png>` (substitute a PNG for the device capture — the mechanism the
      self-verification script and any offline re-diff use). Refuses `planned` targets with
      `Target "home--pending" is still planned (owned by issue #12); wire it before running the
      gate.` Aggregates per-target verdicts into a markdown summary table and exits non-zero if any
      target failed.
- [ ] `verify-gate.sh` — the Decision 10 self-proof. See
      [Gate self-verification](#gate-self-verification-proving-both-directions).
- [ ] `fidelity-contract.test.mjs`, `compare-screenshots.test.mjs` — `node --test`.

### Frontend / UI — `apps/mobile`

- [ ] `src/lib/fidelity-preview.ts` (new; `src/lib/` does not exist yet) — the two exports from
      Decision 9. No JSX, no user-facing strings, so the `no-literal-string` rule is not engaged.
- [ ] `src/lib/__tests__/fidelity-preview.test.ts` (new) — app Jest project (`jest-expo`).
- [ ] No route, component, screen or theme change. Every route stays a `RoutePlaceholder`.

### Infrastructure / Configuration

- [ ] `package.json` (root) — devDependencies `pixelmatch@^7.2.0`, `pngjs@^7.0.0`,
      `playwright@^1.60.0`; scripts `fidelity`, `fidelity:contract`, `fidelity:test`,
      `fidelity:capture-mockup`, `fidelity:verify-gate` (exact strings in
      [Implementation Order](#implementation-order) step 2).
- [ ] `.github/workflows/ci.yml` — two steps appended to the existing `test` job:
      `pnpm fidelity:contract` and `pnpm fidelity:test`. Neither needs a browser or a simulator.
- [ ] `.gitignore` — no change; `.tmp/` is already ignored and all artifacts land in
      `.tmp/ui-fidelity/`.

### Database / Data Layer, Backend / API, Shared packages

None. This item writes no SQL, adds no migration, and touches no `packages/*`.

---

## Contract file: `scripts/mobile-ui/fidelity-targets.json`

```jsonc
// Illustrative — adapt during implementation. Field names here are normative; the
// mappings array is generated (Implementation Order step 4), not hand-typed.
{
  "schema_version": 1,
  "default_profile": "iphone-393x852",
  "defaults": { "max_mismatch_pct": 3.0, "pixel_threshold": 0.1, "settle_ms": 2500 },
  "profiles": {
    "iphone-393x852": {
      "width": 393,
      "height": 852,
      "simulator_name": "Finanzas Fidelity",
      "device_types": ["iPhone 16", "iPhone 15", "iPhone 14"],
      "requires_native_dev_client": true
    }
  },
  "fixtures": {
    "seed-default": { "description": "The bundled deterministic seed fixture (pnpm --filter @finanzas/mobile db:seed)" },
    "empty-db": { "description": "Fresh install: migrations applied, no rows" }
  },
  "coverage_sets": [
    { "issue": 12, "targets": [{ "screen_id": "home", "states": "all" }] }
  ],
  "exclusions": [
    { "screen_id": "ds-colors", "states": null, "reason": "Design-system reference page; the app surface is the single __DEV__ gallery route /(dev)/gallery (#2), not a product screen" },
    { "screen_id": "categorize", "states": ["advanced"], "reason": "Manifest marks this state mvp: false — partial-inclusion UI is drawn but not built in the MVP" }
  ],
  "mappings": [
    {
      "screen_id": "home",
      "state_id": "pending",
      "status": "planned",
      "fixture": "seed-default",
      "max_mismatch_pct": 5.0,
      "threshold_note": "Donut chart antialiasing differs between Chromium SVG and React Native rendering"
    },
    {
      "screen_id": "settings",
      "state_id": null,
      "status": "wired",
      "fixture": "seed-default",
      "app_file": "apps/mobile/app/settings/index.tsx",
      "deep_link": "finanzas:///settings?fidelity=1&fidelityScreen=settings",
      "ready_test_id": "fidelity-settings"
    }
  ]
}
```

Deep-link rules the validator enforces for `wired` targets: scheme `finanzas:`, `fidelity=1`,
`fidelityScreen` equal to `screen_id`, and `fidelityState` equal to `state_id` (absent when
`state_id` is `null`).

Coverage sets, seeded from the Verification Log (13 sets, 25 screens, 64 targets):

| Issue | Screens | Targets |
| --- | --- | --- |
| #8 | `onboarding-intro`, `onboarding-value`, `onboarding-ready` | 5 |
| #9 | `connect-bank-intro`, `bank-picker`, `bank-credentials`, `bank-connected` | 11 |
| #11 | `bank-syncing` | 4 |
| #12 | `home` | 4 |
| #13 | `stage-intro`, `categorize`, `categorize-complete` | 7 |
| #14 | `merchant-edit` | 3 |
| #15 | `transactions` | 4 |
| #16 | `transaction-detail` | 4 |
| #17 | `dashboard` | 2 |
| #18 | `notifications-intro`, `notifications-schedule`, `settings-notifications` | 7 |
| #19 | `settings`, `settings-account`, `settings-about` | 4 |
| #20 | `settings-banks`, `bank-review` | 5 |
| #21 | `settings-categories` | 4 |

---

## Gate self-verification: proving both directions

`bash scripts/mobile-ui/verify-gate.sh` (also `pnpm fidelity:verify-gate`) runs four checks
against `home` — mockup captures only, so it is deterministic, needs no simulator, and can be
re-run by any reviewer. It asserts **exit codes**, writes
`.tmp/ui-fidelity/gate-verification.md`, and exits non-zero if any expectation is violated.

| # | Case | Inputs | Expected |
| --- | --- | --- | --- |
| V1 | Faithful build | `home--pending` captured twice in two separate browser launches; compare A vs A2 | `PASS`, exit 0, mismatch below the target's threshold. Two launches (not one file compared to itself) so capture non-determinism cannot hide here |
| V2 | Wrong design token | `home--pending` clean vs `home--pending` captured with `--override-css ":root{--brand:#ef4444;--tab-active:#ef4444;--t-brand:#ef4444}"` | `FAIL`, exit 1, mismatch above threshold |
| V3 | Wrong / missing state | `home--pending` (mock) vs `home--all-clear` (app) | `FAIL`, exit 1, mismatch above threshold |
| V4 | Wrong device size | `home--pending` at 393×852 vs the same capture rendered at 375×667 | `FAIL`, exit 1, and the report says the app image was resampled (aspect ratios differ → hard failure) |

V1–V4 prove the comparator discriminates. They do **not** prove the device capture path, which is
covered by the smoke runbook on this machine:

| # | Case | Expected |
| --- | --- | --- |
| V5 | Real device capture, real gate | `pnpm fidelity --screen settings` against the dev build on `Finanzas Fidelity`, with `settings` temporarily flipped to `wired`: the capture succeeds (a 393×852 PNG of the running app appears in `.tmp/ui-fidelity/`), and the comparison **FAILS with exit 1** at a very high mismatch, because the route is still a `RoutePlaceholder`. That failure is the proof: deep link → openurl → stability poll → normalise → diff → non-zero exit all work |

**Known limitation, stated rather than engineered around**: a true *on-device PASS* cannot exist
until a real screen is implemented. The first screen item to reach implementation records it, and
`docs/best-practices/stack/mobile-ui-fidelity.md` says so explicitly. The alternative — inventing a
throwaway pixel-perfect screen inside this item — would duplicate work the screen items own and
would be thrown away in a week. Under no circumstance may a threshold be raised to manufacture a
PASS (Decision 4).

All five results, with the actual mismatch percentages and exit codes, are pasted into the
implementation PR.

---

## Testing Strategy

**Test types**: Unit (`node --test` for the kit, Jest for the app helper), gate self-verification
(`verify-gate.sh`), manual smoke on the simulator.

**Key scenarios**:

1. The contract is a complete, non-overlapping projection of the manifest's MVP universe (Decision 1).
2. A threshold above the default without a note is rejected (Decision 4).
3. A `wired` target with a missing file, a missing `testID`, or a mismatched deep link is rejected (Decision 2).
4. The comparator passes on a faithful pair and fails on token, state, and geometry breakage (Decision 10).
5. `useFidelityPreview` is inert when `__DEV__` is false (Decision 9).

**Regression suite**: `e2e/` is the template's Playwright placeholder for web e2e and is not part
of this item. The durable regression protection here is `pnpm fidelity:contract` +
`pnpm fidelity:test` running in the CI `test` job on every PR.

### Parser-risk addendum

**Classification: applicable.** `fidelity-contract.mjs` is a rule engine over structured
configuration (a JSON contract cross-checked against a JS manifest evaluated in `node:vm`), and it
is the enforcement heart of the gate. The Zeki original ships a 455-line `node:test` suite for
exactly this module; the port keeps that discipline.

**Edge-case enumeration → unit test mapping.** Test file:
`scripts/mobile-ui/fidelity-contract.test.mjs`. Each row is at least one `node:test` case built
against a temporary root with a synthetic manifest and contract.

| # | Input | Expected |
| --- | --- | --- |
| 1 | `screen_id` or `state_id` containing the reserved `--` delimiter | throws `/reserved/` |
| 2 | Coverage target naming a `mvp: false` screen (e.g. `auth`) | throws, naming the screen |
| 3 | Coverage target naming a `mvp: false` state (`categorize--advanced`) | throws, naming the state |
| 4 | MVP screen present in the manifest but in neither coverage nor exclusions | throws `/not covered/`, listing the orphan |
| 5 | MVP **state** present but uncovered while its screen is covered (`states: ["pending"]` only for `home`) | throws, listing `home--all-clear`, `home--empty`, `home--sync-error` |
| 6 | Screen/state both covered and excluded | throws `/both covered and excluded/` |
| 7 | Exclusion without `reason`, or with an empty `reason` | throws |
| 8 | Exclusion naming an unknown screen, or an unknown state of a known screen | throws with the valid state list |
| 9 | Duplicate coverage target across two coverage sets | throws `/Duplicate/` |
| 10 | Coverage set without an integer `issue` | throws |
| 11 | Coverage target with a mapping missing | throws `/Missing mapping/` |
| 12 | Mapping with no corresponding coverage target (stale) | throws `/stale/` |
| 13 | Duplicate mapping for one target | throws `/Duplicate mapping/` |
| 14 | `status` other than `planned` / `wired` | throws |
| 15 | `status: "wired"` missing `app_file`, `deep_link`, or `ready_test_id` | throws, naming the missing field |
| 16 | `status: "wired"` whose `app_file` does not exist on disk | throws |
| 17 | `status: "wired"` whose `ready_test_id` string is absent from `app_file` | throws |
| 18 | `status: "planned"` that carries `app_file` / `deep_link` / `ready_test_id` | throws |
| 19 | Deep link with the wrong scheme (`zeki:`), missing `fidelity=1`, or `fidelityScreen` / `fidelityState` not matching the target | throws (four cases) |
| 20 | Deep link that is not a parsable URL | throws `/invalid deep_link/` |
| 21 | `max_mismatch_pct` above `defaults.max_mismatch_pct` without `threshold_note` | throws `/threshold_note/` |
| 22 | `max_mismatch_pct` that is `0`, negative, `> 100`, or non-finite | throws (four cases) |
| 23 | Mapping referencing an unknown `fixture` or an unknown `profile` | throws (two cases) |
| 24 | `states: "all"` on a screen with no `states[]` | yields exactly one target with `state_id: null` |
| 25 | `states: "initial"` on a screen with zero or two `initial: true` states | throws `/exactly one initial state/` |
| 26 | `states: []` or a non-array, non-`"all"`, non-`"initial"` value | throws |
| 27 | `schema_version` other than `1` | throws |
| 28 | Profile with non-integer or non-positive `width` / `height` | throws |
| 29 | Manifest file missing, unparsable, or not assigning `window.__MOCKUP_MANIFEST__` | `loadManifest` throws a message naming the manifest path |
| 30 | The **real** repository contract and the **real** manifest | validates; asserts exactly 64 targets, 25 screens, 13 coverage sets, and that every target is `planned` or `wired` |

Comparator test file: `scripts/mobile-ui/compare-screenshots.test.mjs`, built on synthetic PNGs
written with `pngjs` (no browser):

| # | Input | Expected |
| --- | --- | --- |
| C1 | Identical images | `0.00 %`, verdict `PASS`, exit code 0 |
| C2 | Images differing by a handful of pixels, threshold 3 % | `PASS` |
| C3 | Images differing over a large block, threshold 3 % | `FAIL`, exit code 1, message quotes both percentages |
| C4 | Same aspect ratio, different pixel size | resamples, `resampled: true` in the report, comparison proceeds |
| C5 | Different aspect ratio | hard `FAIL` naming both sizes; no resample |
| C6 | Any run | the report file exists and contains the target id, profile, verdict, mismatch, and threshold |

**Suppression semantics** — the contract has no inline directives; its equivalent is the
`exclusions` array, whose semantics are: exclusions appear **only** at the top level of the
contract; each entry names one `screen_id` with either `states: null` (the whole screen) or a
non-empty `states[]` array (those states only); every entry requires a non-empty `reason`; a
screen or state may not be simultaneously excluded and covered (test 6); and exclusions may only
name screens/states that exist in the manifest (test 8). There is no wildcard and no
"exclude everything" form — the completeness rule must always be satisfiable by inspection.

### Concurrent-event-source addendum

**Not applicable.** Every module in this item is a sequential CLI: `run-fidelity.mjs` awaits each
child process in order (`for … of` with `await`), there is no shared mutable state across
execution contexts, no listener registration, no timer that outlives a step, and no teardown race.
The only asynchrony is `await`ed subprocess and Playwright I/O, whose failures reject and
propagate to a single top-level `catch` that exits non-zero.

### Residual verification strategy

This plan makes a pattern-completeness claim ("every `mvp: true` screen state is registered").
The evidence the implementation must produce before `ready-for-human-review`:

- `pnpm fidelity:contract` output pasted into the PR, showing `64 targets (0 wired, 64 planned),
  25 screens, 4 exclusions` — the validator refuses to print that line if the projection is
  incomplete (Decision 1), so the count *is* the proof, not a manual tally.
- Test 30 above, which asserts the same counts against the real files, so the claim cannot rot
  silently as the manifest evolves.
- The four exclusions, each with its `reason` string, listed in the PR body.
- Residual work is explicitly enumerated in [Follow-ups](#follow-ups-explicitly-out-of-scope)
  rather than left implicit: the 64 `planned` targets are owned by the 13 named issues.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| None | This item captures the mockup and a placeholder app screen; neither reads the database. The contract *declares* the fixture names `seed-default` and `empty-db` for screen items to reference, but no seed is loaded or changed here. | — |

---

## Documentation Updates

> Listed for the developer to execute during implementation — not written at plan stage.

- [ ] `docs/best-practices/stack/mobile-ui-fidelity.md` — replace the "Tooling to automate this
      comparison … is tracked as a backlog item. Until it lands the check is manual" note (lines
      38–39) with: the commands (`pnpm fidelity`, `fidelity:contract`, `fidelity:verify-gate`), the
      simulator setup, the `planned` → `wired` obligation for screen items, the threshold policy
      including the `threshold_note` rule, the required PR evidence block, and the known limitation
      that the first on-device PASS lands with the first screen item. Keep the existing
      "Implementation rules" and "Review evidence" sections; extend "Review evidence" with the
      summary table format.
- [ ] `AGENTS.md` — (a) non-negotiable #6: add that a UI item also registers and wires its fidelity
      targets and attaches the summary; (b) Common Commands: a `# Design fidelity` block with the
      five scripts; (c) Repository Structure: `scripts/mobile-ui/` alongside `scripts/lint/`;
      (d) Troubleshooting: one row for "fidelity capture grabs the wrong device" → the simulator is
      not `Finanzas Fidelity`. **Make every edit additive and section-scoped** — PR #44 also
      modifies this file.
- [ ] `docs/project/2-repo-architecture.md` — add `scripts/mobile-ui/` to the repository layout
      and one line on what it owns.
- [ ] `docs/project/3-software-architecture.md` — under `## Testing Strategy` → `### Automated
      Suite`, add the fidelity gate as a suite entry (what runs in CI vs what runs locally).
- [ ] `scripts/README.md` — one bullet pointing at `scripts/mobile-ui/`.
- [ ] `docs/best-practices/STACK-SPECIFIC.md` — no change; its table already links
      `stack/mobile-ui-fidelity.md`.
- [ ] Not to be edited: `REVIEW.md`, `docs/workflow/**`, `.claude/agents/**`, `.cursor/agents/**`,
      `.codex/skills/**`, `docs/best-practices/3-testing.md` — always-sync template surfaces
      (Decision 8).

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A native dev build cannot be produced on this machine (`expo run:ios` prebuild failure), so V5 cannot run | Med | High — the device leg is the half of the gate the brief insists must work here | Runbook step 1 builds the dev client **before** anything else, so failure surfaces immediately. V1–V4 still prove the comparator without it. If the build genuinely cannot be produced, record V5 as BLOCKED with the exact error and escalate — do not paper over it |
| `iPhone 16` device type is not creatable on the iOS 26.5 runtime | Med | Low | `device_types` is an ordered fallback list (`iPhone 16` → `15` → `14`); iOS 18.5 already hosts an iPhone 14 device on this machine. Record the runtime actually used in the runbook |
| Stability poll locks onto the Expo splash/bundling screen and captures it | Med | Med | `settle_ms` floor of 2500 ms before polling starts, two consecutive identical frames required, and a hard 20 s ceiling that fails instead of capturing. The operator eyeballs the artifact in V5 |
| Chromium and React Native antialias text and shadows differently, so even a faithful screen never reaches 0 % | High | Med | Thresholds are per-screen with documented rationale (Decision 4); the gate is a drift detector, not a pixel-identity assertion. The report says so in its footer, as the Zeki original does |
| Someone raises a threshold to make a failing screen pass | Med | High — it would quietly void the whole gate | `threshold_note` is required above the default and the validator enforces it; the raise is visible in the contract diff of the PR that made it; the policy is written into `mobile-ui-fidelity.md` |
| The 64-target contract goes stale when the mockups change | Med | Med | That is the failure mode Decision 1 exists to make loud: the CI contract check fails until the contract is updated |
| `node:vm` evaluation of the manifest breaks if the manifest stops being a plain assignment | Low | Med | `loadManifest` throws a message naming the file and the expected `window.__MOCKUP_MANIFEST__` assignment (test 29). Item #24, "Mockup manifest verification script", is the natural place to converge on a shared loader later |
| Root `playwright` devDependency slows CI install | Low | Low | Package only; browsers are never installed in CI because CI runs only the contract and unit tests |

---

## Follow-ups (explicitly out of scope)

1. **CI simulator job** — a macOS runner that boots `Finanzas Fidelity`, installs a dev build and
   runs `pnpm fidelity --all`. Heavy (macOS minutes, EAS artifacts); the brief permits deferring it.
   `pnpm fidelity:verify-gate` in CI is the cheaper intermediate step (needs a Chromium install).
2. **Maestro capture mode** — swap the stability poll for `assertVisible: id: ${READY_TEST_ID}`;
   natural home is item #22 (Maestro end-to-end flows). The `ready_test_id` contract is already in
   place.
3. **Fixture injection** — a deep-link-driven mechanism to load `empty-db` or a scenario seed
   before capture. Owned by the first screen item with a data-dependent state (#12, `home--empty`).
4. **First on-device PASS** — the first screen item to reach implementation flips its targets to
   `wired` and records the first true faithful-build PASS.
5. **`settings-notifications` backlog gap** — no issue body lists `#screen=settings-notifications`
   (Assumption A2). Whoever owns #18 or #19 should claim it in the issue body; the contract
   assigns it to #18 in the meantime.
6. **Shared manifest loader** — item #24 ("Mockup manifest verification script") should reuse
   `scripts/mobile-ui/load-manifest.mjs` rather than writing a second one.

---

## Assumptions

No human was available while this plan was written; the following are the author's calls, each
cheap to reverse.

- **A1** — The mockup's `393×852` frame is the fidelity reference size, so the simulator profile
  matches it exactly rather than using whatever device happens to be booted.
- **A2** — `settings-notifications` is assigned to coverage set #18 (notifications and local
  reminders), even though no issue body names it. Route `apps/mobile/app/settings/notifications.tsx`
  already exists. See follow-up 5.
- **A3** — The three `ds-*` manifest screens are excluded from pixel fidelity (Decision 3).
- **A4** — Starting thresholds (Decision 4) are engineering judgement, not measurements; the first
  screen item to run the gate may adjust them **with** a `threshold_note` and a stated reason.
- **A5** — `simctl` is preferred over Maestro for v1 (Decision 6).
- **A6** — The review-flow wiring deliberately avoids template-owned files (Decision 8). If the
  intent was to change `REVIEW.md` or protocol `04`, that is an upstream template item.
- **A7** — `pnpm fidelity:verify-gate`'s FAIL cases are synthesised from the mockup (wrong token,
  wrong state, wrong geometry) rather than from a deliberately broken React Native screen, because
  no screen exists yet. It is the *comparison* that must be proved to fail, and it is.

---

## Code Samples

> All samples in this document are **illustrative** — adapt during implementation.

Manifest loader, the one adaptation the port genuinely requires (`load-manifest.mjs`):

```js
// Illustrative — adapt during implementation.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const MANIFEST_PATH = 'design/mockups/mobile/mockup-manifest.js';

export function loadManifest(root) {
  const file = path.join(root, MANIFEST_PATH);
  const source = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  new vm.Script(source, { filename: MANIFEST_PATH }).runInContext(sandbox, { timeout: 2000 });
  const manifest = sandbox.window.__MOCKUP_MANIFEST__;
  if (manifest == null) {
    throw new Error(`${MANIFEST_PATH} did not assign window.__MOCKUP_MANIFEST__`);
  }
  return manifest;
}

// The canonical universe the contract must cover exactly once.
export function mvpTargets(manifest) {
  return (manifest.screens ?? [])
    .filter((screen) => screen.mvp !== false)
    .flatMap((screen) => {
      const states = (screen.states ?? []).filter((state) => state.mvp !== false);
      return states.length === 0
        ? [{ screenId: screen.screen_id, stateId: null }]
        : states.map((state) => ({ screenId: screen.screen_id, stateId: state.state_id }));
    });
}
```

The app-side preview contract (`apps/mobile/src/lib/fidelity-preview.ts`):

```ts
// Illustrative — adapt during implementation.
import { useLocalSearchParams } from 'expo-router';

/** The `testID` a screen must expose so the gate can assert readiness. */
export function fidelityTestId(screenId: string): string {
  return `fidelity-${screenId}`;
}

/**
 * `__DEV__`-only. Returns the manifest `state_id` the fidelity run asked for, so a screen can
 * render that state deterministically. Inert in a release build.
 */
export function useFidelityPreview(): { active: boolean; state: string | null } {
  const params = useLocalSearchParams<{ fidelity?: string; fidelityState?: string }>();
  if (!__DEV__ || params.fidelity !== '1') return { active: false, state: null };
  return { active: true, state: params.fidelityState ?? null };
}
```

The threshold gate — the one behavioural change from the Zeki original, which only reported
(`compare-screenshots.mjs`):

```js
// Illustrative — adapt during implementation.
const mismatchPct = (mismatched / totalPixels) * 100;
const passed = mismatchPct <= maxMismatchPct;
await writeFile(report, renderReport({ target, profile, mismatchPct, maxMismatchPct, passed, resampled }));
console.log(
  `${passed ? 'PASS' : 'FAIL'} ${target} (${profile}): ${mismatchPct.toFixed(2)}% vs ${maxMismatchPct.toFixed(2)}% allowed`,
);
if (!passed) process.exit(1);
```

---

## Implementation Order

1. **Re-verify the operational assumptions.** Re-run the two implementation-start checks in
   [Cross-Cutting Operational Assumption Check](#implementation-start-re-verification-mandatory-before-the-first-file-edit).
   Stop and escalate if an open PR now touches the manifest or `scripts/mobile-ui/`.
   *Verify*: the open-PR file lists contain none of this plan's surfaces except `AGENTS.md`.

2. **Dependencies and scripts.** Add `pixelmatch@^7.2.0`, `pngjs@^7.0.0`, `playwright@^1.60.0` to
   root `devDependencies` and these scripts to root `package.json`:

   ```json
   {
     "fidelity": "node scripts/mobile-ui/run-fidelity.mjs",
     "fidelity:contract": "node scripts/mobile-ui/fidelity-contract.mjs",
     "fidelity:test": "node --test scripts/mobile-ui/*.test.mjs",
     "fidelity:capture-mockup": "node scripts/mobile-ui/capture-mockup.mjs",
     "fidelity:verify-gate": "bash scripts/mobile-ui/verify-gate.sh"
   }
   ```

   Run `pnpm install`, then `pnpm check:layout`.
   *Verify*: `pnpm check:layout` passes and the lockfile change is limited to the three new packages.

3. **`load-manifest.mjs`.** Implement and sanity-check it.
   *Verify*: `node -e "import('./scripts/mobile-ui/load-manifest.mjs').then(m => console.log(m.mvpTargets(m.loadManifest(process.cwd())).length))"` prints `67`.

4. **`fidelity-targets.json`.** Write the header (`schema_version`, `defaults`, `profiles`,
   `fixtures`, `coverage_sets` from the table in [Contract file](#contract-file-scriptsmobile-uifidelity-targetsjson),
   `exclusions` for the three `ds-*` screens and `categorize--advanced`) by hand, then **generate**
   the 64 `mappings` entries with a throwaway Node one-liner that expands the coverage sets to
   `{ screen_id, state_id, status: "planned", fixture: "seed-default" }`, adding the Decision 4
   threshold overrides for `home--*`, `dashboard--*` and `bank-syncing--*`. Commit the generated
   JSON; delete the one-liner.
   *Verify*: the file contains one mapping per coverage target and no mapping carries `app_file`.

5. **`fidelity-contract.mjs`.** Implement schema validation, coverage expansion, the completeness
   rule, and the `planned` / `wired` rules. Wire the CLI summary line.
   *Verify*: `pnpm fidelity:contract` prints
   `Fidelity contract valid: 64 targets (0 wired, 64 planned), 25 screens, 4 exclusions.` and
   exits 0. Then temporarily delete one mapping and confirm it exits 1 naming the orphan; restore it.

6. **`fidelity-contract.test.mjs`.** All 30 cases from the parser-risk table.
   *Verify*: `node --test scripts/mobile-ui/fidelity-contract.test.mjs` — every case passes and
   test 30 asserts the real counts.

7. **`compare-screenshots.mjs` + `compare-screenshots.test.mjs`.** Comparator, threshold gate,
   size rules, markdown report; six synthetic-PNG cases C1–C6.
   *Verify*: `node --test scripts/mobile-ui/compare-screenshots.test.mjs` passes, and a manual run
   on two deliberately different PNGs exits 1 with a `FAIL …%` line.

8. **`capture-mockup.mjs`.** Playwright capture at profile size, including `--override-css`.
   *Verify*: `pnpm fidelity:capture-mockup --screen home --state pending` writes a PNG; confirm
   with `sips -g pixelWidth -g pixelHeight` that it is exactly 393×852 and that opening it shows
   the `home` screen in its pending state.

9. **`verify-gate.sh`.** Cases V1–V4 with exit-code assertions and the
   `.tmp/ui-fidelity/gate-verification.md` table.
   *Verify*: `pnpm fidelity:verify-gate` exits 0, and its report shows V1 `PASS` with V2, V3 and V4
   `FAIL` — i.e. the gate is green precisely because the broken inputs were rejected. Read the four
   mismatch percentages and confirm they are plausible (V1 near zero, V2/V3 clearly above the
   threshold); if V1 is not near zero, fix the capture, **never the threshold**.

10. **`capture-simulator.sh`.** Device resolution by name then device type, `openurl`, the
    stability poll, screenshot, `sips` normalisation, and the size assertion.
    *Verify*: create and boot `Finanzas Fidelity`, then
    `bash scripts/mobile-ui/capture-simulator.sh --profile iphone-393x852 --check-only` prints the
    resolved UDID; with the wrong device booted it fails and prints the `simctl create` command.

11. **`run-fidelity.mjs`.** Selectors, `planned` refusal, `--dry-run`, `--app-from`, the summary
    table, and the aggregate exit code.
    *Verify*: `pnpm fidelity --all --dry-run` lists 64 targets with their profile, fixture, status
    and owning issue; `pnpm fidelity --screen home --state pending` fails fast with the
    "still planned (owned by issue #12)" message.

12. **`apps/mobile/src/lib/fidelity-preview.ts` + its test.**
    *Verify*: `pnpm --filter @finanzas/mobile test` passes, including a case asserting
    `{ active: false, state: null }` when `__DEV__` is false.

13. **CI wiring.** Append `pnpm fidelity:contract` and `pnpm fidelity:test` as steps of the
    existing `test` job in `.github/workflows/ci.yml`.
    *Verify*: the steps appear after the existing test step in the same job and reuse its
    `pnpm install --frozen-lockfile`; no new job, no browser install.

14. **Device leg (V5).** Build and install the dev client on `Finanzas Fidelity`
    (`npx expo run:ios --device "Finanzas Fidelity"`), temporarily flip the `settings` mapping to
    `wired` with its `app_file`, `deep_link` and `ready_test_id`, add
    `testID={fidelityTestId('settings')}` to the placeholder root, and run
    `pnpm fidelity --screen settings`.
    *Verify*: an app PNG appears in `.tmp/ui-fidelity/`, and the run **fails with exit 1** at a high
    mismatch — the placeholder is not the mockup. Record the percentage. Then decide: keep
    `settings` wired only if its `testID` addition is retained, otherwise revert both the mapping
    and the `testID` so all 64 targets stay `planned` and the contract check still reports
    `0 wired`. **Record which choice was made in the PR** and keep the contract summary line in the
    PR consistent with it.

15. **Run the smoke test runbook** `docs/testing/mobile/47-design-fidelity-gate.smoke-test.md`
    end to end and paste the V1–V5 evidence table (mismatch percentages and exit codes) into the PR.

16. **Full local check**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm fidelity:contract`,
    `pnpm fidelity:test`, `pnpm fidelity:verify-gate`.
    *Verify*: all pass.

17. **Update project docs** per [Documentation Updates](#documentation-updates). Keep the
    `AGENTS.md` edits additive and section-scoped (PR #44 conflict risk).

18. **Update `CHANGELOG.md`** under `## [Unreleased]` → `### Added`, exactly:

    ```markdown
    - **Design-fidelity gate: port the Zeki fidelity kit wired to the mockup manifest** (#47): `scripts/mobile-ui/` compares every `mvp: true` mockup screen state against the running app on a 393×852 iOS simulator and fails when the pixel mismatch exceeds the screen's threshold. A fidelity contract registers all 64 MVP screen/state targets against `design/mockups/mobile/mockup-manifest.js` and is validated in CI, so a mockup state cannot be added — or a screen shipped — without the gate noticing. `pnpm fidelity:verify-gate` proves the comparison passes on a faithful build and fails on a wrong token, a wrong state and a wrong device size.
    ```

---

## Document Quality Gate

- **Spec/brief coverage**: Checked — the brief's five requirements map to Decision 1/2 and the
  contract file (per-screen/state targets keyed by manifest ids, `mvp: true` only), Decision 4
  (per-screen thresholds in the contract), Decision 8 (review-flow wiring, with the exact surfaces
  named), Decision 10 and Implementation Order steps 9 and 14 (both-directions proof recorded in
  the PR), and Decisions 5–7 (runs on this machine's simulator; CI simulator deferred as an
  explicit follow-up).
- **Implementation-order consistency**: Checked — file names, script names (`fidelity`,
  `fidelity:contract`, `fidelity:test`, `fidelity:capture-mockup`, `fidelity:verify-gate`),
  the profile id `iphone-393x852`, the simulator name `Finanzas Fidelity`, the counts
  (64/25/13/4/67), the status values `planned` / `wired`, and the helper names
  `useFidelityPreview` / `fidelityTestId` / `loadManifest` / `mvpTargets` are identical across the
  Summary, Decisions, Layer-by-Layer, Contract file, Testing Strategy, Code Samples and
  Implementation Order sections.
- **Verification support**: Checked — every count, geometry, tool-availability and file-ownership
  claim traces to a row in the Verification Log with its exact command.
- **Behavioural guarantees**: Checked — completeness is enforced by the Decision 1 rule (test 4/5,
  test 30); "cannot silently raise a threshold" by the `threshold_note` rule (test 21); "fails on
  drift" by the non-zero exit in `compare-screenshots.mjs` (C3); "inert in release builds" by the
  `__DEV__` guard (step 12's test).
- **Complex workflow decision-gate matrix**: Not applicable — this plan adds a *product* quality
  gate on project-owned surfaces; it does not add or modify a workflow decision gate, its inputs,
  outcomes, status labels, or any mirrored workflow surface. Decision 8 records why the
  template-owned workflow surfaces are deliberately untouched.
- **Parser/API/concurrency checklist**: Parser-risk **applicable** — 30 enumerated edge cases, each
  mapped to `scripts/mobile-ui/fidelity-contract.test.mjs`, plus exclusion ("suppression")
  semantics. Concurrent-event-source **not applicable** — sequential CLI, rationale recorded.
  Cross-cutting checklist **applicable** — the live search was run and its results are in the
  Verification Log; the enumeration and the deliberate exclusion of always-sync surfaces are in
  Decision 8 and Documentation Updates.
- **CHANGELOG literal format**: Checked — Implementation Order step 18 gives the entry verbatim in
  the project's `**Bold Title** (#N):` format under `### Added`.
- **Not-applicable rationale**: Checked — every skipped category above carries a rationale.
