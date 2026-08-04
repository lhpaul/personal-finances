# Design tokens & UI

[`design/tokens.json`](../../../design/tokens.json) is canonical. The mockup `:root` block and
`apps/mobile/src/theme.ts` are both mirrors of it.

## The rule

No hardcoded colour, spacing, radius, font size or shadow in app code. If a value is missing:

1. Add it to `design/tokens.json`
2. Mirror it in `design/mockups/mobile/index.html` `:root`
3. Expose it in `apps/mobile/src/theme.ts`

All three in the **same commit**. A drifting token file is worse than no token file. A token
added without a `theme.ts` mirror fails `theme-tokens-parity.test.ts` in CI — see
[`theme.ts`'s parity guarantee](#themets-theme-vs-componentmetrics) below.

```ts
// ✅
<View style={{ padding: theme.space[4], borderRadius: theme.radius.card }} />
// ❌
<View style={{ padding: 16, borderRadius: 20 }} />
```

## `theme.ts`: `theme` vs `componentMetrics`

`apps/mobile/src/theme.ts` exports two values:

- **`theme`** — a hand-written, parity-tested mirror of `design/tokens.json`'s ten token groups
  (`colors`, `gradients`, `chart`, `typography`, `space`, `radius`, `shadow`, `layout`,
  `touchTarget`, `categoryIcons`). `theme-tokens-parity.test.ts` asserts deep equality in both
  directions, so `theme` can never silently drift from the token file, and a new top-level
  token group fails the test until someone decides whether to mirror or explicitly exclude it.
- **`componentMetrics`** — per-primitive geometry read off the mockup's `mu-*` CSS that is
  **not** a design token: border widths, control sizing (button heights, chip dimensions, …),
  glyph sizes, letter-spacing/line-height overrides, and decomposed shadow layers (React
  Native's shadow API has no single `box-shadow` equivalent). Every entry's doc comment cites
  its `.mu-*` selector and `design/mockups/mobile/index.html` line number. `componentMetrics` is
  deliberately **not** parity-tested against `tokens.json` — it would defeat its purpose as a
  geometry scratchpad distinct from the token contract.

**Graduation rule**: a `componentMetrics` value graduates to `design/tokens.json` when it is a
colour, or when two unrelated primitives use the same value for the same semantic reason (this
is why shadow decompositions live in a shared `componentMetrics.shadow.{sm,card}` group rather
than being duplicated per primitive).

- **`screenMetrics`** — the same idea as `componentMetrics`, but namespaced per **screen**
  rather than per `components/ui/` primitive (added by issue #8's implementation plan, Decision
  10). `componentMetrics` cannot host screen-level measurements: every one of its groups is
  named after a primitive, and `theme` itself cannot grow a group —
  `theme-tokens-parity.test.ts` asserts `Object.keys(theme).sort()` equals an exact ten-group
  allowlist mirrored from `design/tokens.json`. `screenMetrics` is a sibling export with the
  same doc-comment contract and the same graduation rule as `componentMetrics`. Example:
  `screenMetrics.onboarding.heroGlyphSize` (the 62px hero glyph shared by `onboarding-intro`,
  `onboarding-value` and `onboarding-ready`). Every later screen item follows this pattern
  instead of stretching `componentMetrics` past its documented meaning. Item #19 added
  `componentMetrics.listRow` (the `ListRow`/`ListGroup` primitives — `.mu-item`, `.mu-item__icon`,
  `.mu-item__title`; the shared `.mu-item__chev`/`__sub`/`__txt` stay under `componentMetrics.
  bankRow`, jointly owned with `BankRow`/`CategoryRow`) and `screenMetrics.settings` (the
  local-profile device avatar and the about screen's brand-block icon — both bare inline styles
  in the mockup, not `mu-*` classes).

Both `theme` and `componentMetrics` live in `theme.ts`, so "no hardcoded literal" holds
literally: `no-style-literals.test.ts` scans every `.ts`/`.tsx` file under `apps/mobile/app/`
and `apps/mobile/src/` (excluding `theme.ts` itself and test files) for hex colours,
`rgb()`/`rgba()` colours, and numeric literals assigned to a tracked style property
(`padding*`, `margin*`, `fontSize`, `borderRadius`, `width`, `height`, …).

## Touch targets: visual box vs `hitSlop`

Several mockup controls are visually smaller than the 44pt minimum touch target
(`theme.touchTarget.min`): `Button` `size="sm"` is 40pt tall, `Checkbox`/`Radio` are 22×22,
`Switch` is 27pt tall. Shrinking these to "look right" per the mockup would fail accessibility;
enlarging them to 44pt would break mockup fidelity. The fix is
`apps/mobile/src/components/ui/_internal/touch-metrics.ts`:

- `withMinTarget({ width?, height })` computes a symmetric `hitSlop` that expands the
  **invisible** press area to reach `theme.touchTarget.min`, without changing the primitive's
  **visual** box.
- `TOUCH_METRICS` is a single record — one entry per pressable primitive — that every
  pressable's `hitSlop` prop reads from. `touch-targets.test.ts` iterates that same record and
  asserts every entry reaches the minimum on both axes, so there is one enumeration and no
  drift between what a component uses and what the test checks.

`Checkbox`, `Radio` and `Switch` are the one exception: each may render as a plain `View` (no
`hitSlop`) when rendered inside an external pressable row that owns the press (e.g. a settings
list item) — only the component that owns the press applies `hitSlop`.

## Component layer

`apps/mobile/src/components/ui/` mirrors the `mu-*` primitives in the mockups one-to-one (23
components — see the theme and design-system primitives implementation plan for the full
`mu-class` classification of every stylesheet class into `primitive` / `utility` / `deferred`).
Building a screen means composing these, not restyling from scratch:

| Mockup class(es) | Component |
|--------------|-----------|
| `.mu-h1`…`.mu-xs`, `.mu-eyebrow`, `.mu-label`, `.mu-hint`, `.mu-mono`, `.mu-center` | `<Text variant="h1\|h2\|h3\|body\|bodyLead\|small\|xs\|eyebrow\|label\|hint\|mono" center>` |
| `.mu-btn` + modifiers | `<Button variant="primary\|muted\|outline\|ghost\|danger\|dangerSoft" size="md\|sm">` |
| `.mu-card` + modifiers | `<Card variant="default\|tight\|flat">` |
| `.mu-hero` | `<Hero gradient="challenge\|income\|expense\|celebration\|brand">` |
| `.mu-badge` | `<Badge tone="neutral\|ok\|warn\|danger\|info\|celebration">` |
| `.mu-chip` | `<CategoryChip state="default\|selected\|suggested">` |
| `.mu-stat` | `<StatTile tone="income\|expense">` |
| `.mu-note` | `<Note tone="info\|ok\|warn\|danger">` |
| `.mu-tx` | `<TransactionRow direction="in\|out" state="default\|pending\|excluded">` |
| `.mu-field`, `.mu-input` | `<TextField>` |
| `.mu-check` | `<Checkbox>` |
| `.mu-radio` | `<Radio>` |
| `.mu-switch` | `<Switch>` |
| `.mu-segment` | `<Segment>` |
| `.mu-pill` | `<Pill>` |
| `.mu-overlay` | `_internal/Overlay` (shared by `Sheet`/`Modal`, not in the public barrel) |
| `.mu-sheet` | `<Sheet>` |
| `.mu-modal` | `<Modal>` |
| `.mu-tabbar` | `<TabBar>` |
| `.mu-progress` | `<Progress>` |
| `.mu-steps` | `<Steps>` |
| `.mu-dots` | `<Dots>` |
| `.mu-empty` | `<EmptyState>` |
| `.mu-amount` | `<Amount>` — `formatted` string or `minorUnits` + a required `format` callback; never a default CLP formatter (that seam belongs to `@finanzas/shared-utils`) |

A one-off style inside a feature is a signal the primitive is missing. Add it to
`src/components/ui/` and to `#screen=ds-components`.

### Checking a primitive before writing a screen

Run the app and open `finanzas://gallery` (or navigate to `/gallery`) — a `__DEV__`-only route
that renders every primitive with sample data, grouped to match `#screen=ds-components` and
`#screen=ds-typography`. It never ships in a release build (see
[`mobile-ui-fidelity.md`](mobile-ui-fidelity.md)).

## Colour semantics

Colour carries meaning in this product; using the wrong one misinforms.

| Meaning | Token |
|---------|-------|
| Brand, CTA, active tab, primary chart series | `brandPrimary` `#6366f1` |
| **Expenses**, pending categorization | `brandSecondary` / `warning` `#f59e0b` |
| **Income**, synced, on track | `success` `#10b981` |
| Errors, destructive actions | `danger` `#ef4444` |
| Challenges, celebration | `celebration` `#8b5cf6` |

Never render an expense in green or an income in amber, even if a designer's mock looks nicer.

## Verifying against the mockups

Before marking a UI item done, open the referenced screen and compare side by side:

```bash
open 'design/mockups/mobile/index.html#screen=transactions&state=filters'
```

Then run the app screen next to it. The mockup is the contract for layout, spacing, copy and
states — differences are either a bug in the implementation or a change that belongs in the
mockup first.

## Design-system screens

`#screen=ds-colors`, `ds-typography`, `ds-components` are the visual reference. When you add a
primitive or a token, add it there too — that is what makes the system reviewable.
