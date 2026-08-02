# Mockup manifest verification script — Implementation Plan

**Work item**: [#24 — Mockup manifest verification script](https://github.com/lhpaul/personal-finances/issues/24) (Refactor · Low priority). This item has no spec; the issue body is the brief.
**Smoke test runbook**: [`docs/testing/mobile/24-mockup-manifest-verification.smoke-test.md`](../../../testing/mobile/24-mockup-manifest-verification.smoke-test.md)

---

## Summary

**Approach**: Promote the throwaway `node -e "…"` one-liner in
[`design/mockups/mobile/README.md`](../../../../design/mockups/mobile/README.md) to a real,
tested Node script at `scripts/design/verify-manifest.mjs`, exposed as `pnpm mockups:verify` and
wired into the existing CI `test` job. The script loads `mockup-manifest.js` in a `node:vm`
sandbox, scans `index.html` markup, and reports every violation of the mockup PR checklist that
[`design/mockups/README.md`](../../../../design/mockups/README.md) and the HTML Mockup Framework
standard already state in prose. Ten checks with stable codes (`M001`–`M010`) replace the
one-liner, and each one is covered by a planted-violation unit test in both directions.

**Estimated complexity**: S

**Rationale**: One new ~250-line script, one new test file, three one-line wiring changes
(`package.json`, `.github/workflows/ci.yml`), and five documentation edits. No product code, no
database, no UI, no new dependency — `node:vm` and `node --test` are both built into Node 22
(`.nvmrc` = `22`). The only real design work is picking check boundaries that produce zero false
positives on the current mockup, and that has already been measured at plan time (see
**Verification Log**).

**Dependencies**: None blocking. #1 (monorepo bootstrap) is merged; `design/mockups/mobile/` and
`design/tokens.json` are on `develop` at `3ac49ee`. PR #61 (item #47, design-fidelity gate) is
open against `develop` and touches two of the same files — see **Cross-Cutting Operational
Assumption Check** and **Decision 2**.

---

## Verification Log

All commands run in the worktree at `origin/develop` = `3ac49ee`, on 2026-08-02T19:50Z.
The measurement script is reproduced in **Appendix A** so every count below can be regenerated.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `3ac49ee` (identical to `origin/develop`) |
| `scripts/design/` does not exist yet | `git ls-files scripts/design \| wc -l` | `0` — this item creates the directory |
| Manifest inventory | Appendix A (`screens`, `statefulScreens`, `totalStates`) | `36` screens, `28` with a `states` array, `78` states total |
| Navigation leaves | Appendix A (`navLeafIds`) | `36` `screen_id` references in the recursive `navigation[].items[]` tree |
| DOM sections | Appendix A (`domSectionsFull`, `domSectionsMarkup`) | `36` `<section class="app-screen" id="…">` nodes; unchanged after stripping `<script>` blocks |
| Screens declaring `dom_id` | Appendix A (`m.screens.filter(s => s.dom_id)`) | `0` — every screen today uses the implicit `s-{screen_id}` node id, so `dom_id` support is defensive |
| `<script>` blocks | Appendix A (`scriptBlocks`) | `3`, all starting at byte offset `163461`, i.e. after the last screen section |
| HTML comments | Appendix A (`htmlComments`) | `27` |
| `data-states` occurrences | Appendix A (`dataStatesFull`, `dataStatesMarkup`) | `211` in the raw file, `210` in markup after stripping `<script>` blocks and HTML comments |
| `go(` occurrences | Appendix A (`goFull`, `goMarkup`) | `176` in the raw file, `171` in markup |
| `go(` argument shapes in markup | Appendix A (`goLiteralScreenOnly`, `goLiteralScreenState`, `goDynamicStateInMarkup`) | `92` screen-only literals, `78` screen+state literals, `1` call with a literal screen and a **computed** state argument (`index.html` line 782, `connect-bank-intro`) |
| Current one-liner false positives | Ran the README snippet's logic in Node | `2` — `undeclared state ds-components -> a` and `-> b`, both from the `data-states="a b"` example inside the boot-script doc comment, exactly as the README warns |
| `:root` custom properties | Appendix A (`rootVars`) | `83` |
| Semantic colour tokens | Appendix A (`semanticColorTokens`) | `39` leaves under `colors.*` excluding `colors.palette.*` |
| Raw palette tokens | Appendix A (`paletteColorTokens`) | `60` leaves under `colors.palette.*` |
| Semantic colour tokens not mirrored in `:root` | Appendix A (`semanticNotMirrored`) | `[]` — empty, so check `M010` as scoped produces zero false positives today |
| PR #61 overlap surface | `git diff --stat origin/develop origin/feature/47-design-fidelity-gate -- .github/ package.json scripts/ AGENTS.md` | `.github/workflows/ci.yml` (+6), `package.json` (+9/-1), `scripts/README.md` (+4), and 12 new files under `scripts/mobile-ui/` |
| Root lint scope | `grep -n "scripts" eslint.config.mjs` | no match; `pnpm lint` is `turbo run lint` over workspace packages, so a root-level `scripts/design/` file is not linted and needs no ESLint wiring |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` (no `mode:` key in `.ai-dev-workflow.yaml`); this repository owns the plan and the implementation | `.ai-dev-workflow.yaml` | 2026-08-02T19:50Z @ `3ac49ee` | Current invocation (item #24 only) | `Verified` |
| Approved artifact base branch | `develop` | Parent handoff for item #24; `AGENTS.md` § Git & Branching | 2026-08-02T19:50Z @ `3ac49ee` | Current invocation; `git rev-parse origin/develop` equals worktree `HEAD` | `Verified` |
| Template-fit gate | `template.is_template: false` → Protocol 02 Step 0 does not apply | `.ai-dev-workflow.yaml` line 176 | 2026-08-02T19:50Z @ `3ac49ee` | Current invocation | `Verified` |
| CI host for the new check | The existing `test` job in `.github/workflows/ci.yml` (no path filters anywhere in that workflow) | `.github/workflows/ci.yml` | 2026-08-02T19:50Z @ `3ac49ee` | Same-surface open PRs: PR #61 (`feature/47-design-fidelity-gate` → `develop`) adds two sibling steps to the same `test` job and four sibling entries to the `package.json` `scripts` block | `Verified` |

**Note on the one same-surface open PR.** PR #61 edits `.github/workflows/ci.yml` and
`package.json` in the same regions this plan edits, but it *adds sibling entries* rather than
changing the operational fact this plan relies on: after either merge order, the `test` job is
still the CI host and `scripts` is still the script registry. This is a textual merge-conflict
risk handled by the normal batch-merge conflict resolution, not a contradicting operational
assumption. No `Conflict` row is required.

Sharing the `design/mockups/mobile/mockup-manifest.js` *file* with PR #61 is a code-structure
question, not an operational assumption; it is resolved in **Decision 2** below.

---

## Decisions

### Decision 1 — `scripts/design/`, per the issue and the framework standard

The script lands at `scripts/design/verify-manifest.mjs`. The issue brief names that path
explicitly ("Promote it to `scripts/design/verify-manifest.mjs`, following `zeki-platform`'s
`scripts/design/` convention"), and the HTML Mockup Framework standard § *Optional: verify +
smoke (code repos)* says the same: `scripts/design/` holds manifest verification, while
`scripts/mobile-ui/` holds React Native fidelity. Verified above: `scripts/design/` does not
exist on `develop`, so this item creates it.

### Decision 2 — `verify-manifest.mjs` carries its own manifest loader

PR #61 introduces `scripts/mobile-ui/load-manifest.mjs`, whose `loadManifest(root)` also
evaluates the manifest in a `node:vm` sandbox. This plan deliberately does **not** import it,
for two reasons:

1. **Signature mismatch.** `loadManifest(root)` hard-codes
   `MANIFEST_PATH = 'design/mockups/mobile/mockup-manifest.js'` and joins it to a repository
   root. The planted-violation tests in this plan must point the verifier at a *fixture*
   mockup directory in a temp folder, which that signature cannot express.
2. **Merge-order independence.** PR #61 is open, not merged. Importing from it would make
   item #24 unmergeable until #47 lands, for no functional gain.

The duplicated surface is ~15 lines (`readFileSync` + `vm.runInNewContext` + a shape assertion).
The two loaders are allowed to coexist; a later consolidation — teaching
`load-manifest.mjs` to accept an explicit manifest path and having both callers use it — is an
explicit **non-goal of this item** and is recorded under **Residual Verification** below.

### Decision 3 — CI runs the check on every PR, not only on `design/` changes

The brief's third acceptance criterion is "Runs in CI on changes under `design/`".
`.github/workflows/ci.yml` uses no `paths:` filters on any job, and PR #61 adds its fidelity
steps to the existing `test` job. This plan follows that convention: two steps appended to the
`test` job, running on every pull request to `develop` / `main`. Running on *every* PR is a
strict superset of "on changes under `design/`", so the criterion is satisfied, and it avoids
the required-check ambiguity that a path-filtered job introduces (a skipped job on a PR that
does not touch `design/` can never be reported as passing). Cost is negligible: the check is a
sub-second pure-Node scan of two files in a job that already installs dependencies.

### Decision 4 — Scope of the token-mirroring check (`M010`)

The framework's PR check is "Tokens are mirrored in `:root`", but `tokens.json` names
(`brandPrimary`) and CSS custom-property names (`--brand`) are deliberately different, and
several token groups have no `:root` mirror at all. `design/README.md` § *Token workflow*
already documents part of this: "`categoryIcons` and `categoryLabels` are content, not CSS —
they have no `:root` mirror".

`M010` is therefore defined as a **value-level** check with a documented scope: every leaf under
`colors.*` **excluding** `colors.palette.*` must appear as the value of at least one `--*`
custom property in the `:root` block of the mockup's `index.html`, after normalising case,
whitespace, and leading-zero-less decimals (`rgba(15, 23, 42, .45)` ≡ `rgba(15,23,42,0.45)`).
Measured at plan time: 39 in-scope tokens, 0 unmirrored — zero false positives.

Excluded and why:

- `colors.palette.*` (60 leaves) — the raw colour ramp consumed by `apps/mobile/src/theme.ts`; by design it is not mirrored in the mockup `:root`.
- `gradients`, `chart`, `typography`, `space`, `radius`, `shadow`, `layout`, `touchTarget` — either composite values or dimensions whose `:root` spelling does not correspond one-to-one to a token leaf.
- `categoryIcons`, `categoryLabels` — content, per `design/README.md`.

**Known limitation, stated honestly**: a value-level check catches the failure mode the
framework actually warns about (a colour value changed in `tokens.json` without the same-commit
`:root` mirror). It does **not** catch a token *rename* that keeps the value. Extending `M010` to
a name-mapped check is out of scope for this v1 and is recorded under **Residual Verification**.

### Decision 5 — Markup scanning strips `<script>` blocks and HTML comments

The current README one-liner reports two documented false positives (`ds-components -> a`,
`-> b`) that come from the `data-states="a b"` example inside the boot script's doc comment.
Because all three `<script>` blocks sit after the last screen section, a naive `split()` on the
section marker attributes their contents to the last screen.

`verify-manifest.mjs` blanks out `<script …>…</script>` blocks and `<!-- … -->` comments
(replacing each with equal-length whitespace so byte offsets and reported line numbers stay
correct) before scanning for sections, `data-states`, and `go(`. Measured effect at plan time:
`data-states` goes 211 → 210 and `go(` goes 176 → 171, and the two false positives disappear.
Section count is unchanged at 36, confirming no screen markup is lost.

Consequence: **no suppression directive is needed**. The verifier recognises no `verify-ignore`
comment or equivalent, because after this change there is nothing legitimate left to suppress.

---

## Layer-by-Layer Changes

### Database / Data Layer

None — this item touches no database, schema, migration, or seed data.

### Backend / API

None — there is no backend in this product.

### Shared Packages / Libraries

None — nothing under `packages/` or `apps/` changes.

### Repository tooling

- [ ] **New** `scripts/design/verify-manifest.mjs` — the verifier. ES module, no dependencies, Node 22 built-ins only. Public surface:
  - `export function verifyMockup({ mockupDir, tokensPath })` → `{ violations: Array<{ code, message }>, stats: { screens, states, checks } }`. Pure: reads files, returns findings, never calls `process.exit`.
  - A CLI wrapper guarded by `import.meta.url === pathToFileURL(process.argv[1]).href` that parses `--mockup-dir` (default `design/mockups/mobile`) and `--tokens` (default `design/tokens.json`), prints one `CODE  message` line per violation, and exits `1` when `violations.length > 0`, `0` otherwise. The success line has the form `OK — <screens> screens, <states> states, <checks> checks passed`, with every number rendered from `stats` rather than hard-coded.
  - Internal helpers: `loadManifest(manifestPath)` (see **Decision 2**), `stripNonMarkup(html)` (see **Decision 5**), `collectNavScreenIds(navigation)` (recursive over `items`), `domIdFor(screen)` → `screen.dom_id ?? 's-' + screen.screen_id`, `normalizeCssValue(value)` (see **Decision 4**).
- [ ] **New** `scripts/design/verify-manifest.test.mjs` — `node:test` + `node:assert/strict` suite; see **Testing Strategy**.
- [ ] **Modify** `package.json` — add two entries to `scripts`, placed immediately after `"mockups:mobile"`:
  - `"mockups:verify": "node scripts/design/verify-manifest.mjs"`
  - `"mockups:verify:test": "node --test scripts/design/*.test.mjs"`
- [ ] **Modify** `.github/workflows/ci.yml` — append two steps to the existing `test` job, after its final step:
  - `- name: Mockup manifest verification` / `run: pnpm mockups:verify`
  - `- name: Mockup manifest verification unit tests` / `run: pnpm mockups:verify:test`
- [ ] No ESLint or Prettier wiring: `pnpm lint` is `turbo run lint` over workspace packages and `format:code` targets `{apps,packages}` only, so root-level `scripts/*.mjs` is outside both (verified above).

### Frontend / UI

None — no app code, no route, no component. `design/mockups/` content itself is **not** modified
by this item; the verifier must pass against it unchanged.

### Infrastructure / Configuration

Covered by the `package.json` and `.github/workflows/ci.yml` entries above. No new dependency,
no new workflow file, no `turbo.json` change.

### Executable workflow shell snippets

Not applicable — this item adds no executable shell guidance to a framework-owned surface. The
only shell commands introduced are two single-command CI `run:` steps and two `package.json`
script entries; there is no iteration or positional-argument splitting to lint.

---

## The checks

Each check has a stable code used in output and in tests. `M001`–`M006` read the manifest only;
`M007`–`M009` correlate the manifest with `index.html`; `M010` correlates `tokens.json` with
`index.html`. Every message must name the offending `screen_id` / `state_id` / value so a
developer can act without opening the script. Against the current mockup a clean run therefore
prints `OK — 36 screens, 78 states, 10 checks passed`.

| Code | Name | Rule | Brief coverage |
| --- | --- | --- | --- |
| `M001` | `manifest-loads` | `mockup-manifest.js` exists, evaluates without throwing, and assigns a `window.__MOCKUP_MANIFEST__` object whose `screens` is a non-empty array. When `M001` fails, the run reports only `M001` and stops — later checks have nothing to read. | Precondition for every other check |
| `M002` | `nav-target-exists` | Every `screen_id` in the recursive `navigation[].items[]` tree exists in `screens`. | "Navigation ids exist in `screens`" |
| `M003` | `screen-id-unique` | `screen_id` values are unique across `screens`, and every screen declares a non-empty `screen_id` and `route`. | Structural precondition for `M007`–`M009` |
| `M004` | `state-id-unique` | Within a screen, `state_id` values are unique, and every state declares a non-empty `state_id`. | "States are local and unique" |
| `M005` | `single-initial` | Every screen whose `states` array is non-empty has exactly one state with `initial: true`. Reports "0 initial states" and "N initial states" as distinct messages. | "exactly one `initial: true`" |
| `M006` | `state-no-screen-fields` | No state object declares `screen_id`, `route`, `dom_id`, `nav_screen`, `kind`, or `states`. | "States contain no screen-level fields" |
| `M007` | `dom-parity` | Every screen with `kind: 'html'` (or no `kind`) has exactly one `<section class="app-screen" id="…">` whose id equals `dom_id ?? 's-' + screen_id`, and every such section in the markup maps back to a declared screen. Screens with `kind: 'image'` are skipped (none today). | "Every screen has a DOM node and vice versa" |
| `M008` | `data-states-declared` | For every `data-states="…"` in the markup of a screen's section, each whitespace-separated token is declared in that screen's `states`. A `data-states` attribute inside a section for a screen with no `states` is a violation. | "Every `data-states` value is declared" |
| `M009` | `go-target-exists` | For every `go('<screen>')` or `go('<screen>', '<state>')` in the markup, `<screen>` exists in `screens`; when the second argument is a **string literal**, `<state>` is one of that screen's `state_id`s. Calls whose second argument is not a string literal (1 today, `index.html` line 782) validate the screen only. | "Every `go()` target exists" |
| `M010` | `tokens-mirrored` | Every leaf under `colors.*` excluding `colors.palette.*` in `tokens.json` appears, after normalisation, as the value of at least one `--*` custom property in the `:root` block of `index.html`. | "Tokens are mirrored in `:root`" |

---

## Testing Strategy

**Test types**: Unit (`node:test`) + smoke (manual runbook). No integration or e2e — the script
has no runtime dependencies and no UI.

**Test file**: `scripts/design/verify-manifest.test.mjs`, run by `pnpm mockups:verify:test`.

**Fixture strategy**: the suite defines one **good synthetic mockup** in-file — a three-screen
manifest string, a matching minimal `index.html` (including a `:root` block and one `<script>`
block containing a `data-states="a b"` decoy comment), and a matching minimal `tokens.json` —
written to a `fs.mkdtempSync(path.join(os.tmpdir(), 'verify-manifest-'))` directory. Each
planted-violation test writes the same good fixture with exactly **one** mutation applied, then
asserts on `verifyMockup(...)` in-process. Temp directories are removed in an `after` hook.

**Key scenarios to test**:

1. **Real mockup passes** (maps to brief AC 1, "Passes on the current manifest with no false
   positives"): `verifyMockup({ mockupDir: 'design/mockups/mobile', tokensPath: 'design/tokens.json' })`
   returns `violations: []` and `stats.screens === 36`, `stats.states === 78`. This is the
   regression guard for the two `a` / `b` false positives the one-liner produces today.
2. **Good synthetic fixture passes**: `violations` is empty. This is what makes every negative
   assertion below meaningful — it proves the fixture is not failing for unrelated reasons.
3. **Ten planted-violation tests**, one per check.

**Planted-violation matrix** — the house rule is *both directions for every check*, so each row
asserts (a) the expected code fires with a message naming the offending symbol, **and** (b) no
other code fires. Requirement (b) is what proves the check discriminates instead of flagging
everything.

| Test | Mutation applied to the good fixture | Asserts |
| --- | --- | --- |
| `M001` | Manifest body replaced with `window.__OTHER__ = {}` | only `M001`; message names `__MOCKUP_MANIFEST__` |
| `M002` | Add `{ screen_id: 'ghost-screen' }` to a `navigation[].items[]` group | only `M002`; message names `ghost-screen` |
| `M003` | Duplicate an existing `screen_id` on a second screen | only `M003`; message names the duplicated id |
| `M004` | Duplicate a `state_id` inside one screen's `states` | only `M004`; message names screen + state |
| `M005` | (a) remove `initial: true` from the only state that has it; (b) add `initial: true` to a second state | (a) only `M005` "0 initial"; (b) only `M005` "2 initial" — two cases, one per direction of the "exactly one" rule |
| `M006` | Add `route: '/leaked'` to a state object | only `M006`; message names the state and the field `route` |
| `M007` | (a) delete the `<section>` for a declared screen; (b) add a `<section class="app-screen" id="s-orphan">` with no manifest entry | (a) only `M007` "no DOM node"; (b) only `M007` "orphan DOM node" |
| `M008` | Change one `data-states="filled"` to `data-states="filled bogus"` | only `M008`; message names the screen and `bogus` |
| `M009` | (a) change a `go('home')` to `go('nowhere')`; (b) change a `go('home', 'filled')` to `go('home', 'nostate')` | (a) only `M009` naming `nowhere`; (b) only `M009` naming `home` + `nostate` |
| `M010` | Change one semantic colour value in the fixture `tokens.json` without touching `:root` | only `M010`; message names the token path and the unmirrored value |

**Additional negative-direction (must-not-fire) tests** — these guard the specific
false-positive shapes this script is being written to eliminate:

| Test | Fixture property | Asserts |
| --- | --- | --- |
| Script-block decoy | The good fixture's `<script>` block contains `data-states="a b"` and `go(screenId, stateId)` in a comment | `violations` is empty — `M008` and `M009` must not read `<script>` content (**Decision 5**) |
| HTML-comment decoy | The good fixture contains `<!-- <div data-states="nope"> -->` | `violations` is empty |
| Computed `go()` state | The good fixture contains `go('home', flag ? 'filled' : 'empty')` | `violations` is empty — `M009` validates the screen only when the second argument is not a string literal |
| Unmirrored palette token | The good fixture's `tokens.json` has a `colors.palette.blue.500` value absent from `:root` | `violations` is empty — `M010` excludes `colors.palette.*` (**Decision 4**) |
| Stateless screen | The good fixture has one screen with no `states` and no `data-states` in its section | `violations` is empty — `M005` must not demand an `initial` state on stateless screens |

**Regression suite**: the repository has no automated regression suite for repo tooling; CI
executes `pnpm mockups:verify` and `pnpm mockups:verify:test` on every PR, which is the standing
regression for this item.

### Parser-risk addendum

This plan is **parser-risk**: `verify-manifest.mjs` is a scanner module that performs
regex-based scanning of structured text (HTML markup and a JavaScript manifest file).

**Edge-case enumeration** — concrete inputs the implementation must handle, each mapped to a
test in the matrices above or the list below:

| # | Input | Required behaviour | Covered by |
| --- | --- | --- | --- |
| 1 | `data-states="a b"` inside a `<script>` doc comment | ignored | Script-block decoy test |
| 2 | `<!-- <div data-states="nope"> -->` | ignored | HTML-comment decoy test |
| 3 | `data-states="filled  resend-ready"` (multiple spaces, and a newline separator) | split on `/\s+/`, empty tokens dropped, both ids validated | New unit test `data-states whitespace splitting` |
| 4 | Two `data-states` attributes on one line, e.g. `<div data-states="a"></div><div data-states="b"></div>` | both scanned (global regex, no early exit) | New unit test `two data-states on one line` |
| 5 | Two `go(...)` calls in one `onclick` attribute | both scanned | New unit test `two go() calls on one line` |
| 6 | `go('home', flag ? 'filled' : 'empty')` | screen validated, state skipped | Computed `go()` state test |
| 7 | `go(screenId, stateId)` (identifier arguments, in a `<script>`) | ignored entirely | Script-block decoy test |
| 8 | A negative lookalike: the literal text `data-statesX="foo"` or `cargo('home')` | must **not** match (attribute regex anchored on `data-states="`, call regex anchored on a `go(` word boundary) | New unit test `negative lookalikes are not matched` |
| 9 | `rgba(15, 23, 42, .45)` in `:root` vs `rgba(15, 23, 42, 0.45)` in `tokens.json` | treated as equal after normalisation | New unit test `rgba leading-zero normalisation` |
| 10 | `#6366F1` in `:root` vs `#6366f1` in `tokens.json` | treated as equal after normalisation | New unit test `hex case normalisation` |
| 11 | A `:root` block containing a nested block (e.g. a media query following it) | the `:root` extraction must stop at that block's own closing brace, not at the first `}` of a nested rule | New unit test `:root extraction stops at its own closing brace` |
| 12 | A screen section that itself contains a nested `<section>` element | section boundaries derived from the ordered list of `app-screen` section start offsets, so a nested plain `<section>` does not split a screen | New unit test `nested section element does not split a screen` |
| 13 | A screen declaring an explicit `dom_id` that is **not** `s-{screen_id}` | `M007` honours `dom_id` (0 screens use this today — defensive) | New unit test `explicit dom_id is honoured` |
| 14 | A manifest whose evaluation throws (syntax error) | reported as `M001` with the thrown message; no crash, no stack trace dump | New unit test `manifest syntax error is reported as M001` |
| 15 | An empty `states: []` array on a screen | not a violation of `M005` (the rule applies to non-empty arrays), and any `data-states` in that section is still an `M008` violation | New unit test `empty states array` |

**Unit test mapping**: all fifteen edge cases plus the ten planted-violation rows and the five
must-not-fire rows live in `scripts/design/verify-manifest.test.mjs`. Smoke-only coverage is not
sufficient for this item and is not being relied on.

**Suppression semantics**: not applicable — `verify-manifest.mjs` recognises **no** suppression
directive. Per **Decision 5**, stripping `<script>` blocks and HTML comments removes the only
known legitimate false positive, so there is nothing to suppress. If a future mockup needs one,
adding it is a separate item.

### Concurrent-event-source addendum

Not applicable. The verifier is a single-pass synchronous script: it reads two or three files
with `fs.readFileSync`, evaluates one sandboxed script, and returns. There are no event
listeners, timers, sockets, async queues, or shared mutable state across execution contexts.

---

## Cross-cutting checklist classification

Not applicable. This plan does not add or modify a safety, quality, or compliance checklist
category in `REVIEW.md`, in a planning or implementation protocol, or in any agent/skill
guidance file. The mockup PR checklist it automates is a pre-existing, project-local list in
`design/mockups/README.md`, not a framework-wide review category, and this item mechanises that
list rather than introducing a new one.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Good synthetic mockup manifest | 3 screens: one stateful with `initial: true` (`home` with `filled` / `empty`), one stateless (`about`), one with an explicit `dom_id`. Includes a nav group referencing all three. | Inline string constant in `scripts/design/verify-manifest.test.mjs`, written to a `mkdtemp` directory |
| Good synthetic `index.html` | 3 `app-screen` sections matching the manifest; a `:root` block mirroring the fixture tokens; a `<script>` block whose comment contains the `data-states="a b"` and `go(screenId, stateId)` decoys; an HTML-comment decoy; a computed-state `go()` call; two `data-states` on one line; two `go()` calls on one line | Inline string constant in the same test file |
| Good synthetic `tokens.json` | 2–3 semantic colours mirrored in the fixture `:root`, plus one `colors.palette.*` entry deliberately absent from `:root` | Inline string constant in the same test file |
| Broken variants | Produced by applying a single documented mutation to one of the three strings above — no separate fixture files on disk | Same test file |

No database seed data, no application fixtures, and no change to `design/mockups/mobile/` itself.

---

## Documentation Updates

The developer must make these edits after implementation (they are **not** made during Plan
Ready):

- [ ] `design/mockups/mobile/README.md` — replace the § *Verification* `node -e "…"` one-liner (currently lines 35–43) with `pnpm mockups:verify`, and delete the "reports two false positives (`a`, `b`) … ignore those two lines" sentence, which stops being true.
- [ ] `design/mockups/README.md` — in § *Workflow (no scripts/)*, retitle the section (there is a `scripts/design/` now) and change the closing sentence "The last three are mechanical — see the verification snippet in [mobile/README.md](./mobile/README.md#verification)" to point at `pnpm mockups:verify`; note that all six checklist items are now mechanised.
- [ ] `design/README.md` — in § *Token workflow*, state that `pnpm mockups:verify` enforces the `:root` mirror for semantic colour tokens and record the documented exclusions from **Decision 4** (`colors.palette.*`, the non-colour groups, and the already-documented `categoryIcons` / `categoryLabels`).
- [ ] `scripts/README.md` — add a short "Design mockups" section pointing at `scripts/design/` (mirroring the existing "Development workflow" section), and note that `scripts/mobile-ui/` is the separate fidelity kit.
- [ ] `AGENTS.md` — in § *Common Commands*, add `pnpm mockups:verify` (and `pnpm mockups:verify:test`) next to the existing `open design/mockups/mobile/index.html` line.
- [ ] `docs/project/2-repo-architecture.md` — the `scripts/` entry in the tree at line 50 is unannotated; add `design/` beneath it only if the developer also annotates siblings. Optional; skip if the tree stays coarse.

No change is required to `docs/project/1-business-domain.md`, `3-software-architecture.md`,
`4-database-model.md`, `docs/best-practices/`, or `REVIEW.md`.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Regex markup scanning produces a false positive on a future mockup edit, blocking an unrelated PR | Med | Med | Every check is scoped to a measured-zero-false-positive rule on the current mockup (**Verification Log**), and the five must-not-fire tests pin the known-tricky shapes. Messages name the offending symbol so the fix is obvious. |
| `M010`'s value-level rule is too weak to catch a token rename | High | Low | Stated explicitly as a known limitation in **Decision 4** and in the runbook's *Known Limitations*; the failure mode it does catch (value changed without a `:root` mirror) is the one the framework warns about. |
| Merge conflict with PR #61 in `package.json` / `.github/workflows/ci.yml` | High | Low | Both PRs only append entries; standard batch-merge conflict resolution. Placing the new `mockups:verify*` entries next to the existing `mockups:mobile` key (not at the end of the block, where #61 appends) reduces the overlap. |
| Duplicate manifest loader with `scripts/mobile-ui/load-manifest.mjs` is flagged in review | Med | Low | Rationale recorded in **Decision 2** with the concrete signature blocker; consolidation recorded as an out-of-scope residual. |
| `node --test scripts/design/*.test.mjs` glob is shell-expanded and could match nothing | Low | Low | Verified pattern: PR #61 uses the identical `node --test scripts/mobile-ui/*.test.mjs` form. The test file is committed in the same change, so the glob always matches at least one file; the runbook has an explicit step asserting a non-zero test count in the output. |

---

## Residual Verification

This item is not a sweep or a mass rename, but it does make a completeness claim — "the script
enforces the mockup PR checklist" — so the evidence the implementation must produce before
`ready-for-human-review` is:

1. **Checklist coverage evidence**: the six-item PR checklist in `design/mockups/README.md` maps
   onto `M002`, `M004`+`M005`, `M006`, `M008`, `M009`, `M010`; the *Brief coverage* column of
   **The checks** table is that mapping. The implementation PR description must restate it.
2. **Both-directions evidence**: `pnpm mockups:verify:test` output showing every planted
   violation test passing, i.e. at least one firing test and one must-not-fire assertion per
   check code `M001`–`M010`.
3. **No-false-positive evidence**: `pnpm mockups:verify` exiting `0` against the unmodified
   `design/mockups/mobile/`, with the `36 screens, 78 states` counts in the success line.

**Explicit non-goals** (not residuals to be fixed in this item — recorded so reviewers do not
read them as gaps):

- Consolidating the manifest loader with `scripts/mobile-ui/load-manifest.mjs` (**Decision 2**).
- Extending `M010` to name-mapped token checking, or to `gradients` / `chart` / dimension groups (**Decision 4**).
- A Playwright viewer smoke test (`verify-mockups.mjs` in the framework standard) — a separate concern from manifest verification.
- Any change to `design/mockups/` content.

---

## Code Samples

<!-- Illustrative — adapt during implementation. -->

```js
// Illustrative — adapt during implementation.
// scripts/design/verify-manifest.mjs — shape of the public surface only.

/** Blanks out <script> blocks and HTML comments, preserving length so offsets stay valid. */
function stripNonMarkup(html) {
  const blank = (match) => ' '.repeat(match.length);
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

export function verifyMockup({ mockupDir, tokensPath }) {
  const violations = [];
  // M001 first; when it fails, return early with only M001.
  // M002–M006 read the manifest; M007–M009 read stripNonMarkup(index.html);
  // M010 compares tokensPath against the :root block.
  return { violations, stats: { screens: 0, states: 0, checks: 10 } };
}
```

---

## Implementation Order

1. **Create `scripts/design/verify-manifest.mjs`** with `loadManifest`, `stripNonMarkup`,
   `collectNavScreenIds`, `domIdFor`, `normalizeCssValue`, checks `M001`–`M006`, and the
   `verifyMockup` entry point returning `{ violations, stats }`.
   *Verify*: `node -e "import('./scripts/design/verify-manifest.mjs').then(m => console.log(m.verifyMockup({ mockupDir: 'design/mockups/mobile', tokensPath: 'design/tokens.json' })))"` prints an object; confirm no violations are reported for the manifest-only checks.
2. **Add checks `M007`–`M009`** (DOM parity, `data-states`, `go()`) on top of `stripNonMarkup`.
   *Verify*: rerun the command from step 1 and confirm the output no longer contains the
   `ds-components -> a` / `-> b` findings the old one-liner produced.
3. **Add check `M010`** (token mirroring) with the normalisation and exclusions from **Decision 4**.
   *Verify*: rerun the command from step 1 and confirm the violations list is empty.
4. **Add the CLI wrapper** (argument parsing, per-violation output lines, exit codes, success
   line rendered from `stats`).
   *Verify*: `node scripts/design/verify-manifest.mjs; echo "exit=$?"` prints the success line
   and `exit=0`.
5. **Create `scripts/design/verify-manifest.test.mjs`** with the good synthetic fixture, the ten
   planted-violation tests, the five must-not-fire tests, and the fifteen edge-case tests from
   the **Parser-risk addendum**.
   *Verify*: `node --test scripts/design/*.test.mjs` — read the summary line and confirm every
   test passes and the reported test count matches the number of tests written.
6. **Wire `package.json`**: add `"mockups:verify"` and `"mockups:verify:test"` immediately after
   `"mockups:mobile"`.
   *Verify*: `pnpm mockups:verify` and `pnpm mockups:verify:test` both succeed.
7. **Wire `.github/workflows/ci.yml`**: append the two steps to the existing `test` job.
   *Verify*: read the edited file and confirm the two new steps sit inside the `test` job's
   `steps:` list at the same indentation as its existing steps. CI executing them on the
   implementation PR is the authoritative confirmation (runbook Step 7).
8. **Deliberate-break sanity check** (brief AC 2): temporarily edit `design/mockups/mobile/mockup-manifest.js` to add a second `initial: true` to one screen, run `pnpm mockups:verify`, confirm it reports `M005` for that screen and exits non-zero, then **revert the edit** with `git checkout -- design/mockups/mobile/mockup-manifest.js` and confirm `git status` is clean for `design/`.
9. **Run the smoke test runbook** at
   [`docs/testing/mobile/24-mockup-manifest-verification.smoke-test.md`](../../../testing/mobile/24-mockup-manifest-verification.smoke-test.md)
   and record the results in the implementation PR.
10. **Update project docs** per the **Documentation Updates** section above.
11. **Update `CHANGELOG.md`** under `[Unreleased]` → `### Added`, using exactly this entry:

    ```markdown
    - **Mockup manifest verification script** (#24): `scripts/design/verify-manifest.mjs` and
      `pnpm mockups:verify` enforce the mockup PR checklist mechanically — navigation targets,
      unique local states, exactly one `initial: true`, no screen-level fields inside states,
      manifest/DOM parity, declared `data-states`, resolvable `go()` targets, and semantic colour
      tokens mirrored in `:root`. Runs in CI on every pull request and replaces the `node -e`
      one-liner in `design/mockups/mobile/README.md`, including its two documented false positives
    ```

---

## Appendix A — Verification Log measurement script

Run from the repository root at `3ac49ee` to reproduce every count in the **Verification Log**:

```bash
node -e '
const fs=require("fs"),vm=require("vm");
const base="design/mockups/mobile/";
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(base+"mockup-manifest.js","utf8"),ctx);
const m=ctx.window.__MOCKUP_MANIFEST__;
const h=fs.readFileSync(base+"index.html","utf8");
const blank=s=>" ".repeat(s.length);
const markup=h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,blank).replace(/<!--[\s\S]*?-->/g,blank);
const out={};
out.screens=m.screens.length;
out.statefulScreens=m.screens.filter(s=>Array.isArray(s.states)).length;
out.totalStates=m.screens.reduce((n,s)=>n+(s.states||[]).length,0);
out.navLeafIds=(function(){const a=[];(function w(i){for(const x of i||[]){if(x.screen_id)a.push(x.screen_id);w(x.items)}})(m.navigation.flatMap(g=>g.items));return a.length})();
out.domSectionsFull=[...h.matchAll(/<section class="app-screen" id="/g)].length;
out.domSectionsMarkup=[...markup.matchAll(/<section class="app-screen" id="/g)].length;
out.scriptBlocks=[...h.matchAll(/<script\b[^>]*>/g)].length;
out.htmlComments=[...h.matchAll(/<!--/g)].length;
out.dataStatesFull=[...h.matchAll(/data-states="/g)].length;
out.dataStatesMarkup=[...markup.matchAll(/data-states="/g)].length;
out.goFull=[...h.matchAll(/go\(/g)].length;
out.goMarkup=[...markup.matchAll(/go\(/g)].length;
out.goLiteralScreenOnly=[...markup.matchAll(/go\(.[a-z0-9-]+.\s*\)/g)].length;
out.goLiteralScreenState=[...markup.matchAll(/go\(.[a-z0-9-]+.\s*,\s*.[a-z0-9-]+.\s*\)/g)].length;
out.goDynamicStateInMarkup=out.goMarkup-out.goLiteralScreenOnly-out.goLiteralScreenState;
const t=JSON.parse(fs.readFileSync("design/tokens.json","utf8"));
const root=h.match(/:root\s*\{([\s\S]*?)\n\s*\}/)[1];
const vars=[...root.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)];
out.rootVars=vars.length;
const norm=s=>String(s).toLowerCase().replace(/\s+/g,"").replace(/(\d)?\.(\d+)/g,(x,a,b)=>(a||"0")+"."+b);
const rootSet=new Set(vars.map(v=>norm(v[2].trim())));
const leaves=[];(function w(o,p){for(const[k,v]of Object.entries(o)){if(k.startsWith("$"))continue;const q=p+"."+k;if(v&&typeof v==="object")w(v,q);else leaves.push([q,v]);}})(t.colors,"colors");
const sem=leaves.filter(([k])=>!k.startsWith("colors.palette."));
out.semanticColorTokens=sem.length;
out.paletteColorTokens=leaves.length-sem.length;
out.semanticNotMirrored=sem.filter(([k,v])=>!rootSet.has(norm(v))).map(([k])=>k);
console.log(JSON.stringify(out,null,2));
'
```

Recorded output at `3ac49ee`:

```json
{
  "screens": 36,
  "statefulScreens": 28,
  "totalStates": 78,
  "navLeafIds": 36,
  "domSectionsFull": 36,
  "domSectionsMarkup": 36,
  "scriptBlocks": 3,
  "htmlComments": 27,
  "dataStatesFull": 211,
  "dataStatesMarkup": 210,
  "goFull": 176,
  "goMarkup": 171,
  "goLiteralScreenOnly": 92,
  "goLiteralScreenState": 78,
  "goDynamicStateInMarkup": 1,
  "rootVars": 83,
  "semanticColorTokens": 39,
  "paletteColorTokens": 60,
  "semanticNotMirrored": []
}
```
