# Notifications and local reminders — Implementation Plan

**Work item**: [#18 Notifications and local reminders](https://github.com/lhpaul/personal-finances/issues/18)
— a **Refactor**-type item in the tracker, so there is no spec document. The issue body plus its
recorded scope comment is the brief, together with the three contracts it points at:

- **Visual contract**: `design/mockups/mobile/index.html` — `#screen=notifications-intro`
  (`default`, `denied`), `#screen=notifications-schedule` (`time`, `custom-time`, `days`),
  `#screen=settings-notifications` (`enabled`, `disabled`); manifest entries in
  [`mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js)
- **Behaviour contract**:
  [`BEHAVIOR.md` → `notifications-intro`, `notifications-schedule`, `settings-notifications`](../../../../design/mockups/mobile/BEHAVIOR.md)
- **Domain contract**: [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md)
  — BR0 (no account, no server, the profile is the device) and BR6 (the product never punishes the
  person; a reminder nags gently and never blocks)

**Smoke test runbook**:
[`docs/testing/mobile/18-notifications-local-reminders.smoke-test.md`](../../../testing/mobile/18-notifications-local-reminders.smoke-test.md)

---

## Summary

**Approach**: Three composition-only screens over one new `src/features/reminders/` surface, plus
one new native capability behind a port. The person's reminder **intent** lives in the three
`app_settings` keys item #8 already defined (`reminder_enabled`, `reminder_time`, `reminder_days`);
the OS **permission** is read live from `expo-notifications` and never persisted. What the app
actually schedules is a pure function of those two truths, produced by `planReminderSchedule()` and
applied through a `NotificationsPort` whose only implementation imports `expo-notifications` — the
same one-adapter-one-boundary shape item #9 uses for `expo-secure-store`. Deterministic
notification identifiers make "changing the schedule reschedules rather than duplicating" a
property of the data, not of the call order. **No TanStack Query**: screens call feature hooks,
feature hooks call `getAppDatabase()` plus repository functions, exactly as items #8, #12 and #19
established. No backend, no push token, no remote notification — the product has no server (BR0)
and this item does not create one.

**Estimated complexity**: **M**

**Rationale**: the three screens are shallow — they compose primitives that already exist
(`Switch`, `Checkbox`, `Radio`, `Segment`, `CategoryChip`, `Note`, `Card`, `Button`, `Text`) and add
catalogue copy. The M comes from three things that are not shallow: a new native module whose
permission model is a first-class product state rather than an error path; an idempotent scheduler
that must converge to the same set of OS-registered notifications no matter how many times it runs;
and a recurrence shape the mockups do not draw, which needs a reversible default rather than a
guess baked into a call site.

**Dependencies**:

| Item | State at plan time | Why this plan needs it | Blocking? |
| --- | --- | --- | --- |
| [#8 onboarding intro/value/ready](https://github.com/lhpaul/personal-finances/issues/8) | Plan merged; implementation not started | Owns `src/db/runtime.ts` → `getAppDatabase()`, `readReminderSettings(db)` and the reminder value contract this item writes, `src/features/reminders/summary.ts` → `summarizeReminderDays`, the `screenMetrics` theme export, `formatWallClockLabel` in `@finanzas/shared-utils`, and the `reminders.*` catalogue keys this item reuses | **Yes** — see Resolution R1 |
| [#3 local database](https://github.com/lhpaul/personal-finances/issues/3) | Merged | `app_settings`, `getSetting` / `setSetting`, `openBootstrappedMemoryDb()`, the two-project Jest config | Satisfied |
| [#2 theme and primitives](https://github.com/lhpaul/personal-finances/issues/2) | Merged | Every primitive these screens compose | Satisfied |
| [#34 i18n](https://github.com/lhpaul/personal-finances/issues/34) | Merged | Flat-key catalogues, the typed `t()` union, `i18next/no-literal-string` | Satisfied |
| [#47 design-fidelity gate](https://github.com/lhpaul/personal-finances/issues/47) | Implementation open as PR [#61](https://github.com/lhpaul/personal-finances/pull/61) | This item's seven fidelity targets flip `planned` → `wired` | **No** — contingent, see Resolution R2 |
| [#19 settings hub](https://github.com/lhpaul/personal-finances/issues/19) | Plan merged; implementation not started | Owns `ScreenTopBar`, `ListGroup` and `ListRow`, which `settings-notifications` and `notifications-schedule` would otherwise compose locally | **No** — contingent, see Resolution R3 |
| [#9 connect a bank](https://github.com/lhpaul/personal-finances/issues/9) | Plan merged; implementation not started | Owns `bank-connected`, the screen that navigates **into** `notifications-intro`. This item does not touch that file | No |

### Resolutions

**R1 — item #8 must be merged before implementation starts.** Six symbols this plan calls by name
(`getAppDatabase`, `readReminderSettings`, `summarizeReminderDays`, `screenMetrics`,
`formatWallClockLabel`, and the `reminders.day_1…day_7` catalogue keys) are created by #8 and exist
nowhere in the tree today (Verification Log). Implementation Order step 0 re-checks each one; if any
is missing, the implementer **stops and returns to the parent orchestrator** rather than inventing a
second copy. A second `getAppDatabase()` would be a second open database handle, which is a data
bug, not a style problem.

**R2 — the fidelity flip is contingent on #47.** If `scripts/mobile-ui/fidelity-targets.json` exists
at implementation time, this item flips its seven targets to `wired` and runs
`pnpm fidelity:contract`. If it does not, the item ships without touching it, records that in the PR
body, and the manual side-by-side in the runbook is the fidelity evidence. Under no circumstance
does this item create that file.

**R3 — three primitives are consumed if present, composed locally if not.** `ScreenTopBar`,
`ListGroup` and `ListRow` are #19's to create. If they exist in
`apps/mobile/src/components/ui/index.ts` at implementation time, these screens import them and
`MU_CLASS_MAP` is **not** touched. If they do not, these screens compose the same shapes locally
from `Text` / `Card` / `Pressable` and `MU_CLASS_MAP` is still **not** touched — precisely the
choice item #8 made for the same classes. Either way `mu-class-coverage.test.ts` stays green,
because that test compares the mockup's class universe against the map, not against screens.

---

## Verification Log

All commands were run in the plan worktree
`.claude/worktrees/item-18` (branch `implementation-plan/18-notifications-local-reminders`) on
2026-08-02, at repo revision `961cc69`.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse HEAD` and `git rev-parse origin/develop` | Both `961cc69` — the plan branch is not stacked on unmerged work |
| Template-fit check applies? | `sed -n '170,176p' .ai-dev-workflow.yaml` | `is_template: false` → Protocol 02 **Step 0 does not apply**; no template-fit warning is required |
| Repository mode | `grep -n '^mode:' .ai-dev-workflow.yaml` | No match → default `single_repo`; this repository owns the plan and the plan PR |
| Declared MVP states for the three screens | `node -e "global.window={};require('./design/mockups/mobile/mockup-manifest.js'); …"` | `notifications-intro /(onboarding)/notifications` → `default`, `denied`; `notifications-schedule /(onboarding)/notifications/schedule` → `time`, `custom-time`, `days`; `settings-notifications /settings/notifications` → `enabled`, `disabled`. **Seven screen/state targets**, all `mvp: true` |
| `settings-notifications` really belongs to this item | Issue #18 comment of 2026-08-02T17:39:39Z; item #47's merged plan *Coverage sets* table | The comment records #18 as the owner because no issue body claims the screen; #47's table already reads `#18 → notifications-intro, notifications-schedule, settings-notifications → 7`. Both agree, so this plan **includes** the screen and no exclusion entry is needed |
| `expo-notifications` is not a dependency and is imported nowhere | `grep -rn "expo-notifications" apps packages scripts` | `0` hits. It is also absent from `apps/mobile/package.json` — this item adds it |
| The six #8 symbols this plan depends on do not exist yet | `grep -rn "formatWallClockLabel\|readReminderSettings\|summarizeReminderDays\|screenMetrics\|getAppDatabase" apps packages` | `0` hits; `apps/mobile/src/features` does not exist. This is Resolution R1's premise, re-checked at Implementation Order step 0 |
| The three route files exist as placeholders | `cat "apps/mobile/app/(onboarding)/notifications/index.tsx" "apps/mobile/app/(onboarding)/notifications/schedule.tsx" apps/mobile/app/settings/notifications.tsx` | All three render `RoutePlaceholder`. This item adds **no** route file, so `route-manifest-parity.test.ts`'s 25-route set equality is unchanged |
| `app_settings` is key-value; the three reminder keys are already MVP keys | `sed -n '296,307p' docs/project/4-database-model.md`; `apps/mobile/src/db/repositories/settings.ts` | `key TEXT PK`, `value TEXT NOT NULL` (JSON); MVP keys include `reminder_enabled`, `reminder_time`, `reminder_days`. **No migration** — non-negotiable 5 is not engaged |
| `mu-*` ownership for the classes these screens draw | `grep -nE "'mu-(switch\|check\|radio\|chip\|otp\|segment\|note\|grid-2\|h3\|label\|list\|item\|topbar)" apps/mobile/src/test-utils/mu-class-map.ts` | `mu-switch`→`Switch`, `mu-check`→`Checkbox`, `mu-radio`→`Radio`, `mu-chip`/`mu-chip__emoji`→`CategoryChip`, `mu-segment`/`mu-segment__item`→`Segment`, `mu-note*`→`Note`, `mu-h3`/`mu-label`→`Text`, `mu-grid-2`/`mu-row*`→`utility`; `mu-list`/`mu-item*` **deferred to #19**; `mu-topbar*` **deferred**; `mu-otp`/`mu-otp__box` **deferred to #7 (out of MVP)** → Decision 10, Resolution R3 |
| `mu-class-coverage.test.ts` compares the map to the mockup, not to screens | `cat apps/mobile/src/__tests__/mu-class-coverage.test.ts` | Set equality between `muClassInventory(index.html)` and `Object.keys(MU_CLASS_MAP)`, plus owner-resolves-to-barrel-export checks. Composing a deferred class locally does **not** fail it |
| Catalogue key shape enforced by CI | `cat apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` | Flat lowercase dotted snake_case keys, identical key sets in `es` and `en`, every value a non-empty string, no nested values |
| `i18n.t` is callable outside React | `cat apps/mobile/src/i18n/index.ts` | `export default i18n` — the initialised i18next instance, so the scheduler service can compose notification copy without a hook (Decision 12) |
| The boundary-lint pattern to mirror | `sed -n '/export const dbAccessBoundary/,/^};/p' eslint.config.mjs`; item #9's plan, *Layer-by-Layer → Infrastructure* | `dbAccessBoundary` is an exported flat-config object using `no-restricted-imports`; item #9 adds `secureStoreBoundary` the same way. Decision 1 adds a third, `notificationsBoundary` |
| `expo-linking` can open the OS settings page | `grep -rn "openSettings" node_modules/.pnpm/expo-linking@8.0.12_*/node_modules/expo-linking/build/Linking.d.ts` | `export declare function openSettings(): Promise<void>` — **installed and verified**; the `disabled` note's "Abrir ajustes del teléfono" needs no new dependency |
| `expo-notifications` API surface for SDK 54 | `npm pack expo-notifications@0.32.17` and read `build/*.d.ts` (see the API table below) | Every symbol this plan names was read from the published typings of the SDK-54 line, not assumed |
| Which `expo-notifications` version `expo install` will pick | `npm view expo-notifications versions` | The SDK-54-aligned line is `0.32.x`, newest `0.32.17`. The implementer runs `npx expo install expo-notifications` and records the resolved range rather than hand-pinning (Implementation Order step 1) |
| Fidelity targets for this item, and the wired-target rules | `git show origin/feature/47-design-fidelity-gate:scripts/mobile-ui/fidelity-targets.json`; same branch's `scripts/mobile-ui/fidelity-contract.mjs` lines 163-205 | The contract already carries this item's seven mappings, all `status: "planned"`, `fixture: "seed-default"`. A `wired` mapping must carry `app_file`, `deep_link` and `ready_test_id`; the validator accepts the literal selector **or** a `fidelityTestId('<screen_id>')` call in `app_file`, and requires `deep_link` to be a `finanzas:` URL with `fidelity=1`, `fidelityScreen=<screen_id>` and a matching `fidelityState` |
| `useFidelityPreview` / `fidelityTestId` signatures | `git show origin/feature/47-design-fidelity-gate:apps/mobile/src/lib/fidelity-preview.ts` | `fidelityTestId(screenId) === 'fidelity-' + screenId`; `useFidelityPreview(): { active: boolean; state: string \| null }`, inert unless `__DEV__ && params.fidelity === '1'` |
| Feature-layer test convention | Item #12's merged plan, *Infrastructure*; item #9's merged plan, Decision 14 | `*.db.test.ts` under `src/features/` is routed to the Node/`better-sqlite3` `db` Jest project and excluded from the `app` project. This item follows it (Decision 17) |
| Bounded same-surface open PRs | `gh pr list --state open --json number,title,headRefName,baseRefName` | Three: **#61** (item #47 implementation — same surface: `scripts/mobile-ui/fidelity-targets.json`, `apps/mobile/src/lib/fidelity-preview.ts`), **#68** (a docs-only fix to item #12's merged plan), **#46** (`packages/bank-scraper`). Only #61 touches a surface this plan names |

### `expo-notifications` API this plan relies on

Read from the published typings of `expo-notifications@0.32.17` (`npm pack`, then `build/*.d.ts`).
Every one of these is re-verified against the **installed** package at Implementation Order step 1
before any adapter code is written.

| Symbol | Shape as published | Where this plan uses it |
| --- | --- | --- |
| `getPermissionsAsync()` | `Promise<NotificationPermissionsStatus>` (extends `PermissionResponse`: `status`, `granted`, `canAskAgain`) | `NotificationsPort.getPermission()` |
| `requestPermissionsAsync(request?)` | same return type | `NotificationsPort.requestPermission()` |
| `scheduleNotificationAsync(request)` | `NotificationRequestInput { identifier?: string; content; trigger }` → `Promise<string>` | `NotificationsPort.schedule()`; the optional `identifier` is what makes Decision 2 possible |
| `cancelScheduledNotificationAsync(id)` | `Promise<void>` | `NotificationsPort.cancel()` |
| `getAllScheduledNotificationsAsync()` | `Promise<NotificationRequest[]>`, each with `identifier` | `NotificationsPort.listScheduled()` |
| `SchedulableTriggerInputTypes.WEEKLY` | `{ type; weekday: number; hour; minute; channelId? }` — the typings state **"Weekdays are specified with a number from 1 through 7, with 1 indicating Sunday"** | Decision 4's weekday conversion |
| `SchedulableTriggerInputTypes.DAILY` | `{ type; hour; minute; channelId? }` | Decision 3's alternative strategy |
| `setNotificationHandler(handler)` | takes `{ handleNotification }` returning `NotificationBehavior { shouldShowBanner; shouldShowList; shouldPlaySound; shouldSetBadge; priority? }` | Decision 14 |
| `addNotificationResponseReceivedListener(cb)` | returns `EventSubscription` with `.remove()` | Decision 15 |
| `getLastNotificationResponse()` | `NotificationResponse \| null` (the non-deprecated form; `getLastNotificationResponseAsync` is marked deprecated) | Decision 15's cold-start tap |
| `setNotificationChannelAsync(id, channel)` | Android channel creation; `AndroidImportance` lives in `NotificationChannelManager.types` | Decision 13 |

### Residual verification strategy

This plan makes one completeness claim — *every declared MVP state of the three screens is
implemented* — and one behavioural guarantee — *rescheduling never duplicates*. Neither is left as
prose; both have a mechanical evidence source the implementation PR must paste:

| Claim | Evidence source | What the implementation PR pastes |
| --- | --- | --- |
| Every declared state is implemented | `apps/mobile/src/features/reminders/__tests__/view-state-manifest-parity.test.ts` — loads the manifest through the existing `src/test-utils/mockup-manifest` loader and asserts that each screen's `VIEW_STATES` tuple deep-equals the manifest's declared state ids, in order | The test's pass line and the three state tuples it printed |
| Rescheduling converges rather than duplicates | `apps/mobile/src/features/reminders/__tests__/apply-schedule.test.ts` — applies the same plan twice, then a changed plan, against the in-memory port and asserts the resulting identifier set each time | The final identifier sets for all three applications |
| The `expo-notifications` import boundary holds, and the permission is requested from only two call sites | `apps/mobile/src/__tests__/notifications-boundary.test.ts` — scans every file under `app/**` and `src/**` for two things: that exactly one file imports `expo-notifications`, and that `requestPermission` is called from exactly the two files named in Decision 7. Both lists are printed, so a vacuous pass on a broken walk is visible | The importer list and the `requestPermission` call-site list the test printed |
| Every copy string comes from the catalogue | `apps/mobile/src/features/reminders/__tests__/reminders-catalogue-keys.test.ts`, using the merged `src/test-utils/catalogue-key-scan` helper over the three route files and the feature folder | The test's pass line and the number of keys scanned |
| Fidelity targets are wired (R2-contingent) | `pnpm fidelity:contract` output showing seven fewer `planned` targets | The command output, or the R2 not-applicable note plus the runbook's manual comparison record |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` (no `mode` key) — this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo` block) | 2026-08-02, `961cc69` | Current invocation (item #18) only | `Verified` |
| Plan artifact base branch | `develop` | `AGENTS.md` → "Integration branch: `develop` (spec/plan/feature/fix PRs target `develop`)"; all three open PRs target `develop` | 2026-08-02, `961cc69` | The three open PRs (#61, #68, #46) — all base `develop` | `Verified` |
| Ownership of `settings-notifications` | Owned by **this item**; no exclusion entry is needed in the fidelity contract | Issue #18 comment 2026-08-02T17:39:39Z ("This item (#18 …) is its natural owner"), and item #47's merged plan coverage table `#18 → 7 targets` | 2026-08-02, `961cc69` | Same-surface artifacts only: issue #18, item #47's merged plan, PR #61's `fidelity-targets.json` — all three agree | `Verified` |
| The seven fidelity targets exist as `planned` and their wired-target rules | Seven `planned` mappings, `fixture: "seed-default"`; wired targets need `app_file` + `deep_link` + `ready_test_id`, with `fidelityTestId('<screen_id>')` accepted in place of the literal | `git show origin/feature/47-design-fidelity-gate:scripts/mobile-ui/fidelity-targets.json` and `…:scripts/mobile-ui/fidelity-contract.mjs` lines 163-205 | 2026-08-02, `961cc69` | Bounded to PR #61, the only open PR touching this surface | `Verified` — the contract is not on `develop` yet, which is exactly why the flip is contingent (Resolution R2), not a conflict |
| The reminder value contract (`reminder_enabled` boolean, `reminder_time` `"HH:mm"`, `reminder_days` ISO weekday integers with Monday = 1) | Adopted verbatim; this item is the writer, item #8 is the reader | Item #8's merged plan, Decision 8 | 2026-08-02, `961cc69` | Same-surface artifacts: item #8's merged plan (the only artifact defining these keys) and item #19's merged plan, which reads the same keys through `summarizeReminderDays` | `Verified` |

No `Conflict` rows. The two contingencies above (R2, R3) are **sequencing** facts recorded with
their check step, not competing operational assumptions: no open PR and no merged artifact asserts a
different value for any surface in this table.

---

## Layer-by-Layer Changes

### Database / Data Layer

No migration. `app_settings` is key-value and all three reminder keys are already declared MVP keys
(Verification Log).

- [ ] `apps/mobile/src/db/repositories/settings.ts` — add `writeReminderSettings(db, settings)`, the
      write-side sibling of item #8's `readReminderSettings(db)`. It writes the three keys through
      the existing `setSetting` (which is `onConflictDoUpdate` on the primary key, hence idempotent)
      and normalises before writing: days sorted ascending and de-duplicated, time re-serialised as
      zero-padded `"HH:mm"`. Nothing else in the file changes.
- [ ] `apps/mobile/src/db/types.ts` — no new type if item #8's `ReminderSettings` is already there
      (it is, per #8's Decision 8). This plan **reuses** it and does not define a parallel shape.

### Shared Packages / Libraries

- [ ] `packages/shared-utils/src/dates.ts` — add the inverse pair of item #8's
      `formatWallClockLabel`, so the custom-time editor can round-trip:
      `wallClockParts(timeOfDay: string): { hour12: number; minute: number; meridiem: 'am' | 'pm' }`
      and `timeOfDayFromParts(parts): string` (`"HH:mm"`, 24-hour, zero-padded). Both are numeric
      only — no `Intl`, no locale — matching the reason #8 gave for putting the formatter here.
      `formatWallClockLabel` itself is **not** modified.
- [ ] `packages/shared-utils/src/dates.test.ts` — tests for the new pair, including the round-trip
      property and the two hour-12 boundaries (`"00:30"` ↔ `12:30 am`, `"12:00"` ↔ `12:00 pm`).
- [ ] `packages/shared-utils/src/index.ts` — export both, matching the file's existing barrel style.
- [ ] `packages/shared-domain` — **no change.** Reminder scheduling is device policy, not a money or
      inclusion rule, and `shared-domain` may not import from `apps/` or from any `expo-*` package.

### Frontend / UI — new files

Native boundary (`src/lib/notifications/`, new folder — mirrors item #9's `src/lib/secure-store/`):

- [ ] `apps/mobile/src/lib/notifications/types.ts` — the port and its value types. No import of
      `expo-notifications`, so every consumer and every test can use it freely:

      ```ts
      // Illustrative — adapt during implementation.
      export type PermissionState = 'granted' | 'denied' | 'undetermined';

      /** ISO weekday: 1 = Monday … 7 = Sunday (item #8 Decision 8). The adapter — and only the
       *  adapter — converts to the platform numbering (Decision 4). */
      export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

      export type ReminderTrigger =
        | { kind: 'weekly'; isoWeekday: IsoWeekday; hour: number; minute: number }
        | { kind: 'daily'; hour: number; minute: number };

      export type ReminderRequest = {
        identifier: string;
        title: string;
        body: string;
        trigger: ReminderTrigger;
      };

      export type NotificationsPort = {
        getPermission(): Promise<PermissionState>;
        requestPermission(): Promise<PermissionState>;
        listScheduledIdentifiers(): Promise<string[]>;
        schedule(request: ReminderRequest): Promise<void>;
        cancel(identifier: string): Promise<void>;
        prepareChannel(name: string): Promise<void>;
        openSystemSettings(): Promise<void>;
      };
      ```

- [ ] `apps/mobile/src/lib/notifications/expo-notifications.adapter.ts` — the **only** file in the
      repository allowed to import `expo-notifications` (Decision 1). Implements the port, converts
      ISO weekdays to the platform's `1 = Sunday` numbering (Decision 4), creates the Android
      channel (Decision 13), installs the foreground handler (Decision 14), and delegates
      `openSystemSettings()` to `expo-linking`'s verified `openSettings()`.
- [ ] `apps/mobile/src/lib/notifications/testing/memory-notifications.ts` — an in-memory port used by
      every test: a settable permission state, a `Map<string, ReminderRequest>` of scheduled
      requests, and a call log so tests can assert *ordering* (cancel before schedule), not only the
      end state.
- [ ] `apps/mobile/src/lib/notifications/index.ts` — barrel exporting the types, the memory double
      and a lazily-constructed singleton adapter accessor `getNotificationsPort()`.

Reminder feature (`src/features/reminders/`, created by item #8 with `summary.ts`):

- [ ] `apps/mobile/src/features/reminders/constants.ts` — `REMINDER_ID_PREFIX = 'finanzas-reminder'`,
      `REMINDER_TRIGGER_STRATEGY` (Decision 3), `FOREGROUND_BEHAVIOR` (Decision 14),
      `REMINDER_CHANNEL_ID = 'reminders'`, and the default settings
      (`DEFAULT_REMINDER_TIME = '09:00'`, `DEFAULT_REMINDER_DAYS = [1, 2, 3, 4, 5]` — the chip and
      the checkboxes the mockup draws pre-selected at `index.html:1049` and `index.html:1072-1078`).
- [ ] `apps/mobile/src/features/reminders/schedule-plan.ts` — the heart of the item, pure and
      synchronous:

      ```ts
      // Illustrative — adapt during implementation.
      export function planReminderSchedule(input: {
        enabled: boolean;
        permission: PermissionState;
        time: string;            // "HH:mm"
        days: IsoWeekday[];
        strategy?: TriggerStrategy;
      }): ReminderRequest[];
      ```

      Returns `[]` unless `enabled === true && permission === 'granted' && days.length > 0`.
      Otherwise it returns one request per selected day (or a single daily request — Decision 3),
      each with the deterministic identifier from `reminderIdentifier(trigger)`, sorted by
      identifier so two runs on the same input are `toEqual`-identical.
- [ ] `apps/mobile/src/features/reminders/apply-schedule.ts` —
      `applyReminderSchedule(port, plan): Promise<string[]>`: lists the currently scheduled
      identifiers, cancels **every** identifier that starts with `REMINDER_ID_PREFIX`, then schedules
      each request in the plan, and returns the resulting identifier set (Decision 2). Identifiers
      the app does not own are never touched.
- [ ] `apps/mobile/src/features/reminders/reminder-content.ts` —
      `reminderContent(): { title: string; body: string }`, reading the catalogue through the
      `i18n` instance (Decision 12). Separated from the planner so the planner stays free of i18n.
- [ ] `apps/mobile/src/features/reminders/presets.ts` — `ONBOARDING_TIME_PRESETS` (the five drawn
      chips plus the custom chip) and `SETTINGS_TIME_PRESETS` (the three drawn radios plus the custom
      row), each `{ id, glyph, timeOfDay, labelKey? }`, plus the pure
      `resolvePresetSelection(timeOfDay, presets)` → `{ kind: 'preset'; id } | { kind: 'custom' }`
      (Decision 9).
- [ ] `apps/mobile/src/features/reminders/view-state.ts` — the three pure resolvers and the three
      `VIEW_STATES` tuples that the manifest-parity test asserts against
      (`resolveIntroState`, `resolveScheduleStep`, `resolveSettingsState`) — Decision 8.
- [ ] `apps/mobile/src/features/reminders/save-reminders.ts` —
      `saveReminders({ db, port, settings })`: writes through `writeReminderSettings`, then plans and
      applies the schedule, returning `{ status: 'ok'; identifiers } | { status: 'permission-lost' }`
      so the caller can re-render the OS-blocked frame instead of pretending the save worked.
- [ ] `apps/mobile/src/features/reminders/use-notification-permission.ts` — `{ permission, request,
      refresh }`. Reads once on mount, re-reads on `AppState` `'active'` (the person can revoke the
      permission in the OS settings while the app is backgrounded — see the concurrency addendum).
- [ ] `apps/mobile/src/features/reminders/use-reminder-settings.ts` — `{ status, settings, save }`
      over `getAppDatabase()` + `readReminderSettings` + `saveReminders`. Cancellation-guarded and
      re-entrancy-guarded.
- [ ] `apps/mobile/src/features/reminders/use-reminder-tap-routing.ts` — registers the notification
      response listener and routes a tap to `/categorize/intro` (Decision 15).
- [ ] `apps/mobile/src/features/reminders/components/SamplePushCard.tsx` — the framed sample
      notification `notifications-intro` draws (`index.html:1001-1015`).
- [ ] `apps/mobile/src/features/reminders/components/TimePresetGrid.tsx` — the two-column chip grid
      (`mu-grid-2`, `utility`) over `CategoryChip`.
- [ ] `apps/mobile/src/features/reminders/components/CustomTimeCard.tsx` — the custom-time editor
      (Decision 10): two numeric fields and the `Segment` AM/PM control, over the verified
      `wallClockParts` / `timeOfDayFromParts` pair.
- [ ] `apps/mobile/src/features/reminders/components/DayCheckList.tsx` — the seven-day list over
      `Checkbox`, reusing item #8's `reminders.day_1…day_7` catalogue keys.

Tests (files named in the Testing Strategy): `__tests__/schedule-plan.test.ts`,
`__tests__/apply-schedule.test.ts`, `__tests__/presets.test.ts`, `__tests__/view-state.test.ts`,
`__tests__/view-state-manifest-parity.test.ts`, `__tests__/reminders-catalogue-keys.test.ts`,
`save-reminders.db.test.ts`, plus `apps/mobile/src/__tests__/notifications-boundary.test.ts` and
`apps/mobile/src/lib/notifications/__tests__/adapter-weekday-mapping.test.ts`.

### Frontend / UI — modified files

- [ ] `apps/mobile/app/(onboarding)/notifications/index.tsx` — replaces `RoutePlaceholder` with the
      real screen (`#screen=notifications-intro&state=default|denied`). Carries
      `testID={fidelityTestId('notifications-intro')}` **in this route file**, which is what the
      fidelity validator reads.
- [ ] `apps/mobile/app/(onboarding)/notifications/schedule.tsx` — replaces `RoutePlaceholder`
      (`#screen=notifications-schedule&state=time|custom-time|days`). Carries
      `testID={fidelityTestId('notifications-schedule')}`.
- [ ] `apps/mobile/app/settings/notifications.tsx` — replaces `RoutePlaceholder`
      (`#screen=settings-notifications&state=enabled|disabled`). Carries
      `testID={fidelityTestId('settings-notifications')}`.
- [ ] `apps/mobile/app/_layout.tsx` — **two lines**: import and call `useReminderTapRouting()`
      (Decision 15). Item #8's plan says this file needs no change *for the launch gate*; this
      addition is additive and does not touch what #8 does here. It is the only file this item
      shares with another in-flight lane outside the catalogues.
- [ ] `apps/mobile/src/theme.ts` — add a `reminders` group to item #8's `screenMetrics` export for
      the mockup-measured values these screens need (the 20 px sample-push glyph at
      `index.html:1005`, the 62 px custom-time box at `index.html:1061`). The `theme` object itself
      is **not** touched, so `theme-tokens-parity.test.ts` stays green untouched.
- [ ] `apps/mobile/src/i18n/es.json` and `apps/mobile/src/i18n/en.json` — the keys in the
      **Catalogue keys** section, added to both catalogues in the same change.
- [ ] `scripts/mobile-ui/fidelity-targets.json` — flip this item's seven mappings from `planned` to
      `wired` (Resolution R2). Exact values in Decision 18.

### Infrastructure / Configuration

- [ ] `apps/mobile/package.json` — add `expo-notifications` via `npx expo install expo-notifications`
      (do not hand-pin; the SDK-54 line is `0.32.x`, Verification Log). Record the resolved range in
      the PR body.
- [ ] `apps/mobile/app.config.js` — **no `plugins` entry** (Decision 13). Autolinking provides the
      native module; the config plugin only customises the Android icon, colour and bundled sounds,
      none of which this item changes.
- [ ] `eslint.config.mjs` (root) — export a `notificationsBoundary` flat-config object
      (`no-restricted-imports` on `expo-notifications`), written the same way as the existing
      `dbAccessBoundary` (Decision 1).
- [ ] `apps/mobile/eslint.config.mjs` — apply `notificationsBoundary` to `app/**` and `src/**` with
      `src/lib/notifications/**` ignored, mirroring how `dbAccessBoundary` ignores `src/db/**`.
- [ ] `apps/mobile/jest.config.js` — **only if no earlier item has already done it**: add
      `'<rootDir>/src/features/**/*.db.test.ts'` to the `db` project's `testMatch` and
      `'\\.db\\.test\\.ts$'` to the `app` project's `testPathIgnorePatterns`, with item #12's exact
      contract (Decision 17).

No CI change. `pnpm lint`, `pnpm typecheck`, `pnpm test` and (contingently) `pnpm fidelity:contract`
already run on every PR.

---

## Catalogue keys

Flat, dotted `snake_case`, namespaced by screen, per
[`docs/best-practices/stack/i18n.md`](../../../best-practices/stack/i18n.md). The Spanish string is
copied from the mockup; the English string is a translation. Both catalogues receive the same key
set (`catalogue-parity.test.ts` enforces it).

| Key | `es` (from the mockup) | Mockup source |
| --- | --- | --- |
| `notifications_intro.eyebrow` | `Paso 2` | `index.html:996` |
| `notifications_intro.title` | `Activar notificaciones` | `index.html:997` |
| `notifications_intro.body` | `A partir de ahora recibirás pequeños desafíos para tomar control de tus finanzas poco a poco.` | `index.html:998` |
| `notifications_intro.sample_caption` | `Recibirás notificaciones como esta:` | `index.html:1002` (the leading `📱` is a glyph constant) |
| `notifications_intro.sample_app_name` | `Finanzas` | `index.html:1008` |
| `notifications_intro.sample_time` | `ahora` | `index.html:1009` |
| `notifications_intro.sample_title` | `Desafío diario:` | `index.html:1011` (the leading `💰` is a glyph constant) |
| `notifications_intro.sample_body` | `categoriza tu gasto en café de hoy. Toca para comenzar.` | `index.html:1011` |
| `notifications_intro.denied_note` | `Las notificaciones están bloqueadas para esta app. Puedes habilitarlas en los ajustes del teléfono cuando quieras.` | `index.html:1019` |
| `notifications_intro.cta_enable` | `Habilitar notificaciones` | `index.html:1023` |
| `notifications_intro.cta_later` | `Tal vez después` | `index.html:1024` |
| `notifications_intro.cta_continue_without` | `Continuar sin notificaciones` | `index.html:1027` |
| `notifications_schedule.title` | `Recordatorios` | `index.html:1036` |
| `notifications_schedule.time_title` | `¿Cuándo te funciona mejor?` | `index.html:1041` (leading `⏰` is a glyph constant) |
| `notifications_schedule.time_body` | `Elige la hora en que te gustaría recibir tus desafíos.` | `index.html:1043` |
| `notifications_schedule.days_title` | `¿Qué días?` | `index.html:1042` (leading `📅` is a glyph constant) |
| `notifications_schedule.days_body` | `Selecciona los días en que quieres recibir desafíos.` | `index.html:1044` |
| `notifications_schedule.preset_custom` | `Personalizada` | `index.html:1054` |
| `notifications_schedule.custom_label` | `Hora personalizada` | `index.html:1059` |
| `notifications_schedule.meridiem_am` | `AM` | `index.html:1065` |
| `notifications_schedule.meridiem_pm` | `PM` | `index.html:1066` |
| `notifications_schedule.weekdays_only` | `Solo días laborales` | `index.html:1080` |
| `notifications_schedule.cta` | `Continuar` | `index.html:1083-1084` |
| `settings_notifications.title` | `Recordatorios` | `index.html:2352` |
| `settings_notifications.toggle_label` | `Recordatorios activados` | `index.html:2357` |
| `settings_notifications.blocked_note` | `Las notificaciones están bloqueadas en los ajustes del sistema.` | `index.html:2362` |
| `settings_notifications.open_settings` | `Abrir ajustes del teléfono` | `index.html:2362` |
| `settings_notifications.time_section` | `Hora del desafío` | `index.html:2366` |
| `settings_notifications.days_section` | `Días` | `index.html:2374` |
| `settings_notifications.preset_morning` | `Mañana` | `index.html:2368` |
| `settings_notifications.preset_afternoon` | `Tarde` | `index.html:2369` |
| `settings_notifications.preset_evening` | `Noche` | `index.html:2370` |
| `settings_notifications.preset_custom` | `Hora personalizada` | `index.html:2371` |
| `settings_notifications.cta_save` | `Guardar` | `index.html:2384` |
| `reminders.notification_title` | `Desafío diario` | `index.html:1011`, with the trailing colon dropped — a notification title is not a sentence opener |
| `reminders.notification_body` | `Categoriza tus gastos de hoy. Toca para comenzar.` | **derived** — Assumption A6 |
| `reminders.channel_name` | `Recordatorios` | `index.html:2352` — the Android channel name the person sees in the OS settings |

Reused from item #8, **not** redefined here: `reminders.day_1` … `reminders.day_7`,
`reminders.days_weekdays`, `reminders.days_everyday`, `reminders.summary`. If item #8 has landed they
already exist; the parity test proves it either way. Preset time labels (`7:00 AM`, `9:00 AM`,
`12:00 PM`, `6:00 PM`, `8:00 PM`, `2:00 PM`) are **not** catalogue entries — they are produced by
`formatWallClockLabel(preset.timeOfDay)` (item #8, Decision 9), which is why the two preset tables can
differ without duplicating copy.

Decorative glyphs (`📱 💰 ⏰ 📅 📵 🌅 ☀️ 🕛 🌆 🌙 ⚙️`) are module-level named constants in the file
that renders them, per item #34's Decision 10 and item #8's Decision 11 — never catalogue entries.

---

## Decisions

### Decision 1 — One port, one adapter, one boundary, enforced twice

`expo-notifications` is imported by exactly one file,
`src/lib/notifications/expo-notifications.adapter.ts`. Everything else — screens, hooks, the planner,
every test — talks to `NotificationsPort`. This is a direct copy of the shape item #9 uses for
`expo-secure-store` and item #3 uses for SQL, and it buys three things at once: the planner is
testable without a simulator, a future platform change is a one-file change, and the `jest-expo`
`app` project never has to mock a native module.

Enforcement mirrors `dbAccessBoundary` exactly:

```js
// Illustrative — adapt during implementation. Root eslint.config.mjs
export const notificationsBoundary = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['expo-notifications', 'expo-notifications/*'],
            message:
              'Only apps/mobile/src/lib/notifications/ may import expo-notifications. Screens and feature hooks use NotificationsPort instead.',
          },
        ],
      },
    ],
  },
};
```

plus `src/__tests__/notifications-boundary.test.ts`, a source scan that fails if a second importer
appears **or** if `requestPermission` is called from anywhere other than the two call sites named in
Decision 7 — the lint rule alone can be disabled inline, the test cannot be disabled quietly.

### Decision 2 — Rescheduling is cancel-owned-then-schedule over deterministic identifiers

Acceptance criterion: *"Changing the schedule reschedules rather than duplicating notifications."*
The mechanism that enforces it has two halves:

1. **Deterministic identifiers.** `scheduleNotificationAsync` accepts an optional `identifier`
   (Verification Log). The app derives it from the trigger, never from a counter or a random value:
   `finanzas-reminder-w<isoWeekday>` for a weekly trigger, `finanzas-reminder-daily` for the daily
   one. The same logical reminder therefore always has the same id.
2. **Cancel every owned id first.** `applyReminderSchedule` reads
   `listScheduledIdentifiers()`, cancels **all** ids starting with `REMINDER_ID_PREFIX`, and only
   then schedules the plan.

**Rejected**: diffing the plan against what is scheduled and only touching the difference. A weekly
id survives a time change (`w1` is still `w1` when 09:00 becomes 20:00), so a diff keyed on the
identifier would leave the old trigger in place — the exact duplication the criterion forbids. With
at most seven registrations, the cost of the simple form is irrelevant and its correctness is
obvious.

Identifiers not carrying the prefix are never cancelled, so this item cannot delete another
feature's notifications; today it owns all of them, and that will not always be true.

### Decision 3 — The recurrence shape is a reversible default, because the mockup does not draw it

Nothing in the mockups or `BEHAVIOR.md` says whether "every day" should be seven weekly triggers or
one daily trigger. Both are legal, both are observably identical to the person, and the choice has
real consequences at the platform level (iOS caps pending local notifications at 64; a daily trigger
survives a device timezone change differently from seven weekly ones).

**Default: `weekly-per-day`** — one `WEEKLY` trigger per selected ISO day, always, including when all
seven are selected. One code path, one cancellation rule, one identifier scheme, and the day set is
recoverable by reading the scheduled ids.

The alternative is not deleted, it is a constant:

```ts
// Illustrative — adapt during implementation. src/features/reminders/constants.ts
export type TriggerStrategy = 'weekly-per-day' | 'daily-when-every-day';

/** Reversible default (plan Decision 3). `daily-when-every-day` collapses a seven-day selection
 *  into a single DAILY trigger; every other selection is identical under both strategies. */
export const REMINDER_TRIGGER_STRATEGY: TriggerStrategy = 'weekly-per-day';
```

`planReminderSchedule` implements **both** and takes the strategy as an optional argument defaulting
to the constant, and the Testing Strategy covers both branches. Reversing the decision is a one-line
change with tests already in place, not a rewrite.

### Decision 4 — ISO weekdays in the domain, platform weekdays only inside the adapter

Item #8's Decision 8 fixed `reminder_days` as ISO weekday integers, `1 = Monday … 7 = Sunday`. The
published `WeeklyTriggerInput` typing says the platform numbers weekdays `1 = Sunday … 7 = Saturday`.
These disagree, and the disagreement is exactly the kind of off-by-one that ships a reminder on the
wrong day.

**Decision**: the port speaks ISO. The conversion lives in the adapter and nowhere else:

```ts
// Illustrative — adapt during implementation.
/** ISO 1 = Monday … 7 = Sunday  →  platform 1 = Sunday … 7 = Saturday. */
const toPlatformWeekday = (iso: IsoWeekday): number => (iso % 7) + 1;
```

`adapter-weekday-mapping.test.ts` pins all seven pairs explicitly rather than re-deriving the formula
in the assertion, and the runbook's step 5 verifies one real day end-to-end on a device, because a
unit test cannot prove the platform's own numbering.

### Decision 5 — Two truths: stored intent and live OS permission. The OS wins

`BEHAVIOR.md` → `settings-notifications`: *"settings + permiso del OS (si el OS lo revocó, manda el
OS y se muestra `disabled`)"*.

| Source | Where it lives | Who writes it |
| --- | --- | --- |
| Intent | `app_settings.reminder_enabled` (plus `reminder_time`, `reminder_days`) | this item |
| Permission | the OS, read live through `NotificationsPort.getPermission()` | the OS |

Effective state is the conjunction: reminders are scheduled only when intent is on **and** the
permission is `granted`. The permission is **never persisted** — a cached copy is a copy that goes
stale the moment the person changes it in the OS settings, and it would be a second source of truth
for something the platform already answers authoritatively in a single call.

When the permission is lost while intent is on, the stored intent is deliberately **not** rewritten:
the person did not change their mind, the OS changed the answer. Re-granting the permission
therefore restores their schedule instead of making them re-enter it. `saveReminders` returns
`{ status: 'permission-lost' }` so the screen renders the OS-blocked frame rather than silently
succeeding.

### Decision 6 — "Tal vez después" goes to `onboarding-ready`, not to the `denied` state

The mockup's button carries `onclick="go('notifications-intro','denied')"` (`index.html:1024`).
That is the mockup navigating its own state gallery so a reviewer can see the `denied` frame — it is
not a behavioural claim, and the mockup has no OS to ask. `BEHAVIOR.md` is unambiguous:
*"Omitir → `onboarding-ready` (recordatorios nunca bloquean, espíritu de BR6)"*.

**Decision**: "Tal vez después" writes `reminder_enabled: false`, cancels any owned scheduled
notifications (there are none on a first run, but the call is idempotent and this path is also
reachable on re-entry), and `router.replace`s to `/(onboarding)/ready`. The `denied` state is
reached the only way it can honestly be reached: the OS answered `denied`.

### Decision 7 — The permission is requested from two explicit user actions and nowhere else

Acceptance criterion: *"Permission is requested at `notifications-intro`, never on launch."*

The call graph is fixed, in two layers, so "nowhere else" is a checkable statement rather than a
promise:

| Symbol | Allowed call sites |
| --- | --- |
| `NotificationsPort.requestPermission()` | exactly one: `src/features/reminders/use-notification-permission.ts` |
| the hook's returned `request()` | exactly two: the `notifications-intro` **Habilitar notificaciones** press (`app/(onboarding)/notifications/index.tsx`) and the `settings-notifications` toggle turning on while the permission is `undetermined` (`app/settings/notifications.tsx`) |

Both rows are asserted by `notifications-boundary.test.ts`'s scan. There is **no** launch hook,
**no** `useEffect` that requests on mount (the hook *reads* the permission on mount; reading never
prompts), and this item adds nothing to `app/index.tsx`.

A consequence worth stating: because there is no launch-time re-sync, a schedule that the OS dropped
(app reinstall, restore from backup) is re-established the next time the person opens
`settings-notifications`, not automatically at launch. This is deliberate — a launch hook would
touch item #8's entry point and would run a native call on every cold start for a case that is rare
and self-healing. It is Assumption A8 and a reported follow-up.

### Decision 8 — Every screen derives one `viewState`; the fidelity preview overrides it in `__DEV__`

Each screen has exactly one state variable, produced by a pure resolver over real inputs:

| Screen | Resolver | States (manifest order) |
| --- | --- | --- |
| `notifications-intro` | `resolveIntroState(permission)` | `default`, `denied` |
| `notifications-schedule` | `resolveScheduleStep(step, selection)` | `time`, `custom-time`, `days` |
| `settings-notifications` | `resolveSettingsState(enabled, permission)` | `enabled`, `disabled` |

`useFidelityPreview()` (item #47, verified signature) returns `{ active, state }` and is inert
outside `__DEV__`. Each screen renders `preview.active ? (preview.state ?? derived) : derived`, so a
capture can reach `denied` and `disabled` without revoking a real OS permission, and a release build
cannot reach the override at all.

`VIEW_STATES` for each screen is exported from `view-state.ts` and asserted against the manifest by
`view-state-manifest-parity.test.ts`, which is what makes "every declared state is implemented"
mechanical instead of a promise.

### Decision 9 — Two preset tables, drawn verbatim; the stored value is a time, not a preset

The two screens draw **different** preset sets, and both are part of the UI contract:

| Screen | Presets drawn | Source |
| --- | --- | --- |
| `notifications-schedule` | `7:00 AM`, `9:00 AM` *(selected)*, `12:00 PM`, `6:00 PM`, `8:00 PM`, `Personalizada` | `index.html:1048-1055` |
| `settings-notifications` | `Mañana 9:00 AM`, `Tarde 2:00 PM`, `Noche 8:00 PM`, `Hora personalizada 7:30 PM` *(selected)* | `index.html:2368-2371` |

**Decision**: keep both, verbatim, in `presets.ts`. What is persisted is only `reminder_time` as
`"HH:mm"`; which preset appears selected is **derived** at render time by
`resolvePresetSelection(timeOfDay, presets)`, which returns `custom` when no preset matches. So a
time chosen from the onboarding chips (say `18:00`) correctly shows as *Hora personalizada · 6:00 PM*
in settings, and no migration is needed if a preset label ever changes.

Storing a preset id instead was rejected: the two tables would then need a shared id space they do
not have, and a custom time would need a second key anyway.

### Decision 10 — The custom-time editor is a screen-local composition, not a native picker

The `custom-time` state draws two boxes and an AM/PM segment (`index.html:1058-1069`). It draws no
keypad, no wheel and no stepper, so the interaction is not specified.

Rejected alternatives, with reasons:

- **`@react-native-community/datetimepicker`** — a new native module, a new prebuild, and a platform
  widget that looks nothing like the drawn card. The whole point of the mockup contract is that the
  screen looks like the drawing.
- **Promoting `mu-otp__box` to a primitive** — `MU_CLASS_MAP` defers those classes to #7 (sign-in,
  out of the MVP). Promoting them here would make this item own a design-system decision for a
  screen it does not build.

**Decision**: `CustomTimeCard.tsx` composes two numeric `TextInput`s styled from
`screenMetrics.reminders` (62 px, mirroring `index.html:1061`) and the existing `Segment` primitive
for AM/PM, converting through the verified `wallClockParts` / `timeOfDayFromParts` pair. Input is
clamped in the pure converter (hour 1-12, minute 0-59), not in the component, so the clamping is unit
tested. `MU_CLASS_MAP` is not touched.

### Decision 11 — The `disabled` frame covers both reasons; the system note appears for only one

`settings-notifications` can be "not enabled" for two different reasons, and the mockup draws one
frame with one warning note bound to the `disabled` state (`index.html:2360-2363`).

| Situation | Switch | System note | Schedule editor |
| --- | --- | --- | --- |
| Intent on, permission `granted` | on | hidden | shown (`enabled`) |
| Intent off, permission `granted` | off | **hidden** | hidden |
| Permission `denied`, any intent | off | **shown**, with "Abrir ajustes del teléfono" | hidden |

Both "off" rows render the manifest's `disabled` frame; only the OS-blocked row shows the note,
because the note's own text says the block is in the system settings and that would be false in the
other row. Inventing a second, softer note would mean writing Spanish copy that is not in the
mockup, which non-negotiable 8 forbids. This is Assumption A4.

When the permission is `denied`, the switch is rendered **non-interactive** (no `onValueChange` — the
`Switch` primitive already supports that exact prop shape) because turning it on cannot succeed:
`canAskAgain` is false once the person has denied at the OS level, and the only real action is the
note's "Abrir ajustes del teléfono".

### Decision 12 — Notification copy is composed at schedule time from the catalogue

A local notification's text is fixed when it is scheduled, not when it fires — so the strings are
read once, in `reminderContent()`, through the `i18n` instance the app already initialises
(Verification Log). Consequences, stated rather than discovered later:

- The drawn sample body names a specific merchant (*"tu gasto en café de hoy"*). That is sample data
  in the same sense as the mockup's `Banco de Chile · 3 productos`; the app cannot know at schedule
  time what the person will spend on. The scheduled body is the generic derivation in the catalogue
  table above (Assumption A6). The **drawn** string stays exactly as drawn inside the
  `notifications-intro` sample card, which is a picture of a notification, not a notification.
- A device language change after scheduling leaves already-registered notifications in the previous
  language until the next save. Rescheduling on locale change is a reported follow-up, not silent
  behaviour.

### Decision 13 — The Android channel is created at runtime; no config-plugin entry

`app.config.js` gains **no** `expo-notifications` plugin entry. Autolinking provides the native
module; the config plugin exists to customise the Android small icon, accent colour and bundled
sounds, and this item changes none of them (the mockup's sample push shows the default app icon).

The adapter calls `setNotificationChannelAsync(REMINDER_CHANNEL_ID, …)` with
`AndroidImportance.DEFAULT` and the `reminders.channel_name` catalogue string before its first
`schedule()`, guarded by a module-level "already prepared" flag so it runs once per process. Every
scheduled trigger carries `channelId: REMINDER_CHANNEL_ID`. Without a channel, Android 8+ silently
downgrades or drops the notification.

### Decision 14 — Foreground behaviour: banner and list, no sound, no badge

`setNotificationHandler` decides what happens when a reminder fires while the app is open. The
mockups draw a notification in the OS shade and say nothing about the foreground case, and BR6's
"nunca castiga" spirit argues against interrupting someone who is already using the app.

```ts
// Illustrative — adapt during implementation. src/features/reminders/constants.ts
/** Reversible default (plan Decision 14). */
export const FOREGROUND_BEHAVIOR = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: false,
  shouldSetBadge: false,
} as const;
```

`shouldShowAlert` is deliberately **not** set: the published typings mark it deprecated in favour of
the two `shouldShow*` fields.

### Decision 15 — A reminder tap routes to `/categorize/intro`, from a single root-level hook

`BEHAVIOR.md` → `stage-intro`: *"**Entrada:** desde `onboarding-ready`, desde el CTA de pendientes en
`home`, o desde un recordatorio local."* A reminder that opens the app on a random screen would make
that line false and the feature pointless.

`useReminderTapRouting()` is called once from `app/_layout.tsx` and does two things: registers
`addNotificationResponseReceivedListener` for warm taps, and reads `getLastNotificationResponse()`
once on mount for the cold-start tap. It routes only when the response's `identifier` carries
`REMINDER_ID_PREFIX`, and it never routes during onboarding (a person mid-onboarding who taps an old
reminder should not be thrown into categorisation) — the guard is the current pathname, which the
router already exposes.

The listener is removed in the effect's cleanup. See the concurrency addendum for the duplicate-tap
and cold-start-plus-listener cases.

### Decision 16 — Explicitly out of scope

- **Remote push of any kind** — no token, no `getExpoPushTokenAsync`, no server. BR0 and the product's
  defining constraint. The adapter deliberately exposes no token method, so there is nothing to call.
- **Notification content derived from real data** (the drawn *"tu gasto en café"*) — impossible at
  schedule time; a follow-up if a fire-time content hook is ever added.
- **Badge counts, snooze actions, notification categories/actions** — none are drawn.
- **A launch-time schedule re-sync** (Decision 7, Assumption A8).
- **Rescheduling on device-locale change** (Decision 12).
- **The `home` challenge hero and `stage-intro` itself** (#12, #13) — this item only routes to
  `/categorize/intro`.
- **`bank-connected`** (#9), the screen that navigates into `notifications-intro`. This item does not
  edit that file; the seam already exists in the placeholder.

### Decision 17 — Test tiers follow the established convention

| Kind of test | Jest project | File suffix | Why |
| --- | --- | --- | --- |
| Pure planner, presets, view-state, weekday mapping, manifest parity, catalogue scan | `app` | `*.test.ts` | No React renderer is installed (item #8, Decision 14) and none is needed — every one of these is a pure function or a static scan |
| `saveReminders` over a real in-memory store plus the memory port | `db` | `save-reminders.db.test.ts` | Item #12 established `.db.test.ts` under `src/features/` as the routing convention to the Node/`better-sqlite3` project |
| Import-boundary and permission-call-site scan | `app` | `notifications-boundary.test.ts` | Mirrors `db-access-boundary.test.ts`, with the extra `requestPermission` call-site assertion that makes AC1 mechanical |

No test imports `expo-notifications`; the memory port is what every test uses (Decision 1).

### Decision 18 — The fidelity flip, exactly

Contingent on Resolution R2. Each of the seven mappings loses nothing and gains three fields:

| `screen_id` | `state_id` | `app_file` | `deep_link` | `ready_test_id` |
| --- | --- | --- | --- | --- |
| `notifications-intro` | `default` | `apps/mobile/app/(onboarding)/notifications/index.tsx` | `finanzas:///notifications?fidelity=1&fidelityScreen=notifications-intro&fidelityState=default` | `fidelity-notifications-intro` |
| `notifications-intro` | `denied` | same | `…&fidelityState=denied` | same |
| `notifications-schedule` | `time` | `apps/mobile/app/(onboarding)/notifications/schedule.tsx` | `finanzas:///notifications/schedule?fidelity=1&fidelityScreen=notifications-schedule&fidelityState=time` | `fidelity-notifications-schedule` |
| `notifications-schedule` | `custom-time` | same | `…&fidelityState=custom-time` | same |
| `notifications-schedule` | `days` | same | `…&fidelityState=days` | same |
| `settings-notifications` | `enabled` | `apps/mobile/app/settings/notifications.tsx` | `finanzas:///settings/notifications?fidelity=1&fidelityScreen=settings-notifications&fidelityState=enabled` | `fidelity-settings-notifications` |
| `settings-notifications` | `disabled` | same | `…&fidelityState=disabled` | same |

Two things the implementer must not get wrong:

1. **The selector must be in the route file named by `app_file`.** The validator reads that file and
   accepts either the literal `fidelity-<screen_id>` or a `fidelityTestId('<screen_id>')` call. Putting
   the `testID` on a component inside `src/features/reminders/` and not in the route file fails
   validation even though the app behaves correctly.
2. **Expo Router group segments are not part of the URL.** `/(onboarding)/notifications` is expected
   to be reachable as `finanzas:///notifications`, not `finanzas:///(onboarding)/notifications`.
   This is framework behaviour that no file in this repository asserts, so it is **unverified — the
   implementer must confirm it before the flip**. The contract validator only checks the query
   parameters, so a wrong path fails later, at capture time, with a confusing blank screenshot.
   Implementation Order step 8 opens each of the seven links on a dev build and records the result
   **before** the flip is committed.

No `max_mismatch_pct` override is proposed: none of these screens draws a chart or an animation, so
the 3.0 default should hold. If a capture exceeds it, the fix is the screen, not the threshold
(item #47, Decision 4).

### Decision 19 — File surface, stated for lane serialisation

This item touches two feature folders that other in-flight items also touch. The complete list of
files it modifies outside its own new folders:

| Shared file | Also owned / touched by | Nature of this item's edit |
| --- | --- | --- |
| `apps/mobile/app/(onboarding)/notifications/index.tsx`, `…/schedule.tsx` | nobody else — declared out of scope by #8 (Decision 16) and #9 | full replacement of the placeholder |
| `apps/mobile/app/settings/notifications.tsx` | nobody else — declared "navigation seam only" by #19 (Decision 14) | full replacement of the placeholder |
| `apps/mobile/app/_layout.tsx` | #8 (which states it expects no change) | two lines: import and call `useReminderTapRouting()` |
| `apps/mobile/src/db/repositories/settings.ts` | #8 adds readers here | appends one exported function |
| `apps/mobile/src/features/reminders/` | #8 creates `summary.ts` here | adds sibling files; does not edit `summary.ts` |
| `apps/mobile/src/theme.ts` | #8 creates `screenMetrics`; #19 adds a `settings` group | adds a `reminders` group |
| `apps/mobile/src/i18n/es.json`, `en.json` | every screen item | appends its own namespaces |
| `packages/shared-utils/src/dates.ts` | #8 adds `formatWallClockLabel`; #19 adds `formatLongMonthYear` | appends two functions |
| `eslint.config.mjs`, `apps/mobile/eslint.config.mjs` | #9 adds `secureStoreBoundary` | appends a third boundary object |
| `apps/mobile/jest.config.js` | #9, #12, #19 may add the same lines | conditional, idempotent |
| `scripts/mobile-ui/fidelity-targets.json` | every screen item flips its own targets | flips seven mappings |

None of these is a rename or a deletion, so a merge conflict is textual and local. The item cannot be
implemented before #8 (Resolution R1) regardless of lane ordering.

---

## Assumptions

Every item below is a 🟡-derived or gap-derived choice made without a human in the loop. Each names
the evidence it rests on. None blocks implementation.

| # | Assumption | Evidence and rationale |
| --- | --- | --- |
| A1 | `settings-notifications` is in scope for this item | Issue #18's recorded scope comment names #18 as the owner, and item #47's merged coverage table already assigns all seven targets to #18. The issue **body** does not mention the screen, which is why this is recorded as an assumption rather than a quotation |
| A2 | The default schedule is 09:00 on Monday-Friday | `index.html:1049` draws the `9:00 AM` chip `is-selected`, and `index.html:1072-1078` draws Monday-Friday checked and the weekend unchecked. Also consistent with `index.html:2208`'s hub subtitle *«9:00 AM · días laborales»* |
| A3 | "Tal vez después" leaves onboarding rather than showing the `denied` frame | `BEHAVIOR.md` says *"Omitir → `onboarding-ready`"*; the mockup's `onclick` is a state-gallery link — Decision 6 |
| A4 | Intent-off with permission granted renders the `disabled` frame **without** the system note | The note's own text asserts a system-level block, which would be false; no other note is drawn — Decision 11 |
| A5 | The recurrence shape is seven weekly triggers rather than one daily trigger when every day is selected | Not drawn anywhere. Reversible via `REMINDER_TRIGGER_STRATEGY`, with both branches implemented and tested — Decision 3 |
| A6 | `reminders.notification_body` = `Categoriza tus gastos de hoy. Toca para comenzar.` | The drawn body names a sample merchant that cannot exist at schedule time. This is the one string in this plan not transcribed from the mockup; it keeps the drawn verb, the drawn closing sentence and the drawn tone. Flagged for LH to draw or replace, exactly as item #8 flagged `reminders.days_everyday` |
| A7 | A reminder tap opens `/categorize/intro` | `BEHAVIOR.md` → `stage-intro` lists *"desde un recordatorio local"* as an entry point — Decision 15 |
| A8 | No launch-time re-sync of the OS schedule | Nothing requires it; the OS persists scheduled notifications across launches, and the rare loss cases self-heal on the next save. Avoids a native call on every cold start and keeps item #8's entry point untouched — Decision 7 |
| A9 | The default Android notification icon and accent colour are acceptable | The mockup's sample push draws the app icon with no custom badge, and no colour is specified for it anywhere — Decision 13 |
| A10 | Custom minutes are free-form (0-59), not snapped to a 5-minute grid | The mockup draws `08 : 30`, which is consistent with both; free-form is the smaller assumption and the clamp is unit tested — Decision 10 |
| A11 | The two screens' different preset sets are intentional, not a mockup inconsistency | Both are drawn, and the manifest treats them as separate screens with separate states. Storing a time rather than a preset id makes the difference harmless — Decision 9 |

A1, A5 and A6 are the ones a human should confirm at review; each is paired with either a
documentation update or a reported follow-up so the confirmation lands somewhere durable.

---

## Testing Strategy

**Test types**: Unit (`app` and `db` Jest projects, plus the `shared-utils` package) + Smoke (manual,
on a dev build) + the design-fidelity gate when Resolution R2 applies.

**Key scenarios**:

1. **Permission is never requested on launch** (AC1) — the scan proves `expo-notifications` has
   exactly one importer, that `NotificationsPort.requestPermission()` is called only from
   `use-notification-permission.ts`, and that the hook's `request()` is called only from the two
   screen files named in Decision 7's table.
   *(`apps/mobile/src/__tests__/notifications-boundary.test.ts`)*
2. **Denial is a state, not an error** (AC2) — `resolveIntroState('denied')` is `'denied'`,
   `resolveIntroState('undetermined')` and `resolveIntroState('granted')` are `'default'`; no branch
   throws. *(`src/features/reminders/__tests__/view-state.test.ts`)*
3. **The planner schedules exactly the selected days at the selected time** (AC3) — Monday-Friday at
   `09:00` yields five requests with identifiers `finanzas-reminder-w1…w5`, each a `weekly` trigger
   with `hour: 9, minute: 0`; the output is sorted and stable across two calls.
   *(`__tests__/schedule-plan.test.ts`)*
4. **The planner returns nothing when it must not schedule** (AC1, AC2, Decision 5) — intent off;
   permission `denied`; permission `undetermined`; empty day set. Four cases, all `[]`. *(same file)*
5. **Both recurrence strategies are correct** (Decision 3) — all seven days under `weekly-per-day`
   yields seven weekly requests; under `daily-when-every-day` it yields one `finanzas-reminder-daily`;
   a six-day selection yields six weekly requests under **both**. *(same file)*
6. **Rescheduling converges rather than duplicating** (AC4, Decision 2) — against the memory port:
   apply plan A, apply plan A again, then apply plan B. Assert the identifier set after each step,
   assert that no identifier appears twice, and assert from the call log that every cancel precedes
   every schedule. *(`__tests__/apply-schedule.test.ts`)*
7. **Foreign identifiers survive** (Decision 2) — the port is pre-loaded with
   `some-other-feature-1`; after applying a plan it is still present. *(same file)*
8. **ISO-to-platform weekday mapping** (Decision 4) — all seven pairs pinned explicitly:
   `1→2, 2→3, 3→4, 4→5, 5→6, 6→7, 7→1`.
   *(`src/lib/notifications/__tests__/adapter-weekday-mapping.test.ts`)*
9. **Saving writes the settings and applies the schedule, in that order** (AC3, AC4) — against
   `openBootstrappedMemoryDb()` plus the memory port: after `saveReminders`, `readReminderSettings`
   returns the normalised values (days sorted and de-duplicated, time zero-padded) **and** the port
   holds the planned identifier set. A second identical save leaves both unchanged.
   *(`src/features/reminders/save-reminders.db.test.ts`)*
10. **A revoked permission is reported, not swallowed** (Decision 5) — with the memory port set to
    `denied`, `saveReminders` returns `{ status: 'permission-lost' }`, the stored intent is
    **unchanged**, and nothing is scheduled. *(same file)*
11. **Preset selection is derived correctly** (Decision 9) — `09:00` selects the morning preset in
    both tables; `18:00` selects the `6:00 PM` chip in the onboarding table and `custom` in the
    settings table; `19:30` is `custom` in both. *(`__tests__/presets.test.ts`)*
12. **The custom-time converters round-trip and clamp** (Decision 10) — `"00:30"`, `"12:00"`,
    `"09:05"`, `"23:59"` round-trip; hour 13 and minute 60 clamp to the documented bounds.
    *(`packages/shared-utils/src/dates.test.ts`)*
13. **Every declared manifest state is implemented** (non-negotiable 6) — each screen's `VIEW_STATES`
    tuple deep-equals the manifest's declared state ids, in order.
    *(`__tests__/view-state-manifest-parity.test.ts`)*
14. **All screen copy comes from the catalogue** (non-negotiable 8) — the catalogue-key scan over the
    three route files and the feature folder, asserting every `t('…')` key exists in `es.json` and
    that no dynamic key is used. *(`__tests__/reminders-catalogue-keys.test.ts`)*
15. **Existing guards still pass untouched** — `route-manifest-parity` (no route file is added),
    `theme-tokens-parity` (`theme` itself is untouched), `mu-class-coverage` (the map is untouched),
    `catalogue-parity`, `no-style-literals`, `no-naked-text`, `touch-targets`, `db-access-boundary`.
    Needing to edit any of them is a signal that a decision above was violated.

**Smoke test runbook**:
[`docs/testing/mobile/18-notifications-local-reminders.smoke-test.md`](../../../testing/mobile/18-notifications-local-reminders.smoke-test.md)

**Regression suite**: the repository has no automated regression suite yet (Maestro flows are item
#22). No regression spec is added here; the runbook's steps are written so #22 can lift them.

### Parser-risk addendum

**Not applicable.** No file under `scripts/lint/` or `scripts/parse/` changes; no module named for
lint, parser, scanner or tokenizer responsibilities is added; no regex-heavy or structured-text
scanning behaviour is introduced. The boundary and catalogue scans reuse merged helpers
(`src/test-utils/catalogue-key-scan`, the `db-access-boundary` scan shape) without modifying them.

### Concurrent-event-source addendum

**Classification: applicable.** This item registers a notification-response listener and an
`AppState` listener, runs an async write-then-schedule sequence that a second user press can re-enter,
and reads a cold-start notification response that races with listener registration.

- **Shared mutable state guards**: three pieces of state cross execution contexts. (a) The memoized
  database handle — owned by item #8's `src/db/runtime.ts`, a write-once module promise; this item
  only reads it. (b) The adapter's "channel prepared" flag and installed foreground handler —
  set once behind a module-level promise, so concurrent first calls share one preparation rather than
  racing two channel creations. (c) The OS's own scheduled-notification set — the only writer is
  `applyReminderSchedule`, and Decision 2's cancel-then-schedule sequence is serialised by the
  in-flight guard below, so two saves can never interleave a cancel between another save's cancel and
  schedule.
- **Re-entrancy / in-flight tracking**: yes, on both save paths — a double tap on **Guardar** or on
  **Continuar** can fire before the first `saveReminders` resolves. `use-reminder-settings.ts` holds a
  `useRef<Promise | null>` in-flight handle: a second call while one is in flight returns the same
  promise rather than starting a second write-and-schedule. The underlying write is idempotent
  regardless (`onConflictDoUpdate`), so the guard protects the *scheduling* sequence, which is the
  part that is not naturally serialisable.
- **Event deduplication**: two cases. (a) A cold-start tap is visible **both** through
  `getLastNotificationResponse()` and, on some platforms, through the listener that is registered
  moments later. The hook records the handled response's notification `identifier` plus its
  `date` in a ref and ignores a repeat, so the person is routed once. (b) `AppState` emits `'active'`
  on transitions that are not real foregrounds (a permission dialog dismissing, for instance); the
  permission refresh is idempotent and only calls `setState` when the value actually changed, so a
  duplicate is a no-op rather than a re-render loop.
- **Listener and resource cleanup**: `useReminderTapRouting` removes its `EventSubscription` in the
  effect cleanup; `use-notification-permission` removes its `AppState` subscription the same way.
  Neither creates a timer. In-flight `saveReminders` work is not cancellable — the OS calls are
  already issued — so instead the resolution is dropped through a `cancelled` flag checked before
  every `setState`, leaving the OS in the consistent state the sequence intended.
- **Race conditions at initialization**: a reminder can be tapped before `app/_layout.tsx` has
  mounted (cold start). That is exactly why `getLastNotificationResponse()` is read on mount in
  addition to registering the listener — the response the app missed is still available. A tap that
  arrives before `getAppDatabase()` resolves does not need the database at all: routing to
  `/categorize/intro` is a pure navigation.
- **Race conditions at teardown**: a response or an `AppState` event arriving after unmount is
  dropped by the cancellation flag rather than re-thrown; throwing from a cleaned-up effect would
  produce an unhandled rejection with no `ErrorBoundary` mounted to catch it. The app's root layout
  effectively never unmounts, so this is a defensive rule, not a routine path.
- **Error propagation across async boundaries**: a failing `getPermission()` resolves to
  `'undetermined'` with the error surfaced through the hook's `error` field — a permission read that
  throws must not make the settings screen unreachable. A failing `applyReminderSchedule` is **not**
  swallowed: `saveReminders` returns a failure result, the screen shows the OS-blocked frame or the
  unchanged state, and the settings write is not reported as successful. No `catch {}` without a
  result is written anywhere in this item.
- **New concurrent patterns**: none. The in-flight-ref, cancellation-flag and memoized-promise
  patterns all follow merged precedents (`src/db/bootstrap.ts`, item #8's plan).

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| — | **No new committed seed data.** The fixture item #3 ships (`apps/mobile/src/db/__fixtures__/store-v1.sql`) is unchanged, and `pnpm --filter @finanzas/mobile db:seed` must produce no diff | — |
| `app_settings` reminder keys | Test-only rows for scenarios 9 and 10: absent (fresh store), a complete record (`true` / `"09:00"` / `[1,2,3,4,5]`), an unsorted duplicated day list (`[5,1,1,3]`) to prove normalisation, and a malformed value to prove the defensive read | `apps/mobile/src/features/reminders/save-reminders.db.test.ts` |
| Memory notifications port | Permission `granted` / `denied` / `undetermined`; a pre-loaded foreign identifier `some-other-feature-1` for scenario 7 | `apps/mobile/src/lib/notifications/testing/memory-notifications.ts`, driven per test |
| Smoke-test data | Produced by using the app: the onboarding path needs a fresh install; the settings path needs the app past onboarding. No fixture load is required — reminders read no transaction data | — |

---

## Documentation Updates

To be executed by the developer during implementation, not now.

- [ ] `design/mockups/mobile/BEHAVIOR.md` — **required**. In `### notifications-intro`, promote the 🟡
      action line to validated and record that "Tal vez después" leaves to `onboarding-ready`
      (Decision 6). In `### notifications-schedule`, record that the stored value is a time, not a
      preset, and that the two screens draw different preset sets (Decision 9). In
      `### settings-notifications`, promote the 🟡 re-enable note to validated and add the two-reason
      `disabled` table from Decision 11.
- [ ] `docs/project/4-database-model.md` — in `### app_settings`, extend item #8's value-shape table
      with the normalisation this item performs on write (days sorted and de-duplicated, time
      zero-padded `"HH:mm"`), so a future reader knows the stored form is canonical.
- [ ] `docs/project/3-software-architecture.md` — add `expo-notifications` to the native-dependency
      list and record the port/adapter boundary as the third instance of the pattern (after SQL and
      secure store).
- [ ] `docs/best-practices/stack/expo-react-native.md` — add the notifications boundary to whatever
      list of "modules with a single sanctioned importer" that document keeps, alongside the SQL and
      secure-store boundaries. If the file does not yet name that list (it may still be describing
      TanStack Query — item #8 has an update queued for the same file), coordinate rather than
      revert #8's edit.
- [ ] `AGENTS.md` — add the `expo-notifications` boundary to the **Troubleshooting** table
      (symptom: *"a reminder fires twice / an old reminder still fires"* → cause: *"a write bypassed
      `applyReminderSchedule`; every schedule change goes through it"*). No other section needs
      changing: the repository structure and non-negotiables are still accurate.
- [ ] `docs/best-practices/stack/mobile-ui-fidelity.md` — no change if item #47 has already replaced
      its manual-check note. If #47 has not landed, leave it alone; it is #47's file.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Item #8 has not merged when this item is implemented | Med | High | Resolution R1: Implementation Order step 0 checks all six symbols and **stops**, returning to the parent orchestrator rather than inventing a second `getAppDatabase()` |
| The installed `expo-notifications` differs from the typings this plan read | Low | Med | Every symbol is listed in the API table with its published shape; Implementation Order step 1 re-reads the **installed** `.d.ts` files before any adapter code is written, and the plan names responsibilities and file owners rather than exact call signatures |
| The platform weekday numbering is not what the typings say | Low | High | Unit test 8 pins the mapping, and runbook step 5 fires a real reminder on a real day; a wrong mapping shows up as a reminder on the wrong day, which the runbook checks explicitly |
| A dev client built before this item lacks the native module | High | Med | Stated in the runbook's prerequisites: adding `expo-notifications` requires a **rebuilt** dev client, not a Metro reload. The symptom (a "native module missing" error) is in the troubleshooting table |
| iOS's pending-local-notification limit is approached | Low | Low | Apple documents a 64-pending limit for `UNUserNotificationCenter`; that figure is **unverified from this repository** and the implementer should not design around the exact number. What matters is bounded by construction: at most seven registrations exist at any time, and Decision 2 cancels before scheduling so the count cannot grow. Recorded because `weekly-per-day` is the strategy that consumes more slots (Decision 3) |
| A DST transition shifts the reminder by an hour | Low | Low | Platform weekly and daily triggers are wall-clock triggers, so they follow the device's local time through a transition. Chile's transitions are recorded in the runbook's known limitations rather than engineered around |
| Item #47 lands mid-flight and `pnpm fidelity:contract` fails on unflipped targets | Med | Low | Resolution R2 makes the flip conditional and checked at implementation start; the contract itself fails loudly and names the target |
| `ScreenTopBar` / `ListGroup` / `ListRow` arrive from #19 mid-flight, causing duplicated local compositions | Med | Low | Resolution R3: consume them if present, compose locally if not, record the choice in the PR body. `MU_CLASS_MAP` is untouched either way |
| A reminder tap during onboarding drops the person into categorisation | Low | Med | Decision 15's pathname guard; runbook step 7 exercises it |
| The generic notification body reads as a downgrade from the drawn sample | Med | Low | Assumption A6 and a reported follow-up: either the mockup gains a schedulable string, or fire-time content becomes a separate item |

---

## Implementation Order

0. **Re-verify the dependency surface (Resolution R1).** Confirm each of `getAppDatabase`
   (`src/db/runtime.ts`), `readReminderSettings` (`src/db/repositories/settings.ts`),
   `summarizeReminderDays` (`src/features/reminders/summary.ts`), `screenMetrics` (`src/theme.ts`),
   `formatWallClockLabel` (`packages/shared-utils/src/dates.ts`) and the `reminders.day_1…day_7`
   catalogue keys exists. Also record whether `scripts/mobile-ui/fidelity-targets.json` (R2) and
   `ScreenTopBar` / `ListGroup` / `ListRow` (R3) exist.
   *Verification*: paste the six existence checks and the two contingency answers into the PR body.
   If any of the six is missing, **stop and report** — do not create a second copy.
1. **Add and verify the dependency.** `npx expo install expo-notifications` from `apps/mobile`, then
   read the installed `node_modules/expo-notifications/build/*.d.ts` for every symbol in the API
   table. *Verification*: the resolved version range and any signature that differs from the plan's
   table are quoted in the PR body; `pnpm check:layout` still passes.
2. **Add the boundary.** `notificationsBoundary` in the root `eslint.config.mjs`, applied in
   `apps/mobile/eslint.config.mjs`, plus `src/__tests__/notifications-boundary.test.ts`.
   *Verification*: temporarily add an `expo-notifications` import to a screen, confirm both `pnpm
   lint` and the new test fail, then remove it.
3. **Build the port, the adapter and the memory double** — `src/lib/notifications/`. Write
   `adapter-weekday-mapping.test.ts` (scenario 8). *Verification*: `pnpm --filter @finanzas/mobile
   test` passes and `pnpm lint` reports the adapter as the only importer.
4. **Add the shared-utils converters** — `wallClockParts` / `timeOfDayFromParts` with their tests
   (scenario 12). *Verification*: `pnpm --filter @finanzas/shared-utils test` passes.
5. **Add the write-side repository function** — `writeReminderSettings` in
   `src/db/repositories/settings.ts`. *Verification*: the existing `db` project passes with no
   existing test edited.
6. **Build the pure feature modules** — `constants.ts`, `schedule-plan.ts`, `apply-schedule.ts`,
   `presets.ts`, `view-state.ts`, `reminder-content.ts`, `save-reminders.ts`, each with its tests
   (scenarios 2-7, 9-11, 13). *Verification*: both Jest projects pass, including the manifest-parity
   test.
7. **Add the catalogue keys** to `es.json` and `en.json` in one change, and the `reminders` group to
   `screenMetrics`. *Verification*: `catalogue-parity.test.ts` and `theme-tokens-parity.test.ts` pass.
8. **Build the three screens and the two hooks**, replacing the placeholders, and wire
   `useReminderTapRouting()` into `app/_layout.tsx`. Add each screen's `testID` through
   `fidelityTestId('<screen-id>')` **in the route file**. *Verification*: `pnpm lint` reports no
   `i18next/no-literal-string` and no `no-style-literals` violation; each of the seven deep links from
   Decision 18 opens the intended screen and state on a dev build (record the seven results).
9. **Flip the fidelity targets** (R2-contingent) in `scripts/mobile-ui/fidelity-targets.json`.
   *Verification*: `pnpm fidelity:contract` prints seven fewer `planned` targets and exits 0. Skip
   with a recorded note if the file does not exist.
10. **Compare against the mockup**, one `#screen=…&state=…` at a time, following
    [`docs/best-practices/stack/mobile-ui-fidelity.md`](../../../best-practices/stack/mobile-ui-fidelity.md).
    *Verification*: run the smoke runbook end to end and record the simulator, viewport and
    screenshot paths in the PR body.
11. **Run the full suite** — `pnpm lint && pnpm typecheck && pnpm test && pnpm check:layout`, plus
    `pnpm --filter @finanzas/mobile db:seed`. *Verification*: all green, and `git status` shows no
    change under `src/db/__fixtures__/`.
12. **Update the project docs** listed in **Documentation Updates** above.
13. **Update `CHANGELOG.md`** under `[Unreleased]` → `### Added`, using the project's
    `**Bold Title** (#N):` format. Add exactly this entry:

    ```markdown
    - **Notifications and local reminders** (#18): the onboarding flow now asks for the OS
      notification permission at `notifications-intro` (never at launch), treats a denial as a
      supported state with how-to-re-enable copy, and lets the person pick a time and the days of
      the week. Reminders are scheduled locally with `expo-notifications` behind a single adapter —
      no push token, no server — and saving a schedule cancels the app's own scheduled
      notifications before registering the new set, so changing it reschedules instead of
      duplicating. `/settings/notifications` shows and edits the same schedule, and reflects a
      revoked OS permission as disabled.
    ```

### Follow-ups to report, not implement

1. **`reminders.notification_body`** (Assumption A6) — the one string in this item not transcribed
   from the mockup. Either draw a schedulable notification body in the mockup or replace this one.
2. **Fire-time notification content** — the drawn sample names a merchant. A notification whose body
   is composed when it fires needs a background task, which is a separate item with its own
   privacy review.
3. **Rescheduling on device-locale change** (Decision 12) — today a language change leaves already
   scheduled reminders in the previous language until the next save.
4. **A launch-time schedule reconciliation** (Decision 7, Assumption A8) — worth doing if telemetry
   ever shows schedules being lost, which cannot be measured today because there is no telemetry and
   deliberately so.
5. **Quiet hours or a snooze action** — not drawn, not in the brief, but the first thing a person
   asks for after living with a daily reminder.
