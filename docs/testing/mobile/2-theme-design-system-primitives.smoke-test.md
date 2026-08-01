# Smoke Test Runbook: Theme and design-system primitives

**Feature**: Theme and design-system primitives (issue #2)
**Spec**: None — Refactor route. The work item brief is reproduced in the
[implementation plan](../../specs/developments/20260801172100_2-theme-design-system-primitives/2_2-theme-design-system-primitives_implementation-plan.md).
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

Before running this smoke test:

- [ ] `pnpm install` has been run at the repo root (Node 22 via `.nvmrc`, pnpm 11.12.0)
- [ ] A booted iOS simulator (or a physical device with Expo Go). `pnpm dev:mobile` then `i`
- [ ] The app is running in **development** mode, so `__DEV__` is `true` — the gallery route
      renders nothing otherwise, by design
- [ ] `design/mockups/mobile/index.html` can be opened in a browser next to the simulator
      (`pnpm mockups:mobile`)
- [ ] No database, no seed data, no login. This product has no sign-in and this item touches no
      SQLite

---

## Test Data

| Item | Value |
| --- | --- |
| Gallery route | `/(dev)/gallery` |
| Gallery copy source | `apps/mobile/src/dev/gallery.strings.ts` |
| Primary reference screen | `design/mockups/mobile/index.html#screen=ds-components` |
| Typography / amounts reference | `design/mockups/mobile/index.html#screen=ds-typography` |
| Colour reference | `design/mockups/mobile/index.html#screen=ds-colors` |
| Token file | `design/tokens.json` (`$version` must read `1.1.0`) |

No user accounts, no seeded rows.

---

## Smoke Test Steps

### Step 1: Token mirror is intact across all three files

**Maps to**: AC1, and the `design/README.md` token workflow

1. Open `design/tokens.json` and confirm `$version` is `1.1.0` and that `colors.overlayScrim`,
   `colors.focusRing`, `colors.onGradientSurface`, `colors.onGradientDecoration`,
   `colors.switchTrackOff`, `radius.control` and `typography.scale.amount.stat` are present.
2. Open `design/mockups/mobile/index.html` and confirm the `:root` block declares
   `--overlay-scrim`, `--focus-ring`, `--on-grad-surface`, `--on-grad-decoration`,
   `--switch-track-off` and `--r-control` with the same values.
3. Run `pnpm --filter @finanzas/mobile test`.

**Expected result**: `theme-tokens-parity.test.ts` passes in both directions — no token missing
from `apps/mobile/src/theme.ts`, no extra key in `theme` that is absent from `design/tokens.json`.

### Step 2: The mockup still renders unchanged after the `:root` rewrite

**Maps to**: AC1 (no visual regression from the token mirror)

1. `pnpm mockups:mobile`.
2. Visit, in order: `#screen=ds-colors`, `#screen=ds-components`,
   `#screen=home&state=pending`, `#screen=categorize&state=exclude-sheet`,
   `#screen=bank-picker&state=no-results`, `#screen=settings-account&state=delete-confirm`.

**Expected result**: every screen looks exactly as before the change, except `#screen=ds-colors`,
which now shows one additional "Superposiciones y controles" swatch group. The overlay scrim
behind the exclude sheet and the delete-confirm modal is unchanged; the hero on `home` is
unchanged; the switch track and the checkbox corner radius on `#screen=ds-components` are
unchanged.

### Step 3: Machine checks for AC1, AC2 and AC4

**Maps to**: AC1, AC2, AC4

1. `pnpm --filter @finanzas/mobile test`
2. `pnpm --filter @finanzas/mobile typecheck`
3. `pnpm --filter @finanzas/mobile lint`

**Expected result**:

- `no-style-literals.test.ts` reports zero violations across
  `apps/mobile/src/components/ui/`, `apps/mobile/src/dev/` and `apps/mobile/app/(dev)/`
- `mu-class-coverage.test.ts` passes both assertions, and its reported class count equals the
  number of entries in `apps/mobile/src/test-utils/mu-class-map.ts`
- `touch-targets.test.ts` passes for every entry in `TOUCH_METRICS`
- `route-manifest-parity.test.ts` still reports the 25 manifest MVP routes and still finds no
  route containing `design-system`
- typecheck and lint are clean

### Step 4: Reach the gallery route

**Maps to**: AC3, and the dev-only gating decision

1. With the app running in development, open the gallery deep link:
   `npx uri-scheme open finanzas://\(dev\)/gallery --ios`
   (or type the path into the Expo Router dev menu).

**Expected result**: the design-system gallery renders, with a top bar reading
`DS · Componentes` and a scrolling list of sections.

### Step 5: Every primitive renders

**Maps to**: AC2, AC3

Scroll the gallery top to bottom and confirm each of the 23 primitives appears at least once:

1. `Text` — the Tipografía section shows h1, h2, h3, body, body-lead, small, xs, eyebrow,
   label, hint and mono variants
2. `Button` — six variants: primario, muted (deshabilitado), outline, ghost, danger,
   danger-soft; plus one `size="sm"`
3. `Card` — default, tight and flat variants, one with a title/subtitle header
4. `Hero` — at least the `challenge` gradient; icon, title and subtitle
5. `Badge` — neutro, ok, warn, danger, info, celebration
6. `CategoryChip` — default, selected and suggested (the suggested chip shows the ✨ star)
7. `StatTile` — one income tile and one expense tile
8. `Note` — info, ok, warn, danger
9. `TransactionRow` — default, pending and excluded
10. `TextField` — placeholder, with hint, with error, and locked
11. `Checkbox` — on and off
12. `Radio` — on and off
13. `Switch` — on and off
14. `Segment` — two options, one active
15. `Pill` — active and inactive
16. `Sheet` — opened by a button in the gallery
17. `Modal` — opened by a button in the gallery
18. `TabBar` — four items, one active
19. `Progress` — a partially filled bar
20. `Steps` — a segmented progress bar with only its first segment active
21. `Dots` — three dots, one elongated and active
22. `EmptyState` — icon, title, description and an action button
23. `Amount` — hero, lg and md sizes; `in` and `out` tones

**Expected result**: all 23 render without a red box, a missing style, or clipped text.

### Step 6: Interactive states behave

**Maps to**: AC3, AC4

1. Tap the `TextField` in the Campos section.
2. Tap each `Checkbox`, `Radio` and `Switch`.
3. Tap each `Segment` option and each `Pill`.
4. Tap the button that opens the `Sheet`, then dismiss it; do the same for the `Modal`.
5. Tap each `TabBar` item.

**Expected result**: the field shows the focus ring (`colors.focusRing`); the controls toggle;
the segment and pill active states move; the sheet slides up from the bottom over the scrim and
the modal appears centred over it; both dismiss. Nothing crashes.

### Step 7: Touch targets are comfortable

**Maps to**: AC4

1. Using a fingertip on a physical device (or the simulator with a deliberately imprecise
   click), tap **just outside** the visible box of: the small button, a `Pill`, a
   `Segment` option, a `Checkbox`, a `Radio` and the `Switch` — roughly 8–10 pt beyond the
   drawn edge.

**Expected result**: each control still activates. These five are drawn smaller than 44 pt in
the mockup on purpose; `hitSlop` expands the effective target to at least
`theme.touchTarget.min`. `touch-targets.test.ts` (Step 3) is the authoritative check; this step
confirms it feels right in the hand.

### Step 8: Design fidelity — expected vs actual

**Maps to**: AC3

Design assets for this item are the mockup screens named in the issue body. This is a
lightweight visual comparison, not a pixel diff.

1. Open `design/mockups/mobile/index.html#screen=ds-components` in a browser beside the
   simulator showing the gallery.
2. Compare, section by section and in this order: Botones, Badges, Chips de categoría, Campos,
   Transacciones, Avisos, Stat tiles. Check colour, corner radius, border weight, vertical
   rhythm between sections, and the Spanish copy.
3. Open `#screen=ds-typography` and compare the gallery's Tipografía y montos section: type
   sizes and weights, the `+` prefix on income, the amber expense tone, and tabular figures.
4. For each additional gallery section, open its reference screen and compare:
   Card → `#screen=dashboard`; Hero → `#screen=home&state=pending`;
   Segment → `#screen=notifications-schedule`; Pill → `#screen=transactions&state=filters`;
   Progress → `#screen=bank-syncing&state=products`; Steps → `#screen=categorize`;
   Dots → `#screen=onboarding-value&state=step-2`;
   EmptyState → `#screen=bank-picker&state=no-results`; TabBar → `#screen=home`;
   Sheet → `#screen=categorize&state=exclude-sheet`;
   Modal → `#screen=settings-account&state=delete-confirm`.
5. Record PASS/FAIL per section, with expected-vs-actual detail on failure. Keep any
   screenshots under `.tmp/`.

**Expected result**: the gallery matches `#screen=ds-components` for the seven mirrored
sections, and each additional primitive matches its named reference screen. Differences that
follow from React Native versus CSS (font smoothing, hover states, shadow rendering on Android)
are acceptable and must be listed explicitly as known acceptable differences in the PR.

### Step 9: The gallery is gated out of production

**Maps to**: the dev-only requirement in the work item brief

1. Confirm `apps/mobile/app/(dev)/gallery.tsx` guards on `__DEV__` before rendering anything.
2. Confirm no file under `apps/mobile/app/` other than that route references `(dev)/gallery`.
3. Confirm the parity test's dev-route guard assertion passes (Step 3).

**Expected result**: there is no navigable path to the gallery from any product screen, and the
route renders `null` in a release build.

### Last Step: Validate & Shut Down

- Verify all assertions in the checklist below are met
- Stop the Expo dev server and close the mockup browser tab

---

## Assertions Checklist

- [ ] **AC1** — `theme-tokens-parity.test.ts` passes and `no-style-literals.test.ts` reports
      zero violations outside `apps/mobile/src/theme.ts` (Steps 1, 3)
- [ ] **AC1** — the seven new tokens exist in `design/tokens.json`, are mirrored in the mockup
      `:root`, and are consumed from `theme.ts` (Steps 1, 2)
- [ ] **AC2** — every `mu-*` class in the mockup stylesheet is classified, and every
      `primitive` entry resolves to an export of `apps/mobile/src/components/ui/index.ts`
      (Step 3)
- [ ] **AC2** — all 23 primitives render in the gallery (Step 5)
- [ ] **AC3** — the gallery's seven mirrored sections match `#screen=ds-components` (Step 8)
- [ ] **AC3** — every additional gallery section matches its named reference screen (Step 8)
- [ ] **AC4** — `touch-targets.test.ts` passes, and the five sub-44 pt controls activate from
      outside their drawn box (Steps 3, 7)
- [ ] Existing route/manifest parity is preserved: 25 manifest MVP routes, no `design-system`
      route, no `(auth)` group (Step 3)
- [ ] The gallery is unreachable and renders nothing outside `__DEV__` (Step 9)
- [ ] `Amount` performs no CLP formatting arithmetic — the only path from `minorUnits` to text
      is the injected `format` callback (code read during Step 4 of the implementation order)

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Gallery sample content | Emoji, labels, amounts and states copied verbatim from `#screen=ds-components` and `#screen=ds-typography` | Static, in `apps/mobile/src/dev/gallery.strings.ts`. Nothing to load |

No database. No SQLite in this item.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| The gallery route renders a blank screen | The app is running in a production/release configuration, so `__DEV__` is `false` | Restart with `pnpm dev:mobile`; this is the gate working as designed |
| The deep link does nothing | The `(dev)` group parentheses were not escaped in the shell | Quote the whole URL: `npx uri-scheme open "finanzas://(dev)/gallery" --ios` |
| `theme-tokens-parity.test.ts` fails with an extra key | `componentMetrics` was merged into `theme` instead of exported separately | Keep the two exports separate — the parity test runs against `theme` only |
| `no-style-literals.test.ts` flags a legitimate value | The value belongs in `theme.ts` | Move it to `componentMetrics` under the right primitive. Use a `style-literal-allow: <reason>` suppression only when the value genuinely cannot be a token, and expect it to be questioned in review |
| `route-manifest-parity.test.ts` fails on set equality | `DEV_ONLY_ROUTES` was not subtracted, or the gallery route file was renamed | Keep the route at `app/(dev)/gallery.tsx` and the allowlist entry at `/(dev)/gallery` |
| Colours look washed out on the simulator | Display colour profile, not the theme | Compare against the mockup in the same browser/display; note it as a known acceptable difference |
| Shadows look flat on Android | React Native maps `shadow*` to `elevation` on Android | Expected. Record as a known acceptable difference; do not add a literal to compensate |

---

## Known Limitations

- Visual fidelity (AC3) is checked by eye. There is no automated mockup capture/compare tool
  yet — it is tracked as a separate backlog item and noted in
  `docs/best-practices/stack/mobile-ui-fidelity.md`.
- The style-literal scanner only catches a numeric literal directly assigned to a tracked style
  property. `padding: theme.space[4] + 2` escapes it; code review and Step 8 cover that residue.
- There is no component-render test tier in this repo, so prop-driven state changes are checked
  by hand in Step 6 rather than by an automated test.
- The gallery is a superset of `#screen=ds-components`: that screen shows seven primitive
  groups, while the brief requires all 23 primitives. Sections beyond the seven are compared
  against the reference screens named in Step 8 instead.
