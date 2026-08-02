# Smoke Test Runbook: Mockup manifest verification script

**Feature**: Mockup manifest verification script (`pnpm mockups:verify`)
**Work item**: [#24](https://github.com/lhpaul/personal-finances/issues/24) (Refactor — no spec; the issue body is the brief)
**Implementation plan**: [`2_24-mockup-manifest-verification_implementation-plan.md`](../../specs/developments/20260802195209_24-mockup-manifest-verification/2_24-mockup-manifest-verification_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

Before running this smoke test:

- [ ] Node 22 is active (`node --version` matches [`.nvmrc`](../../../.nvmrc))
- [ ] Dependencies installed: `pnpm install`
- [ ] The working tree is clean: `git status --porcelain` prints nothing
- [ ] You are on the item #24 implementation branch with the change applied

This is a repository-tooling item. There is no app to launch, no database to seed, and no
session to log out of — the standard "ensure logged out" and "log in" steps do not apply.

**Design assets**: none. The issue body has no `## Design assets` section, there are no tracker
attachments, and the item ships no UI. No expected-vs-actual fidelity step is included, and no
visual baseline is invented for it.

---

## Test Data

| Item | Value |
| --- | --- |
| Verifier | `scripts/design/verify-manifest.mjs` |
| Unit tests | `scripts/design/verify-manifest.test.mjs` |
| Mockup under test | `design/mockups/mobile/` (`mockup-manifest.js` + `index.html`) |
| Tokens under test | `design/tokens.json` |
| Expected screen count | `36` |
| Expected state count | `78` |
| CI job hosting the check | `test` in `.github/workflows/ci.yml` |

---

## Smoke Test Steps

### Step 1: The verifier passes on the real mockup with no false positives

**Maps to**: brief acceptance criterion 1 — *Passes on the current manifest with no false
positives*

1. From the repository root, run `pnpm mockups:verify`.
2. Read the whole output, not just the exit status.
3. Run `echo "exit=$?"` immediately afterwards.

**Expected result**: a single success line of the form
`OK — 36 screens, 78 states, 10 checks passed`, no violation lines, and `exit=0`.
In particular, the two findings the old `node -e` one-liner reported
(`undeclared state ds-components -> a` and `-> b`) must **not** appear — eliminating them is the
point of this item.

### Step 2: The verifier is reachable through the documented command

**Maps to**: brief acceptance criterion 1 (usability of the promoted script)

1. Open [`design/mockups/mobile/README.md`](../../../design/mockups/mobile/README.md) and find
   the § *Verification* section.
2. Copy the command it documents and run it verbatim.
3. Open [`design/mockups/README.md`](../../../design/mockups/README.md) § *Workflow* and confirm
   the PR checklist points at the same command.

**Expected result**: the documented command is `pnpm mockups:verify`, it runs successfully, and
neither README still contains the `node -e "…"` one-liner or the sentence about two ignorable
false positives.

### Step 3: The verifier fails on a deliberately broken manifest

**Maps to**: brief acceptance criterion 2 — *Fails on a deliberately broken manifest*

Perform each break one at a time, running `pnpm mockups:verify; echo "exit=$?"` after each, and
reverting with `git checkout -- design/` before the next one.

1. **Two initial states**: in `design/mockups/mobile/mockup-manifest.js`, add `initial: true` to
   a second state of the `home` screen.
   **Expected**: an `M005` line naming `home` and reporting two initial states; `exit=1`.
2. **Navigation points at a non-existent screen**: change one `screen_id` inside a
   `navigation[].items[]` entry to `ghost-screen`.
   **Expected**: an `M002` line naming `ghost-screen`; `exit=1`.
3. **Screen-level field inside a state**: add `route: '/leaked'` to any state object.
   **Expected**: an `M006` line naming that state and the field `route`; `exit=1`.
4. **Undeclared `data-states`**: in `design/mockups/mobile/index.html`, change any
   `data-states="…"` value to include an extra token `bogus`.
   **Expected**: an `M008` line naming the owning screen and `bogus`; `exit=1`.
5. **Broken `go()` target**: change one `go('home')` call to `go('nowhere')`.
   **Expected**: an `M009` line naming `nowhere`; `exit=1`.
6. **Missing DOM node**: delete one `<section class="app-screen" id="s-…">` element and its
   contents.
   **Expected**: an `M007` line naming that screen; `exit=1`.
7. **Unmirrored token**: in `design/tokens.json`, change `colors.brandPrimary` to `#123456`
   without touching the `:root` block.
   **Expected**: an `M010` line naming `colors.brandPrimary` and `#123456`; `exit=1`.

**Expected result** (all seven): each break produces at least one violation line whose code
matches the table above, each message names the offending symbol, and the exit status is `1`.

### Step 4: Restore the mockup and re-verify

1. Run `git checkout -- design/`.
2. Run `git status --porcelain` and confirm nothing under `design/` is modified.
3. Run `pnpm mockups:verify`.

**Expected result**: the working tree is clean under `design/`, and the verifier prints the same
success line as in Step 1 with `exit=0`. **Do not open the implementation PR with any Step 3
break still applied.**

### Step 5: Planted-violation unit tests pass in both directions

**Maps to**: brief acceptance criteria 1 and 2 (the automated form of Steps 1 and 3)

1. Run `pnpm mockups:verify:test`.
2. Read the test names in the output, not only the pass/fail summary.

**Expected result**: every test passes, the reported test count is non-zero, and the test names
show, for each check code `M001` through `M010`, both a test where that check fires and a test
where it must not fire. Specifically confirm the presence of the must-not-fire cases: the
`<script>`-block decoy, the HTML-comment decoy, the computed `go()` state argument, the
`colors.palette.*` exclusion, and the stateless screen.

### Step 6: A check that flags everything is caught

**Maps to**: brief acceptance criteria 1 and 2 (discrimination, not just detection)

1. Temporarily edit `scripts/design/verify-manifest.mjs` so that one check — for example `M008` —
   pushes a violation unconditionally.
2. Run `pnpm mockups:verify:test`.
3. Revert with `git checkout -- scripts/design/verify-manifest.mjs`.

**Expected result**: the suite **fails**, and it fails on the good-fixture test and on the
must-not-fire tests rather than only on the `M008` planted-violation test. This proves the
negative direction is actually asserted. After reverting, rerun `pnpm mockups:verify:test` and
confirm it passes again.

### Step 7: CI runs the check

**Maps to**: brief acceptance criterion 3 — *Runs in CI on changes under `design/`*

1. Open [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) and confirm the `test`
   job contains a `Mockup manifest verification` step running `pnpm mockups:verify` and a
   `Mockup manifest verification unit tests` step running `pnpm mockups:verify:test`.
2. Push the branch and open the implementation PR.
3. Open the PR's Checks tab and locate the `Test` job.

**Expected result**: both new steps appear in the `Test` job log and succeed. Because
`.github/workflows/ci.yml` uses no path filters, the check runs on every pull request to
`develop` / `main`, which is a superset of "on changes under `design/`" (implementation plan
Decision 3).

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below is met
- Confirm `git status --porcelain` shows only the intended implementation changes — no leftover
  break from Step 3 or Step 6
- No application to shut down

---

## Assertions Checklist

- [ ] `pnpm mockups:verify` exits `0` on the unmodified `design/mockups/mobile/` and prints
      `36 screens, 78 states` (brief AC 1)
- [ ] The two `ds-components -> a` / `-> b` false positives of the old one-liner are gone (brief AC 1)
- [ ] Both mockup READMEs document `pnpm mockups:verify` and no longer carry the `node -e`
      one-liner or its false-positive caveat (brief AC 1)
- [ ] Each of the seven deliberate breaks in Step 3 produces the expected check code and exit
      status `1` (brief AC 2)
- [ ] `design/` is restored clean after Step 3 (brief AC 2)
- [ ] `pnpm mockups:verify:test` passes, with a firing test and a must-not-fire test for every
      check code `M001`–`M010` (brief AC 1 + 2)
- [ ] Step 6 shows that an always-firing check breaks the suite (brief AC 1 + 2)
- [ ] The CI `test` job runs both new steps and they succeed on the PR (brief AC 3)

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Real mockup | The 36-screen `design/mockups/mobile/` tree | Already in the repository — nothing to load |
| Synthetic good fixture | 3-screen mockup with decoys, written to a temp directory | Created by `scripts/design/verify-manifest.test.mjs` at run time |
| Broken variants | One documented mutation each, applied to the good fixture | Created in-memory by the same test file |

No database, no application seed data.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `pnpm mockups:verify` reports `M008` for `ds-components -> a` / `-> b` | The verifier is scanning `<script>` block contents; `stripNonMarkup` is missing or applied after the section split | Apply `stripNonMarkup` to the whole file before locating sections (plan Decision 5) |
| `pnpm mockups:verify` reports `M009` for a call like `go(screenId, stateId)` | Same cause — `<script>` content is being scanned | As above |
| `pnpm mockups:verify` reports `M010` for `colors.palette.*` entries | The token walk is not excluding the raw palette ramp | Restrict `M010` to `colors.*` minus `colors.palette.*` (plan Decision 4) |
| `pnpm mockups:verify` reports `M010` for `overlayScrim` or `focusRing` | Value normalisation is missing; `:root` writes `rgba(15, 23, 42, .45)` and `tokens.json` writes `0.45` | Normalise case, whitespace, and leading-zero-less decimals before comparing |
| `pnpm mockups:verify` reports `M009` for the `connect-bank-intro` call at `index.html` line 782 | The `go()` scanner is treating a computed second argument as a state id | Validate the state only when the second argument is a string literal |
| `pnpm mockups:verify:test` reports "no test files found" | The `node --test scripts/design/*.test.mjs` glob matched nothing | Confirm the test file is committed and named `*.test.mjs` under `scripts/design/` |
| The CI `Test` job passes but the new steps are absent from the log | The steps were added to the wrong job or at the wrong indentation | Confirm they are inside the `test` job's `steps:` list |

---

## Known Limitations

- **Step 3 mutates tracked files.** Every break must be reverted with `git checkout -- design/`
  before continuing. Step 4 exists specifically to catch a forgotten revert.
- **`M010` is value-level, not name-level.** Renaming a token while keeping its value passes the
  check (implementation plan Decision 4). This runbook does not test for a rename because the
  script does not claim to detect one.
- **`M010` covers only semantic colours.** `gradients`, `chart`, `typography`, `space`, `radius`,
  `shadow`, `layout`, `touchTarget`, `categoryIcons`, and `categoryLabels` are out of scope by
  design.
- **Step 7 requires a pushed PR.** The CI assertion cannot be verified locally; run Steps 1–6
  locally, then confirm Step 7 on the open PR.
- **This runbook does not exercise the mockup viewer.** Whether a screen *looks* right is the
  design-fidelity gate's job (item #47), not the manifest verifier's.
