# Theme and design-system primitives — Implementation Plan

**Work item**: [lhpaul/personal-finances#2](https://github.com/lhpaul/personal-finances/issues/2) — `Type: Refactor`
**Spec**: None. This is a **Refactor-route** item — see
[`docs/project/2-repo-architecture.md` → Backlog routing](../../../project/2-repo-architecture.md).
The specification is the work item brief (issue #2 body, reproduced under
[Work Item Brief](#work-item-brief)) plus the `mu-*` CSS in
`design/mockups/mobile/index.html` and `design/tokens.json`.
**Smoke test runbook**: [`docs/testing/mobile/2-theme-design-system-primitives.smoke-test.md`](../../../testing/mobile/2-theme-design-system-primitives.smoke-test.md)

---

## Work Item Brief

Recorded verbatim so this plan is self-contained and every change below can cite a
brief objective or acceptance criterion.

> **Context**: Every screen composes these. Built once, from `design/tokens.json`, so no
> screen hardcodes a value.
>
> **Scope**:
>
> - `apps/mobile/src/theme.ts` — a typed mirror of `design/tokens.json`: colors, gradients,
>   chart series, typography scale, space, radius, shadow, touch targets.
> - `apps/mobile/src/components/ui/` — primitives matching the `mu-*` classes one-to-one:
>   `Button` (primary / muted / outline / ghost / danger / danger-soft), `Card`, `Hero`,
>   `Badge`, `CategoryChip`, `StatTile`, `Note`, `TransactionRow`, `TextField`, `Checkbox`,
>   `Radio`, `Switch`, `Segment`, `Pill`, `Sheet`, `Modal`, `TabBar`, `Progress`, `Steps`,
>   `Dots`, `EmptyState`, `Amount`.
> - A dev-only gallery route rendering every primitive, mirroring `#screen=ds-components`.
>
> **Mockups**: `#screen=ds-colors`, `#screen=ds-typography`, `#screen=ds-components` in
> `design/mockups/mobile/index.html`.
>
> **Acceptance criteria**:
>
> - **AC1**: No hex, spacing or radius literal outside `theme.ts`
> - **AC2**: Every `mu-*` primitive in the mockups has a component
> - **AC3**: The gallery route visually matches `#screen=ds-components`
> - **AC4**: Touch targets are at least `theme.touchTarget.min` (44)
>
> **Depends on**: #1 (merged).
>
> **MVP scope note**: Banco de Chile only. Presupuestos, planificación and beneficios are out
> of implementation scope. Don't build screens, only primitives + gallery.

---

## Summary

**Approach**: Fill the seven genuine gaps in `design/tokens.json` (five colours, one radius,
one type-scale entry) and mirror them into the mockup `:root` in the same commit, then generate
`apps/mobile/src/theme.ts` as a typed, parity-tested mirror of that file plus a separate
`componentMetrics` namespace holding the component geometry read off the `mu-*` CSS. Build 23
presentational primitives under `apps/mobile/src/components/ui/` in four commit-sized groups,
each composing only `theme` / `componentMetrics`. Close with a `__DEV__`-gated gallery route at
`/(dev)/gallery` that renders every primitive. Three machine checks hold the acceptance
criteria: a theme↔tokens parity test (AC1), a `mu-*` class-coverage scan over the mockup
stylesheet (AC2), a style-literal scan over `src/components/ui/**` (AC1), and a touch-target
test over a single shared metrics module (AC4). AC3 is verified manually against
`#screen=ds-components` in the smoke runbook — this repo has no component-render test tier
(see [Testing Strategy](../../../project/3-software-architecture.md#testing-strategy)).

**Estimated complexity**: **L**

**Rationale**: 23 components, a token-file change that must stay in lock-step across three
files, two small text scanners with their own unit suites, and a new route that interacts with
an existing route/manifest parity test. No single piece is hard; the volume and the
cross-file consistency requirements put it over 3 days.

**Dependencies**:

- **#1 — Bootstrap the monorepo and the Expo app**: merged. `apps/mobile` with Expo Router,
  strict TypeScript, Jest (`jest-expo`) and the 25 placeholder routes are in place.
- **Not blocked on #4** (`shared-utils`: CLP money). `Amount` is designed with an injected
  formatter so it can land before #4 — see [Decision 7](#decision-7-the-amount-and-shared-utils-seam).
- **Not blocked on #3** (`apps/mobile/src/db/`). This plan touches no file under `src/db/` or
  `packages/shared-utils/`.

---

## Verification Log

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `ecf46ef` (branch `implementation-plan/2-theme-design-system-primitives`, base `develop`) |
| Distinct `mu-*` classes in the mockup stylesheet | `grep -o '\.mu-[a-zA-Z0-9_-]*' design/mockups/mobile/index.html \| sort -u \| wc -l` | `162` — drives the [mu-class classification](#mu-class-classification-ac2) and the coverage test |
| Stylesheet boundaries | `grep -n '<style\|</style' design/mockups/mobile/index.html` | lines `7`–`582`; the `mu-*` product-UI block starts at line `229` |
| `ds-*` screen markup | `grep -n 'id="screen-ds-\|id="s-ds-' design/mockups/mobile/index.html` | `s-ds-colors` L2492, `s-ds-typography` L2541, `s-ds-components` L2573 |
| `ds-*` manifest entries | `grep -n "ds-colors\|ds-typography\|ds-components" design/mockups/mobile/mockup-manifest.js` | L516–518, routes `design-system/{colors,typography,components}`, `kind: html`, no `states` — the gallery must render one flat screen, not state variants |
| Literal audit of the `mu-*` rules | Python scan of the `<style>` block, cross-joined against `design/tokens.json` | 1 untokenized hex (`#e5e7eb`), 4 untokenized `rgba()` values, 1 untokenized radius (`6`) reachable from an in-scope primitive, 1 untokenized amount size (`26`). Full table: [Token gaps](#token-gaps-found-must-land-in-step-1) |
| Route files present | `find apps/mobile/app -name '*.tsx' \| wc -l` | `29` = 25 manifest MVP routes + `index.tsx` entry shim + 3 `_layout.tsx` |
| Target directories absent | `test -d apps/mobile/src/components/ui`, `test -f apps/mobile/src/theme.ts` | both **absent** — this item creates them |
| Existing route/manifest parity contract | `apps/mobile/src/__tests__/route-manifest-parity.test.ts` | asserts derived route set **equals** the 25 manifest MVP routes and that no route contains `design-system`. Drives [Decision 6](#decision-6-gallery-route-path-and-production-gating) |
| Component-render test tier | `docs/project/3-software-architecture.md` → Testing Strategy; `apps/mobile/package.json` | Jest + Maestro only; **no** `@testing-library/react-native`. Drives [Decision 8](#decision-8-no-new-test-dependency) |
| No i18n catalogue owner | `gh issue list --state all --limit 40` | 25 issues; none owns `apps/mobile/src/i18n/`. Drives [Decision 9](#decision-9-gallery-copy-and-the-i18n-catalogue) |
| Concurrent same-surface work | `gh pr list --state open --json number,title,headRefName,baseRefName --limit 50` | `[]` — no open PRs |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` (no `mode:` key) — this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml` (no top-level `mode:`); `docs/workflow/development-workflow/repository-modes.md` | 2026-08-01, SHA `ecf46ef` | Current invocation only (item #2) | `Verified` |
| Approved artifact base branch | `develop` | Parent orchestrator handoff; `AGENTS.md` → Git & Branching | 2026-08-01, SHA `ecf46ef` | Current invocation only (item #2) | `Verified` |
| Canonical design-token source | `design/tokens.json` `$version 1.0.0` — **this plan mutates it** (Step 1) | `design/tokens.json` `$description`; `docs/best-practices/stack/design-tokens.md`; `design/README.md` → Token workflow | 2026-08-01, SHA `ecf46ef` | Open PRs touching `design/tokens.json`, `design/mockups/mobile/index.html`, `apps/mobile/src/theme.ts`, `apps/mobile/package.json`, or `apps/mobile/src/__tests__/route-manifest-parity.test.ts` → `gh pr list --state open` returned `[]` | `Verified` |
| Ownership of `apps/mobile/src/db/` and `packages/shared-utils/` | Owned by concurrent items #3 and #4; **out of bounds for this plan** | Parent orchestrator handoff; `docs/project/2-repo-architecture.md` | 2026-08-01, SHA `ecf46ef` | Items #2, #3, #4 in the current batch; no open PRs on those paths | `Verified` |
| Route/manifest parity contract owned by merged item #1 | Derived route set must equal the 25 manifest MVP routes | `apps/mobile/src/__tests__/route-manifest-parity.test.ts` (merged in #1) | 2026-08-01, SHA `ecf46ef` | No open PR modifies this file | `Verified` — this plan extends it with an explicit dev-only allowlist ([Decision 6](#decision-6-gallery-route-path-and-production-gating)) |

No `Conflict` rows. Implementation-start re-verification: before the first file edit, the
developer re-reads `design/tokens.json` `$version` and re-runs the open-PR query above; a
changed `$version` or a new PR touching those paths is `Stale or conflicting` and must be
returned to the parent orchestrator before any edit.

---

## Classification Results

| Classifier | Result | Rationale |
| --- | --- | --- |
| Parser-risk | **Applies** | Step 1 and Step 2 add `mu-class-inventory.ts` and `style-literal-scan.ts`: regex-driven scanning of structured text (a CSS stylesheet and TypeScript source). See the [Parser-risk addendum](#parser-risk-addendum). |
| Concurrent-event-source | **Not applicable** | Every primitive is a controlled, presentational component. No event listeners beyond React `onPress`/`onChangeText` props, no timers, no sockets, no async queues, no shared mutable module state, no initialization or teardown sequence. `Sheet` and `Modal` are driven by a `visible` prop supplied by the caller. |
| Cross-cutting checklist | **Not applicable** | This plan changes no review, planning or implementation protocol, no `REVIEW.md` category, and no agent/skill guidance file. It adds product code plus product documentation. |
| Executable workflow shell snippets | **Not applicable** | No framework-owned shell guidance is added or changed. |
| Sweep / pattern-completeness | **Applies** | AC2 ("every `mu-*` primitive") is a pattern-completeness claim. Residual strategy: [mu-class classification](#mu-class-classification-ac2) plus the machine-checked coverage test. |

---

## Token Gaps Found (must land in Step 1)

A full literal audit of the `mu-*` rules in the mockup stylesheet against `design/tokens.json`
found the values below with no token. Per
[`docs/best-practices/stack/design-tokens.md`](../../../best-practices/stack/design-tokens.md)
each one is added to `design/tokens.json`, mirrored in the mockup `:root`, and consumed from
`theme.ts` — **all in the same commit** (Step 1).

| New token | Value | Mockup source | Consumed by |
| --- | --- | --- | --- |
| `colors.overlayScrim` | `rgba(15, 23, 42, 0.45)` | `.mu-overlay` (L515) | `Sheet`, `Modal` |
| `colors.focusRing` | `rgba(99, 102, 241, 0.12)` | `.mu-input.is-focus` (L412) | `TextField` |
| `colors.onGradientSurface` | `rgba(255, 255, 255, 0.2)` | `.mu-hero__icon` (L309) | `Hero` |
| `colors.onGradientDecoration` | `rgba(255, 255, 255, 0.12)` | `.mu-hero::after` (L304) | `Hero` |
| `colors.switchTrackOff` | `#e5e7eb` | `.mu-switch` (L436) | `Switch` |
| `radius.control` | `6` | `.mu-check` (L425) | `Checkbox` |
| `typography.scale.amount.stat` | `{ fontSize: 26, lineHeight: 32, fontWeight: 800, letterSpacing: -0.6 }` | `.mu-stat__value` (L485) | `StatTile` |

Also in Step 1: bump `design/tokens.json` `$version` to `1.1.0`, update the mirror comment at
the top of the mockup `<style>` block (L9), and update
`design/mockups/mobile/INVENTORY.md` L3 (`tokens v1.0.0` → `tokens v1.1.0`).

**Values deliberately NOT promoted to `tokens.json`** (they go into `componentMetrics` in
`theme.ts` instead — see [Decision 2](#decision-2-theme-vs-componentmetrics)):

| Value(s) | Where | Why not a token |
| --- | --- | --- |
| `1px` / `1.5px` border widths | 19 `mu-*` rules | Not a design-token group in this project; promoting it would rewrite 19 mockup rules for no visual-language gain. Lives as `componentMetrics.borderWidth.{hairline,control}`. |
| Control geometry: `52`, `46`, `40`, `36`, `30`, `27`, `22`, `21`, `74`, `120`, `132` px | `.mu-btn`, `.mu-input`, `.mu-switch`, `.mu-check`, `.mu-radio`, `.mu-chip`, `.mu-bars`, `.mu-donut`, … | Component geometry, not visual language. `tokens.json` is the token contract consumed by two renderers; a geometry dump makes it unreviewable. |
| Glyph sizes: `17`, `18`, `19`, `22`, `26`, `34`, `42` px | `.mu-note__icon`, `.mu-item__icon`, `.mu-chip__emoji`, `.mu-hero__icon`, `.mu-modal__icon`, `.mu-empty__icon` | Emoji glyph sizing, not the type scale. |
| Letter-spacing: `-0.1`…`-1`, `+0.1em` | `.mu-btn`, `.mu-h1`…`.mu-h3`, `.mu-eyebrow`, … | Already present inside `typography.scale.*` where the mockup matches a scale entry; the remainder is per-component tracking. |
| Radii `2`, `3`, `4` px | `.mu-bars__bar`, `.mu-legend__dot`, `.mu-draft` | All belong to chart / misc classes that are **out of scope** for this item (deferred to the dashboard item, #17). |
| `layout.safeAreaTop` (`52px` in `.mu-head`, `.mu-topbar`, `.mu-safe-top`) | header classes | `Header` / `TopBar` are not in this item's 23-component scope. Deferred with the class. |

**Graduation rule** (record it in `docs/best-practices/stack/design-tokens.md`): a
`componentMetrics` value graduates to `design/tokens.json` when it is a colour, or when two
unrelated primitives use the same value for the same semantic reason.

### Type-scale drift observed (no action in this item)

`typography.scale` in `tokens.json` is an idealized scale; several `mu-*` rules do not match it
exactly — `.mu-h1` is `28/800/-0.7` vs `display.md` `28/34/700/-0.6`; `.mu-h3` and
`.mu-card__title` are `16/700/-0.2` vs `heading.md` `17/23/600`; `.mu-hero__title` is
`20/800/-0.4` vs `heading.lg` `20/26/700`. **Resolution chosen: change nothing in
`tokens.json`.** The mockup CSS is the authority for how a primitive looks, so each primitive
composes its text style from token primitives (`typography.size.*`, `typography.weight.*`) plus
`componentMetrics.<primitive>.letterSpacing`, reproducing the mockup exactly with zero
literals. `typography.scale` is still mirrored verbatim into `theme.ts` and parity-tested; it
is simply not the source for these six classes. This is recorded as
[Open Question 1](#open-questions).

---

## Decisions

### Decision 1: `theme.ts` is generated by hand, parity-tested by machine

`apps/mobile/src/theme.ts` is a hand-written TypeScript module (`as const`), not a build
artifact. `apps/mobile/src/__tests__/theme-tokens-parity.test.ts` reads
`design/tokens.json` at test time and asserts deep equality against the exported `theme`
object for every group named in the brief (`colors`, `gradients`, `chart`, `typography`,
`space`, `radius`, `shadow`, `layout`, `touchTarget`, `categoryIcons`), in **both** directions:
no token missing from `theme`, no extra key in `theme` that is not in `tokens.json`. Keys
beginning with `$` (`$description`, `$version`, `$source`) are excluded. This is what makes
"typed mirror" enforceable rather than aspirational.

### Decision 2: `theme` vs `componentMetrics`

`apps/mobile/src/theme.ts` has exactly two value exports:

- `theme` — the verbatim, parity-tested mirror of `design/tokens.json`.
- `componentMetrics` — component geometry read off the `mu-*` CSS, namespaced per primitive
  (`componentMetrics.button`, `componentMetrics.switch`, …). Every entry carries a comment
  naming its `.mu-*` selector and its `design/mockups/mobile/index.html` line number.

Both live in `theme.ts`, so AC1 ("no hex, spacing or radius literal outside `theme.ts`") holds
literally and is machine-checked by
`apps/mobile/src/__tests__/no-style-literals.test.ts`. `componentMetrics` is **not**
parity-tested against `tokens.json` — that would defeat its purpose — and the parity test's
"no extra key" direction runs against `theme` only.

### Decision 3: primitives are presentational and copy-free

No component under `apps/mobile/src/components/ui/` contains a user-facing string. Copy
arrives as props (`label`, `title`, `children`). This keeps the whole primitive layer immune to
the i18n rule in `AGENTS.md` non-negotiable 8 and makes every primitive reusable across
screens.

### Decision 4: one shared touch-target module

`apps/mobile/src/components/ui/_internal/touch-metrics.ts` is the single place where a
pressable primitive's visual box and its `hitSlop` are defined. It exports
`withMinTarget(size: { width?: number; height: number }): TouchMetrics` — which computes
symmetric `hitSlop` from `theme.touchTarget.min` — and a `TOUCH_METRICS` record with one entry
per pressable primitive. Components consume `TOUCH_METRICS.<key>`; the test
`apps/mobile/src/__tests__/touch-targets.test.ts` iterates the **same** record and asserts
`height + hitSlop.top + hitSlop.bottom >= theme.touchTarget.min` (and the width equivalent when
`width` is fixed). One enumeration, no drift, no circular import.

This is how AC4 is satisfied without breaking mockup fidelity: several mockup controls are
visually smaller than 44 (`.mu-btn--sm` 40, `.mu-pill` ≈32, `.mu-segment__item` ≈34,
`.mu-check` / `.mu-radio` 22, `.mu-switch` 27 tall). The visual box keeps the mockup geometry;
the effective touch area is expanded to ≥44 with `hitSlop`.

Non-pressable rendering modes are exempt and are not in `TOUCH_METRICS`: `Checkbox`, `Radio`
and `Switch` may be rendered without `onPress`/`onChange` inside a pressable row (as in
`#screen=categorize&state=exclude-sheet`, where `.mu-item` is the target). Each of those three
components documents this and only applies `hitSlop` when it owns the press.

### Decision 5: `Text` is added to the brief's component list

The brief lists 22 components. Rendering the gallery — and `Card`, `Hero`, `Note`,
`EmptyState`, `TransactionRow` internally — requires the mockup's typography helpers
(`.mu-h1`, `.mu-h2`, `.mu-h3`, `.mu-p`, `.mu-p--lead`, `.mu-small`, `.mu-xs`, `.mu-eyebrow`,
`.mu-label`, `.mu-hint`, `.mu-mono`, `.mu-center`). Without a `Text` primitive those styles
would be re-declared in every consumer, violating AC1 in spirit and in machine-checked fact.
`Text` is therefore added as a 23rd primitive and lands first in Step 2. **Total: 23
components.**

### Decision 6: gallery route path and production gating

- **Route path**: `apps/mobile/app/(dev)/gallery.tsx` → derived route `/(dev)/gallery`.
- **Why not `design-system/components`**: the merged parity test asserts
  `no route contains "design-system"` (AC6 of item #1) because those three manifest entries
  are reference screens, not product screens. That assertion stays literally true and
  untouched — this item creates none of the three `design-system/*` routes.
- **Why not `app/_dev/…` or `app/+gallery.tsx`**: Expo Router ignores `_`-prefixed segments
  entirely (they would never render) and reserves `+`-prefixed names for special files.
- **Production gating**: the route file is hook-free and guards first:

  ```tsx
  // Illustrative — adapt during implementation
  export default function DevGalleryRoute() {
    if (!__DEV__) return null;
    return <DesignSystemGallery />;
  }
  ```

  Because the component uses no hooks before the guard, `DevGalleryRoute()` can be called
  directly in a plain Jest test with `__DEV__` forced to `false` — no renderer needed.
  There is no link to `/(dev)/gallery` from any product screen, so a release build has no
  reachable entry point and the guard renders nothing if one is manufactured.
- **Parity-test change**: `apps/mobile/src/test-utils/route-inventory.ts` gains
  `export const DEV_ONLY_ROUTES = ['/(dev)/gallery'] as const;`.
  `apps/mobile/src/__tests__/route-manifest-parity.test.ts` subtracts `DEV_ONLY_ROUTES` from
  the derived set before the set-equality assertion, and gains one new test asserting that
  every entry in `DEV_ONLY_ROUTES` (a) resolves to an existing route file and (b) that file's
  source contains a `__DEV__` guard. The existing `design-system` and `(auth)` assertions are
  unchanged.
- **Gallery content location**: `apps/mobile/src/dev/DesignSystemGallery.tsx` and
  `apps/mobile/src/dev/gallery.strings.ts`. A new `src/dev/` folder keeps
  `src/components/ui/` containing primitives only, and makes the dev-only surface obvious in
  the tree. It is listed in [Documentation Updates](#documentation-updates).

### Decision 7: the Amount and shared-utils seam

`Amount` performs **no** CLP formatting arithmetic. Its props are a discriminated union:

```ts
// Illustrative — adapt during implementation
export type AmountTone = 'neutral' | 'in' | 'out';
export type AmountSize = 'hero' | 'lg' | 'md';

type AmountBase = { tone?: AmountTone; size?: AmountSize };

export type AmountProps =
  | (AmountBase & { formatted: string; minorUnits?: never; format?: never })
  | (AmountBase & {
      /** CLP minor units (pesos). Never a float. */
      minorUnits: number;
      /** Injected formatter. `@finanzas/shared-utils` (#4) will supply the real one. */
      format: (minorUnits: number) => string;
      formatted?: never;
    });
```

There is **no default formatter in this item**: passing `minorUnits` without `format` is a
TypeScript error, so no wrong-looking CLP string can reach a screen. The gallery passes
`formatted` strings copied verbatim from `#screen=ds-typography` (`$1.200.000`,
`+$2.500.000`, `$35.000`).

**What #4 must provide for the seam to close** (reported to the parent orchestrator, not built
here): a pure function of shape `(minorUnits: number, options?: { signed?: boolean; locale?: string }) => string`
exported from `@finanzas/shared-utils`, producing `$1.200.000` — point thousands separator, no
decimals, no space after `$`, income prefixed `+` — per
[`docs/best-practices/stack/expo-react-native.md`](../../../best-practices/stack/expo-react-native.md).
Wiring that formatter as the app-wide default (a provider or a thin `<Money>` wrapper) belongs
to a **later item**, not to #2 and not to #4.

### Decision 8: no new test dependency

`docs/project/3-software-architecture.md` → Testing Strategy defines exactly two automated
tiers for this repo — Jest unit and Maestro device E2E — and `apps/mobile/package.json` has no
React Native testing library. Adding `@testing-library/react-native` + `react-test-renderer`
under React 19.1 is a dependency-resolution risk that this item does not need: every acceptance
criterion is provable with pure-Node Jest tests over exported data (`theme`,
`componentMetrics`, `TOUCH_METRICS`, `MU_CLASS_MAP`) plus source scanning, and AC3 is a visual
criterion that only a simulator can settle anyway. Adding a component-render tier is recorded
as [Open Question 2](#open-questions).

### Decision 9: gallery copy and the i18n catalogue

`AGENTS.md` non-negotiable 8 requires user-facing copy to live in `apps/mobile/src/i18n/`
catalogues, enforced by `eslint-plugin-i18next`. **No backlog item owns that infrastructure**
(verified: issues #1–#25 contain no i18n item), it does not exist in the repo, and enabling the
lint rule repo-wide would immediately fail on item #1's `RoutePlaceholder.tsx` and
`(tabs)/_layout.tsx`.

**This item does not bootstrap i18n.** Rationale: (a) the gallery is `__DEV__`-only and never
reaches a user, so its section headers are not product copy; (b) per
[Decision 3](#decision-3-primitives-are-presentational-and-copy-free) no primitive contains
copy at all, so the primitive layer is already compliant; (c) bootstrapping i18next +
`expo-localization` + `eslint-plugin-i18next` touches every existing route file and belongs
with the first product screen item (#8) or its own backlog item.

**What this item does instead**: all gallery strings live in
`apps/mobile/src/dev/gallery.strings.ts` — a single flat, `ds.*`-keyed object with Spanish
(es-CL) values taken verbatim from the `ds-*` mockup screens. Zero literals in JSX, and a
mechanical move into `es.json` when the catalogue lands. **Recommended follow-up backlog
item**: "Bootstrap `apps/mobile/src/i18n` catalogues and enable `eslint-plugin-i18next`" —
flagged to the parent orchestrator, not created by this plan.

---

## `mu-class` Classification (AC2)

AC2 says "every `mu-*` primitive in the mockups has a component"; the brief's Scope section
freezes the component list to 22 names. Those two statements are reconciled by classifying
**all 162** `mu-*` classes found in the stylesheet (see [Verification Log](#verification-log))
into exactly one of three statuses, held in
`apps/mobile/src/test-utils/mu-class-map.ts`:

```ts
// Illustrative — adapt during implementation
export type MuClassStatus = 'primitive' | 'utility' | 'deferred';
export type MuClassEntry = {
  status: MuClassStatus;
  /** Required when status === 'primitive': the exported component name. */
  component?: string;
  /** Required when status !== 'primitive': why, and which item owns it. */
  note?: string;
};
export const MU_CLASS_MAP: Record<string, MuClassEntry> = { /* 162 entries */ };
```

- **`primitive`** — covered by one of the 23 components built here. Includes every modifier and
  BEM element of a covered block (`.mu-btn--danger-soft` → `Button`, `.mu-tx__amount--in` →
  `TransactionRow`, `.mu-overlay` → `Sheet`/`Modal` via the shared `_internal/Overlay`).
- **`utility`** — a layout, spacing or typography helper with no component of its own; the
  consumer applies `theme` / `componentMetrics` directly. Covers `.mu-scroll`, `.mu-pad`,
  `.mu-pad-b`, `.mu-safe-top`, `.mu-row`, `.mu-row--between`, `.mu-grid-2`, `.mu-grid-3`,
  `.mu-spacer`, `.mu-center`, `.mu-mt1`…`.mu-mt6`, `.mu-btn-row`, `.mu-btn-stack`,
  `.mu-pill-row`, `.mu-tx-group`. Typography helpers (`.mu-h1`…`.mu-xs`, `.mu-eyebrow`,
  `.mu-label`, `.mu-hint`, `.mu-mono`) are `primitive` → `Text` per
  [Decision 5](#decision-5-text-is-added-to-the-briefs-component-list).
- **`deferred`** — a real primitive that is **not** in this item's scope, with the owning
  backlog item named in `note`. The complete deferred set:

  | Classes | Deferred to |
  | --- | --- |
  | `.mu-head*`, `.mu-topbar*` | screen-shell work, first needed by #12 (Home) |
  | `.mu-list`, `.mu-item*` | #19 (Settings hub) |
  | `.mu-bars*`, `.mu-line`, `.mu-donut`, `.mu-legend*`, `.mu-cat-row*` | #17 (Dashboard charts) |
  | `.mu-bank*` | #9 (Connect a bank) |
  | `.mu-otp*` | #7 (deferred sign-in — out of the MVP) |
  | `.mu-swatch*`, `.mu-draft` | mockup-viewer chrome; no product component |

Two Jest assertions enforce this:

1. **Exhaustive classification** (lands in Step 1, passes immediately): every class returned by
   `muClassInventory()` has an entry in `MU_CLASS_MAP`, and every `MU_CLASS_MAP` key is a real
   class in the stylesheet. A new `mu-*` class in the mockup fails the build until someone
   classifies it. This is the residual-verification mechanism for the pattern-completeness
   claim.
2. **Component resolution** (lands in Step 5): every entry with `status: 'primitive'` names a
   `component` that is exported from `apps/mobile/src/components/ui/index.ts`.

Both live in `apps/mobile/src/__tests__/mu-class-coverage.test.ts`.

---

## Layer-by-Layer Changes

### Database / Data Layer

- **None.** This plan touches no file under `apps/mobile/src/db/` (owned by concurrent item
  #3). If implementation appears to need a schema or repository change, **stop** and return to
  the parent orchestrator.

### Backend / API

- **None.** There is no backend in this product.

### Shared Packages / Libraries

- **None.** `packages/shared-utils/` is owned by concurrent item #4. `Amount` consumes an
  injected formatter instead — see [Decision 7](#decision-7-the-amount-and-shared-utils-seam). If
  implementation appears to need a `packages/**` change, **stop**.

### Design assets (`design/`)

- [ ] `design/tokens.json` — add the 7 tokens in [Token gaps](#token-gaps-found-must-land-in-step-1); bump `$version` to `1.1.0`.
- [ ] `design/mockups/mobile/index.html` — mirror the 7 tokens into `:root` (L12–109) as
      `--overlay-scrim`, `--focus-ring`, `--on-grad-surface`, `--on-grad-decoration`,
      `--switch-track-off`, `--r-control`; replace the corresponding literals in `.mu-overlay`
      (L515), `.mu-input.is-focus` (L412), `.mu-hero__icon` (L309), `.mu-hero::after` (L304),
      `.mu-switch` (L436), `.mu-check` (L425). `typography.scale.amount.stat` has no `:root`
      mirror (the scale is not mirrored there — only `--xs`…`--xl` are), so `.mu-stat__value`
      keeps `26px`, exactly as `.mu-h1` keeps `28px` today. Update the mirror comment at L9.
- [ ] `design/mockups/mobile/index.html` — add a "Superposiciones y controles" swatch group to
      `#screen=ds-colors` (section `s-ds-colors`, before the closing spacer at L2537) showing
      `overlayScrim`, `focusRing` and `switchTrackOff`, per
      `docs/best-practices/stack/design-tokens.md` ("when you add a token, add it there too").
      `onGradientSurface` / `onGradientDecoration` are omitted from the swatch grid because a
      translucent white on a white chip shows nothing; they are already visible on the `Hero`.
- [ ] `design/mockups/mobile/INVENTORY.md` — L3 `tokens v1.0.0` → `tokens v1.1.0`.
- **Not changed**: `mockup-manifest.js`. The gallery is a dev route, not a manifest screen;
  adding it would break the 25-route parity contract.

### Frontend / UI (`apps/mobile`)

**New — theme (Step 1)**

- [ ] `apps/mobile/src/theme.ts` — `export const theme` (verbatim token mirror, `as const`) and
      `export const componentMetrics` (per-primitive geometry, each entry commented with its
      `.mu-*` selector and `index.html` line).

**New — primitives (Steps 2–4), all under `apps/mobile/src/components/ui/`**

| Step | File | Mockup class(es) | Key props |
| --- | --- | --- | --- |
| 2 | `Text.tsx` | `.mu-h1`, `.mu-h2`, `.mu-h3`, `.mu-p`, `.mu-p--lead`, `.mu-small`, `.mu-xs`, `.mu-eyebrow`, `.mu-label`, `.mu-hint`, `.mu-hint--error`, `.mu-mono`, `.mu-center` | `variant: 'h1'\|'h2'\|'h3'\|'body'\|'bodyLead'\|'small'\|'xs'\|'eyebrow'\|'label'\|'hint'\|'mono'`, `tone?: 'primary'\|'secondary'\|'tertiary'\|'brand'\|'inverse'\|'danger'`, `center?: boolean` |
| 2 | `Button.tsx` | `.mu-btn` + `--muted` `--outline` `--ghost` `--danger` `--danger-soft` `--sm` `--auto` | `variant: 'primary'\|'muted'\|'outline'\|'ghost'\|'danger'\|'dangerSoft'`, `size?: 'md'\|'sm'`, `fullWidth?: boolean`, `label: string`, `onPress`, `disabled?` |
| 2 | `Card.tsx` | `.mu-card`, `--tight`, `--flat`, `__title`, `__sub`, `__head` | `variant?: 'default'\|'tight'\|'flat'`, `title?`, `subtitle?`, `headerRight?`, `children` |
| 2 | `Hero.tsx` | `.mu-hero`, `__row`, `__icon`, `__title`, `__sub`, `::after` | `gradient?: 'challenge'\|'income'\|'expense'\|'celebration'\|'brand'`, `icon`, `title`, `subtitle?`, `onPress?` |
| 2 | `Badge.tsx` | `.mu-badge` + `--ok` `--warn` `--danger` `--info` `--celebration` | `tone?: 'neutral'\|'ok'\|'warn'\|'danger'\|'info'\|'celebration'`, `label: string` |
| 2 | `CategoryChip.tsx` | `.mu-chip`, `__emoji`, `__hint`, `__star`, `.is-selected`, `.is-suggested` | `emoji`, `label`, `hint?`, `state?: 'default'\|'selected'\|'suggested'`, `onPress` |
| 2 | `StatTile.tsx` | `.mu-stat`, `--in`, `--out`, `__label`, `__value`, `__sub`, `__arrow` | `tone: 'income'\|'expense'`, `label`, `value: string`, `sub?`, `arrow?: 'up'\|'down'` |
| 2 | `Note.tsx` | `.mu-note`, `--ok`, `--warn`, `--danger`, `__icon` | `tone?: 'info'\|'ok'\|'warn'\|'danger'`, `icon`, `children` |
| 2 | `TransactionRow.tsx` | `.mu-tx`, `--pending`, `--excluded`, `__icon`, `__txt`, `__name`, `__meta`, `__meta--warn`, `__amount`, `__amount--in` | `icon`, `name`, `meta`, `amount: string`, `direction: 'in'\|'out'`, `state?: 'default'\|'pending'\|'excluded'`, `metaTone?: 'default'\|'warn'`, `onPress?` |
| 3 | `TextField.tsx` | `.mu-field`, `.mu-label`, `.mu-input`, `--ph`, `.is-focus`, `.is-error`, `.is-locked`, `.mu-hint`, `.mu-hint--error` | `label?`, `value`, `onChangeText`, `placeholder?`, `hint?`, `error?: string \| null`, `locked?: boolean`, `secureTextEntry?` (focus tracked internally) |
| 3 | `Checkbox.tsx` | `.mu-check`, `.is-on` | `checked: boolean`, `onChange?`, `accessibilityLabel: string` |
| 3 | `Radio.tsx` | `.mu-radio`, `.is-on`, `::after` | `selected: boolean`, `onPress?`, `accessibilityLabel: string` |
| 3 | `Switch.tsx` | `.mu-switch`, `.is-on`, `::after` | `value: boolean`, `onValueChange?`, `accessibilityLabel: string` |
| 3 | `Segment.tsx` | `.mu-segment`, `__item`, `.is-active` | `options: { value: string; label: string }[]`, `value`, `onChange` |
| 3 | `Pill.tsx` | `.mu-pill`, `.is-active` | `label`, `active?: boolean`, `onPress` |
| 4 | `_internal/Overlay.tsx` | `.mu-overlay`, `--center` | `align: 'bottom'\|'center'`, `visible`, `onRequestClose`, `children` |
| 4 | `Sheet.tsx` | `.mu-sheet`, `__grab` | `visible`, `onRequestClose`, `children` |
| 4 | `Modal.tsx` | `.mu-modal`, `__icon` | `visible`, `onRequestClose`, `icon?`, `title`, `children` |
| 4 | `TabBar.tsx` | `.mu-tabbar`, `__item`, `__icon`, `.is-active` | `items: { key; icon; label }[]`, `activeKey`, `onSelect` |
| 4 | `Progress.tsx` | `.mu-progress`, `__fill` | `value: number` (0–1), `accessibilityLabel` |
| 4 | `Steps.tsx` | `.mu-steps`, `__step`, `.is-on` | `total: number`, `current: number` (1-based) |
| 4 | `Dots.tsx` | `.mu-dots`, `__dot`, `.is-on` | `total: number`, `current: number` (1-based) |
| 4 | `EmptyState.tsx` | `.mu-empty`, `__icon` | `icon`, `title`, `description?`, `action?: { label; onPress }` |
| 4 | `Amount.tsx` | `.mu-amount`, `--in`, `--out`, `--hero` | see [Decision 7](#decision-7-the-amount-and-shared-utils-seam) |

- [ ] `apps/mobile/src/components/ui/_internal/touch-metrics.ts` (Step 2, extended in 3 and 4)
- [ ] `apps/mobile/src/components/ui/index.ts` — barrel (created Step 2, extended each step)

**New — dev gallery (Step 5)**

- [ ] `apps/mobile/app/(dev)/gallery.tsx` — `__DEV__` guard + `<DesignSystemGallery />`
- [ ] `apps/mobile/src/dev/DesignSystemGallery.tsx`
- [ ] `apps/mobile/src/dev/gallery.strings.ts`

**New — scanners and test support**

- [ ] `apps/mobile/src/test-utils/mu-class-inventory.ts` + `.test.ts` (Step 1)
- [ ] `apps/mobile/src/test-utils/mu-class-map.ts` (Step 1; statuses updated in Steps 2–5)
- [ ] `apps/mobile/src/test-utils/style-literal-scan.ts` + `.test.ts` (Step 2)

**New — applied test suites**

- [ ] `apps/mobile/src/__tests__/theme-tokens-parity.test.ts` (Step 1)
- [ ] `apps/mobile/src/__tests__/mu-class-coverage.test.ts` (Step 1; second assertion Step 5)
- [ ] `apps/mobile/src/__tests__/no-style-literals.test.ts` (Step 2)
- [ ] `apps/mobile/src/__tests__/touch-targets.test.ts` (Step 2, extended in 3 and 4)

**Modified**

- [ ] `apps/mobile/src/test-utils/route-inventory.ts` — add `DEV_ONLY_ROUTES` (Step 5)
- [ ] `apps/mobile/src/__tests__/route-manifest-parity.test.ts` — subtract `DEV_ONLY_ROUTES`
      before the set-equality assertion; add the dev-route guard test (Step 5)

**Not touched**: any file under `apps/mobile/app/` other than the new `(dev)/gallery.tsx`, and
`apps/mobile/src/components/RoutePlaceholder.tsx`. Wiring primitives into the 25 product routes
belongs to items #8–#21.

### Infrastructure / Configuration

- **None.** No new runtime dependency, no `app.config.js` change, no CI change, no
  `metro.config.js` change (the `__DEV__` guard, not a Metro `blockList`, is the gating
  mechanism — see [Decision 6](#decision-6-gallery-route-path-and-production-gating)).

---

## Testing Strategy

**Test types**: Unit (Jest, `jest-expo` preset) + Manual smoke on a simulator. No integration
tier applies (no backend, no database in this item). No Maestro flow: the gallery is dev-only
and never appears in a user journey.

**Key scenarios**:

1. `theme` deep-equals `design/tokens.json` in both directions — **AC1**, Decision 1
2. `componentMetrics` is namespaced per primitive and contains no key absent from the
   primitives that consume it — **AC1**
3. No hex, `rgb()`/`rgba()`, or numeric style-property literal in `src/components/ui/**`,
   `src/dev/**` or `app/(dev)/**` — **AC1**
4. Every one of the 162 stylesheet classes is classified in `MU_CLASS_MAP` — **AC2**
5. Every `status: 'primitive'` entry resolves to an export of
   `src/components/ui/index.ts` — **AC2**
6. Every entry in `TOUCH_METRICS` yields an effective target ≥ `theme.touchTarget.min` — **AC4**
7. `DevGalleryRoute()` returns `null` when `__DEV__` is `false` — Decision 6
8. The derived route set minus `DEV_ONLY_ROUTES` still equals the 25 manifest MVP routes, and
   no route contains `design-system` — item #1 AC5/AC6 regression
9. Scanner edge cases — see the [Parser-risk addendum](#parser-risk-addendum)
10. The gallery renders every primitive and matches `#screen=ds-components` — **AC3**, manual,
    in the smoke runbook

**Smoke test runbook**:
`docs/testing/mobile/2-theme-design-system-primitives.smoke-test.md`

**Regression suite**: none applicable. The repo's E2E tier is Maestro (`.maestro/`, empty until
#22) and the Playwright placeholder is disabled for this product
(`docs/project/2-repo-architecture.md` → "A note on `e2e/`").

### Residual verification before `ready-for-human-review`

AC2 is a pattern-completeness claim, so the implementation PR must state:

- the output of `pnpm --filter @finanzas/mobile test` showing
  `mu-class-coverage.test.ts` passing both assertions;
- the count of `MU_CLASS_MAP` entries by status (`primitive` / `utility` / `deferred`) and the
  total, which must equal the live class count from `muClassInventory()`;
- for every `deferred` entry, the owning backlog item named in its `note`.

Evidence source: the test output plus `MU_CLASS_MAP` itself. Prose claims of completeness
without those counts are not sufficient.

### Parser-risk addendum

Two scanners are added. Both are pure functions over a string, unit-tested independently of the
files they are later pointed at.

#### Scanner A — `muClassInventory(html: string): string[]`

Extracts the distinct `mu-*` class names that appear in **selector position** inside the single
`<style>` block of `design/mockups/mobile/index.html`.

Edge cases (unit tests in `apps/mobile/src/test-utils/mu-class-inventory.test.ts`):

| ID | Input | Expected |
| --- | --- | --- |
| E1 | Comma-separated selector list: `.mu-card + .mu-card, .mu-card + .mu-hero, .mu-hero + .mu-card { … }` | `['mu-card','mu-hero']` — deduplicated across all three selectors |
| E2 | Compound with a state class: `.mu-chip.is-selected { … }` | `['mu-chip']` — `is-selected` is not a `mu-` class |
| E3 | Pseudo-element / pseudo-class: `.mu-hero::after`, `.mu-radio.is-on::after`, `.mu-btn:hover` | `['mu-hero','mu-radio','mu-btn']` — pseudo suffix stripped, not treated as part of the name |
| E4 | Combinators: `.mu-btn-row .mu-btn { … }` and `.mu-item + .mu-item { … }` | `['mu-btn-row','mu-btn','mu-item']`, no duplicates |
| E5 | BEM element and modifier with internal hyphens: `.mu-tx__amount--in`, `.mu-btn--danger-soft`, `.mu-cat-row__fill` | full names captured; **must not** truncate at the first `-` or at `__` |
| E6 | Negative — the same token outside selector position: `class="mu-btn mu-btn--sm"` in HTML markup, `/* ── Buttons ─ */` in a CSS comment, and a declaration body such as `background: var(--brand)` | none captured; only the `<style>` block, and within it only text left of `{` |
| E7 | Two complete rules on one physical line: `.mu-mt1 { margin-top: var(--sp1); } .mu-mt2 { margin-top: var(--sp2); }` (real: index.html L326) | `['mu-mt1','mu-mt2']` |
| E8 | Negative — CSS custom properties: `--sp5`, `--r-pill`, `var(--mu-anything)` | none captured; a leading `--` is never a class |
| E9 | Negative — class name only inside an attribute: `<div data-states="mu-fake">` | not captured |
| E10 | Malformed input: no `<style>` block, or an empty one | throws a descriptive `Error` mentioning `<style>`, mirroring the existing `loadMockupManifest` error-message convention in `route-manifest-parity.test.ts` |

No suppression directives apply to Scanner A — it reports an inventory, not violations.

#### Scanner B — `findStyleLiterals(source: string): StyleLiteral[]`

Flags hardcoded visual values in TypeScript/TSX source. A violation is `{ line, column, kind, text }`
with `kind` in `'hex' | 'rgb' | 'style-number'`. Line and block comments are stripped before
scanning. `style-number` matches only a numeric literal **directly assigned** to a key in a
fixed property set: `padding*`, `margin*`, `gap`, `rowGap`, `columnGap`, `borderRadius`,
`border*Radius`, `borderWidth`, `border*Width`, `fontSize`, `lineHeight`, `letterSpacing`,
`width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `top`, `right`, `bottom`,
`left`.

Edge cases (unit tests in `apps/mobile/src/test-utils/style-literal-scan.test.ts`):

| ID | Input | Expected |
| --- | --- | --- |
| L1 | `'#fff'`, `'#6366f1'`, `'#6366f1ff'` | three `hex` violations (3-, 6- and 8-digit forms all match) |
| L2 | `'rgba(0,0,0,0.05)'`, `'rgb( 15 , 23 , 42 )'` | two `rgb` violations; arbitrary internal whitespace tolerated |
| L3 | Negative: `flex: 1`, `opacity: 0.55`, `zIndex: 40`, `numberOfLines={2}`, `total={4}` | no violations — none of these keys is in the property set |
| L4 | Two violations on one line: `{ padding: 16, borderRadius: 20 }` | two `style-number` violations sharing a line number, with distinct columns |
| L5 | Negative: `padding: theme.space[4]`, `borderRadius: theme.radius.card` | no violations — the value is not a numeric literal |
| L6 | Negative in comments: `// padding: 16 — matches .mu-card` and `/* #6366f1 */` | no violations — comments are stripped first |
| L7 | `padding: 0` | no violation — `0` is the only allowed numeric literal |
| L8 | Suppression, see below | line exempt |

**Suppression semantics** (Scanner B only):

- **Recognized directive**: `style-literal-allow: <reason>` inside a line comment. The reason is
  mandatory; a directive with an empty or whitespace-only reason is itself reported as a
  violation of kind `style-number` with text `missing suppression reason`, so a suppression can
  never be used to silence the scanner without an explanation.
- **Placement**: either trailing on the offending line (`padding: 16, // style-literal-allow: …`)
  or alone on the line immediately above it. Directives inside block comments and directives
  more than one line above have no effect.
- **Scope**: one directive exempts **the entire line**, including multiple violations on it
  (the L4 case). A second directive on the same line is redundant and changes nothing — the
  line is already exempt, and the extra reason is ignored rather than concatenated.
- Suppressions are expected to be rare; each one must be visible in review.

#### Applied scans

- `apps/mobile/src/__tests__/mu-class-coverage.test.ts` runs Scanner A against
  `design/mockups/mobile/index.html` and compares it with `MU_CLASS_MAP`.
- `apps/mobile/src/__tests__/no-style-literals.test.ts` runs Scanner B over every `.ts`/`.tsx`
  file under `apps/mobile/src/components/ui/`, `apps/mobile/src/dev/` and
  `apps/mobile/app/(dev)/`, and asserts zero violations. `apps/mobile/src/theme.ts` is the one
  file exempt by design — it is where the literals belong.

**Known limitation, documented in the scanner's doc comment**: Scanner B matches only a numeric
literal *directly* assigned to a tracked key, so `padding: theme.space[4] + 2` escapes
detection. Manual review and the mockup fidelity step in the runbook cover that residue; the
scanner exists to catch the common case, not to be a type checker.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Gallery sample content | Emoji, labels, amounts and states copied verbatim from `#screen=ds-components` (`s-ds-components`, index.html L2573–2634) and `#screen=ds-typography` (L2541–2571): `Primario`/`Secundario`/`Terciario`/`Destructivo` buttons; `Neutro`/`Al día`/`Pendiente`/`Error`/`Info`/`Logro` badges; `📦 Sugerido` / `🍔 Elegido` / `🚗 Normal` chips; `🛒 Categorizada $35.000`, `💳 Pendiente $42.000`, `🚫 Excluida $75.000` rows; `Ingresos 3.7M / 2 movimientos` and `Gastos 1.4M / 24 movimientos` tiles; amounts `$1.200.000`, `+$2.500.000`, `$35.000` | `apps/mobile/src/dev/gallery.strings.ts` |

No database seed data. No SQLite in this item.

---

## Documentation Updates

To be executed by the developer **after** implementation (not during Plan Ready):

- [ ] `docs/best-practices/stack/design-tokens.md` — replace the 9-row "Mockup class →
      Component" table with the full 23-component mapping; document the
      `theme` / `componentMetrics` split and the graduation rule from
      [Decision 2](#decision-2-theme-vs-componentmetrics); document the `hitSlop` approach to
      AC4 from [Decision 4](#decision-4-one-shared-touch-target-module); add how to open the
      dev gallery.
- [ ] `docs/best-practices/stack/mobile-ui-fidelity.md` — under "Implementation rules", point
      at `/(dev)/gallery` as the place to check a primitive before writing a screen.
- [ ] `docs/project/2-repo-architecture.md` — add `src/dev/` (dev-only surfaces) to the
      `apps/mobile` tree at L25–33.
- [ ] `docs/project/3-software-architecture.md` — add `src/dev/` to the tree at L88; note the
      `__DEV__`-gated `(dev)` route group under Testing Strategy or the routing section.
- [ ] `AGENTS.md` (and its `CLAUDE.md` symlink) — add `src/dev/` to the Repository Structure
      tree; add a Common Commands line for opening the gallery in the running app.
- [ ] `design/README.md` — Token workflow section: note that `theme.ts` now exists and is
      parity-tested, so a token added without a `theme.ts` mirror fails CI.
- [ ] `CHANGELOG.md` — `[Unreleased] → ### Added`, exact literal:

  ```markdown
  - **Theme and design-system primitives** (#2): `apps/mobile/src/theme.ts` as a parity-tested
    mirror of `design/tokens.json`, 23 UI primitives under `apps/mobile/src/components/ui/`
    matching the mockup `mu-*` classes, seven new design tokens, and a dev-only design-system
    gallery route at `/(dev)/gallery`
  ```

`design/tokens.json` and `design/mockups/mobile/INVENTORY.md` are edited **in Step 1**, not in
this post-implementation list, because the same-commit mirror rule requires it.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Token/mockup drift: `tokens.json` updated but the mockup `:root` is not (or vice versa) | Med | High | Step 1 is a single commit containing all three files. `theme-tokens-parity.test.ts` catches JSON↔theme drift immediately; the mockup mirror is checked in the smoke runbook and in review. |
| Editing 6 rules in the 167 KB mockup introduces a visual regression in an unrelated screen | Med | High | Only the 6 named rules change, and each swaps one literal for a `:root` var of the identical value. Runbook step 1 opens `#screen=ds-components`, `#screen=home&state=pending`, `#screen=categorize&state=exclude-sheet` and `#screen=bank-picker&state=no-results` and confirms no visual change. |
| The gallery breaks the merged route/manifest parity test | High (certain without action) | Med | [Decision 6](#decision-6-gallery-route-path-and-production-gating): explicit `DEV_ONLY_ROUTES` allowlist plus a new test asserting each dev route is `__DEV__`-guarded. The `design-system` and `(auth)` assertions stay untouched. |
| Adding `@testing-library/react-native` + `react-test-renderer` under React 19.1 stalls the item on dependency resolution | Med | Med | [Decision 8](#decision-8-no-new-test-dependency): no new test dependency. Every AC is provable from exported data plus source scanning, or is visual and belongs in the runbook. |
| `Amount` gets a temporary CLP formatter that later conflicts with #4 | Med | High (money correctness) | [Decision 7](#decision-7-the-amount-and-shared-utils-seam): the `minorUnits` branch **requires** an injected `format`; there is no default and no arithmetic in `Amount`. Passing minor units without a formatter is a compile error. |
| Mockup fidelity vs the 44 pt touch-target AC | High | Med | [Decision 4](#decision-4-one-shared-touch-target-module): visual box keeps mockup geometry, `hitSlop` expands the effective target, one shared `TOUCH_METRICS` record is asserted by test. |
| `componentMetrics` becomes an unreviewable dump of magic numbers | Med | Med | Namespaced per primitive; every entry carries its `.mu-*` selector and `index.html` line; the graduation rule is documented in `design-tokens.md`. |
| Gallery copy contradicts `AGENTS.md` non-negotiable 8 (no literals in JSX / i18n catalogues) | Med | Med | [Decision 9](#decision-9-gallery-copy-and-the-i18n-catalogue): zero literals in JSX; strings in a flat `ds.*`-keyed module that moves mechanically into `es.json`. Follow-up backlog item recommended to the parent orchestrator. |
| Scope collision with concurrent items #3 (`src/db/`) and #4 (`packages/shared-utils/`) | Low | High | This plan names zero files in either path and instructs the developer to **stop** and escalate rather than reach into them. |
| Scanner B produces false positives that tempt blanket suppressions | Low | Med | Tight property allowlist, comments stripped, mandatory suppression reason, and a documented known limitation instead of an over-broad regex. |

---

## Code Samples

All snippets in this plan are marked `// Illustrative — adapt during implementation`. They
exist to fix API shape and naming, not to be pasted. Production code belongs in the
implementation PR.

---

## Implementation Order

Five commit-sized steps plus a docs step. Commit after **each** step so an interrupted run is
recoverable; do not batch.

### Step 1 — Tokens and theme

1. Add the 7 tokens from [Token gaps](#token-gaps-found-must-land-in-step-1) to
   `design/tokens.json`; bump `$version` to `1.1.0`.
2. Mirror the 6 mirrorable tokens into the mockup `:root`; rewrite the 6 named rules to use
   them; update the mirror comment at L9; add the "Superposiciones y controles" swatch group to
   `s-ds-colors`; update `design/mockups/mobile/INVENTORY.md` L3.
3. Write `apps/mobile/src/theme.ts` — `theme` (verbatim mirror) and `componentMetrics`
   (per-primitive geometry with `.mu-*` + line-number comments).
4. Write `apps/mobile/src/test-utils/mu-class-inventory.ts` and its unit test covering E1–E10.
5. Write `apps/mobile/src/test-utils/mu-class-map.ts` with all 162 classes classified
   (`primitive` entries name the component they *will* have; that is only asserted in Step 5).
6. Write `apps/mobile/src/__tests__/theme-tokens-parity.test.ts` and
   `apps/mobile/src/__tests__/mu-class-coverage.test.ts` (exhaustive-classification assertion
   only).
7. **Verify**: run `pnpm --filter @finanzas/mobile test`, `pnpm --filter @finanzas/mobile typecheck`
   and `pnpm --filter @finanzas/mobile lint`; confirm the parity and classification tests pass
   and that the class count reported by the coverage test equals the number of entries in
   `MU_CLASS_MAP`. Open `design/mockups/mobile/index.html#screen=ds-colors` and confirm the new
   swatch group renders and no existing swatch changed.
8. **Commit**: `feat(mobile): add theme.ts mirroring design tokens`

### Step 2 — Surface and content primitives

1. `apps/mobile/src/components/ui/_internal/touch-metrics.ts` with `withMinTarget` and the
   `TOUCH_METRICS` entries for this step's pressables (`button`, `buttonSm`, `buttonGhost`,
   `categoryChip`, `transactionRow`, `hero`).
2. `Text.tsx`, `Button.tsx`, `Card.tsx`, `Hero.tsx`, `Badge.tsx`, `CategoryChip.tsx`,
   `StatTile.tsx`, `Note.tsx`, `TransactionRow.tsx`.
3. `apps/mobile/src/components/ui/index.ts` barrel exporting the above.
4. `apps/mobile/src/test-utils/style-literal-scan.ts` and its unit test covering L1–L8.
5. `apps/mobile/src/__tests__/no-style-literals.test.ts` and
   `apps/mobile/src/__tests__/touch-targets.test.ts`.
6. Flip the corresponding `MU_CLASS_MAP` entries' notes if any classification proved wrong
   while implementing.
7. **Verify**: run test, typecheck and lint; confirm `no-style-literals` reports zero
   violations and that every `TOUCH_METRICS` entry passes the ≥44 assertion.
8. **Commit**: `feat(mobile): add surface and content design-system primitives`

### Step 3 — Form controls

1. `TextField.tsx`, `Checkbox.tsx`, `Radio.tsx`, `Switch.tsx`, `Segment.tsx`, `Pill.tsx`.
2. Extend `TOUCH_METRICS` (`checkbox`, `radio`, `switch`, `segmentItem`, `pill`) and the barrel.
3. **Verify**: run test, typecheck and lint; confirm the touch-target test now covers the five
   controls whose visual box is under 44 and still passes.
4. **Commit**: `feat(mobile): add form-control design-system primitives`

### Step 4 — Layout, feedback and amount primitives

1. `_internal/Overlay.tsx`, `Sheet.tsx`, `Modal.tsx`, `TabBar.tsx`, `Progress.tsx`,
   `Steps.tsx`, `Dots.tsx`, `EmptyState.tsx`, `Amount.tsx`.
2. Extend `TOUCH_METRICS` (`tabBarItem`, `emptyStateAction`, `sheetDismiss`) and the barrel.
3. **Verify**: run test, typecheck and lint. Confirm by reading `Amount.tsx` that it contains
   no arithmetic on `minorUnits` and no string-formatting of numbers — the only path from
   `minorUnits` to text is the injected `format` callback.
4. **Commit**: `feat(mobile): add layout, feedback and amount primitives`

### Step 5 — Dev-only gallery route

1. `apps/mobile/src/dev/gallery.strings.ts` (es-CL copy from the `ds-*` screens) and
   `apps/mobile/src/dev/DesignSystemGallery.tsx`. Section order mirrors `#screen=ds-components`
   exactly — Botones, Badges, Chips de categoría, Campos, Transacciones, Avisos, Stat tiles —
   then the additional sections for primitives that screen omits, each labelled with its
   reference screen: Tipografía y montos (`#screen=ds-typography`), Card
   (`#screen=dashboard`), Hero (`#screen=home&state=pending`), Segment
   (`#screen=notifications-schedule`), Pill (`#screen=transactions&state=filters`), Progress
   (`#screen=bank-syncing&state=products`), Steps (`#screen=categorize`), Dots
   (`#screen=onboarding-value&state=step-2`), EmptyState (`#screen=bank-picker&state=no-results`),
   TabBar (`#screen=home`), Sheet (`#screen=categorize&state=exclude-sheet`), Modal
   (`#screen=settings-account&state=delete-confirm`).
2. `apps/mobile/app/(dev)/gallery.tsx` with the `__DEV__` guard.
3. Add `DEV_ONLY_ROUTES` to `apps/mobile/src/test-utils/route-inventory.ts`; update
   `apps/mobile/src/__tests__/route-manifest-parity.test.ts` (subtract the allowlist; add the
   dev-route guard test).
4. Enable the second assertion in `mu-class-coverage.test.ts` (every `primitive` entry resolves
   to a barrel export) and reconcile `MU_CLASS_MAP` until it passes.
5. **Verify**: run test, typecheck and lint. Confirm the route parity test still reports the 25
   manifest routes and that `DevGalleryRoute()` returns `null` under `__DEV__ === false`.
6. **Commit**: `feat(mobile): add dev-only design-system gallery route`

### Step 6 — Documentation and changelog

1. Execute every item in [Documentation Updates](#documentation-updates), including the exact
   `CHANGELOG.md` literal.
2. Run the smoke runbook
   (`docs/testing/mobile/2-theme-design-system-primitives.smoke-test.md`) on a booted iOS
   simulator and record the results, the device/viewport, and the `#screen=` references
   compared, per `docs/best-practices/stack/mobile-ui-fidelity.md` → Review evidence.
3. **Verify**: `pnpm test`, `pnpm typecheck`, `pnpm lint` from the repo root; then
   `npx markdownlint-cli2 "docs/specs/developments/**/*.md" "docs/testing/mobile/**/*.md" "CHANGELOG.md"`.
4. **Commit**: `docs: record design-system primitives in project documentation`

---

## Open Questions

1. **Type-scale drift.** Six `mu-*` classes do not match `typography.scale` exactly (see
   [Type-scale drift](#type-scale-drift-observed-no-action-in-this-item)). This plan reproduces
   the mockup and leaves `tokens.json` alone. If the intent is that `typography.scale` should be
   authoritative and the mockup CSS should be corrected to match it, that is a separate design
   change to `design/mockups/mobile/index.html` and should be its own item. **No decision is
   needed to start implementation.**
2. **Component-render test tier.** [Decision 8](#decision-8-no-new-test-dependency) defers
   `@testing-library/react-native`. If interaction-level component tests are wanted, that is a
   framework decision affecting `docs/project/3-software-architecture.md` → Testing Strategy and
   deserves its own backlog item. **No decision is needed to start implementation.**
3. **i18n catalogue ownership.** [Decision 9](#decision-9-gallery-copy-and-the-i18n-catalogue)
   recommends a new backlog item to bootstrap `apps/mobile/src/i18n/` and enable
   `eslint-plugin-i18next`. Flagged to the parent orchestrator; not created by this plan.
   **No decision is needed to start implementation.**
