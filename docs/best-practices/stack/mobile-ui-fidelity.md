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

For each screen state in the manifest, compare the running app against the mockup at the same
hash:

```bash
open 'design/mockups/mobile/index.html#screen=transactions&state=filters'
```

- **Every declared state, not just the happy path.** A screen is not done until each
  `state_id` under its manifest entry renders. `empty`, `error` and loading are the ones that
  get skipped, and they are the ones users hit.
- Capture at least one small-screen and one normal-screen viewport wherever text wrapping or
  density is risky — Spanish copy is long.
- Simulator or device validation for anything native. Jest cannot prove visual parity, safe
  areas, or gesture behaviour.
- Keep temporary screenshots under `.tmp/` unless the runbook asks for a committed artifact.

> Tooling to automate this comparison (`mockups:capture`, `compare`) is tracked as a backlog
> item. Until it lands the check is manual, and the PR must say so.

## Implementation rules

- Compose the shared primitives in `src/components/ui/` before writing a one-off style. A
  one-off is a signal the primitive is missing — add it there and to `#screen=ds-components`.
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
