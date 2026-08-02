# Smoke Test Runbook: i18n infrastructure

**Feature**: i18n infrastructure — catalogues, resolver and the no-literal-string lint rule
(issue #34)
**Spec**: None — Refactor route. The work item brief is
[issue #34](https://github.com/lhpaul/personal-finances/issues/34); the technical decisions are
in the [implementation plan](../../specs/developments/20260802015138_34-i18n-infrastructure/2_34-i18n-infrastructure_implementation-plan.md).
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

Before running this smoke test:

- [ ] `pnpm install` has been run at the repo root (Node 22 via `.nvmrc`, pnpm 11.12.0), **after**
      the four new packages were added — `i18next`, `react-i18next`, `expo-localization`,
      `eslint-plugin-i18next`
- [ ] A booted iOS simulator (or a physical device). `pnpm dev:mobile`, then `i`.
      `expo-localization` is a native module, so a **dev build** is required — Expo Go will not
      resolve it
- [ ] The app runs in **development** mode, so `__DEV__` is `true`; the gallery route renders
      nothing otherwise, by design
- [ ] `design/mockups/mobile/index.html` can be opened next to the simulator
      (`pnpm mockups:mobile`)
- [ ] You can change the simulator's system language (iOS: Settings → General → Language &
      Region). Step 5 needs it
- [ ] No database, no seed data, no login. This product has no sign-in, and this item touches no
      SQLite

---

## Test Data

| Item | Value |
| --- | --- |
| i18n entry module | `apps/mobile/src/i18n/index.ts` |
| Locale resolver | `apps/mobile/src/i18n/locale.ts` |
| Primary catalogue | `apps/mobile/src/i18n/es.json` |
| Fallback catalogue | `apps/mobile/src/i18n/en.json` |
| Lint rule location | `apps/mobile/eslint.config.mjs` (appended block) |
| Gallery route file | `apps/mobile/app/(dev)/gallery.tsx` |
| Gallery runtime URL | `finanzas://gallery` — Expo Router group segments such as `(dev)` do not appear in the URL |
| Deleted file (must not exist) | `apps/mobile/src/dev/gallery.strings.ts` |
| Design reference — components | `design/mockups/mobile/index.html#screen=ds-components` |
| Design reference — typography and amounts | `design/mockups/mobile/index.html#screen=ds-typography` |

No user accounts, no seeded rows.

---

## Smoke Test Steps

### Step 1: The catalogues exist, are flat, and agree

**Maps to**: AC3 (both `es` and `en` exist and are updated together)

1. Open `apps/mobile/src/i18n/es.json` and `apps/mobile/src/i18n/en.json`.
2. Confirm every value is a plain string — no nested object, no array anywhere in either file.
3. Confirm keys are flat and dotted (for example `ds.section.buttons`, `dev.placeholder.title`),
   with snake_case leaf segments.
4. Spot-check that a key present in one file is present in the other.
5. Run `pnpm --filter @finanzas/mobile test`.

**Expected result**: `catalogue-parity.test.ts` passes — identical key sets, every value a
non-empty string, no nested structure, and every key matching the flat snake_case pattern. The
`en` values are real English, not copies of the Spanish (`Botones` → `Buttons`, not `Botones`).

### Step 2: The gallery renders entirely from catalogue keys

**Maps to**: AC4

1. Confirm `apps/mobile/src/dev/gallery.strings.ts` no longer exists.
2. Open `apps/mobile/src/dev/DesignSystemGallery.tsx` and confirm it imports `useTranslation`
   from `react-i18next` and contains no import of a local strings module.
3. With `pnpm dev:mobile` running, navigate the dev client to `finanzas://gallery`.
4. Scroll the whole gallery.

**Expected result**: every section heading, button label, badge, field label, transaction row,
note, stat tile, typography sample, card, hero, segment, pill, empty state, tab bar and modal
renders its Spanish copy exactly as before the change. **No raw key string** (for example a
literal `ds.section.buttons`) appears anywhere on screen — a visible key means i18next failed to
resolve it, which is the signature of a missing `keySeparator: false`.

5. Tap **Abrir sheet** and **Abrir modal** and confirm the sheet body and the modal title, body
   and both buttons render their Spanish copy.

### Step 3: The lint rule fails on a deliberate JSX literal

**Maps to**: AC1

1. Run `pnpm lint` at the repo root. Confirm it passes.
2. Add a deliberate JSX **text** literal to `apps/mobile/src/dev/DesignSystemGallery.tsx` —
   for example `<Text variant="body">Texto de prueba deliberado</Text>` inside any `Section`.
   It must be JSX text; an attribute literal (`label="…"`) is not checked by `jsx-text-only` and
   proves nothing.
3. Run `pnpm lint` again.
4. Remove the deliberate literal and run `pnpm lint` a third time.

**Expected result**: run 1 passes; run 2 **fails** with an `i18next/no-literal-string` error
naming `DesignSystemGallery.tsx` and the line you added; run 3 passes again. The three outputs
are recorded in the PR description.

### Step 4: No suppression exists anywhere

**Maps to**: AC5

1. Run `grep -rn "no-literal-string" apps packages`.

**Expected result**: the only matches are the rule configuration in
`apps/mobile/eslint.config.mjs`. No `eslint-disable`, `eslint-disable-line`, or
`eslint-disable-next-line` mentioning this rule appears in any source file.

### Step 5: The device locale selects the catalogue, and anything unresolved falls back to `es`

**Maps to**: AC2

1. With the simulator language set to **Spanish**, cold-start the app (fully quit and relaunch —
   the locale is read once at init) and open `finanzas://gallery`.
2. Confirm the copy is Spanish.
3. Change the simulator's system language to **English** and cold-start the app again. Open the
   gallery.
4. Confirm the copy is English.
5. Change the simulator's system language to a third language that the app does not support —
   **Português** or **Français**. Cold-start and open the gallery.
6. Confirm the copy is **Spanish**, not English and not raw keys.

**Expected result**: `es` and `en` each select their own catalogue; any unsupported or
unresolvable device language falls back to `es`. `locale.test.ts` covers the same mapping in
Jest, including the empty-`getLocales()` case that cannot be reproduced on a device.

### Step 6: The placeholder routes still render their copy

**Maps to**: AC1 (the tree passes lint), Decision 9

1. From the running app, navigate to any not-yet-implemented route, for example
   `finanzas://settings` or `finanzas://dashboard`.

**Expected result**: the placeholder screen still shows `PLACEHOLDER — not implemented`, the
mockup screen id, the route, and one `Next: …` link per successor — with the interpolated values
filled in, not literal `{{screenId}}` / `{{route}}` / `{{label}}` placeholders.

### Step 7: Design fidelity — expected vs actual

**Maps to**: AC4

1. Open the reference assets: `design/mockups/mobile/index.html#screen=ds-components` and
   `design/mockups/mobile/index.html#screen=ds-typography` (`pnpm mockups:mobile`).
2. Place the mockup next to the simulator showing `finanzas://gallery`, in Spanish.
3. Compare each section's copy and layout against the reference (lightweight visual check, not a
   pixel diff). Sections 1-7 of the gallery mirror `#screen=ds-components` in order; the
   typography and amounts sections mirror `#screen=ds-typography`.
4. Record PASS/FAIL with expected-vs-actual detail on failure.

**Expected result**: the gallery is visually and textually **unchanged** by this item — the
migration moves where copy lives, never what it says. Any wording difference from the mockup, or
from the gallery before the change, is a failure.

### Last Step: Validate & Shut Down

- Restore the simulator's system language to Spanish
- Verify every assertion in the checklist below is met
- Stop the dev server

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion from issue #34.

- [ ] **AC1** — `pnpm lint` fails on a deliberately added JSX text literal and passes on the
      current tree (Step 3)
- [ ] **AC2** — the device locale selects the catalogue; anything unresolved falls back to `es`
      (Step 5)
- [ ] **AC3** — both `es` and `en` catalogues exist, share one key set, and carry real
      translations (Step 1)
- [ ] **AC4** — the gallery route renders entirely from catalogue keys, with no raw key visible
      and no visual change (Steps 2 and 7)
- [ ] **AC5** — no `eslint-disable` for `no-literal-string` anywhere in the repo (Step 4)
- [ ] `apps/mobile/src/dev/gallery.strings.ts` is deleted (Step 2)
- [ ] `pnpm typecheck` and `pnpm test` pass at the repo root

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Catalogues | 121 migrated `ds.*` gallery keys plus 4 `dev.placeholder.*` keys, in both locales | Committed source: `apps/mobile/src/i18n/{es,en}.json`. Nothing to load at runtime |

No database seed data — this item touches no SQLite.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Raw keys such as `ds.section.buttons` render instead of Spanish | `keySeparator` left at its i18next default of `'.'`, so a flat key is treated as a nested path | Set `keySeparator: false` in `src/i18n/index.ts` **and** in the `CustomTypeOptions` augmentation |
| The whole app renders English while the simulator is Spanish | `lng` not set from `resolveDeviceLocale()`, or the app was not cold-started after the language change | Check the `init` call; fully quit and relaunch |
| `Cannot find native module 'ExpoLocalization'` | Running in Expo Go, or the dev build predates the dependency | Rebuild the dev client after `expo install expo-localization` |
| `pnpm lint` reports `i18next/no-literal-string` on `CategoryChip` or `Checkbox` | The `★` / `✓` glyph was left as JSX text | Extract it to a module-level constant and render `{GLYPH}` — never add an `eslint-disable` (AC5) |
| A gallery key is missing from the catalogue | The snake_case rename missed a call site | `pnpm typecheck` names the exact key; `gallery-catalogue-keys.test.ts` names it too |
| `pnpm lint` passes even with a literal you added | The literal is in a JSX attribute, not JSX text | `jsx-text-only` checks text children only. Use JSX text for the proof (Step 3) |

---

## Known Limitations

- `mode: 'jsx-text-only'` does **not** inspect string literals in JSX attributes or in objects
  passed through attributes. `<Tabs.Screen options={{ title: 'Inicio' }} />` in
  `apps/mobile/app/(tabs)/_layout.tsx` is user-facing copy that this rule cannot see. It is left
  in place deliberately (tab-shell copy belongs to the tab-shell item) and reported as a
  follow-up.
- Step 5 cannot exercise the empty-`getLocales()` path on a device; that case is covered only by
  `locale.test.ts`.
- This runbook asserts the gallery is unchanged, which makes it a regression check rather than a
  new-behaviour check. That is the intent: the item is infrastructure, and its only visible
  surface is the dev-only gallery.
