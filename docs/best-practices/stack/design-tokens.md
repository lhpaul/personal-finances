# Design tokens & UI

[`design/tokens.json`](../../../design/tokens.json) is canonical. The mockup `:root` block and
`apps/mobile/src/theme.ts` are both mirrors of it.

## The rule

No hardcoded colour, spacing, radius, font size or shadow in app code. If a value is missing:

1. Add it to `design/tokens.json`
2. Mirror it in `design/mockups/mobile/index.html` `:root`
3. Expose it in `apps/mobile/src/theme.ts`

All three in the **same commit**. A drifting token file is worse than no token file.

```ts
// ✅
<View style={{ padding: theme.space[4], borderRadius: theme.radius.card }} />
// ❌
<View style={{ padding: 16, borderRadius: 20 }} />
```

## Component layer

`apps/mobile/src/components/ui/` mirrors the `mu-*` primitives in the mockups one-to-one. Building a screen means
composing these, not restyling from scratch:

| Mockup class | Component |
|--------------|-----------|
| `.mu-btn` + modifiers | `<Button variant="primary\|outline\|ghost\|danger">` |
| `.mu-card` | `<Card>` |
| `.mu-tx` | `<TransactionRow>` |
| `.mu-badge` | `<Badge tone="ok\|warn\|danger\|info\|celebration">` |
| `.mu-chip` | `<CategoryChip selected suggested>` |
| `.mu-stat` | `<StatTile tone="income\|expense">` |
| `.mu-note` | `<Note tone>` |
| `.mu-input`, `.mu-check`, `.mu-radio`, `.mu-switch` | `<TextField>`, `<Checkbox>`, `<Radio>`, `<Switch>` |
| `.mu-tabbar` | `<TabBar>` |

A one-off style inside a feature is a signal the primitive is missing. Add it to
`src/components/ui/` and to `#screen=ds-components`.

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
