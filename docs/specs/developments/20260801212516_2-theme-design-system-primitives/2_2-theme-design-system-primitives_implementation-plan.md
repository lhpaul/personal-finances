# Theme and Design-System Primitives — Implementation Plan

**Work item brief**: lhpaul/personal-finances#2 (Refactor route — no spec; the issue body is the brief)
**Smoke test runbook**: [`../../../testing/mobile/2-theme-design-system-primitives.smoke-test.md`](../../../testing/mobile/2-theme-design-system-primitives.smoke-test.md)
**Issue**: lhpaul/personal-finances#2

---

## Summary

**Approach**: Give `apps/mobile` the three foundations every screen item will compose against.
First, `apps/mobile/src/theme.ts` — a hand-written, `as const` typed mirror of
[`design/tokens.json`](../../../../design/tokens.json), with a Jest parity test that reads the
token file from disk so the mirror cannot drift silently. Second,
`apps/mobile/src/components/ui/` — twenty-two primitives, one per `mu-*` family in the mockup
design system, each built only from theme values and each interactive one expanded to the
44 pt minimum touch target with `hitSlop` rather than by inflating its visual box. Third,
`apps/mobile/src/i18n/` — `i18next` + `react-i18next` initialised from the device locale via
`expo-localization`, with flat `es`/`en` catalogues, and the `i18next/no-literal-string` ESLint
rule wired into `apps/mobile/eslint.config.mjs` so a literal string in JSX fails `pnpm lint`
instead of relying on reviewer vigilance. A dev-only gallery route renders every primitive so
the system is reviewable against `#screen=ds-components`.

**Estimated complexity**: L

<!-- S: < 1 day | M: 1-3 days | L: 3+ days -->

**Rationale**: Twenty-two primitives, a full token mirror, an i18n runtime, a lint-rule rollout
that also has to clean up the four existing JSX literals it will start failing on, and a gallery
screen. No single piece is algorithmically hard, but the surface is wide: five new
dependencies (three of them native/Expo-managed), a CSS-to-React-Native translation for
shadows and gradients, and three new mechanical guard tests. Expect several `pnpm lint` /
`pnpm test` loops and at least one simulator pass before the gallery matches the mockup.

**Dependencies**: #1 (bootstrap the monorepo and the Expo app) — **merged**. Nothing else.
This item is itself a dependency of every screen item.

---

## Verification Log

> Reproducible plan-time verification. Repo revision for every row below: `ecf46ef`
> (`implementation-plan/2-theme-design-system-primitives`, at the `origin/develop` tip).
> Verified 2026-08-01T21:25Z.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `ecf46ef` |
| Branch and worktree isolation | `pwd -P` and `git rev-parse --abbrev-ref HEAD` | `/Users/lhpaul/Git/personal-finances/.claude/worktrees/item-2`, `implementation-plan/2-theme-design-system-primitives` |
| Full `mu-*` class inventory that the primitive list must cover | `grep -o '\.mu-[a-z0-9-]*' design/mockups/mobile/index.html \| sort -u` | 89 distinct class selectors, collapsing to the 22 primitive families in the brief plus layout/typography helpers (`mu-row`, `mu-grid-2`, `mu-grid-3`, `mu-mt1`…`mu-mt6`, `mu-pad`, `mu-scroll`, `mu-h1`…`mu-h3`, `mu-p`, `mu-small`, `mu-xs`, `mu-eyebrow`, `mu-mono`, `mu-center`, `mu-spacer`) and screen-specific chart/list classes (`mu-bars`, `mu-line`, `mu-donut`, `mu-legend`, `mu-cat-row`, `mu-item`, `mu-list`, `mu-head`, `mu-topbar`, `mu-bank`, `mu-otp`, `mu-draft`, `mu-swatch`) that the brief does not list — see **Decision 12** |
| Design-system mockup screens to compare against | `grep -n 'id="s-ds-' design/mockups/mobile/index.html` | `s-ds-colors` (line 2492), `s-ds-typography` (line 2541), `s-ds-components` (line 2573) |
| Which mockup screen sources the sample copy for primitives absent from `ds-components` | node scan of `index.html` mapping each `mu-*` class to its enclosing `<section id="s-…">` | `mu-hero` → `home`; `mu-empty` → `transactions`; `mu-sheet` → `transactions`; `mu-modal` → `settings-banks`; `mu-segment` → `home`; `mu-pill` → `transactions`; `mu-steps` → `categorize`; `mu-dots` → `onboarding-value`; `mu-progress` → `bank-syncing`; `mu-tabbar` → `home`; `mu-card` → `home`; `mu-amount` → `home` |
| Existing JSX text literals the new lint rule will start failing on | `grep -rnE '>[^<>]*[A-Za-z]{2,}[^<>]*<' --include='*.tsx' apps/mobile` | Exactly 4 matches, all in `apps/mobile/src/components/RoutePlaceholder.tsx` lines 29–34. No route file under `apps/mobile/app/` contains JSX text |
| Route-parity constraint the gallery route must satisfy | `apps/mobile/src/__tests__/route-manifest-parity.test.ts` lines 46–81 | Two assertions block a naive gallery route: set equality between derived routes and the 25 manifest MVP routes, and `derived.some((route) => route.includes('design-system')) === false`. See **Decision 6** |
| Manifest routes for the three design-system screens | `grep -n "ds-colors\|ds-typography\|ds-components" design/mockups/mobile/mockup-manifest.js` | `design-system/colors`, `design-system/typography`, `design-system/components` — already excluded from the MVP route set by `DESIGN_SYSTEM_SCREEN_IDS` in `apps/mobile/src/test-utils/mockup-manifest.ts` |
| Import style already used by app code (drives "no `@/` alias" guidance) | `head -1 'apps/mobile/app/(tabs)/home.tsx'` | `import { RoutePlaceholder } from '../../src/components/RoutePlaceholder';` — relative, not `@/`. See **Decision 14** |
| Colour literals in the mockup CSS with no token in `design/tokens.json` | manual read of `design/mockups/mobile/index.html` lines 298–552 against `design/tokens.json` `colors` | 5 values: `rgba(15,23,42,.45)` (`.mu-overlay`), `rgba(255,255,255,.2)` (`.mu-hero__icon`), `rgba(255,255,255,.12)` (`.mu-hero::after`), `#e5e7eb` (`.mu-switch` off track), `rgba(99,102,241,.12)` (`.mu-input.is-focus` ring). Every other literal resolves to an existing token or palette entry (`#047857` = `emerald.700`, `#b45309` = `amber.700`, `#b91c1c` = `red.700`, `#6d28d9` = `violet.700`, `#334155` = `slate.700`, `#a5b4fc` = `indigo.300`, `#cbd5e1` = `slate.300`). See **Decision 4** |
| Current token version strings that a token addition must keep in sync | `grep -rn '1\.0\.0' design/tokens.json design/mockups/mobile/index.html design/mockups/mobile/INVENTORY.md` | `design/tokens.json` `$version`, `index.html` line 9 header comment, `INVENTORY.md` line 3 (`tokens v1.0.0`) |
| Mobile dependency baseline (drives the "add to `apps/mobile/package.json`, not the root" instruction) | `cat apps/mobile/package.json` | No i18n, gradient, or testing-library dependency present; `expo ~54.0.0`, `react 19.1.0`, `react-native 0.81.5` |
| Existing ESLint composition the new block must append to | `cat apps/mobile/eslint.config.mjs` | `export default [...rootConfig, ...expoConfig];` — the i18next block appends last so it is not overridden |
| CI commands that gate this item | `.github/workflows/` lint / typecheck / test jobs | `pnpm install --frozen-lockfile` then `pnpm lint`, `pnpm typecheck`, `pnpm test` on PRs into `develop` and `main` |
| Design-asset discovery | Issue #2 body has no `## Design assets` section; no tracker attachments; no `<dev-folder>/assets/` directory | Authoritative reference is the repo's own UI contract, `design/mockups/mobile/index.html` at `#screen=ds-colors`, `#screen=ds-typography`, `#screen=ds-components` |
| Same-surface open PRs (bounded assumption cross-check) | Current invocation item list is `{#2}`; `gh pr list --state open` | Empty — zero open PRs in the repository. No unbounded repository-wide PR scan was performed |
| Board membership | `ensure_on_project_board 2 "Writing Plan"` | `issue #2 already on project board` |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Artifact owner / repository mode | `single_repo` (no `mode` key) — this repository owns the plan and its PR | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo` section) | 2026-08-01T21:25Z, `ecf46ef` | Current invocation item list = `{#2}`; zero open PRs, so nothing can be changing artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching*; merged plan PR for item #1 targeted `develop` | 2026-08-01T21:25Z, `ecf46ef` | Current invocation item list = `{#2}`; zero open PRs change branching policy | `Verified` |
| Canonical design-token source | `design/tokens.json` is canonical; the mockup `:root` block and `apps/mobile/src/theme.ts` are mirrors of it, and any addition touches all three in one commit | [`docs/best-practices/stack/design-tokens.md`](../../../best-practices/stack/design-tokens.md) | 2026-08-01T21:25Z, `ecf46ef` | Current invocation item list = `{#2}`; no open PR touches `design/` | `Verified` |
| i18n runtime selection | `i18next` + `react-i18next` + `expo-localization`, enforced by `eslint-plugin-i18next` — not a hand-rolled `t()` | [`docs/best-practices/stack/i18n.md`](../../../best-practices/stack/i18n.md) (rewritten in `ecf46ef`) and [`docs/project/3-software-architecture.md`](../../../project/3-software-architecture.md) line 14 | 2026-08-01T21:25Z, `ecf46ef` | Current invocation item list = `{#2}`; zero open PRs touch the i18n docs or `apps/mobile` | `Verified` |
| Ownership boundary with sibling backlog items | `apps/mobile/src/db/` belongs to #3; `packages/shared-utils/` and all currency/date/number formatting belong to #4 | Parent orchestrator handoff for this run; issue bodies for #3 and #4 | 2026-08-01T21:25Z, `ecf46ef` | Current invocation item list = `{#2}`. Local sibling worktrees exist for #3 (`spec/3-…`, no plan doc yet) and #4 (`implementation-plan/4-…`, at the `develop` tip with zero unique commits); **neither has an open PR**, so there is no live same-surface conflict — only the scope boundary recorded in **Scope Boundaries** below | `Verified` |

No `Conflict` rows. Nothing in this check blocks implementation. At implementation start the
developer re-checks these five rows; a changed, conflicting, or unverifiable source is
`Stale or conflicting` and must stop before file edits and return evidence to the orchestrator.

---

## Scope Boundaries

These boundaries are load-bearing: crossing one duplicates work another in-flight item owns.

| Surface | Owner | This item's obligation |
| --- | --- | --- |
| `apps/mobile/src/db/` — Drizzle schema, migrations, seeds, repositories | Issue #3 | Create nothing under `src/db/`. No primitive imports from it. The gallery uses local fixture constants, not repository calls |
| `packages/shared-utils/` — CLP money, dates, RUT | Issue #4 | Add no formatter anywhere. `Amount` and `TransactionRow` accept **already-formatted strings** from the caller (**Decision 5**). No `Intl.NumberFormat`, `Intl.DateTimeFormat`, `toLocaleString`, or hand-rolled money/date logic may appear in `apps/mobile/src/components/ui/` or in the gallery route |
| Screen implementations (`app/(tabs)/home.tsx`, `transactions`, `dashboard`, …) | Later screen items | Leave every existing route file's composition alone. The only edits to files owned by #1 are the four i18n key substitutions in `RoutePlaceholder.tsx`, the i18n side-effect import in `app/_layout.tsx`, and the route-parity allowlist (**Decision 6**, **Decision 10**) |
| Expo Router tab shell wiring | Later tab-shell item | `TabBar` is presentational: it takes `items` / `activeKey` / `onSelect` props and knows nothing about Expo Router (**Decision 12**) |

---

## Key Decisions

Each decision is referenced by index from the Layer-by-Layer, Files, Testing and Implementation
Order sections. Indices are stable within this document.

**Decision 1 — `theme.ts` is a hand-written typed mirror, not a runtime import of
`design/tokens.json`.** Importing the JSON at runtime would put a file from outside the app
package into the Metro graph and would still not solve the two values that need translation
(CSS shadow strings, CSS gradient angles). Instead `theme.ts` is written by hand with
`as const`, and a Jest test (`theme-token-parity.test.ts`) reads `design/tokens.json` from disk
with `node:fs` — the same technique `src/test-utils/mockup-manifest.ts` already uses for the
mockup manifest — and asserts field-by-field equality for every directly mirrorable group.
Drift becomes a red test, not a code review question.

**Decision 2 — shadows are translated to React Native `ViewStyle` objects.**
`design/tokens.json` stores CSS `box-shadow` strings, which React Native cannot consume.
`theme.shadow.*` therefore exposes objects with `shadowColor` / `shadowOffset` /
`shadowOpacity` / `shadowRadius` / `elevation`, translated from the CSS per the table in
**Layer-by-Layer → Frontend / UI**. The CSS string in `tokens.json` remains canonical; the
parity test asserts the translation for each level against a translation table declared in the
test, so a token change forces a conscious theme change. React Native 0.81 also supports a
`boxShadow` style prop; it is deliberately **not** used, because the RN prop set works
identically on both platforms and on the New Architecture without a version-gated fallback.

**Decision 3 — gradients render through `expo-linear-gradient`.** All five token gradients use
a CSS angle of `135deg`, which maps to `start={{ x: 0, y: 0 }}` / `end={{ x: 1, y: 1 }}`.
`theme.gradients.<name>` exposes `{ colors: [from, to], start, end, angle }` so a component
never restates coordinates. `angle` is carried through purely for traceability back to the
token file and the parity test.

**Decision 4 — five missing colours are promoted into `design/tokens.json` in the same
commit.** [`design-tokens.md`](../../../best-practices/stack/design-tokens.md) is explicit: a
missing value is added to `tokens.json`, mirrored in the mockup `:root`, and exposed in
`theme.ts`, all in one commit. The Verification Log identifies exactly five colour literals the
mockup CSS uses that no token names. They are added as `overlayScrim`, `overlayLight`,
`overlayLightSoft`, `switchTrackOff` and `focusRing`; the mockup gains matching `:root`
variables and the five affected CSS rules switch to them; `$version` goes `1.0.0` → `1.1.0`
with the version string updated in the mockup header comment and `INVENTORY.md`. No other
token changes. This is the only change this item makes under `design/`.

**Decision 5 — `Amount` and `TransactionRow` never format.** `Amount` takes
`value: string` — an already-formatted string produced by the caller. There is no `number`
overload, so a caller physically cannot pass an unformatted amount and get formatting for
free. `TransactionRow` takes `amount: string` and `meta: string` on the same basis. Issue #4
owns `@finanzas/shared-utils`; when it lands, screens call its formatters and pass the result
in. Enforced by the prop types plus a unit test asserting `Amount` renders its input verbatim,
and by the absence of any `@finanzas/shared-utils` import under `src/components/ui/`.

**Decision 6 — the gallery is `/dev-gallery`, `__DEV__`-gated, and the route-parity test gains
an explicit allowlist.** Item #1 froze two assertions in
`apps/mobile/src/__tests__/route-manifest-parity.test.ts`: derived routes must equal the 25
manifest MVP routes exactly, and no derived route may contain `design-system`. The brief for
this item mandates a dev-only gallery route, so the two must be reconciled deliberately rather
than by accident:

- The route file is `apps/mobile/app/dev-gallery.tsx`, deriving the route `/dev-gallery`. It
  does **not** contain the substring `design-system`, so item #1's second assertion stays
  green and unmodified — the three `design-system/*` manifest pseudo-routes are still not
  shipped.
- `apps/mobile/src/test-utils/route-inventory.ts` gains an exported
  `DEV_ONLY_ROUTES = ['/dev-gallery'] as const`. The set-equality assertion subtracts that
  allowlist before comparing, and a new assertion pins the allowlist contents so it cannot grow
  silently. The guard stays exact; it is not loosened to a "starts with /dev" pattern.
- The route component returns `<Redirect href="/" />` when `__DEV__` is false, so the gallery
  is unreachable in a production build. Known limitation, recorded in **Risks**: the file is
  still bundled; `__DEV__` gating removes reachability, not bytes.

Underscore-prefixing the file (`app/_dev-gallery.tsx`) was rejected: Expo Router's ignore list
only special-cases `_layout` and `+html` / `+native-intent` / `+api`, so the file would still
be routable while becoming invisible to `toRoutePath`, hiding a real route from the parity
guard.

**Decision 7 — 44 pt touch targets come from `hitSlop`, not from inflating the visual box.**
The brief requires every touch target to be at least `theme.touchTarget.min` (44), but several
mockup controls are visually smaller: `.mu-btn--sm` is 40 pt tall, `.mu-check` and `.mu-radio`
are 22 pt, `.mu-switch` is 46 × 27, `.mu-pill` is roughly 31 pt and `.mu-segment__item` roughly
30 pt. Inflating them would break mockup fidelity. Instead
`apps/mobile/src/components/ui/touchTarget.ts` exports
`hitSlopToMinTarget(visualSize: number): { top: number; bottom: number; left: number; right: number }`,
returning `Math.max(0, (theme.touchTarget.min - visualSize) / 2)` per edge, and every
interactive primitive applies it on both axes. A table-driven unit test asserts that
`visualSize + top + bottom >= theme.touchTarget.min` for every interactive primitive.

**Decision 8 — mockup box metrics live in `theme.metrics`, not in `design/tokens.json`.**
The mockup fixes component box sizes that `tokens.json` never modelled — control heights
(52 / 44 / 40), checkbox and radio 22, switch 46 × 27 with a 21 pt knob, chip min-height 74,
tab-bar icon 46 × 30, hero icon 52, list icon 40, empty-state icon 42, modal icon 34, border
widths 1 / 1.5 / 2, and the two off-scale font sizes the mockup uses (`.mu-stat__value` 26,
`.mu-h1` line-height 1.18). These are component metrics, not design tokens, so they are
declared in a `metrics` group inside `theme.ts` with the source CSS rule named in a comment on
each entry. That keeps the brief's first acceptance criterion true — no spacing or radius
literal exists outside `theme.ts` — without unilaterally expanding the design contract. If a
design review later decides they are canonical, promoting them is a follow-up that must touch
`tokens.json`, the mockup `:root` and `theme.ts` in one commit.

**Decision 9 — the no-literal-string rule is machine-enforced with no escape hatch.** The exact
block from [`i18n.md`](../../../best-practices/stack/i18n.md) is appended to
`apps/mobile/eslint.config.mjs` after `expoConfig`. No `eslint-disable` comment for
`i18next/no-literal-string` may be added anywhere in this item; a literal goes into the
catalogue instead. Scope of the proof is stated precisely: `mode: 'jsx-text-only'` checks JSX
**text** nodes, so a green `pnpm lint` proves no JSX text literal remains under
`apps/mobile/app/**/*.tsx` and `apps/mobile/src/**/*.tsx`. It does not cover JSX attribute
strings (for example the existing `options={{ title: 'Inicio' }}` in
`app/(tabs)/_layout.tsx`) or non-JSX strings; those stay a review-time concern and the tab
labels remain the tab-shell item's to migrate.

**Decision 10 — `RoutePlaceholder` copy moves into the catalogues.** The rule will fail on the
four JSX text literals in `apps/mobile/src/components/RoutePlaceholder.tsx` enumerated in the
Verification Log. They become `dev.placeholder_banner`, `dev.placeholder_screen`,
`dev.placeholder_route` and `dev.placeholder_next` under a `dev.*` namespace, the last three
using i18next interpolation (`{{screenId}}`, `{{route}}`, `{{label}}`). This is a required
consequence of adopting the rule, not scope creep.

**Decision 11 — device-locale resolution is a pure function in its own module.**
`apps/mobile/src/i18n/locale.ts` exports `SUPPORTED_LOCALES`, `SupportedLocale`,
`DEFAULT_LOCALE` and `resolveDeviceLocale(locales)`, which takes the locale array as a
parameter instead of calling `expo-localization` itself. `apps/mobile/src/i18n/index.ts` calls
`resolveDeviceLocale(getLocales())`. The resolver is therefore unit-testable without mocking a
native module, and the fallback chain (`languageCode` missing → `DEFAULT_LOCALE`; unsupported
code → `DEFAULT_LOCALE`) is directly asserted.

**Decision 12 — the primitive list is exactly the twenty-two named in the brief.** The mockup
also carries layout helpers (`mu-row`, `mu-grid-2`, `mu-grid-3`, `mu-mt*`, `mu-pad`,
`mu-scroll`), typography helpers (`mu-h1`…`mu-h3`, `mu-p`, `mu-small`, `mu-xs`, `mu-eyebrow`,
`mu-mono`) and screen-specific classes (`mu-bars`, `mu-donut`, `mu-line`, `mu-legend`,
`mu-cat-row`, `mu-item`, `mu-list`, `mu-head`, `mu-topbar`, `mu-bank`, `mu-otp`, `mu-draft`,
`mu-swatch`). None becomes a component here. Layout stays inline `View` styling from
`theme.space`; typography is exposed as ready-made `TextStyle` presets on `theme.text.*` used
with React Native's own `Text`; the screen-specific classes belong to the screen and chart
items that own them. Adding an unrequested primitive would widen the review surface and
pre-empt those items' design choices.

**Decision 13 — `TabBar` is presentational.** It renders four columns per the mockup and takes
`items`, `activeKey` and `onSelect`. The MVP renders only Inicio and Transacciones, and which
tabs exist is the tab-shell item's decision, so the component takes the item list from its
caller rather than hardcoding one.

**Decision 14 — imports are relative, not `@/`.** `apps/mobile/tsconfig.json` declares a `@/*`
path alias, but nothing in the repository has proven it resolves under `jest-expo` (no
`moduleNameMapper` is configured) and every existing app file uses relative imports. All new
code uses relative imports (`../../src/theme`, `./touchTarget`). *Unverified against a running
build — if a future item wants the alias, it must add the Jest mapping and prove it there.*

### Unverified external-behaviour claims

The implementer must confirm each of these before treating the corresponding step as done. They
are recorded here so a reviewer does not read them as settled facts.

1. **`eslint-plugin-i18next` under ESLint 9 flat config.** The block in `i18n.md` uses
   `plugins: { i18next: i18nextPlugin }` with the package's default export. Confirm the
   installed version exposes a flat-config-compatible plugin object and that `pnpm lint` runs
   without a plugin-resolution error.
2. **i18next plural handling on Hermes.** Modern Hermes ships `Intl.PluralRules`, so
   `compatibilityJSON` should not be needed. If i18next warns or plurals misbehave on the
   target build, set `compatibilityJSON: 'v3'` and record it as a known limitation. No plural
   key is introduced by this item, so this only matters for later screen items.
3. **`@testing-library/react-native` peer requirements under React 19.** Confirm whether the
   installed version needs `react-test-renderer` as an explicit devDependency; add it if the
   install warns.
4. **`expo-localization` and `expo-linear-gradient` in Expo Go.** Both are Expo-managed native
   modules bundled with Expo Go, so a dev build should not be required. Confirm on first run;
   if a dev build turns out to be needed, say so in the PR per
   [`expo-react-native.md`](../../../best-practices/stack/expo-react-native.md).

### Dependencies to add

All five go in `apps/mobile/package.json`, never the root, per
[`turborepo-pnpm.md`](../../../best-practices/stack/turborepo-pnpm.md) ("keep a dependency in
the package that imports it").

| Package | Where | Install command | Why |
| --- | --- | --- | --- |
| `i18next` | `dependencies` | `pnpm --filter @finanzas/mobile add i18next` | i18n runtime |
| `react-i18next` | `dependencies` | `pnpm --filter @finanzas/mobile add react-i18next` | `useTranslation` binding |
| `expo-localization` | `dependencies` | `cd apps/mobile && npx expo install expo-localization` | Device locale; Expo-managed native module, so the SDK-matched version must come from `expo install`, not `pnpm add` |
| `expo-linear-gradient` | `dependencies` | `cd apps/mobile && npx expo install expo-linear-gradient` | `Hero` and `StatTile` gradients; same Expo-managed rule |
| `eslint-plugin-i18next` | `devDependencies` | `pnpm --filter @finanzas/mobile add -D eslint-plugin-i18next` | Machine enforcement of the no-literals rule |
| `@testing-library/react-native` | `devDependencies` | `pnpm --filter @finanzas/mobile add -D @testing-library/react-native` | Rendering assertions for the primitives |

---

## Layer-by-Layer Changes

### Database / Data Layer

- [ ] **No changes.** `apps/mobile/src/db/` belongs to issue #3 (**Scope Boundaries**). The
      gallery uses local fixture constants declared in the route file.

### Backend / API

- [ ] **No changes.** This product has no backend.

### Shared Packages / Libraries

- [ ] **No changes.** `packages/shared-utils/` belongs to issue #4 (**Scope Boundaries**). No
      formatter is added anywhere in this item.

### Frontend / UI

- [ ] `apps/mobile/src/theme.ts` — the typed mirror (**Decision 1**). Top-level groups:

  | Group | Contents | Source |
  | --- | --- | --- |
  | `colors` | every flat colour plus `palette.<hue>.<50…900>` and the five new entries from **Decision 4** | `tokens.json → colors` |
  | `gradients` | `challenge`, `income`, `expense`, `celebration`, `brand`, each `{ colors, start, end, angle }` (**Decision 3**) | `tokens.json → gradients` |
  | `chart` | `series` (5 colours), `grid`, `axis`, `comparison` | `tokens.json → chart` |
  | `typography` | `fontFamily`, `fontFamilyMono`, `size`, `weight`, `scale.{display,heading,body,label,amount}` | `tokens.json → typography` |
  | `text` | ready-made React Native `TextStyle` presets derived from `typography.scale` (`display.lg`…`amount.md`), so a component writes `theme.text.headingMd` instead of restating four properties (**Decision 12**) | derived |
  | `space` | `1,2,3,4,5,6,8,10,12,16` → `4…64` | `tokens.json → space` |
  | `radius` | `sm,md,lg,xl,card,button,pill` | `tokens.json → radius` |
  | `shadow` | RN `ViewStyle` objects for `sm,md,lg,xl,card` (**Decision 2**) | translated |
  | `layout` | `phoneWidth`, `phoneHeight`, `screenPadding`, `tabBarHeight`, `headerHeight` | `tokens.json → layout` |
  | `touchTarget` | `{ min: 44 }` | `tokens.json → touchTarget` |
  | `categoryIcons` | `expense`, `income`, `uncategorized` emoji maps | `tokens.json → categoryIcons` |
  | `metrics` | mockup-derived component box metrics and border widths (**Decision 8**) | mockup CSS |

  Shadow translation table (the test asserts exactly these):

  | Token | CSS | React Native |
  | --- | --- | --- |
  | `sm` | `0 1px 2px 0 rgba(0,0,0,0.05)` | offset `{0,1}`, radius `2`, opacity `0.05`, colour `#000`, elevation `1` |
  | `md` | `0 4px 6px -1px rgba(0,0,0,0.1), …` | offset `{0,4}`, radius `6`, opacity `0.10`, colour `#000`, elevation `3` |
  | `lg` | `0 10px 15px -3px rgba(0,0,0,0.1), …` | offset `{0,10}`, radius `15`, opacity `0.10`, colour `#000`, elevation `6` |
  | `xl` | `0 20px 25px -5px rgba(0,0,0,0.1), …` | offset `{0,20}`, radius `25`, opacity `0.10`, colour `#000`, elevation `10` |
  | `card` | `0 1px 3px rgba(26,29,41,0.06), …` | offset `{0,1}`, radius `3`, opacity `0.06`, colour `#1a1d29`, elevation `2` |

  React Native cannot express a two-layer shadow or a negative spread; the translation keeps
  the first (outer) layer and drops the spread. That loss is intentional and recorded here so
  the parity test can assert the translated values rather than the CSS string.

  `fontFamily` maps to `undefined` (the platform default resolves to San Francisco on iOS and
  Roboto on Android, matching the `-apple-system … Roboto` stack) and `fontFamilyMono` to
  `Platform.select({ ios: 'Menlo', android: 'monospace' })`. Both mappings live in `theme.ts`
  and nowhere else.

- [ ] `apps/mobile/src/components/ui/` — the twenty-two primitives (**Decision 12**). Full
      catalogue in **Primitive Catalogue** below, plus `touchTarget.ts` (**Decision 7**) and an
      `index.ts` barrel that re-exports every primitive and its prop type.
- [ ] `apps/mobile/app/dev-gallery.tsx` — the dev-only gallery (**Decision 6**), sectioned in
      the same order as `#screen=ds-components` and then continuing with the primitives that
      screen does not draw.
- [ ] `apps/mobile/src/components/RoutePlaceholder.tsx` — four literals replaced with
      `t('dev.…')` calls (**Decision 10**).
- [ ] `apps/mobile/app/_layout.tsx` — add the i18n side-effect import
      (`import '../src/i18n';`) as the first import so the runtime is initialised before any
      screen renders.

### Infrastructure / Configuration

- [ ] `apps/mobile/eslint.config.mjs` — append the `i18next/no-literal-string` block verbatim
      from [`i18n.md`](../../../best-practices/stack/i18n.md) (**Decision 9**), with
      `import i18nextPlugin from 'eslint-plugin-i18next';` at the top.
- [ ] `apps/mobile/package.json` — the six dependency additions in the table above.
- [ ] `design/tokens.json` — five colour additions and `$version` → `1.1.0` (**Decision 4**).
- [ ] `design/mockups/mobile/index.html` — five `:root` variables, five CSS rules switched to
      them, and the header comment's token version.
- [ ] `design/mockups/mobile/INVENTORY.md` — the `tokens v1.0.0` line.
- [ ] No `turbo.json`, `tsconfig`, `metro.config.js`, `babel.config.js` or CI change: the
      existing `lint` / `typecheck` / `test` tasks already cover everything this item adds.

---

## Primitive Catalogue

Every component is a function component in its own file under
`apps/mobile/src/components/ui/`, exported by name together with its `…Props` type, and
re-exported from `index.ts`. Every one reads colours, spacing, radii, typography and metrics
from `theme` only. Every interactive one takes `accessibilityLabel` and applies
`hitSlopToMinTarget` (**Decision 7**) where its visual box is under 44 pt.

| # | Component | Mockup class family | Props | Variants / states |
| --- | --- | --- | --- | --- |
| 1 | `Button` | `.mu-btn` + `--muted --outline --ghost --danger --danger-soft --sm --auto` | `label: string`, `onPress`, `variant`, `size`, `fullWidth`, `disabled`, `leadingIcon`, `accessibilityLabel` | `variant`: `primary \| muted \| outline \| ghost \| danger \| danger-soft`; `size`: `md` (52) \| `sm` (40, hit-slopped); `ghost` is 44 |
| 2 | `Card` | `.mu-card` + `--tight --flat`, `__title __sub __head` | `children`, `variant`, `title?`, `subtitle?`, `headerRight?` | `variant`: `default \| tight \| flat` |
| 3 | `Hero` | `.mu-hero`, `__row __icon __title __sub` | `title`, `subtitle?`, `icon?`, `gradient`, `children?` | `gradient`: the five token gradients; decorative corner blob uses `colors.overlayLightSoft` |
| 4 | `Badge` | `.mu-badge` + `--ok --warn --danger --info --celebration` | `label`, `tone`, `icon?` | `tone`: `neutral \| ok \| warn \| danger \| info \| celebration` |
| 5 | `CategoryChip` | `.mu-chip`, `__emoji __hint __star`, `.is-selected .is-suggested` | `label`, `emoji`, `hint?`, `selected?`, `suggested?`, `onPress`, `accessibilityLabel` | selected, suggested (star badge), plain; min height 74 |
| 6 | `StatTile` | `.mu-stat` + `--in --out`, `__label __value __sub __arrow` | `label`, `value: string`, `sub?`, `tone` | `tone`: `income` (green gradient, ↗) \| `expense` (amber gradient, ↘). `value` is a pre-formatted string (**Decision 5**) |
| 7 | `Note` | `.mu-note` + `--ok --warn --danger`, `__icon` | `children`, `tone`, `icon?` | `tone`: `info \| ok \| warn \| danger` |
| 8 | `TransactionRow` | `.mu-tx` + `--pending --excluded`, `__icon __txt __name __meta __amount` | `name`, `meta`, `amount: string`, `icon`, `state`, `direction`, `onPress?`, `accessibilityLabel` | `state`: `default \| pending \| excluded`; `direction`: `in` (green amount) \| `out` (amber amount). Both strings pre-formatted (**Decision 5**) |
| 9 | `TextField` | `.mu-input` + `--ph .is-focus .is-error .is-locked`, `.mu-label`, `.mu-hint`, `.mu-hint--error` | `label?`, `value`, `onChangeText`, `placeholder?`, `error?`, `hint?`, `locked?`, `leadingIcon?`, `secureTextEntry?` | default, placeholder, focused (brand border + `colors.focusRing`), error, locked. Focus state from internal `onFocus`/`onBlur` |
| 10 | `Checkbox` | `.mu-check`, `.is-on` | `checked`, `onChange`, `accessibilityLabel` | on / off; 22 pt visual, hit-slopped to 44 |
| 11 | `Radio` | `.mu-radio`, `.is-on` | `selected`, `onChange`, `accessibilityLabel` | on / off; 22 pt visual, hit-slopped to 44 |
| 12 | `Switch` | `.mu-switch`, `.is-on` | `value`, `onValueChange`, `accessibilityLabel` | on / off; 46 × 27 track using `colors.switchTrackOff` when off, 21 pt knob |
| 13 | `Segment` | `.mu-segment`, `__item`, `.is-active` | `items: { value: string; label: string }[]`, `value`, `onChange` | active / inactive item; active item gets `shadow.sm` |
| 14 | `Pill` | `.mu-pill`, `.is-active` | `label`, `active?`, `onPress`, `accessibilityLabel` | active / inactive; hit-slopped to 44 |
| 15 | `Sheet` | `.mu-overlay` + `.mu-sheet`, `__grab` | `visible`, `onRequestClose`, `children`, `title?` | bottom sheet over `colors.overlayScrim`; grab handle; max height 78 % |
| 16 | `Modal` | `.mu-overlay--center` + `.mu-modal`, `__icon` | `visible`, `onRequestClose`, `icon?`, `title`, `body?`, `actions?` | centred dialog over `colors.overlayScrim` |
| 17 | `TabBar` | `.mu-tabbar`, `__item __icon`, `.is-active` | `items: { key: string; label: string; icon: string }[]`, `activeKey`, `onSelect` | active / inactive; four equal columns (**Decision 13**); items hit-slopped to 44 |
| 18 | `Progress` | `.mu-progress`, `__fill` | `value: number` (0–1), `accessibilityLabel` | 6 pt track; value clamped to `[0, 1]` |
| 19 | `Steps` | `.mu-steps`, `__step`, `.is-on` | `total: number`, `current: number` | filled / empty segments, 4 pt tall |
| 20 | `Dots` | `.mu-dots`, `__dot`, `.is-on` | `total: number`, `index: number` | active dot widens to 22 pt |
| 21 | `EmptyState` | `.mu-empty`, `__icon` | `icon`, `title`, `body?`, `action?` | with / without action |
| 22 | `Amount` | `.mu-amount` + `--hero --in --out` | `value: string`, `tone`, `size` | `tone`: `neutral \| in \| out`; `size`: `hero \| lg \| md`. Never formats (**Decision 5**); `fontVariant: ['tabular-nums']` always |

---

## i18n Catalogue

`apps/mobile/src/i18n/es.json` and `en.json` use **flat** keys and are updated together in the
same change. Two namespaces are introduced.

**`dev.*` — `RoutePlaceholder` copy (Decision 10).** Four keys, three with interpolation:
`dev.placeholder_banner`, `dev.placeholder_screen` (`{{screenId}}`), `dev.placeholder_route`
(`{{route}}`), `dev.placeholder_next` (`{{label}}`). Spanish is the production string; these are
developer-facing diagnostics, so the English values may mirror the current English text.

**`ds.*` — gallery copy.** The Spanish value is lifted verbatim from the mockup — never
invented — per [`i18n.md`](../../../best-practices/stack/i18n.md) ("the mockup is the source of
the Spanish string"). For the sections `#screen=ds-components` draws, the source is that screen:

| Key group | Keys | Spanish source (`#screen=ds-components`) |
| --- | --- | --- |
| Section headings | `ds.section_buttons`, `ds.section_badges`, `ds.section_chips`, `ds.section_fields`, `ds.section_transactions`, `ds.section_notes`, `ds.section_stats` | `Botones`, `Badges`, `Chips de categoría`, `Campos`, `Transacciones`, `Avisos`, `Stat tiles` |
| Buttons | `ds.btn_primary`, `ds.btn_primary_disabled`, `ds.btn_secondary`, `ds.btn_tertiary`, `ds.btn_destructive`, `ds.btn_destructive_soft` | `Primario`, `Primario deshabilitado`, `Secundario`, `Terciario`, `Destructivo`, `Destructivo suave` |
| Badges | `ds.badge_neutral`, `ds.badge_ok`, `ds.badge_warn`, `ds.badge_danger`, `ds.badge_info`, `ds.badge_celebration` | `Neutro`, `Al día`, `Pendiente`, `Error`, `Info`, `Logro` |
| Chips | `ds.chip_suggested`, `ds.chip_selected`, `ds.chip_normal` | `Sugerido`, `Elegido`, `Normal` |
| Fields | `ds.field_placeholder`, `ds.field_focus`, `ds.field_error`, `ds.field_error_hint`, `ds.field_locked` | `Placeholder`, `Con foco`, `Con error`, `Mensaje de error`, `Bloqueado` |
| Transactions | `ds.tx_categorized`, `ds.tx_categorized_meta`, `ds.tx_pending`, `ds.tx_pending_meta`, `ds.tx_excluded`, `ds.tx_excluded_meta` | `Categorizada`, `24 ene · Comida`, `Pendiente`, `⚠️ Necesita categorización`, `Excluida`, `14 ene · Fuera del análisis` |
| Notes | `ds.note_info`, `ds.note_ok`, `ds.note_warn`, `ds.note_danger` | `Informativo`, `Éxito / seguridad`, `Advertencia`, `Error` |
| Stat tiles | `ds.stat_income`, `ds.stat_income_sub`, `ds.stat_expense`, `ds.stat_expense_sub` | `Ingresos`, `2 movimientos`, `Gastos`, `24 movimientos` |
| Screen title | `ds.title` | `DS · Componentes` |

For the nine primitives `#screen=ds-components` does not draw, the developer lifts the Spanish
copy from the mockup screen where that primitive actually appears — identified in the
Verification Log — and does not invent it:

| Primitive | Key prefix | Lift Spanish copy from |
| --- | --- | --- |
| `Card` | `ds.card_*` | `#screen=home` |
| `Hero` | `ds.hero_*` | `#screen=home` |
| `Segment` | `ds.segment_*` | `#screen=home` |
| `Pill` | `ds.pill_*` | `#screen=transactions` |
| `Sheet` | `ds.sheet_*` | `#screen=transactions` |
| `Modal` | `ds.modal_*` | `#screen=settings-banks` |
| `TabBar` | `ds.tab_*` | `#screen=home` |
| `Progress` | `ds.progress_*` | `#screen=bank-syncing` |
| `Steps` | `ds.steps_*` | `#screen=categorize` |
| `Dots` | `ds.dots_*` | `#screen=onboarding-value` |
| `EmptyState` | `ds.empty_*` | `#screen=transactions` |

Money and date sample strings (`$1.200.000`, `+$2.500.000`, `$35.000`, `24 ene`) are **not**
catalogue entries. They are fixture constants declared in `app/dev-gallery.tsx` and passed as
props, because the catalogue never holds formatted money and this item owns no formatter
(**Decision 5**, **Scope Boundaries**). Passing them as props is also outside the lint rule's
`jsx-text-only` scope, so no literal is smuggled into JSX text.

---

## Files to Create

### `apps/mobile/src`

| Path | Purpose |
| --- | --- |
| `src/theme.ts` | The typed token mirror (**Decision 1**, **Decision 2**, **Decision 3**, **Decision 8**) |
| `src/i18n/index.ts` | i18next init + `setLocale(locale: SupportedLocale): Promise<void>` |
| `src/i18n/locale.ts` | `SUPPORTED_LOCALES`, `SupportedLocale`, `DEFAULT_LOCALE`, `resolveDeviceLocale()` (**Decision 11**) |
| `src/i18n/es.json` | Spanish catalogue, flat keys |
| `src/i18n/en.json` | English catalogue, identical key set |
| `src/i18n/locale.test.ts` | Resolver + fallback unit tests |
| `src/i18n/catalogue-parity.test.ts` | `es` / `en` key-set equality and flatness |
| `src/components/ui/touchTarget.ts` | `hitSlopToMinTarget()` (**Decision 7**) |
| `src/components/ui/touchTarget.test.ts` | Unit tests for the helper |
| `src/components/ui/index.ts` | Barrel re-exporting all 22 primitives and their prop types |
| `src/components/ui/Button.tsx` … `src/components/ui/Amount.tsx` | The 22 primitive files, one per row of the **Primitive Catalogue** |
| `src/components/ui/Button.test.tsx` … | Colocated component tests (see **Testing Strategy** for which assertions each carries) |
| `src/test-utils/color-literal-scan.ts` | `findColorLiterals(source: string): { line: number; match: string }[]` |
| `src/test-utils/color-literal-scan.test.ts` | Edge-case unit tests for the scanner |
| `src/__tests__/theme-token-parity.test.ts` | `theme.ts` vs `design/tokens.json` mirror test |
| `src/__tests__/color-literal-guard.test.ts` | Repo scan applying `findColorLiterals` to app sources |
| `src/__tests__/touch-target.test.tsx` | Table-driven 44 pt assertion across every interactive primitive |

### `apps/mobile/app`

| Path | Purpose |
| --- | --- |
| `app/dev-gallery.tsx` | The dev-only gallery route, `__DEV__`-gated (**Decision 6**) |

### Docs

| Path | Purpose |
| --- | --- |
| `docs/testing/mobile/2-theme-design-system-primitives.smoke-test.md` | Smoke runbook (written in this plan PR) |

---

## Files to Modify

| Path | Change |
| --- | --- |
| `apps/mobile/package.json` | Six dependency additions (**Dependencies to add**) |
| `apps/mobile/eslint.config.mjs` | Append the `i18next/no-literal-string` block (**Decision 9**) |
| `apps/mobile/app/_layout.tsx` | Add `import '../src/i18n';` as the first import |
| `apps/mobile/src/components/RoutePlaceholder.tsx` | Replace 4 JSX text literals with `t('dev.…')` (**Decision 10**) |
| `apps/mobile/src/test-utils/route-inventory.ts` | Export `DEV_ONLY_ROUTES = ['/dev-gallery'] as const` (**Decision 6**) |
| `apps/mobile/src/__tests__/route-manifest-parity.test.ts` | Subtract `DEV_ONLY_ROUTES` in the set-equality assertion; add an assertion pinning the allowlist contents. Leave the `design-system` and `(auth)` and `(tabs)` assertions untouched |
| `apps/mobile/src/test-utils/route-inventory.test.ts` | Cover the new export |
| `design/tokens.json` | 5 colour additions, `$version` → `1.1.0` (**Decision 4**) |
| `design/mockups/mobile/index.html` | 5 `:root` variables, 5 CSS rules switched to them, header comment version |
| `design/mockups/mobile/INVENTORY.md` | `tokens v1.0.0` → `tokens v1.1.0` |
| `CHANGELOG.md` | `[Unreleased] → Added` entry (Implementation Order step 14) |

This item is **not** a cross-cutting checklist change: it adds no safety, quality or compliance
category to `REVIEW.md`, to any protocol, or to any agent/skill guidance file, and it changes no
acceptance criterion that other plans or implementations must satisfy. The
`i18next/no-literal-string` rule is a lint rule inside one application package, enforced by
`pnpm lint`, not a review-workflow checklist. The full-enumeration requirement in protocol 02's
cross-cutting-checklist block therefore does not apply, and no file under `.claude/agents/`,
`.cursor/agents/`, `.codex/skills/` or `docs/workflow/` is touched.

---

## Testing Strategy

**Test types**: Unit (Jest + `@testing-library/react-native`), mechanical guard tests, and a
manual simulator smoke pass against the three mockup design-system screens.

**Key scenarios to test**:

1. **Token mirror parity** — maps to brief AC1 ("no hex, spacing or radius literal outside
   `theme.ts`"). `src/__tests__/theme-token-parity.test.ts` reads `design/tokens.json` with
   `node:fs` and asserts `theme.colors`, `theme.chart`, `theme.typography.{size,weight,scale}`,
   `theme.space`, `theme.radius`, `theme.layout`, `theme.touchTarget`, `theme.categoryIcons`
   equal the token file, and that each `theme.gradients.<name>` carries the token's `from`/`to`
   as `colors[0]`/`colors[1]` and the token's `angle`. Shadows are asserted against the
   translation table declared in the test (**Decision 2**).
2. **No colour literal outside the theme** — maps to brief AC1.
   `src/__tests__/color-literal-guard.test.ts` walks every `.ts`/`.tsx` under `apps/mobile/app`
   and `apps/mobile/src`, applies `findColorLiterals`, and fails with file + line for any hit.
   The allowlist is exactly `['src/theme.ts', 'src/test-utils/color-literal-scan.ts',
   'src/test-utils/color-literal-scan.test.ts']`, and a separate assertion pins that array so it
   cannot grow silently.
3. **Every `mu-*` primitive has a component** — maps to brief AC2. The `index.ts` barrel is
   asserted to export exactly the 22 names in the **Primitive Catalogue**, so a forgotten
   primitive or an unrequested extra one (**Decision 12**) fails the suite.
4. **Touch targets ≥ 44** — maps to brief AC4. `src/__tests__/touch-target.test.tsx` renders
   every interactive primitive and asserts, per element, that its visual height plus
   `hitSlop.top + hitSlop.bottom` is at least `theme.touchTarget.min`, and the same on the
   horizontal axis.
5. **Per-primitive behaviour** — colocated tests: `Button` fires `onPress` and does not when
   `disabled`; `Amount` renders its `value` string verbatim and applies the tone colour
   (**Decision 5**); `TransactionRow` renders the `excluded` and `pending` states; `TextField`
   shows the error hint only when `error` is set; `Checkbox` / `Radio` / `Switch` toggle
   through their callbacks; `Progress` clamps out-of-range values; `Segment` / `Pill` /
   `TabBar` mark the active entry.
6. **Locale resolution and fallback** — `src/i18n/locale.test.ts`:
   `[{ languageCode: 'es' }]` → `es`; `[{ languageCode: 'en' }]` → `en`;
   `[{ languageCode: 'pt' }]` → `es`; `[{ languageCode: null }]` → `es`; `[]` → `es`.
7. **Catalogue parity** — `src/i18n/catalogue-parity.test.ts`: the `es` and `en` key sets are
   identical, every value is a string (no nested object — the doc requires flat keys), and no
   value is empty.
8. **Route parity survives the gallery** — the modified
   `src/__tests__/route-manifest-parity.test.ts` still asserts exact set equality after
   subtracting `DEV_ONLY_ROUTES`, still finds no `design-system` route, and now pins the
   allowlist to `['/dev-gallery']` (**Decision 6**).
9. **The lint rule actually fires** — maps to the enforcement requirement in
   [`i18n.md`](../../../best-practices/stack/i18n.md). Verified by command, not by test:
   `pnpm lint` is green on the final tree, and the developer temporarily adds a literal
   `<Text>hola</Text>` to `app/dev-gallery.tsx`, confirms `pnpm lint` fails on
   `i18next/no-literal-string`, and reverts. The transcript of both runs goes in the PR
   description.

**Smoke test runbook**:
`docs/testing/mobile/2-theme-design-system-primitives.smoke-test.md`

**Regression suite**: The repository's only automated suites are the per-package Jest suites
above; the `e2e/` Playwright placeholder targets a web surface this product does not have, so no
regression spec is added.

### Parser-risk addendum

This plan is classified **parser-risk** because scenario 2 introduces regex-based scanning over
source files (`findColorLiterals`). The scanner is deliberately tiny and pure, and it is the
only parsing this item performs.

**Contract**: `findColorLiterals(source: string)` returns one entry per match, with a 1-based
`line` and the matched text, for CSS-style colour literals: `#` followed by 3, 4, 6 or 8 hex
digits at a word boundary, and `rgb(` / `rgba(` function calls (case-insensitive).

**Edge-case enumeration** — each row is a concrete input, and each maps to a test in
`src/test-utils/color-literal-scan.test.ts`:

| # | Input | Expected | Rationale |
| --- | --- | --- | --- |
| 1 | `const c = '#fff';` | 1 match, `#fff` | 3-digit shorthand |
| 2 | `const c = '#FFFFFF';` | 1 match, `#FFFFFF` | uppercase — the class is case-insensitive |
| 3 | `const c = '#ffffff80';` | 1 match, `#ffffff80` | 8-digit with alpha (boundary: longest accepted length) |
| 4 | `const c = '#6366f';` | 0 matches | 5 digits — between the accepted lengths, must not match |
| 5 | `rgba(15, 23, 42, 0.45)` | 1 match | function form with spaces |
| 6 | `rgb(99 102 241)` | 1 match | space-separated modern syntax |
| 7 | `RGBA(0,0,0,1)` | 1 match | function name is case-insensitive |
| 8 | `// see #screen=ds-components` | 0 matches | negative lookalike: `s` is not a hex digit |
| 9 | `// closes #2` / `// closes #12` | 0 matches | negative lookalike: fewer than 3 digits |
| 10 | `const a='#fff', b='#000';` | 2 matches, both on line 1 | multiple occurrences on one line |
| 11 | `/* brand is #6366f1 */` | 1 match | a comment is not an escape hatch — comments must name tokens, not hex |
| 12 | `` const s = `${x}#e2e8f0`; `` | 1 match | template literals are scanned like any other text |
| 13 | `'#deadbeef'` in prose | 1 match | documented accepted false positive: hex-looking words are rejected by rewording, never by an ignore directive |
| 14 | `const url = 'https://x/#abc123';` | 1 match | documented accepted false positive; same remedy |
| 15 | empty string, and a file with no colour at all | 0 matches | baseline |

**Unit test mapping**: `apps/mobile/src/test-utils/color-literal-scan.test.ts` carries one
`it(...)` per row above (15 cases), asserting both the match count and the reported line
numbers. `apps/mobile/src/__tests__/color-literal-guard.test.ts` then applies the same function
to the real tree, so the scanner's behaviour is proven independently of the files it happens to
scan today.

**Suppression semantics**: Not applicable — the scanner recognises **no** suppression
directive, by design. There is no inline comment, pragma or allowlist annotation that exempts a
line. The only exemption is the file-level allowlist named in scenario 2, which is a fixed
three-entry array pinned by its own assertion. This mirrors **Decision 9**: the way to satisfy
the guard is to move the value into `theme.ts`, never to suppress the check.

### Concurrent-event-source addendum

**Not applicable.** The classifier's signals do not fire: this item registers no event listener,
socket callback, timer or async queue; the only asynchronous call is
`i18n.changeLanguage()` inside `setLocale()`, which has a single caller path and no concurrent
peer. The seven checklist items are answered as follows for completeness:

- **Shared mutable state guards**: not applicable — the only module-level state is the i18next
  singleton, written once at init and thereafter only through `setLocale()`.
- **Re-entrancy / in-flight tracking**: not applicable — no handler exists that a second event
  could re-enter. `setLocale()` is a thin wrapper i18next itself serialises.
- **Event deduplication**: not applicable — no event source.
- **Listener and resource cleanup**: not applicable — no listener, timer or subscription is
  registered. `Sheet` and `Modal` mount and unmount with their `visible` prop and hold no
  handle.
- **Race conditions at initialization**: the i18n side-effect import in `app/_layout.tsx` runs
  synchronously before any screen renders (**Layer-by-Layer → Frontend / UI**), so no render
  can observe an uninitialised i18next.
- **Race conditions at teardown**: not applicable — nothing is torn down.
- **Error propagation across async boundaries**: `setLocale()` returns the promise from
  `i18n.changeLanguage()` rather than swallowing it, so a rejection is visible to its caller.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Gallery sample copy | The `ds.*` catalogue keys enumerated in **i18n Catalogue**, Spanish lifted verbatim from the named mockup screens | `apps/mobile/src/i18n/es.json`, `apps/mobile/src/i18n/en.json` |
| Gallery fixture amounts and dates | `$1.200.000` (hero), `+$2.500.000` (in), `$35.000` (out), `$42.000`, `$75.000`, `3.7M`, `1.4M`, `24 ene · Comida`, `14 ene · Fuera del análisis` — pre-formatted strings, module-level constants, never produced by a formatter (**Decision 5**) | `apps/mobile/app/dev-gallery.tsx` |
| Gallery fixture tab items | Four items mirroring the mockup tab bar, labels from `ds.tab_*` | `apps/mobile/app/dev-gallery.tsx` |

No database seed data: this item touches no database (**Scope Boundaries**, issue #3).

---

## Documentation Updates

Not performed during Plan Ready — listed here for the developer to execute in the
implementation PR.

- [ ] `docs/best-practices/stack/design-tokens.md` — replace the nine-row "Component layer"
      table with the full 22-primitive mapping; document the `theme.metrics` convention
      (**Decision 8**), the shadow translation (**Decision 2**), the gradient shape
      (**Decision 3**), and the five new colour tokens (**Decision 4**).
- [ ] `docs/project/2-repo-architecture.md` — line 30 currently describes `i18n/` as "es-CL
      copy"; update to the `es` / `en` flat-key catalogues plus the i18next wiring. Confirm the
      `components/` and `theme.ts` lines still read correctly now that both exist.
- [ ] `docs/project/3-software-architecture.md` — confirm the i18n row and the copy rules
      (lines 14, 102–104) match the shipped setup; add the design-system primitive layer to the
      structure block if it is not already described.
- [ ] `AGENTS.md` (and therefore `CLAUDE.md`, which symlinks it) — add the gallery deep link to
      **Common Commands**; confirm non-negotiable 8 (no literal strings in JSX) can now cite
      `pnpm lint` as the enforcement.
- [ ] `design/mockups/mobile/README.md` — add a changelog row for tokens v1.1.0
      (**Decision 4**).
- [ ] `design/mockups/mobile/INVENTORY.md` — the `tokens v1.0.0` header line.
- [ ] `docs/best-practices/stack/i18n.md` — no change expected; re-read after implementation and
      only correct it if the shipped setup diverges from what it describes.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Turning on `i18next/no-literal-string` breaks `pnpm lint` on files this item does not otherwise touch | High | Medium | Already enumerated: exactly 4 literals, all in `RoutePlaceholder.tsx` (Verification Log). **Decision 10** converts them in the same commit as the rule |
| `eslint-plugin-i18next` is not flat-config-ready for ESLint 9 | Medium | High | Recorded as unverified claim 1. Step 8 runs `pnpm lint` immediately after wiring the plugin, before any component work depends on it |
| Mockup CSS drifts from `design/tokens.json` (`.mu-h1` is 28/800/-0.7 while `typography.scale.display.md` is 28/700/-0.6; `.mu-h1` line-height 1.18 vs the token's 34) | Certain | Low | `theme.ts` mirrors **`tokens.json`**, which `design-tokens.md` names canonical. The divergence is recorded here and in the smoke runbook as a known, accepted difference; resolving it is a design decision for a follow-up, not a silent edit in this item |
| React Native cannot express the two-layer, negative-spread CSS shadows | Certain | Low | **Decision 2** keeps the outer layer, drops the spread, and pins the result in the parity test so the loss is explicit rather than accidental |
| `__DEV__` gating hides the gallery but still ships its bytes | Certain | Low | Recorded as a known limitation in **Decision 6** and in the PR description. The gallery is a handful of components already in the bundle |
| Gradient rendering differs between iOS and Android for the 135° mapping | Low | Medium | Smoke runbook step compares `Hero` and both `StatTile` tones against `#screen=ds-components` and `#screen=ds-colors` on a simulator |
| Adding tokens desynchronises `tokens.json`, the mockup `:root` and `INVENTORY.md` | Medium | Medium | **Decision 4** makes all four files one atomic step (Implementation Order step 2), and the parity test fails if `theme.ts` misses an added colour |
| Twenty-two primitives in one PR is a large review surface | Certain | Medium | Implementation Order groups them into four themed commits so each is reviewable on its own, and the gallery gives the reviewer a single screen to check them all |
| Scope leakage into #3 (`src/db/`) or #4 (formatting) | Low | High | **Scope Boundaries** table; `Amount`'s `value: string` prop makes formatting impossible inside the primitive; residual verification (below) greps for formatter calls before readiness |

---

## Code Samples

> All samples below are **illustrative — adapt during implementation**. They fix shape and
> naming, not final implementation detail.

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/components/ui/touchTarget.ts  (Decision 7)
import { theme } from '../../theme';

export function hitSlopToMinTarget(visualSize: number) {
  const pad = Math.max(0, (theme.touchTarget.min - visualSize) / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
}
```

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/i18n/locale.ts  (Decision 11)
export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'es';

export function resolveDeviceLocale(
  locales: readonly { languageCode?: string | null }[],
): SupportedLocale {
  const code = locales[0]?.languageCode;
  return SUPPORTED_LOCALES.find((l) => l === code) ?? DEFAULT_LOCALE;
}
```

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/test-utils/color-literal-scan.ts  (parser-risk addendum)
const COLOR_LITERAL =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b|rgba?\s*\(/gi;

export function findColorLiterals(source: string) {
  return source.split('\n').flatMap((text, i) =>
    [...text.matchAll(COLOR_LITERAL)].map((m) => ({ line: i + 1, match: m[0] })),
  );
}
```

```js
// Illustrative — adapt during implementation.
// apps/mobile/eslint.config.mjs  (Decision 9 — block copied verbatim from i18n.md)
import expoConfig from 'eslint-config-expo/flat.js';
import i18nextPlugin from 'eslint-plugin-i18next';

import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  ...expoConfig,
  {
    files: ['app/**/*.tsx', 'src/**/*.tsx'],
    plugins: { i18next: i18nextPlugin },
    rules: {
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-text-only',
        'jsx-attributes': {
          exclude: ['testID', 'accessibilityLabel', 'accessible'],
        },
      }],
    },
  },
];
```

```tsx
// Illustrative — adapt during implementation.
// apps/mobile/app/dev-gallery.tsx  (Decision 6)
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

const SAMPLE_HERO_AMOUNT = '$1.200.000'; // fixture, not a formatter call (Decision 5)

export default function DevGallery() {
  const { t } = useTranslation();
  if (!__DEV__) return <Redirect href="/" />;
  return <ScrollView>{/* sections mirroring #screen=ds-components */}</ScrollView>;
}
```

---

## Implementation Order

1. **Install dependencies.** Run the six commands in **Dependencies to add**, using
   `npx expo install` for `expo-localization` and `expo-linear-gradient`.
   *Verify*: `pnpm install --frozen-lockfile` succeeds from a clean state and
   `apps/mobile/package.json` lists all six with no addition at the repository root.
2. **Add the five colour tokens (Decision 4).** Edit `design/tokens.json` (`overlayScrim`,
   `overlayLight`, `overlayLightSoft`, `switchTrackOff`, `focusRing`; `$version` → `1.1.0`),
   mirror them as `:root` variables in `design/mockups/mobile/index.html`, switch the five
   affected CSS rules to the variables, update the header comment's token version, and update
   the `tokens v1.0.0` line in `design/mockups/mobile/INVENTORY.md`.
   *Verify*: open `design/mockups/mobile/index.html#screen=ds-components` and confirm the
   sheet scrim, hero tints, switch-off track and focused input ring look unchanged.
3. **Write `apps/mobile/src/theme.ts` (Decisions 1, 2, 3, 8)** with every group in the
   Layer-by-Layer table.
4. **Write `src/__tests__/theme-token-parity.test.ts`.**
   *Verify*: `pnpm --filter @finanzas/mobile test` passes; then temporarily change one colour
   in `theme.ts`, confirm the test fails, and revert.
5. **Write the i18n layer (Decision 11).** `src/i18n/locale.ts`, `src/i18n/index.ts`, and both
   catalogues seeded with the `dev.*` keys from **Decision 10**. Add
   `import '../src/i18n';` as the first import of `apps/mobile/app/_layout.tsx`.
6. **Write `src/i18n/locale.test.ts` and `src/i18n/catalogue-parity.test.ts`.**
   *Verify*: `pnpm --filter @finanzas/mobile test` passes.
7. **Convert `RoutePlaceholder.tsx` to catalogue keys (Decision 10).**
8. **Wire the ESLint rule (Decision 9).**
   *Verify*: `pnpm lint` is green. Then add a temporary `<Text>hola</Text>` to any file under
   `apps/mobile/app/`, confirm `pnpm lint` fails with `i18next/no-literal-string`, and revert.
   Capture both outputs for the PR description. **Commit here** — the enforcement mechanism and
   its first clean-up are a coherent, self-contained change.
9. **Build the primitives (Decision 7, Decision 12), in four reviewable groups**, each with its
   colocated tests and each ending in its own commit:
   - *Surfaces and text*: `Card`, `Hero`, `Note`, `EmptyState`, `Amount`, `Badge`.
   - *Actions*: `touchTarget.ts`, `Button`, `Pill`, `Segment`, `CategoryChip`.
   - *Inputs*: `TextField`, `Checkbox`, `Radio`, `Switch`.
   - *Data display and overlays*: `TransactionRow`, `StatTile`, `Progress`, `Steps`, `Dots`,
     `TabBar`, `Sheet`, `Modal`.
   Add each primitive to `src/components/ui/index.ts` as it lands.
   *Verify* after each group: `pnpm lint`, `pnpm typecheck` and
   `pnpm --filter @finanzas/mobile test` are green.
10. **Write `src/test-utils/color-literal-scan.ts` plus its 15-case unit test, then
    `src/__tests__/color-literal-guard.test.ts`.**
    *Verify*: the guard passes on the real tree; then temporarily paste a hex literal into a
    primitive, confirm the guard fails and names the file and line, and revert.
11. **Write `src/__tests__/touch-target.test.tsx`** covering every interactive primitive
    (brief AC4).
12. **Add the gallery route (Decision 6).** Create `apps/mobile/app/dev-gallery.tsx`, add
    `DEV_ONLY_ROUTES` to `src/test-utils/route-inventory.ts`, update
    `src/__tests__/route-manifest-parity.test.ts` to subtract the allowlist and pin its
    contents, and extend `src/test-utils/route-inventory.test.ts`. Seed the `ds.*` catalogue
    keys in both catalogues.
    *Verify*: `pnpm --filter @finanzas/mobile test` passes, including the untouched
    `design-system`, `(auth)` and `(tabs)` assertions.
13. **Run the smoke runbook** at
    `docs/testing/mobile/2-theme-design-system-primitives.smoke-test.md` on a simulator, in
    Spanish, comparing against `#screen=ds-components`, `#screen=ds-colors` and
    `#screen=ds-typography`. Record which states were compared, the simulator and viewport, and
    any accepted difference.
14. **Update `CHANGELOG.md`** under `## [Unreleased]` → `### Added`, appending exactly:

    ```markdown
    - **Theme and design-system primitives** (#2): a typed `apps/mobile/src/theme.ts` mirror of
      `design/tokens.json`, the twenty-two `mu-*` UI primitives, `i18next` catalogues with a
      machine-enforced no-literal-string lint rule, and a dev-only design-system gallery route
    ```

15. **Update the project docs** listed under **Documentation Updates**.
16. **Final verification**: `pnpm lint`, `pnpm typecheck`, `pnpm test` and
    `pnpm format:check` all green from a clean `pnpm install --frozen-lockfile`.

### Residual verification strategy

This item makes two pattern-completeness claims. Both need evidence in the implementation PR
before `ready-for-human-review`, not an assertion:

| Claim | Evidence source | Produced by |
| --- | --- | --- |
| "Every `mu-*` primitive in the mockups has a component" (brief AC2) | The barrel assertion in scenario 3 (exactly the 22 named exports) plus a written reconciliation of the 89-selector inventory from the Verification Log against **Decision 12**, naming each excluded selector family and why | Jest output + PR description |
| "No hex, spacing or radius literal outside `theme.ts`" (brief AC1) | `color-literal-guard.test.ts` output, plus the three-entry allowlist assertion | Jest output |
| "No user-facing literal string in JSX" | `pnpm lint` green **with the rule active**, plus the deliberate-failure transcript from step 8. Scope stated per **Decision 9**: JSX text nodes only | `pnpm lint` transcript |
| "Touch targets are at least 44" (brief AC4) | `touch-target.test.tsx` output listing every interactive primitive | Jest output |
| "No formatting logic leaked in from #4" | `grep -rn "Intl\.\|toLocaleString\|@finanzas/shared-utils" apps/mobile/src/components/ui apps/mobile/app/dev-gallery.tsx` returning nothing | PR description |

---

## Acceptance Criteria Coverage

| Brief acceptance criterion | Where it is implemented | How it is verified |
| --- | --- | --- |
| No hex, spacing or radius literal outside `theme.ts` | `src/theme.ts` (**Decisions 1, 2, 3, 8**); every primitive reads from it | `theme-token-parity.test.ts` + `color-literal-guard.test.ts` (Testing scenarios 1–2) |
| Every `mu-*` primitive in the mockups has a component | `src/components/ui/` — the 22 rows of the **Primitive Catalogue**; exclusions justified in **Decision 12** | Barrel export assertion (scenario 3) + the reconciliation in **Residual verification strategy** |
| The gallery route visually matches `#screen=ds-components` | `app/dev-gallery.tsx` (**Decision 6**), sectioned in the mockup's order | Smoke runbook, Spanish, on a simulator, against all three `ds-*` screens |
| Touch targets are at least `theme.touchTarget.min` (44) | `hitSlopToMinTarget()` applied by every interactive primitive (**Decision 7**) | `touch-target.test.tsx` (scenario 4) |
| Brief scope: `src/theme.ts` typed mirror | **Layer-by-Layer → Frontend / UI** table | scenario 1 |
| Brief scope: `src/components/ui/` primitives | **Primitive Catalogue** | scenarios 3, 5 |
| Brief scope: dev-only gallery route mirroring `#screen=ds-components` | **Decision 6** | scenario 8 + smoke runbook |
| Repository non-negotiable 8: no user-facing literal in JSX | `src/i18n/` + the ESLint rule (**Decisions 9, 10, 11**) | scenario 9 (`pnpm lint` with a deliberate-failure transcript) |
