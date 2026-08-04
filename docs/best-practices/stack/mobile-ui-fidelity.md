# Mobile UI fidelity

Applies to screen work in `apps/mobile`. Adapted from the same conventions in `zeki-platform`.

`design/mockups/mobile/` is the UI contract. This document is how that contract is *checked*
rather than merely asserted.

---

## When fidelity evidence is required

Capture visual evidence when a change affects:

- screen layout, spacing, typography or colour;
- any screen with a `#screen=` reference in its backlog item — which is every screen item;
- safe-area, keyboard or small-screen behaviour;
- charts and the donut / bar / line components on `home` and `dashboard`;
- an acceptance criterion that references a mockup or a screen state.

## The check

The comparison is automated (`scripts/mobile-ui/`, item #47) and enforced in CI, in addition to
the manual eyeballing below.

For each screen state in the manifest, compare the running app against the mockup at the same
hash:

```bash
open 'design/mockups/mobile/index.html#screen=transactions&state=filters'
```

- **Every declared state, not just the happy path.** A screen is not done until each
  `state_id` under its manifest entry renders. `empty`, `error` and loading are the ones that
  get skipped, and they are the ones users hit.
- Capture at least one small-screen and one normal-screen viewport wherever text wrapping or
  density is risky — Spanish copy is long. The fidelity gate itself checks a single profile
  (`iphone-393x852`); the small-screen check stays manual for now (see Known limitations below).
- Simulator or device validation for anything native. Jest cannot prove visual parity, safe
  areas, or gesture behaviour.
- Keep temporary screenshots under `.tmp/` unless the runbook asks for a committed artifact.

### Commands

<!-- workflow-shell-contract: bash -->
```bash
pnpm fidelity:contract                          # validates scripts/mobile-ui/fidelity-targets.json
                                                 # against design/mockups/mobile/mockup-manifest.js
pnpm fidelity:test                               # unit tests for the contract validator and comparator
pnpm fidelity:capture-mockup --screen home --state pending   # one mockup capture, no simulator
pnpm fidelity --screen home --state pending      # full gate: mockup + simulator + diff, exits 1 on drift
pnpm fidelity --issue 12                         # every target owned by one issue
pnpm fidelity --all --dry-run                    # lists every target, its profile, fixture and status
pnpm fidelity:verify-gate                        # proves the comparator discriminates, both directions
bash scripts/mobile-ui/verify-gate.sh            # equivalent direct invocation of fidelity:verify-gate
```

`pnpm fidelity:contract` and `pnpm fidelity:test` run in CI on every PR (no browser, no
simulator). `pnpm fidelity` and `pnpm fidelity:verify-gate` are local-only — the device leg needs
a booted simulator and a native dev build (CI simulator jobs are a follow-up, tracked in the
item #47 implementation plan).

### Simulator setup

The gate uses a single profile, `iphone-393x852` (matching the mockup's `393×852` frame exactly,
so no capture ever needs resampling to compare), on a dedicated simulator named
`Finanzas Fidelity`:

<!-- workflow-shell-contract: bash -->
```bash
xcrun simctl create "Finanzas Fidelity" "iPhone 16" "<runtime id, e.g. com.apple.CoreSimulator.SimRuntime.iOS-26-5>"
xcrun simctl boot "Finanzas Fidelity"
npx expo run:ios --device "Finanzas Fidelity"   # native dev build; Expo Go is not sufficient
bash scripts/mobile-ui/capture-simulator.sh --profile iphone-393x852 --check-only   # verify resolution
```

If `iPhone 16` is not creatable on the installed runtime, retry with `iPhone 15`, then
`iPhone 14` — `scripts/mobile-ui/capture-simulator.sh --check-only` prints the exact `simctl
create` command (with the fallback device types) when no booted simulator matches the profile.

### The `planned` → `wired` obligation

Every MVP screen/state target starts `status: "planned"` in `scripts/mobile-ui/fidelity-targets.json`
— registered against the manifest, not yet runnable. The screen item that implements a target
flips its mapping(s) to `status: "wired"`, adding `app_file`, `deep_link` (scheme `finanzas:`,
`fidelity=1`, `fidelityScreen`/`fidelityState` matching the target) and `ready_test_id`
(`fidelityTestId(screenId)` from `apps/mobile/src/lib/fidelity-preview.ts`, applied as the
screen's root `testID`). `pnpm fidelity:contract` statically verifies the file exists and the
selector appears in it — a screen PR that ships UI without wiring its targets fails a required
CI check.

### The preview-mode convention (a non-deterministic screen)

A screen whose state is driven by a live process — an animated `Progress` bar, a timer, an
in-flight read — cannot be captured deterministically by simply rendering it normally: the
`app_file` in mid-flight might sit anywhere between two frames. `useFidelityPreview()`
(`apps/mobile/src/lib/fidelity-preview.ts`) is the standard fix: `__DEV__`-only, it reads
`fidelity` / `fidelityState` off the deep link's query params and returns `{ active, state }`.
When `active`, the screen renders the named state from a **fixed presentation** instead of its
live one — no timer started, no animation, no process kicked off. `#screen=bank-syncing` (item
#11) is the reference case: its bar is normally driven by the scraper's own live progress, but
under a preview capture it renders exactly at `PROGRESS_FLOOR[state]` (the same fixed width the
mockup itself draws) and starts no bank read at all — no WebView mount, no keychain access, no
sync call. A screen that owns a real side effect (a data hook, a mounted native component) still
calls that hook unconditionally — React's Rules of Hooks forbid a conditional call — but gates the
side effect itself behind `!preview.active` inside the hook, not around the hook call.

### Threshold policy

`scripts/mobile-ui/fidelity-targets.json` sets `defaults.max_mismatch_pct` (currently `3.0`) and
`defaults.pixel_threshold`. A mapping may override `max_mismatch_pct` for a screen with a known,
accepted rendering difference (chart antialiasing, an in-flight animation) — **any value above
the default requires a non-empty `threshold_note`** explaining why, and the contract validator
rejects the file otherwise. This is the anti-gaming rule: the way to make a failing screen pass
is to fix the screen. If a threshold genuinely needs to move, the reason lives in the contract
and in the diff of the PR that moved it — never move it to hide unrelated drift.

## Implementation rules

- Compose the shared primitives in `src/components/ui/` before writing a one-off style. A
  one-off is a signal the primitive is missing — add it there and to `#screen=ds-components`.
  Before writing a screen, check the primitive in the running app at `finanzas://gallery`
  (`/gallery`) — a `__DEV__`-only route rendering every primitive with sample data. It has no
  reachable entry point in a release build. See [`design-tokens.md`](design-tokens.md#checking-a-primitive-before-writing-a-screen).
  **Known gap**: item #12's five new primitives (`ScreenHeader`, `CategoryRow`, `LineChart`,
  `Legend`, `BankRow`) are showcased in the app gallery but not yet in the mockup's own
  `#screen=ds-components` — that side is a design-asset change tracked as a follow-up, not made
  by that implementation.
- Tokens come from `apps/mobile/src/theme.ts`, mirroring `design/tokens.json`. No literal hex,
  spacing or radius. See [`design-tokens.md`](design-tokens.md).
- **No user-facing literals in JSX.** Copy comes from the i18n catalogues, and the Spanish
  string comes from the mockup. See [`i18n.md`](i18n.md).
- Respect safe areas. Avoid absolute positioning that can overlap system UI or a bottom sheet.
- Prefer inline loading / empty / error states that preserve layout stability over full-screen
  swaps that make the app jump.
- Colour carries meaning here — expenses amber, income green. Never invert it for aesthetics.

## Review evidence

A PR for visual work states:

- which `#screen=` and `state=` were compared;
- the simulator or device and the viewport used;
- screenshot or diff artifact paths;
- known acceptable differences, if any;
- the commands run.

For a screen item wiring one or more fidelity targets, paste the automated gate's summary table
into the PR:

| Target | Status | Mismatch | Verdict |
| --- | --- | --- | --- |
| `home--pending` | wired | 1.8% | PASS |
| `home--all-clear` | wired | 2.1% | PASS |

Plus `pnpm fidelity:contract`'s output line (proves the contract still matches the manifest
after the change) and, for any raised threshold, its `threshold_note` and the reason it moved.

## Known limitation — the first on-device PASS

No screen exists yet as of item #47 (every route is a `RoutePlaceholder`). A true on-device
*PASS* cannot exist until a real screen renders — item #47 proves the comparator discriminates
with `pnpm fidelity:verify-gate` (mockup-only: a faithful pair passes, a wrong token, a wrong
state and a wrong device size all fail) and records the device leg failing as expected against
a placeholder. The **first screen item to reach implementation** records the first true
faithful-build PASS. Do not raise a threshold to manufacture one early — that would void the
gate for every screen item that follows.
