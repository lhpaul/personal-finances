# i18n infrastructure: catalogues, resolver and the no-literal-string lint rule — Implementation Plan

**Work item**: [issue #34](https://github.com/lhpaul/personal-finances/issues/34) — classified
**Refactor**, so there is no spec document. The issue body is the specification; every
requirement traced below cites an acceptance criterion (AC1-AC5) or a scope bullet from it.
**Smoke test runbook**: [`docs/testing/mobile/34-i18n-infrastructure.smoke-test.md`](../../../testing/mobile/34-i18n-infrastructure.smoke-test.md)
**Convention source of truth**: [`docs/best-practices/stack/i18n.md`](../../../best-practices/stack/i18n.md)

---

## Summary

**Approach**: Create `apps/mobile/src/i18n/` — an `i18next` + `react-i18next` runtime
initialised once from the root layout, two flat-key JSON catalogues (`es` primary, `en`
fallback), and a device-locale resolver over `expo-localization`. Wire
`eslint-plugin-i18next/no-literal-string` into `apps/mobile/eslint.config.mjs` using the exact
block from `i18n.md`, then make the existing tree pass it: the design-system gallery's 121 live
strings move out of `apps/mobile/src/dev/gallery.strings.ts` into the catalogues (that file is
deleted), `RoutePlaceholder`'s four scaffold strings become catalogue keys, and two decorative
glyphs become named constants. The control is then proved to fire by adding a deliberate JSX
literal, watching `pnpm lint` fail, and removing it.

**Estimated complexity**: M

**Rationale**: No new architecture and no product behaviour, but the change is wide: three new
runtime dependencies, one new devDependency, a new ESLint block, 125 catalogue entries written
twice (es + en), 123 call-site edits in the gallery, and five new test files. The mechanical
volume — not the difficulty — is what puts this above S. There is one genuine design decision
(`keySeparator: false`, below) that silently breaks every lookup if missed.

**Dependencies**: #2 (theme and design-system primitives) — **merged** at `85fb341`. Nothing
else. This item does **not** depend on #3 (database) and must not touch `apps/mobile/src/db/`.

**Blocks**: every screen item (#9 first, then #8, #11-#21). Those items add their own screen
copy; this item adds none.

---

## Verification Log

All commands were run in the worktree at
`/Users/lhpaul/Git/personal-finances/.claude/worktrees/item-34` unless noted.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `85fb341` (`feat(mobile): theme and design-system primitives (#33)`) |
| `src/i18n/` exists? | `ls apps/mobile/src` | Not present — `components/`, `dev/`, `test-utils/`, `theme.ts` only. Directory is new in this item |
| i18n deps installed? | `cat apps/mobile/package.json` | No `i18next`, `react-i18next`, `expo-localization`, or `eslint-plugin-i18next`. All four are added by this item |
| Mobile ESLint config today | `cat apps/mobile/eslint.config.mjs` | `export default [...rootConfig, ...expoConfig];` — no per-app rule block yet |
| Gallery keys defined | Node script counting `^  'ds\.…':` in `gallery.strings.ts` | **124** keys, no duplicates |
| Gallery keys used | Node script counting unique `t['ds.…']` in `DesignSystemGallery.tsx` | **121** unique keys across **123** call sites |
| Defined but unused | Same script, set difference | Exactly **3**: `ds.field.emailFocusedValue`, `ds.steps.label`, `ds.dots.label` |
| Used but undefined | Same script, reverse difference | None |
| Existing `no-literal-string` suppressions | `grep -rn "no-literal-string" apps packages` | **0** occurrences (AC5 starts satisfied and must stay so) |
| **Rule behaviour on the current tree** | Isolated probe project (`eslint@9` + `@typescript-eslint/parser@8` + `eslint-plugin-i18next@6.1.5`) with the exact `i18n.md` block, run over copies of `apps/mobile/app` and `apps/mobile/src` | **6 violations in 3 files** — see the table in "Current-tree violations" below |
| Attribute blind spot | Same probe, fixture with `label="Literal en atributo JSX"` and `options={{ title: 'Inicio' }}` | **0 errors** — `jsx-text-only` does not inspect JSX attribute literals (see Decision 6) |
| Deliberate JSX-text literal | Same probe, fixture `<Text>Texto de prueba deliberado</Text>` | **1 error**, `i18next/no-literal-string` — AC1's proof mechanism is confirmed to work |
| Glyph-as-constant fix | Same probe, fixture `const CHECK_GLYPH = '✓'; … <Text>{CHECK_GLYPH}</Text>` | **0 errors** — confirms Decision 10 without any suppression |
| Plugin default `words.exclude` | `lib/options/defaults.js` in `eslint-plugin-i18next@6.1.5` | `['[0-9!-/:-@[-\`{-~]+', '[A-Z_-]+', htmlEntities, /^\p{Emoji}+$/u]` — pure-emoji JSX text is already exempt; `✓` (U+2713) and `★` (U+2605) are **not** emoji and are flagged |
| `resolveJsonModule` | `cat tsconfig.base.json` | Already `true` — importing `es.json` / `en.json` from TypeScript needs no tsconfig change |
| `noUncheckedIndexedAccess` | `cat tsconfig.base.json` | `true` — catalogue index reads in tests are `string \| undefined` and must be narrowed |
| Test-file precedent | `ls apps/mobile/src/__tests__ apps/mobile/src/test-utils` | Static source-scan suites (`no-style-literals`, `no-naked-text`, `route-manifest-parity`) with scanners in `src/test-utils/*-scan.ts`, each with its own `*.test.ts`. No renderer, no `@testing-library/react-native` installed |
| Latest `expo-localization` for SDK 54 | `npm view expo-localization versions` | `17.0.x` line is current for Expo SDK 54; pin via `expo install`, not by hand (Decision 4) |
| `react-i18next` peer range | `npm view react-i18next peerDependencies` | `i18next >= 26.2.0`, `react >= 16.8.0` — satisfied by `i18next@^26` and the repo's `react@19.1.0` |

### Current-tree violations (the AC1 "passes on the current tree" work)

Ground truth from the probe run, not inference:

| File | Line | Flagged text | Disposition |
| --- | --- | --- | --- |
| `apps/mobile/src/components/RoutePlaceholder.tsx` | 29 | `PLACEHOLDER — not implemented` | → catalogue key (Decision 9) |
| `apps/mobile/src/components/RoutePlaceholder.tsx` | 30 | `Mockup screen: ` | → catalogue key with interpolation (Decision 9) |
| `apps/mobile/src/components/RoutePlaceholder.tsx` | 31 | `Route: ` | → catalogue key with interpolation (Decision 9) |
| `apps/mobile/src/components/RoutePlaceholder.tsx` | 34 | `Next: ` | → catalogue key with interpolation (Decision 9) |
| `apps/mobile/src/components/ui/CategoryChip.tsx` | 94 | `★` | → module-level constant (Decision 10) |
| `apps/mobile/src/components/ui/Checkbox.tsx` | 35 | `✓` | → module-level constant (Decision 10) |

`DesignSystemGallery.tsx` produced **zero** violations today, because every string already sits
inside a `{…}` expression container. The rule alone therefore cannot prove AC4 — see Decision 6.

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Artifact base branch for this plan | `develop` | Worktree branch `implementation-plan/34-i18n-infrastructure` created from `origin/develop` at `85fb341`; `AGENTS.md` → Git & Branching | 2026-08-02, repo SHA `85fb341` | Current invocation batch only: #3, #6, #34, #35 | `Verified` |
| Ownership of `apps/mobile/eslint.config.mjs` | Shared surface; this item **appends** a new flat-config block and edits no existing entry | Parent orchestrator handoff; `cat apps/mobile/eslint.config.mjs` at `85fb341` shows a single 6-line file with no rule blocks | 2026-08-02, repo SHA `85fb341` | Same-surface open PRs only: #39 (`feature/35-pnpm-hoisted-layout-ci-bundle-check`, item #35) may add a `no-restricted-imports` test block to the same file | `Verified` — **Non-blocking** |
| Ownership of `apps/mobile/src/i18n/` | This item, exclusively | Issue #34 scope section | 2026-08-02, repo SHA `85fb341` | Batch items #3, #6, #35 — none names `src/i18n/` | `Verified` |
| `toSupportedLocale` in `apps/mobile/src/db/` | Does **not** exist on `develop` at `85fb341`; owned by #3, still in plan stage (PR #32) | Issue #34 "Note on a known duplication"; `ls apps/mobile/src` | 2026-08-02, repo SHA `85fb341` | Open PR #32 (`implementation-plan/3-local-database-schema-migrations-seed-data`) | `Verified` — consolidation deferred to a follow-up, per the issue's own instruction |

**Non-blocking rationale for the shared ESLint file**: item #35 (PR #39) may add a block
asserting `no-restricted-imports` rejects a violation. That is a *different* rule in a
*different* flat-config entry. Both changes are additive appends to
`apps/mobile/eslint.config.mjs`, so the worst case is a textual merge conflict at the end of the
file, resolvable by keeping both blocks. There is no competing definition of the same
operational fact, so this is **not** a `Conflict` under the gate: no plan statement here depends
on #35's content, and no statement in #35 depends on this one. Implementation must still open
the file and append rather than rewrite it.

**Explicitly not owned by this item**: `apps/mobile/src/db/` (#3), `packages/bank-scraper/`
(#6), `.npmrc`, `.github/workflows/`, and `docs/project/2-repo-architecture.md` (#35). This
plan prescribes no edit to any of them.

---

## Layer-by-Layer Changes

### Database / Data Layer

Not applicable. This item writes no SQL, adds no migration, and does not touch
`apps/mobile/src/db/`. `transaction_categories.labels` (the data-driven copy path described in
`i18n.md`) is #3's surface and is untouched here.

### Shared Packages / Libraries

Not applicable. `@finanzas/shared-domain`, `@finanzas/shared-utils` and
`@finanzas/bank-scraper` are unchanged. Note for reviewers: `i18n.md` assigns currency/date
formatting to `@finanzas/shared-utils` (already shipped by #4) and explicitly keeps it *out* of
the catalogues, so no formatter work belongs to this item.

### Frontend / UI — new files

- [ ] `apps/mobile/src/i18n/locale.ts` — `SupportedLocale` type, `SUPPORTED_LOCALES`,
      `DEFAULT_LOCALE`, `toSupportedLocale()`, `resolveDeviceLocale()`. No i18next import, so it
      is unit-testable without booting the runtime (Decision 2).
- [ ] `apps/mobile/src/i18n/es.json` — primary catalogue, flat keys (Decision 1, Decision 8).
- [ ] `apps/mobile/src/i18n/en.json` — fallback catalogue, same key set, real translations
      (AC3).
- [ ] `apps/mobile/src/i18n/index.ts` — initialises i18next with `initReactI18next`, exports the
      configured `i18n` instance and `setLocale()` (issue scope bullet 1).
- [ ] `apps/mobile/src/i18n/i18next.d.ts` — `CustomTypeOptions` augmentation so `t()` keys are
      compile-time checked (Decision 5).

### Frontend / UI — modified files

- [ ] `apps/mobile/app/_layout.tsx` — add the side-effect import that boots i18next before any
      screen renders (Decision 3). No other change; the `<Stack />` tree is untouched.
- [ ] `apps/mobile/src/dev/DesignSystemGallery.tsx` — replace
      `import { galleryStrings as t } from './gallery.strings'` with
      `const { t } = useTranslation()`, and rewrite all **123** call sites from `t['ds.x']` to
      `t('ds.x')` with snake_case leaf segments (Decision 7, Decision 8). Update the module
      docstring: demo copy now lives in the catalogues, not in a sibling module.
- [ ] `apps/mobile/src/dev/gallery.strings.ts` — **deleted** (Decision 7).
- [ ] `apps/mobile/src/components/RoutePlaceholder.tsx` — four JSX text literals become
      `t('dev.placeholder.…')` calls, three of them with i18next interpolation (Decision 9).
- [ ] `apps/mobile/src/components/ui/CategoryChip.tsx` — extract `★` to a module-level
      `STAR_GLYPH` constant and render `{STAR_GLYPH}` (Decision 10). No prop or style change.
- [ ] `apps/mobile/src/components/ui/Checkbox.tsx` — extract `✓` to a module-level `CHECK_GLYPH`
      constant and render `{CHECK_GLYPH}` (Decision 10). No prop or style change.

### Infrastructure / Configuration

- [ ] `apps/mobile/package.json` — add dependencies `i18next`, `react-i18next`,
      `expo-localization`; add devDependency `eslint-plugin-i18next`. Native module version is
      resolved by `expo install`, not hand-pinned (Decision 4).
- [ ] `apps/mobile/eslint.config.mjs` — **append** one flat-config block containing the
      `i18next/no-literal-string` rule, copied verbatim from `i18n.md` (Decision 6). Do not
      modify the existing `[...rootConfig, ...expoConfig]` spread, and do not touch the root
      `eslint.config.mjs` or its `sharedDomainPurity` / `sharedUtilsPurity` exports.
- [ ] `pnpm-lock.yaml` — regenerated by `pnpm install`. Commit it.

No shell-guidance surface is added by this plan, so no `bash` / `bash-zsh` shell contract or
snippet-linter evidence is required.

---

## Decisions

### Decision 1 — Flat catalogue keys require `keySeparator: false`

`i18n.md` mandates flat keys (`"home.pending_title": "…"`, not nested objects). i18next's
**default** `keySeparator` is `'.'`, which would make `t('home.pending_title')` walk into a
nested `home` object that does not exist, and silently return the key string. Every lookup in
this app would break in a way that looks like a missing translation rather than a config bug.

**Decision**: initialise with `keySeparator: false`. `nsSeparator` keeps its default `':'`
because no key in this repo contains a colon, and a single default `translation` namespace is
used throughout. Also set `interpolation: { escapeValue: false }` (React already escapes) and
`react: { useSuspense: false }` (resources are bundled synchronously at init, so there is
nothing to suspend on, and suspense would only add a failure mode).

`compatibilityJSON` is deliberately **not** set: this item introduces no plural key, so the
Hermes `Intl.PluralRules` question that `i18n.md` flags does not arise yet. Recorded as a risk
for the first screen item that needs plurals.

### Decision 2 — `locale.ts` is separate from `index.ts`

`index.ts` has an initialisation side effect (it calls `i18n.use(initReactI18next).init(...)`
at module scope). Pure locale-mapping logic must be testable without that side effect and
without mocking i18next, so `toSupportedLocale()` and `resolveDeviceLocale()` live in
`locale.ts`, which imports only `expo-localization`. `index.ts` imports `locale.ts`, never the
reverse.

### Decision 3 — i18next boots from `app/_layout.tsx`

Add `import '../src/i18n';` as the first import of `apps/mobile/app/_layout.tsx`. Every route
in the app — including `(dev)/gallery` — is nested under this root layout, so a single
side-effect import guarantees the runtime is configured before any `useTranslation()` call.

Alternatives rejected: initialising lazily inside each component (ordering hazard, repeated
work) and initialising inside `DesignSystemGallery.tsx` (would leave product screens
uninitialised the moment #9 lands).

The existing test `apps/mobile/app/(dev)/__tests__/gallery.test.tsx` is unaffected: it calls
`DevGalleryRoute()` directly, which returns an unevaluated `<DesignSystemGallery />` element
without invoking the component, so no hook runs and no i18next instance is needed. Do not
change that test's approach.

### Decision 4 — Locale resolution and the `setLocale()` API

```ts
// Illustrative — adapt during implementation.
export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'es';

/** Maps any BCP-47 language code (or nothing) onto a supported locale. Anything
 *  unresolved falls back to `es` — i18n.md, "Locales and fallbacks". */
export function toSupportedLocale(languageCode: string | null | undefined): SupportedLocale;

/** Reads the device locale via expo-localization's getLocales()[0]?.languageCode. */
export function resolveDeviceLocale(): SupportedLocale;
```

`setLocale(locale: SupportedLocale): Promise<void>` lives in `index.ts` and wraps
`i18n.changeLanguage(locale)`. It returns the promise so callers can await a switch; it does
**not** persist the choice — there is no settings surface for language in the MVP, and
persistence would need `app_settings`, which is #3's table.

`toSupportedLocale` must be case-insensitive and must tolerate a region tag, because
`getLocales()[0].languageCode` is documented to return the language subtag but platform
behaviour varies: normalise with `toLowerCase()` and take the segment before the first `-` or
`_`. Empty string, `null`, `undefined`, and any unknown language all return `DEFAULT_LOCALE`.

**Name choice**: `toSupportedLocale` deliberately matches the name issue #34 uses for #3's
future helper, so the follow-up consolidation is a straight move rather than a rename. This item
does not import from, or create, anything under `apps/mobile/src/db/`.

### Decision 5 — Compile-time key checking via `CustomTypeOptions`

```ts
// Illustrative — adapt during implementation. apps/mobile/src/i18n/i18next.d.ts
import 'i18next';
import type es from './es.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    keySeparator: false;
    resources: { translation: typeof es };
  }
}
```

`resolveJsonModule` is already enabled, so `typeof es` gives the exact literal key union. This is
cheap here specifically **because** keys are flat: there is no recursive path expansion for
TypeScript to explode over. It replaces the compile-time safety the deleted
`GalleryStringKey` type used to provide, which is a precondition for Decision 7 not being a
regression. `keySeparator: false` must appear in **both** the runtime init and this
augmentation, or the inferred key type will not be flat.

### Decision 6 — ESLint block copied verbatim; its real coverage documented

Append to `apps/mobile/eslint.config.mjs`, exactly as written in `i18n.md`:

```js
// Illustrative — the rule block itself is copied verbatim from docs/best-practices/stack/i18n.md
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
}
```

The following properties of this configuration were confirmed empirically (Verification Log)
and must be understood by anyone reading the AC list:

1. **`jsx-text-only` checks JSX *text children* only.** In
   `eslint-plugin-i18next@6.1.5`, the `JSXText` visitor always validates, while plain `Literal`
   nodes are skipped unless their direct parent is a `JSXElement` or `JSXFragment`. A string in
   a JSX attribute (`label="Primario"`) or inside an object passed through an attribute
   (`options={{ title: 'Inicio' }}`) is therefore **not** reported. The
   `jsx-attributes.exclude` list is consequently inert under this mode. It is kept verbatim
   anyway so the config and `i18n.md` do not drift, and so it becomes load-bearing immediately
   if the mode is ever tightened.
2. **Consequence for AC1's proof**: the deliberate literal must be JSX *text*
   (`<Text>Texto de prueba deliberado</Text>`). An attribute literal would pass and would prove
   nothing.
3. **Consequence for AC4**: the lint rule cannot, by itself, establish that "the gallery route
   renders entirely from catalogue keys" — the gallery passes today, before any catalogue
   exists, because all of its copy sits in attributes. The automated control for AC4 is the
   catalogue-key test in the Testing Strategy, not the lint rule.

The block's globs resolve relative to `apps/mobile/`, which is where `pnpm lint` runs `eslint .`
from — consistent with the note already in the root `eslint.config.mjs` about flat-config glob
resolution. `app/(dev)/gallery.tsx` matches `app/**/*.tsx` despite the parenthesised route
group; this was confirmed in the probe run, which reported on that file.

### Decision 7 — `gallery.strings.ts` is deleted; 121 keys move, 3 are dropped

**Disposition: delete the file.** Its own docstring states it "is meant to move mechanically
into an `es.json` catalogue once that infrastructure lands", and AC4 requires the gallery to
render entirely from catalogue keys. Keeping it as a "non-runtime reference" was considered and
rejected: two copies of the same Spanish strings with no mechanism keeping them in sync is
precisely the drift `i18n.md` forbids, and a dead module invites a future contributor to import
it.

Of the 124 defined keys, **121 are used** by `DesignSystemGallery.tsx` and move into both
catalogues. The **3 unused keys are dropped**, not migrated:

- `ds.field.emailFocusedValue` — the "focused" `TextField` variant is not rendered by the
  gallery.
- `ds.steps.label` — `<Steps total={4} current={2} />` takes no accessibility label prop.
- `ds.dots.label` — same for `<Dots />`.

Dropping them keeps the `ds.*` namespace exactly equal to the gallery's live surface, which the
catalogue-key test then enforces in both directions. If a reviewer wants the `Steps` / `Dots`
accessibility labels wired up, that is a design-system change belonging to a separate item, not
a catalogue change — report it rather than smuggling it in here.

**Migration is value-preserving**: every Spanish string keeps its exact current characters. This
item changes where copy lives, never what it says.

### Decision 8 — Flat keys use snake_case leaf segments

`i18n.md` gives three key examples, all snake_case at the leaf: `home.pending_title`,
`categorize.not_sure_label`, `settings_banks.disconnect_confirm`. The existing `ds.*` keys are
camelCase (`ds.field.emailLabel`) because they predate any catalogue.

**Decision**: normalise to snake_case during the migration —
`ds.field.emailLabel` → `ds.field.email_label`, `ds.categoryChip.suggestedEmoji` →
`ds.category_chip.suggested_emoji`, and so on. Every one of the 123 call sites is being rewritten
from `t['…']` to `t('…')` regardless, so the normalisation costs nothing extra now and is
expensive later. This item seeds the catalogue that thirteen screen items will copy the style
of; the convention must be right on the first commit.

Enforced by a key-format assertion in the parity test: every key matches
`^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$`.

Alternative rejected: keeping camelCase and relaxing the documented convention. It would leave
the repository with two key styles and no rule, and the very next item would have to pick one.

Because `i18n.md` implies the case convention through examples rather than stating it, the
Documentation Updates section below asks the developer to make it explicit there.

### Decision 9 — `RoutePlaceholder`'s scaffold copy goes into the catalogue

The four flagged strings are real user-visible text, so AC5's "no `eslint-disable`" and
`AGENTS.md` non-negotiable 8 both apply. They are **not** "screen copy" in the sense the issue
puts out of scope: they are placeholder scaffolding from item #1, not copy sourced from a
mockup screen. Migrating them is required to make AC1's "passes on the current tree" true.

Keys, under a `dev.placeholder.*` namespace so they are obviously disposable:

| Key | `es` value | Notes |
| --- | --- | --- |
| `dev.placeholder.title` | `PLACEHOLDER — not implemented` | Kept verbatim, including the em dash |
| `dev.placeholder.screen` | `Mockup screen: {{screenId}}` | i18next interpolation replaces `<Text>Mockup screen: {screenId}</Text>` |
| `dev.placeholder.route` | `Route: {{route}}` | |
| `dev.placeholder.next` | `Next: {{label}}` | Rendered once per `next` link |

`RoutePlaceholder` gains `const { t } = useTranslation();`. Confirm before editing that no test
calls `RoutePlaceholder(...)` directly as a plain function — the repo's "no renderer" convention
means a newly added hook would break such a call. At `85fb341` the only tests that call
components directly are `component-style-regressions.test.ts` and `no-naked-text.test.ts`, and
neither references `RoutePlaceholder`; re-check with
`grep -rn "RoutePlaceholder" apps/mobile/src apps/mobile/app` before committing.

These four keys are deleted along with `RoutePlaceholder.tsx` when the last screen item lands.
Note that in the `en` catalogue these particular values are already English; that is the correct
translation, not a stub.

### Decision 10 — Decorative glyphs become named constants, not catalogue entries

`★` in `CategoryChip` and `✓` in `Checkbox` are icon glyphs rendered inside `<Text>` only
because React Native requires text nodes to be wrapped. They are not language-dependent and
they are not copy.

Putting them in the catalogue is wrong twice over: it would translate something untranslatable,
and it would force a design-system primitive to import the i18n runtime, breaking item #2's rule
that primitives take copy as props and contain none of their own.

Adding them to `theme.ts` was considered and **rejected on evidence**:
`apps/mobile/src/__tests__/theme-tokens-parity.test.ts` asserts
`Object.keys(theme).sort()` equals an exact ten-group allowlist mirrored from
`design/tokens.json`, so a new `glyphs` group would fail that suite and would require editing
`design/tokens.json` — a design-contract change this item has no mandate for.

**Decision**: a module-level constant in each primitive, with a comment explaining why:

```ts
// Illustrative — adapt during implementation.
/** Decorative glyph, not user-facing copy: it is language-independent and must not enter the
 *  i18n catalogues. Named so `i18next/no-literal-string` sees an expression, not JSX text. */
const CHECK_GLYPH = '✓';
```

Verified in the probe: `<Text>{CHECK_GLYPH}</Text>` produces zero errors. No `eslint-disable` is
written anywhere, so AC5 holds.

### Decision 11 — Tests follow the repo's no-renderer, static-scan precedent

`@testing-library/react-native` and `react-test-renderer` are not installed, and item #2
deliberately chose to test by calling components directly and by scanning source. Adding a
renderer to satisfy AC4 would be a larger and less reviewable change than a small scanner that
matches five existing suites. AC4's control is therefore a source scan asserting that every
`t('…')` key in the gallery exists in both catalogues and that every `ds.*` catalogue key is
used by the gallery.

### Decision 12 — Explicitly out of scope

- **Screen copy.** No key for any product screen. Issue #34, "Out of scope".
- **`toSupportedLocale` consolidation with #3.** Issue #34 instructs: consolidate only if #3 has
  merged; it has not (PR #32 is still a plan PR). Raise a follow-up instead. Do not open, read
  into, or create `apps/mobile/src/db/`.
- **The two tab titles in `apps/mobile/app/(tabs)/_layout.tsx`**
  (`options={{ title: 'Inicio' }}` / `'Transacciones'`). These are user-facing literals that
  `jsx-text-only` does not catch (confirmed in the probe). They are mockup screen copy, and that
  file's own comment assigns final labels to the tab-shell item. Left in place and reported as a
  finding, not migrated and not suppressed.
- **Tightening the rule mode.** `i18n.md` prescribes `jsx-text-only`; this item implements what
  the convention says.

---

## Testing Strategy

**Test types**: Unit (Jest, via `pnpm --filter @finanzas/mobile test`), plus a manual smoke
runbook. No device E2E: nothing in the Maestro happy paths changes.

**Key scenarios to test**:

1. `toSupportedLocale('es')` → `es`; `toSupportedLocale('en')` → `en` — **AC2**.
2. `toSupportedLocale` of a region-tagged, mixed-case, unknown, empty, `null` and `undefined`
   input all resolve per Decision 4, with unknown/absent → `es` — **AC2**.
3. `resolveDeviceLocale()` returns the mapped locale when `getLocales()` reports one, and `es`
   when the array is empty or `languageCode` is absent — **AC2**.
4. i18next resolves a known flat key in `es`, and the same key in `en` after `setLocale('en')`,
   proving `keySeparator: false` is in effect (a nested-lookup regression returns the key
   itself) — **AC2**, Decision 1.
5. `es.json` and `en.json` have identical key sets, every value is a non-empty string, no value
   is a nested object or array, and every key matches the snake_case flat-key pattern — **AC3**,
   Decision 8.
6. Every `t('…')` key in `DesignSystemGallery.tsx` exists in both catalogues; every `ds.*`
   catalogue key is used by the gallery; the gallery imports no `gallery.strings` module and
   uses no dynamic (non-literal) key — **AC4**.
7. The existing `gallery.test.tsx` still passes unchanged — the route returns `null` under
   `__DEV__ === false` and an element otherwise.
8. AC1 and AC5 are proved by the lint run and the repo-wide suppression scan in Implementation
   Order steps 10 and 11; they are lint-level facts, not Jest assertions.

**New test files**:

| File | Covers |
| --- | --- |
| `apps/mobile/src/i18n/__tests__/locale.test.ts` | Scenarios 1-3 (`expo-localization` mocked with `jest.mock`) |
| `apps/mobile/src/i18n/__tests__/i18n-init.test.ts` | Scenario 4 |
| `apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` | Scenario 5 |
| `apps/mobile/src/test-utils/catalogue-key-scan.ts` | The extractor used by scenario 6 (source, not a test) |
| `apps/mobile/src/test-utils/catalogue-key-scan.test.ts` | The extractor's own edge cases (below) |
| `apps/mobile/src/__tests__/gallery-catalogue-keys.test.ts` | Scenario 6 |

**Smoke test runbook**:
[`docs/testing/mobile/34-i18n-infrastructure.smoke-test.md`](../../../testing/mobile/34-i18n-infrastructure.smoke-test.md)

**Regression suite**: the Jest suites above are the regression suite. `.maestro/` flows are not
extended: no user journey changes.

### Parser-risk addendum

**Classification: parser-risk applies.** `catalogue-key-scan.ts` is a new regex-based source
scanner and its name carries a scanner signal. It mirrors the existing
`apps/mobile/src/test-utils/style-literal-scan.ts` (which has the same shape and its own
`style-literal-scan.test.ts`), so the same rigour applies here.

**Contract**: `findTranslationKeys(source: string): { keys: string[]; dynamic: Finding[] }` —
returns every string-literal argument of a `t(...)` call, plus a finding for every `t(...)` call
whose first argument is not a string literal.

**Edge-case enumeration** (each maps to one automated test in
`catalogue-key-scan.test.ts`):

| # | Input | Expected |
| --- | --- | --- |
| E1 | `t('ds.section.buttons')` | one key, `ds.section.buttons` |
| E2 | `t("ds.section.buttons")` | double quotes accepted; same key |
| E3 | `label={t('ds.a')} icon={t('ds.b')}` on one line | **two** keys — the scan is global, not first-match |
| E4 | `t('dev.placeholder.screen', { screenId })` | key extracted, trailing options argument ignored |
| E5 | `t(someVariable)` | zero keys, one `dynamic` finding |
| E6 | ``t(`ds.${x}`)`` | zero keys, one `dynamic` finding (template literal) |
| E7 | `t('')` | one `dynamic` finding (empty key), not an empty-string key |
| E8 | `expect('x')`, `require('x')`, `print('x')`, `useT('x')`, `format('x')` | zero keys — the callee must be exactly `t`, preceded by a non-identifier boundary |
| E9 | `obj.t('ds.a')` | one key — a member-expression `t` is still `t` |
| E10 | `// t('ds.removed')` in a comment | **Known limitation**: matched. Documented in the module docstring; the only consequence is requiring a catalogue key that exists, and the gallery must contain no commented-out `t(` call |
| E11 | Nested call `t(cond ? 'ds.a' : 'ds.b')` | zero keys, one `dynamic` finding — a conditional key is not a literal |
| E12 | Multi-line call with the literal on its own line | key extracted (the regex must not be anchored to a single line) |

The scanner intentionally does **not** parse TypeScript. Like `style-literal-scan.ts`, it
catches the common case and records its limitation; the gallery is the only file it scans, and
that file is fully reviewed in this same PR.

**Suppression semantics**: not applicable. `catalogue-key-scan.ts` recognises no inline
suppression directive, by design — a suppression mechanism here would create exactly the escape
hatch AC5 forbids. `eslint-plugin-i18next`'s own suppression path (`eslint-disable`) is
prohibited by AC5 and asserted absent in Implementation Order step 11.

### Concurrent-event-source addendum

**Not applicable.** This plan adds no event listener, socket callback, timer, or async queue.
`setLocale()` returns `i18n.changeLanguage()`'s promise and is not called by any code this item
ships (no language-switch UI exists in the MVP). i18next is initialised exactly once, at module
load, from a single import in the root layout — there is no initialisation/teardown race and no
shared mutable state crossing execution contexts.

### Cross-cutting checklist classification

**Not applicable.** This plan does not add or rename a checklist category in `REVIEW.md`, in any
workflow protocol, or in any agent/skill file. `eslint-plugin-i18next` is a lint rule in the
product application, not a workflow review gate, so no protocol/agent/skill enumeration is
required.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Catalogue (`es`) | 121 `ds.*` keys migrated verbatim from `gallery.strings.ts`, plus 4 `dev.placeholder.*` keys — 125 keys total | `apps/mobile/src/i18n/es.json` |
| Catalogue (`en`) | The same 125 keys, each with a real English translation. Emoji-only values, CLP amount samples (`$1.200.000`, `+$2.500.000`, `3.7M`), and `.mu-*` / `--in` / `--out` class tokens keep their `es` value because they are not natural-language copy; every other value is genuinely translated (AC3, `i18n.md`: "Fallbacks are a safety net, not permission to leave a translation missing") | `apps/mobile/src/i18n/en.json` |

No database seed data. No test fixture files: `catalogue-key-scan.test.ts` uses inline source
strings, matching `style-literal-scan.test.ts`.

---

## Documentation Updates

To be performed by the developer during implementation, not now.

- [ ] `docs/best-practices/stack/i18n.md` — state the key-case convention explicitly (leaf
      segments are snake_case, per Decision 8, which the file currently only implies through its
      examples). Add a short note that flat keys require `keySeparator: false` and that
      `jsx-text-only` checks JSX text children only, so attribute copy is not lint-enforced.
- [ ] `docs/project/3-software-architecture.md` — the i18n row and the "Copy lives in i18n
      catalogues" bullet already describe the target state; update only the
      `src/dev/ … (DesignSystemGallery, gallery.strings)` line in the directory tree, which names
      a file this item deletes.
- [ ] `CHANGELOG.md` — see Implementation Order step 14.
- [ ] `AGENTS.md` — no change. Non-negotiable 8 already states the rule this item implements, and
      the repository-structure block already lists `i18n/`.
- [ ] `docs/project/2-repo-architecture.md` — no change; it already lists `i18n/`. This file is
      also #35's surface and must not be edited here.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `keySeparator` left at its default, so every flat key silently returns the key string | Med | High | Decision 1; scenario 4 asserts a real resolved value, which fails loudly if the separator regresses |
| A key is renamed to snake_case in the catalogue but missed at a call site (123 sites) | Med | Med | Scenario 6 fails on any gallery key absent from the catalogue **and** on any catalogue key the gallery does not use, so both directions of a partial rename are caught |
| `expo-localization` version hand-pinned to something outside SDK 54's range, breaking the dev build | Low | High | Install with `expo install`, never `pnpm add`, and let Expo choose the version (Decision 4) |
| Adding `useTranslation()` to `RoutePlaceholder` breaks a direct-call test | Low | Med | Decision 9 requires a `grep` for direct callers before editing; none exist at `85fb341` |
| Merge conflict with #35 at the end of `apps/mobile/eslint.config.mjs` | Med | Low | Append a new block; never rewrite the file. Resolution keeps both blocks (Assumption Check) |
| `en` catalogue written as a copy of `es` (a stub) | Med | Med | AC3 is checked by human review against the Seed Data rule above; the parity test enforces the key set and non-empty values, and the smoke runbook has an explicit English-rendering step |
| First plural key later hits Hermes without full ICU | Low | Med | Out of scope here (no plural keys). Recorded in `i18n.md`'s existing caveat; the screen item that introduces the first plural verifies `Intl.PluralRules` on a device build |
| The lint rule gives false confidence, because attribute copy is unchecked | High | Med | Documented in Decision 6, surfaced in the PR description, and raised as a follow-up. Scenario 6 is the actual AC4 control |

---

## Implementation Order

1. **Install dependencies.** From the repo root:
   `pnpm --filter @finanzas/mobile exec expo install expo-localization`, then
   `pnpm --filter @finanzas/mobile add i18next react-i18next` and
   `pnpm --filter @finanzas/mobile add -D eslint-plugin-i18next`. Run `pnpm install`. Verify:
   `apps/mobile/package.json` lists all four and `pnpm-lock.yaml` is updated; confirm the
   `expo-localization` version Expo selected is in the SDK 54 range rather than a hand-typed
   value.
2. **Write `apps/mobile/src/i18n/locale.ts`** (Decision 4). No i18next import.
3. **Write the catalogues.** Create `es.json` by translating `gallery.strings.ts` mechanically:
   drop the 3 unused keys (Decision 7), snake_case every leaf segment (Decision 8), keep every
   value byte-identical, and add the 4 `dev.placeholder.*` keys (Decision 9). Create `en.json`
   with the same key set and real English values per the Seed Data rule. Verify: both files
   parse as JSON, and a quick key-count check agrees with the 125 total in Seed Data.
4. **Write `apps/mobile/src/i18n/index.ts`** — init with `initReactI18next`, resources for both
   locales, `lng: resolveDeviceLocale()`, `fallbackLng: 'es'`, `keySeparator: false`,
   `interpolation: { escapeValue: false }`, `react: { useSuspense: false }`. Export the instance
   and `setLocale()`.
5. **Write `apps/mobile/src/i18n/i18next.d.ts`** (Decision 5). Verify: `pnpm typecheck` passes,
   and a deliberately misspelled key in a scratch edit is a type error (revert the scratch edit).
6. **Boot i18next from `apps/mobile/app/_layout.tsx`** (Decision 3) — add the side-effect import
   only.
7. **Migrate `DesignSystemGallery.tsx`** — swap the import for `useTranslation()`, rewrite all
   123 call sites to `t('…')` with the new key names, and update the module docstring. Then
   **delete `apps/mobile/src/dev/gallery.strings.ts`**. Verify: `pnpm typecheck` passes — with
   Decision 5 in place, any key that did not make it into the catalogue is a compile error.
8. **Migrate `RoutePlaceholder.tsx`** (Decision 9) and **extract the two glyph constants** in
   `CategoryChip.tsx` and `Checkbox.tsx` (Decision 10). Run the `grep` for direct
   `RoutePlaceholder` callers first.
9. **Append the ESLint block** to `apps/mobile/eslint.config.mjs` (Decision 6), importing
   `eslint-plugin-i18next` at the top of the file. Do not modify the existing export spread.
10. **Prove the control fires (AC1) — required, not optional.**
    1. Run `pnpm lint` and confirm it passes on the migrated tree. Save the output.
    2. Add a deliberate JSX **text** literal to `apps/mobile/src/dev/DesignSystemGallery.tsx` —
       for example `<Text variant="body">Texto de prueba deliberado</Text>` inside any existing
       `Section`. It must be JSX text: an attribute literal proves nothing (Decision 6).
    3. Run `pnpm lint` again and confirm it **fails**, and that the failure names
       `i18next/no-literal-string` on that file and line.
    4. Remove the deliberate literal. Run `pnpm lint` a third time and confirm it passes again.
    5. Record the before / failing / after output (verbatim or paraphrased, including the rule
       name and the file:line) in the PR description under a **"Proof the control fires"**
       heading. Do not commit the deliberate literal.
11. **Prove AC5.** Run `grep -rn "no-literal-string" apps packages` and confirm the only matches
    are the rule configuration in `apps/mobile/eslint.config.mjs` — no `eslint-disable` anywhere.
    Paste the output in the PR description. If any string genuinely cannot be moved into a
    catalogue, stop and report it to the human; do not write a suppression.
12. **Write the tests** — the six files listed in the Testing Strategy table (five Jest suites
    plus the `catalogue-key-scan.ts` module they use), including the scanner edge cases E1-E12.
    Verify: `pnpm --filter @finanzas/mobile test` passes and the new suites appear in the output.
13. **Full gate.** Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` from the repo root; all
    must pass. Then walk the smoke runbook on a dev build.
14. **Update the docs** listed in Documentation Updates, then add to `CHANGELOG.md` under
    `[Unreleased]`:

    ```markdown
    - **i18n infrastructure: catalogues, resolver and the no-literal-string lint rule** (#34): `i18next` + `react-i18next` initialised in `apps/mobile/src/i18n/`, flat-key `es`/`en` catalogues, device-locale resolution via `expo-localization` defaulting to `es`, and `eslint-plugin-i18next/no-literal-string` enforcing that no user-facing literal string appears in JSX. The design-system gallery now renders entirely from catalogue keys; `gallery.strings.ts` is removed.
    ```

15. **Report the follow-ups** listed below to the human in the PR description. Do not create
    them as code changes in this item.

### Follow-ups to report, not implement

- Consolidate this item's `toSupportedLocale` with the one #3 introduces in
  `apps/mobile/src/db/`, once #3 has merged. Instructed by issue #34's duplication note.
- Decide what to do about copy that `mode: 'jsx-text-only'` cannot see — JSX attribute literals
  and object-property literals such as `options={{ title: 'Inicio' }}` in
  `apps/mobile/app/(tabs)/_layout.tsx`. Options are tightening the mode with an attribute
  allowlist, or relying on review. Two user-facing literals exist in that file today.
- Wire accessibility labels for `Steps` and `Dots`, whose unused `ds.steps.label` /
  `ds.dots.label` keys were dropped by Decision 7.

### Residual verification strategy

This is a sweep with a numeric target (every gallery string moves; every current-tree violation
is cleared), so the evidence the implementation must produce before `ready-for-human-review` is:

| Claim | Evidence |
| --- | --- |
| Every gallery string moved | `gallery.strings.ts` does not exist; `pnpm typecheck` passes with the `CustomTypeOptions` key union in force (step 7) |
| No key drift between catalogues, and none orphaned | `catalogue-parity.test.ts` and `gallery-catalogue-keys.test.ts` green in the test output |
| Current-tree violations cleared and the control live | The three-run `pnpm lint` transcript from step 10, pasted in the PR description |
| No suppressions | The `grep -rn "no-literal-string" apps packages` output from step 11, pasted in the PR description |
| Nothing outside this item's surface changed | `git diff --stat` against `develop` shows no file under `apps/mobile/src/db/`, `packages/bank-scraper/`, `.npmrc`, `.github/workflows/`, or `docs/project/2-repo-architecture.md` |
