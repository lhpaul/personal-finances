# Smoke Test Runbook: Design-fidelity gate (#47)

**Feature**: Design-fidelity gate — port the Zeki fidelity kit wired to the mockup manifest
**Work item**: [#47](https://github.com/lhpaul/personal-finances/issues/47) (the issue body is the
brief; this item has no spec)
**Implementation plan**: [`2_47-design-fidelity-gate_implementation-plan.md`](../../specs/developments/20260802132243_47-design-fidelity-gate/2_47-design-fidelity-gate_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

> **Design assets**: the work item declares no `## Design assets` section, has no tracker
> attachments, and its only reference is a code directory (`~/Git/zeki/zeki-platform/scripts/mobile-ui/`).
> There is therefore no expected-vs-actual fidelity step for *this item's own UI* — it ships no UI.
> The mockup-vs-app comparison exercised below is the feature under test, not a fidelity check of
> this item.

---

## Prerequisites

- [ ] macOS with Xcode command-line tools; `xcrun simctl` responds
- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0
- [ ] `pnpm install` has been run at the repo root after this item's dependency change
- [ ] `npx playwright install chromium` has been run (version-matched browser for the root
      `playwright` devDependency)
- [ ] A fidelity simulator exists and is booted — created once:

  ```bash
  xcrun simctl create "Finanzas Fidelity" "iPhone 16" "$(xcrun simctl list runtimes | awk '/iOS/ {print $NF}' | tail -1)"
  xcrun simctl boot "Finanzas Fidelity"
  ```

  If the newest runtime rejects `iPhone 16`, retry with `iPhone 15`, then `iPhone 14`, then with an
  older runtime identifier. **Record the device type and runtime actually used in the report.**
- [ ] A native dev build of `@finanzas/mobile` is installed on that simulator
      (`npx expo run:ios --device "Finanzas Fidelity"`). Expo Go is not sufficient — the app uses
      `expo-sqlite`
- [ ] No other iOS simulator is booted (the capture script resolves by name, but a single booted
      device removes all ambiguity)

---

## Test Data

| Item | Value |
| --- | --- |
| Mockup contract | `design/mockups/mobile/index.html` + `mockup-manifest.js` |
| Fidelity contract | `scripts/mobile-ui/fidelity-targets.json` |
| Profile | `iphone-393x852` (393×852 logical) |
| Simulator name | `Finanzas Fidelity` |
| Artifact directory | `.tmp/ui-fidelity/` (gitignored) |
| Reference screen for the gate proof | `home`, states `pending` and `all-clear` |
| Reference screen for the device proof | `settings` (stateless) |

---

## Smoke Test Steps

### Step 1: The contract is a complete projection of the manifest

**Maps to**: brief requirement 1 (per-screen/state capture keyed by the manifest, `mvp: true` only)

1. Run `pnpm fidelity:contract`.
2. Read the summary line.

**Expected result**: exits 0 and prints
`Fidelity contract valid: 64 targets (0 wired, 64 planned), 25 screens, 4 exclusions.`
(If step 14 of the plan left `settings` wired, the line reads `64 targets (1 wired, 63 planned)` —
either is acceptable, but it must match what the PR claims.)

### Step 2: The contract refuses to drift from the manifest

**Maps to**: brief requirement 1

1. Temporarily delete one mapping from `scripts/mobile-ui/fidelity-targets.json` (for example
   `home--empty`).
2. Run `pnpm fidelity:contract`.
3. Restore the file (`git checkout -- scripts/mobile-ui/fidelity-targets.json`) and re-run.

**Expected result**: step 2 exits non-zero and names the uncovered target; step 3 exits 0 again.

### Step 3: Thresholds live per screen and cannot be raised silently

**Maps to**: brief requirement 2 (thresholds per screen in a fidelity contract file)

1. Confirm `defaults.max_mismatch_pct` and the per-target overrides for `home--*`, `dashboard--*`
   and `bank-syncing--*` are present in the contract, each with a `threshold_note`.
2. Temporarily raise `max_mismatch_pct` on any target above the default and delete its
   `threshold_note`.
3. Run `pnpm fidelity:contract`, then restore the file.

**Expected result**: step 3 exits non-zero with a message naming `threshold_note`; after restoring,
it exits 0.

### Step 4: Unit tests

**Maps to**: brief requirement 4 (the gate must be trustworthy)

1. Run `pnpm fidelity:test`.

**Expected result**: every `node:test` case in `fidelity-contract.test.mjs` and
`compare-screenshots.test.mjs` passes, including the case asserting the real contract's 64 targets
across 25 screens and 13 coverage sets.

### Step 5: Mockup capture

**Maps to**: brief requirement 1

1. Run `pnpm fidelity:capture-mockup --screen home --state pending`.
2. Inspect the output PNG in `.tmp/ui-fidelity/`:
   `sips -g pixelWidth -g pixelHeight <path>` and open it.

**Expected result**: the file is exactly 393×852, shows the `home` screen with its pending-review
content, and has no browser chrome or phone bezel drop-shadow beyond the frame clip.

### Step 6: The gate proves itself — both directions

**Maps to**: brief requirement 4 (prove it FAILS on a deliberately broken screen and PASSES on a
faithful one, both recorded)

1. Run `pnpm fidelity:verify-gate`.
2. Read `.tmp/ui-fidelity/gate-verification.md`.

**Expected result**: the command exits 0 — and it does so precisely because each case behaved as
required:

| Case | Inputs | Required outcome |
| --- | --- | --- |
| V1 faithful build | `home--pending` captured twice, in two separate browser launches | `PASS`, comparator exit 0, mismatch near 0 % |
| V2 wrong design token | clean `home--pending` vs the same capture with `--brand` / `--tab-active` / `--t-brand` forced to `#ef4444` | `FAIL`, comparator exit 1, mismatch above the target threshold |
| V3 wrong / missing state | `home--pending` vs `home--all-clear` | `FAIL`, comparator exit 1, mismatch above the target threshold |
| V4 wrong device size | `home--pending` at 393×852 vs the same screen rendered at 375×667 | `FAIL`, comparator exit 1, report states the aspect ratio disagreed |

Record all four mismatch percentages and exit codes verbatim in the report and in the PR.

> If V1 is not near 0 %, the capture is non-deterministic. Fix the capture. **Do not raise a
> threshold to make V1 pass** — that would void the gate for all 13 screen items.

### Step 7: Simulator resolution

**Maps to**: brief requirement 5 (must run on this machine's simulator setup, no CI)

1. With `Finanzas Fidelity` booted, run
   `bash scripts/mobile-ui/capture-simulator.sh --profile iphone-393x852 --check-only`.
2. Shut it down, boot a different device (e.g. `iPhone 17`), and run the same command.
3. Re-boot `Finanzas Fidelity`.

**Expected result**: step 1 prints the resolved UDID and exits 0. Step 2 exits non-zero and prints
the `xcrun simctl create "Finanzas Fidelity" …` command instead of capturing the wrong device.

### Step 8: Planned targets are refused, with the owning issue named

**Maps to**: brief requirement 3 (screen items inherit a concrete obligation)

1. Run `pnpm fidelity --all --dry-run`.
2. Run `pnpm fidelity --screen home --state pending`.

**Expected result**: the dry run lists every target with its profile, fixture, status and owning
issue. The second command fails fast with a message of the form
`Target "home--pending" is still planned (owned by issue #12); wire it before running the gate.`

### Step 9: The device leg, end to end

**Maps to**: brief requirements 4 and 5

1. Flip the `settings` mapping in the contract to `status: "wired"` with `app_file`
   `apps/mobile/app/settings/index.tsx`, `deep_link`
   `finanzas:///settings?fidelity=1&fidelityScreen=settings`, and `ready_test_id`
   `fidelity-settings`; add `testID={fidelityTestId('settings')}` to the placeholder root.
2. With the dev build running on `Finanzas Fidelity`, run `pnpm fidelity --screen settings`.
3. Open `.tmp/ui-fidelity/app-settings-iphone-393x852.png` and the diff PNG.

**Expected result**: the app capture is produced at 393×852 and shows the running placeholder
screen (not a splash screen, not the home screen — the deep link and the readiness poll both
worked). The comparison **fails with exit 1** at a very high mismatch, because the route is still a
`RoutePlaceholder`. That failure is the pass condition of this step: capture → normalise → diff →
non-zero exit are all wired.

**Known limitation**: a true on-device *PASS* is impossible until a real screen exists. The first
screen item to reach implementation records it. Do not manufacture one here.

### Step 10: Release-build safety of the preview helper

**Maps to**: non-negotiable #7 / release-build hygiene

1. Run `pnpm --filter @finanzas/mobile test`.

**Expected result**: the `fidelity-preview` tests pass, including the case asserting
`{ active: false, state: null }` when `__DEV__` is false.

### Last Step: Validate and clean up

1. Confirm every assertion below.
2. Revert any temporary contract or `testID` edits made in steps 2, 3 and 9 unless the PR
   deliberately keeps them (plan Implementation Order step 14) — and make sure the PR's contract
   summary line matches the committed state.
3. Delete `.tmp/ui-fidelity/` if you want a clean slate; it is gitignored either way.
4. Shut down the simulator: `xcrun simctl shutdown "Finanzas Fidelity"`.

---

## Assertions Checklist

- [ ] `pnpm fidelity:contract` validates the contract against the live manifest and prints the
      target/screen/exclusion counts (brief 1)
- [ ] A missing coverage target, an unknown state, or an unexplained raised threshold fails the
      contract check (brief 1, 2)
- [ ] Per-screen thresholds live in `scripts/mobile-ui/fidelity-targets.json`, and any value above
      the default carries a `threshold_note` (brief 2)
- [ ] `pnpm fidelity:contract` and `pnpm fidelity:test` run in the CI `test` job, so a screen PR
      that skips registration or wiring fails a required check (brief 3)
- [ ] `docs/best-practices/stack/mobile-ui-fidelity.md` states where fidelity evidence goes and what
      a screen PR must attach; `AGENTS.md` non-negotiable #6 makes it mandatory (brief 3)
- [ ] `pnpm fidelity:verify-gate` passes on a faithful pair and fails on a wrong token, a wrong
      state and a wrong device size — all four results recorded in the PR (brief 4)
- [ ] The device leg captures the running app on `Finanzas Fidelity` and the gate exits non-zero
      against the placeholder screen (brief 4, 5)
- [ ] Nothing in this item requires CI, a network service, or a credential (brief 5)
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| None | Neither the mockup capture nor the placeholder app screen reads the database. The contract declares the fixture names `seed-default` and `empty-db` for future screen items only. | — |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `browserType.launch: Executable doesn't exist` | The root `playwright` package version has no matching browser in the local cache | `npx playwright install chromium` |
| Capture shows the Expo splash or a bundling screen | Metro was cold; the stability poll locked on too early | Leave the dev build running and re-run; if it repeats, raise `settle_ms` for that mapping — this is a capture setting, not a threshold |
| Capture shows the wrong screen | The deep link did not route; the app may have been backgrounded | Confirm `finanzas` is the scheme in `apps/mobile/app.config.js` and run `xcrun simctl openurl booted "<deep link>"` by hand |
| `no booted simulator matches profile` | A different device is booted | `xcrun simctl boot "Finanzas Fidelity"`; create it first if it does not exist |
| App capture is 1179×2556 | `sips` normalisation did not run | Confirm `sips` is on `PATH`; the script resamples Retina captures to the profile width |
| Every screen fails with a mismatch just above its threshold | Genuine drift, or a font/antialiasing difference | Inspect the diff PNG. Fix the screen. Only if the difference is provably a renderer artefact may the threshold move — with a `threshold_note` and a justification in the PR |
| `Target … is still planned` | The target has not been wired by its screen item yet | Expected before the screen exists; flip it to `wired` in that screen item |

---

## Known Limitations

- **No on-device PASS yet.** Every route is a `RoutePlaceholder`, so the device leg can only prove
  that the gate captures and fails correctly. The first faithful-build PASS is recorded by the first
  screen item.
- **No CI simulator run.** The device leg is local by design (plan follow-up 1). CI runs only the
  contract validation and the unit tests.
- **Pixel diff is a drift detector, not a pixel-identity assertion.** Chromium and React Native
  antialias text, shadows and charts differently; that is why thresholds are per screen.
- **One profile.** Small-screen (`iPhone SE`) coverage is not part of v1, even though
  `docs/best-practices/stack/mobile-ui-fidelity.md` asks for a small-screen check on
  density-risky screens; that check stays manual for now.
