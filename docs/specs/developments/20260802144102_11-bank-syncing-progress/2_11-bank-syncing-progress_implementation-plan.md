# Bank syncing progress screen — Implementation Plan

**Work item brief**: [issue #11](https://github.com/lhpaul/personal-finances/issues/11) — a
Refactor-type item, so there is no spec. The behaviour contract is
[`design/mockups/mobile/BEHAVIOR.md` → `bank-syncing`](../../../../design/mockups/mobile/BEHAVIOR.md)
and the drawing contract is `design/mockups/mobile/index.html#screen=bank-syncing`.
**Smoke test runbook**: [`11-bank-syncing-progress.smoke-test.md`](../../../testing/mobile/11-bank-syncing-progress.smoke-test.md)

---

## Summary

**Approach**: `#screen=bank-syncing` becomes the app's only WebView host. The route mounts
`@finanzas/bank-scraper`'s hidden `<WebView>` component, implements item #10's `ScraperRunner`
port over it, and calls item #10's `runSync(deps, request)` with the `ConnectHandoff` item #9
left in the connect-flow store — a keychain **key**, never a credential value. The scraper's
`onProgress({ stepId, progress })` callback is the only progress signal: a total map from the
five-value `ScraperStepId` onto the four manifest states drives the step list, the badges and
the bar, so the screen moves when the read moves rather than on a timer. The read outcome and
the connection row item #10 just wrote decide between the success CTA and the `error` state,
whose body copy comes from the four-value `FailureReasonCode` — a code, never a caught error's
message.

**Estimated complexity**: L

**Rationale**: one route, but it is the seam where four items meet (the scraper package, the
connect flow's secure-store port, the sync engine, and the fidelity gate), it is the first
`react-native-webview` mount in the app, it holds a plaintext credential in memory for the life
of a read, and its lifecycle races four independent event sources. The drawing itself is small;
the wiring, the teardown and the negative tests are not.

**Dependencies** (all must be **merged** before implementation starts):

| Item | What this item needs from it | Status at plan time |
| --- | --- | --- |
| #6 — bank scraper | `BankScraperComponent`, `BANK_CONFIGS`, `resolveBankConfigOrReject`, `ScraperStepId`, `ScrapeResult`, `FailureReasonCode` | Plan merged; implementation open in [PR #46](https://github.com/lhpaul/personal-finances/pull/46) |
| #8 — onboarding | `apps/mobile/src/db/runtime.ts` → `getAppDatabase()`; `(onboarding)/_layout.tsx` | Plan merged; implementation not started |
| #9 — connect a bank | `ConnectHandoff`, `SYNCING_ROUTE`, `SecureStorePort`, `readCredentials`, `credentialsKeyFor`, `resolveBackHref`, the connect-flow store | Plan merged; implementation not started |
| #10 — sync engine | `runSync`, `SyncDeps`, `SyncRequest`, `SyncRunResult`, `ScraperRunner`, `getConnection` | Plan merged; implementation not started |
| #12 — home screen | `Progress` gains `indeterminate?`; `.db.test.ts` Jest convention | Plan merged; implementation not started |
| #47 — fidelity gate | `scripts/mobile-ui/fidelity-targets.json`, `useFidelityPreview`, `fidelityTestId` | Implementation open in [PR #61](https://github.com/lhpaul/personal-finances/pull/61) |

This item is the **last** of that chain. Step 1 of the Implementation Order is a hard gate that
stops if any of them is still open.

---

## Verification Log

Every command was run inside the worktree
`/Users/lhpaul/Git/personal-finances/.claude/worktrees/item-11` on 2026-08-02, at repo revision
`09fb7dd` (`implementation-plan/11-bank-syncing-progress`, 0 ahead / 0 behind `origin/develop`).

| # | Check | Command / query | Result |
| --- | --- | --- | --- |
| V1 | Repo revision | `git rev-parse --short HEAD` | `09fb7dd`; `git rev-list --left-right --count origin/develop...HEAD` → `0 0` |
| V2 | The manifest states this screen must implement | `node -e "…indexOf(\"screen_id: 'bank-syncing',\\n      route:\")…"` over `design/mockups/mobile/mockup-manifest.js` | Exactly four: `login` (`initial: true`), `products`, `transactions`, `error`. `INVENTORY.md` line 25 agrees |
| V3 | The route today | `cat "apps/mobile/app/(onboarding)/bank-syncing.tsx"` | `RoutePlaceholder`, `screenId="bank-syncing"`, `next: /(onboarding)/bank-connected`. Item #9's plan states it leaves this file unchanged |
| V4 | `mu-*` ownership for every class the `#s-bank-syncing` section draws | `grep -n "'mu-…'" apps/mobile/src/test-utils/mu-class-map.ts` for `mu-scroll`, `mu-pad`, `mu-pad-b`, `mu-safe-top`, `mu-spacer`, `mu-center`, `mu-h2`, `mu-p`, `mu-small`, `mu-card`, `mu-progress`, `mu-progress__fill`, `mu-row`, `mu-badge`, `mu-badge--info`, `mu-badge--ok`, `mu-note`, `mu-note--danger`, `mu-note__icon`, `mu-btn`, `mu-btn--ghost`, `mu-btn-stack`, `mu-mt2`…`mu-mt6` | **Every one is already `primitive` or `utility`.** No class this screen draws is `deferred`, so `mu-class-map.ts` is **not modified** and no new design-system primitive is required |
| V5 | Primitive APIs this screen composes | `grep` over `apps/mobile/src/components/ui/{Button,Badge,Note,Progress,Text,Card}.tsx` | `ButtonVariant = 'primary' \| 'muted' \| 'outline' \| 'ghost' \| 'danger' \| 'dangerSoft'` with `disabled?: boolean`; `BadgeTone` includes `neutral`, `ok`, `info`; `NoteTone` includes `danger`; `Progress` takes `{ value, accessibilityLabel }` and clamps to 0–1 |
| V6 | `react-native-webview` is not installed in the app | `grep -n "webview" apps/mobile/package.json` | No match. Item #6 declares it as a **peer** dependency of `packages/bank-scraper` and its plan names follow-up **F1**: *"`apps/mobile` adds `react-native-webview` to its dependencies and imports the component — the connect-flow item"*. Item #9's plan Decision 8 hands that to **this** item |
| V7 | The scraper's public entry points | `git show origin/feature/6-port-bank-scraper-banco-de-chile:packages/bank-scraper/src/index.ts` | Barrel exports `ScraperStepId`, `VALID_STEP_TRANSITIONS`, `NON_RETRYABLE_ERROR_CODES`, `FailureReasonCode`, `ReadOutcome`, `ScrapeResult`, `BankConfig`, `BANK_CONFIGS`, `resolveBankConfigOrReject`, `ScrapeSession`, `startBankRead({ …, onResult, onProgress? })`. The React component is the deep import `@finanzas/bank-scraper/src/component` and is **not** in the barrel |
| V8 | The component's props and handle | `git show origin/feature/6-port-bank-scraper-banco-de-chile:packages/bank-scraper/src/component/bank-scraper.component.tsx` | `BankScraperProps = { config, credentials, priorMonths?, readDeadlineMs?, onResult, onProgress?, debugVisible? }`; `BankScraperHandle = { cancel: () => void }`. The session is constructed **and started in the render body** on first render, and `onResult` / `onProgress` are captured into private fields at construction — later prop changes do not propagate (drives Decision 4) |
| V9 | The step ids and their order | `git show origin/feature/6-port-bank-scraper-banco-de-chile:packages/bank-scraper/src/types/protocol.types.ts` | `ScraperStepId = 'load-start' \| 'login-start' \| 'get-products-start' \| 'get-transactions-start' \| 'ready'`; `VALID_STEP_TRANSITIONS` is that array; the doc comment says *"`load-start` is not surfaced to a person; the other four map to `#screen=bank-syncing` states"* |
| V10 | Progress is monotonic and clamped | `git show origin/feature/6-port-bank-scraper-banco-de-chile:packages/bank-scraper/src/engine/state-manager.service.ts` | `updateState` clamps into `0..1`, treats a non-finite input as "no new information", and takes `Math.max` with the current value. `onProgress` fires **only on an accepted update**, and `stepId === 'ready'` finalizes the session |
| V11 | The `ScraperRunner` seam and the summary | `docs/specs/developments/20260802131441_10-sync-engine/2_10-sync-engine_implementation-plan.md` Decision 16, Layer-by-Layer → *Application* | `ScraperRunner.run({ connectionId, countryCode, bankId, credentialsKey, signal? }): Promise<ScrapeResult>`; `SyncDeps = { db, ports, runner, ready }`; `SyncRunResult = { status: 'completed'; summary; connectionState } \| { status: 'refused'; reason: 'read_in_progress' }`. `SyncSummary` has no failure code |
| V12 | Where the failure code is readable | Same plan, Decision 8 and Layer-by-Layer → `institutions.ts` | Each exit writes `sync_status` / `last_sync_at` / `last_error_code` / `last_error_message` in the same transaction, and `getConnection` is added as a `SyncConnection` read. `composeFailureMessageKey` returns the four keys `sync.errors.*` and *"the catalogue entry that renders these keys belongs to the bank detail screen item"* (#20) |
| V13 | The handoff seam | `docs/specs/developments/20260802131302_9-connect-a-bank-picker-credentials-secure-storage/2_9-connect-a-bank-picker-credentials-secure-storage_implementation-plan.md` Decision 8 | `ConnectHandoff = { connectionId, countryCode, bankId, credentialsKey }`, `SYNCING_ROUTE`; *"Item #11 mounts the hidden WebView, implements `ScraperRunner` over `startBankRead(...)`, reads the credential through this item's secure-store port, and calls item #10's `runSync(deps, request)`"* |
| V14 | The secure-store port | Same plan, Layer-by-Layer → *Frontend / UI — new files* | `src/lib/secure-store/`: `SecureStorePort` (`getItem` / `setItem` / `deleteItem`), the single `expo-secure-store` importer, and `credentialsKeyFor` / `readCredentials` / `writeCredentials` / `deleteCredentials`. Root `eslint.config.mjs` gains a `secureStoreBoundary` export applied to `app/**` and `src/**` |
| V15 | The campaign data-access pattern | Item #9 Decision 17, item #12 Decision 7 | `getAppDatabase()` (item #8's `src/db/runtime.ts`) plus repository functions **behind feature hooks**; screens call neither directly; freshness via `useFocusEffect` → `reloadToken`; **no TanStack Query** — the library is not installed |
| V16 | The `.db.test.ts` convention | `cat apps/mobile/jest.config.js`; item #12 Decision 14 / item #9 Decision 14 | Two projects today (`app`, `db`). Items #12, #9 and #13 each add the same two lines: `db.testMatch` gains `'<rootDir>/src/features/**/*.db.test.ts'` and `app.testPathIgnorePatterns` gains `'\\.db\\.test\\.ts$'`. Item #10 adds a third project `sync` for `src/features/sync/**/*.test.ts`. **This item adds neither** — see Decision 11 |
| V17 | The fidelity contract for this screen | `docs/specs/developments/20260802132243_47-design-fidelity-gate/2_47-design-fidelity-gate_implementation-plan.md` Decisions 2, 4, 9 and *Contract file* | Coverage set `#11 → bank-syncing → 4 targets`, all `planned`; `max_mismatch_pct: 6.0` with `threshold_note` *"Progress animation is captured mid-flight; the frame is not deterministic"*; `wired` requires `app_file` + `deep_link` + `ready_test_id`; the app-side helpers are `useFidelityPreview()` and `fidelityTestId(screenId)` in `apps/mobile/src/lib/fidelity-preview.ts` |
| V18 | `src/features/` does not exist yet | `ls apps/mobile/src/features` | `No such file or directory`. Items #8, #9, #10, #12 and #13 each create their own folder under it; this item creates `src/features/bank-syncing/` |
| V19 | The i18n catalogue shape | `cat apps/mobile/src/i18n/es.json`, `src/i18n/index.ts`, `ls src/i18n/__tests__` | Flat dotted keys with `keySeparator: false`; `catalogue-parity.test.ts` asserts identical key sets between `es` and `en`. No `bank_syncing.*` and no `sync.*` key exists today |
| V20 | The no-literal-string fence | `grep -n "no-literal-string" apps/mobile/eslint.config.mjs` | `i18next/no-literal-string` is `error` for the app workspace (non-negotiable 8) |
| V21 | Same-surface open pull requests | `gh pr list --repo lhpaul/personal-finances --state open --json number,title,headRefName` | #46 (`feature/6-…`), #44 (`feature/5-…`), #61 (`feature/47-…`), #60 (`fix/12-plan-post-merge-review`, touches item #12's plan document only), #62 (plan for #14), #63 (plan for #19) |

---

## Cross-Cutting Operational Assumption Check

### Applicable

Repository mode: `.ai-dev-workflow.yaml` declares no `mode` key, so the default `single_repo`
applies and **this repository owns the plan**. `template.is_template` is `false`, so Protocol 02
Step 0 (Template-Fit Check) does not apply.

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Plan artifact base branch | `develop` | `AGENTS.md` → *Git & Branching*; `.ai-dev-workflow.yaml` has no `mode` key → `single_repo` | 2026-08-02, `09fb7dd` | Current invocation (item #11) only; the six open PRs in V21 all target `develop` | `Verified` |
| Artifact owner | This repository (`lhpaul/personal-finances`); plan under `docs/specs/developments/`, runbook under `docs/testing/mobile/` | `single_repo` default; the twelve sibling plan directories already merged here | 2026-08-02, `09fb7dd` | Current invocation only | `Verified` |
| App data-access pattern | `getAppDatabase()` + repository functions behind feature hooks; **no TanStack Query** | Item #9 Decision 17 and item #12 Decision 7 (both merged on `develop`) | 2026-08-02, `09fb7dd` | Same-surface open PRs: **#60** (edits item #12's plan document). Read: it corrects the home-screen plan, does not reopen Decision 7 | `Verified` |
| Scraper public surface (`BankScraperComponent`, `BANK_CONFIGS`, `ScraperStepId`, `ScrapeResult`) | As recorded in V7–V10 | Item #6's **merged** implementation plan, plus the source on `origin/feature/6-port-bank-scraper-banco-de-chile` | 2026-08-02, `09fb7dd` (branch tip `28d4a38`) | Same-surface open PR: **#46**. This plan reads that branch directly rather than assuming | `Verified` — against a contract whose implementation is still open; re-verified at Implementation Order step 1 |
| Sync-engine seam (`runSync`, `SyncDeps`, `ScraperRunner`, `getConnection`) | As recorded in V11–V12 | Item #10's **merged** implementation plan | 2026-08-02, `09fb7dd` | No open PR touches `src/features/sync/` | `Verified` — merged contract, unmerged implementation; re-verified at step 1 |
| Fidelity contract (`fidelity-targets.json`, `useFidelityPreview`, `fidelityTestId`) | 4 `bank-syncing` targets, `max_mismatch_pct: 6.0`, `ready_test_id = fidelity-bank-syncing` | Item #47's plan and the source on `origin/feature/47-design-fidelity-gate` | 2026-08-02, `09fb7dd` | Same-surface open PR: **#61** | `Verified` — re-verified at step 1; Decision 12 states the fallback if #61 is still open |

No row is a `Conflict`. Shared keywords across sibling plans (`sync`, `connection`, `progress`)
are **not** treated as conflict evidence: none of the six open PRs changes any of the six
operational assumptions above.

### Implementation-start re-verification (mandatory before the first file edit)

Per the seventh row of Protocol 02's gate table, re-check each source at implementation start and
record `Still valid` or `Stale or conflicting`. Stop before any file edit and return the evidence
to the parent orchestrator on `Stale or conflicting`.

1. `gh pr view 46 --json state` and `gh pr view 61 --json state` — both must be `MERGED`.
2. `ls apps/mobile/src/db/runtime.ts` and `grep -n "getAppDatabase" apps/mobile/src/db/runtime.ts`
   — item #8 has shipped the handle.
3. `ls apps/mobile/src/features/connect-bank/sync-handoff.ts apps/mobile/src/lib/secure-store/`
   — item #9 has shipped the handoff type and the secure-store port; confirm `ConnectHandoff`'s
   four field names are unchanged.
4. `grep -n "export" apps/mobile/src/features/sync/index.ts` — item #10 has shipped `runSync` and
   the types; confirm `SyncDeps`, `SyncRequest`, `SyncRunResult` and `ScraperRunner` match V11.
   If `SyncRunResult` has since gained the failure code, drop Decision 6's connection read and
   use it instead — that is a simplification, not a conflict.
5. `grep -n "indeterminate" apps/mobile/src/components/ui/Progress.tsx` — item #12 shipped the
   additive prop (used only by the `starting` phase, Decision 3).
6. `node -e "…"` over `design/mockups/mobile/mockup-manifest.js` — the `bank-syncing` state list
   is still exactly the four of V2.

---

## Assumptions

Taken without a human in the loop, from the documents in the Verification Log. Each is cheap to
check and each names what breaks if it is wrong.

- **A1 — D3 resolves to foreground-only, and the resolution is mechanical, not merely chosen.**
  `BEHAVIOR.md` decision **D3** (*"¿`bank-syncing` puede continuar en segundo plano si el usuario
  sale de la pantalla?"*) is 🔴 open. The parent handoff records the chosen default: **the sync
  runs foreground-only in the MVP**. This plan additionally records *why it could not be
  otherwise without new work*: the read is driven by `WebViewPort`, which
  `bank-scraper.component.tsx` implements over the mounted `<WebView>`'s ref and its own
  `sourceUri` state (V8). Unmounting the screen destroys the port, so a read cannot outlive the
  screen. Leaving the screen therefore **stops** the read, which item #10's merged plan already
  defines: outcome `cancelled` → partial results stored, connection `idle`, **no** failure
  recorded (Decision 8's exit table, Decision 10). Nothing about this is a new rule. **Flagged
  for LH**: if background sync is ever wanted, it is a new item that moves the WebView host above
  the route, not a change here. Recorded in *Documentation Updates* as a `BEHAVIOR.md` edit.
- **A2 — the mockup's `transactions` state doubles as the success frame.** The mockup draws
  *"Ver resultado"* only under `data-states="transactions"` and draws no fifth state for "done".
  This plan renders that CTA in the `transactions` state and disables it until the read finalizes
  with `outcome === 'complete'` (Decision 8). If wrong, the alternative is to auto-navigate on
  success and never draw the CTA — a smaller change, one component.
- **A3 — the first step row's ✅ is drawn, not derived.** The mockup gives row 1
  (*Sesión iniciada*) a literal `✅` in **all three** progress states while its badge still reads
  *En curso* in `login`. That is internally inconsistent, but non-negotiable 6 makes the drawing
  the contract, so it is implemented as drawn and asserted as drawn. Rows 2 and 3 switch `⏳` → `✅`
  exactly where the mockup switches them.
- **A4 — the mockup's error body is the `session_closed` instance.** *"El banco cerró la sesión
  antes de terminar."* names one of the four failure reasons. The other three need copy the
  mockup does not draw; Decision 7 composes it from the failure labels item #10's spec already
  proposed, keeping the mockup's second sentence (*"Tus credenciales siguen guardadas en el
  dispositivo."*) wherever it is still true.
- **A5 — `priorMonths` is not overridden.** Item #9's Decision 8 records the intended window as
  *"the scraper's own default of one prior month"* and passes no override because no mockup draws
  a control for it. This item passes none either.
- **A6 — one connection at a time is the only case that exists.** The MVP has one bank
  (`CL_BANKS` has exactly one entry, item #6 AC28), and item #10's device lock refuses a second
  read. The `refused` phase is therefore reachable only by a stale app-open sweep overlapping a
  manual entry; it is still implemented, because item #10 returns it as a value rather than
  throwing.
- **A7 — `sync.errors.*` stays with item #20.** Item #10's plan assigns those four catalogue keys
  to the bank detail screen. This screen renders its own longer, screen-specific bodies under
  `bank_syncing.error.body.*`. Decision 7 explains the split and the test that stops the two sets
  from drifting apart.

---

## Architecture and Decisions

### Decision 1 — the screen is the WebView host, and it is the only one

Item #6's plan names follow-up **F1** (*"`apps/mobile` adds `react-native-webview` to its
dependencies and imports the component"*) and item #9's Decision 8 assigns it here in as many
words: *"Item #11 mounts the hidden WebView, implements `ScraperRunner` over `startBankRead(...)`,
reads the credential through this item's secure-store port, and calls item #10's `runSync(deps,
request)`."* This plan takes that assignment literally and adds **one** dependency to
`apps/mobile`, installed through Expo's resolver so the SDK 54-compatible version is chosen
rather than guessed:

```bash
pnpm --filter @finanzas/mobile exec expo install react-native-webview
```

`react-native-webview` is a native module, so the PR must state that a **dev-build rebuild** is
required — a stale dev client cannot resolve it at runtime. `pnpm check:layout` must stay green
after the install (it runs as a `postinstall` and in CI).

The component is reached by its **deep import**, `@finanzas/bank-scraper/src/component`, exactly
as item #6's Decision 3 intends. The barrel stays React-free, so
`apps/mobile/src/__tests__/workspace-wiring.test.ts` keeps passing unchanged.

### Decision 2 — `ScraperStepId` maps onto the four states through one total function

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/features/bank-syncing/bank-syncing-state.ts

export type BankSyncingState = 'login' | 'products' | 'transactions' | 'error';

export type SyncPhase = 'starting' | 'reading' | 'succeeded' | 'stopped' | 'failed' | 'refused';

/** V9: `load-start` is not surfaced to a person, so it presents as `login`. */
export const STEP_TO_STATE: Record<ScraperStepId, BankSyncingState> = {
  'load-start': 'login',
  'login-start': 'login',
  'get-products-start': 'products',
  'get-transactions-start': 'transactions',
  ready: 'transactions',
};

export function resolveBankSyncingState(input: {
  phase: SyncPhase;
  stepId: ScraperStepId;
}): BankSyncingState {
  if (input.phase === 'failed' || input.phase === 'refused') return 'error';
  return STEP_TO_STATE[input.stepId];
}
```

The function is **total and exhaustive**: `Record<ScraperStepId, …>` makes a new step id a type
error rather than a silent fall-through, and the two error phases are checked first. `stopped`
is unreachable on screen — it only happens as the screen unmounts — but it exists in the union so
the runner's outcome mapping is total too.

`ready` maps to `transactions` rather than to a fifth state because the manifest declares four
(V2) and the mockup draws the success CTA inside `transactions` (Assumption A2).

**Every state the manifest declares is implemented**, and the claim is machine-checked:
`state-coverage.ts` (Decision 13) lists all four with the file that renders each and the test
that asserts it, and a test compares that list against the live manifest.

### Decision 3 — the bar is the scraper's monotonic progress, floored at the mockup's width

The mockup fixes three widths: `25%` in `login`, `60%` in `products`, `90%` in `transactions`.
The scraper reports a real number that `StateManagerService` has already clamped into `0..1`,
made monotonic and made NaN-proof (V10). Discarding it would make *"surface real progress"*
false; using it raw would let the bar sit below the frame the fidelity gate compares against.

```ts
// Illustrative — adapt during implementation.
export const PROGRESS_FLOOR: Record<BankSyncingState, number> = {
  login: 0.25,
  products: 0.6,
  transactions: 0.9,
  error: 0,
};

export function resolveProgressValue(state: BankSyncingState, scraperProgress: number): number {
  return Math.max(PROGRESS_FLOOR[state], scraperProgress);
}
```

`Progress` already clamps its `value` into `0..1`, so the composition cannot exceed the track.
The bar therefore **never moves backwards** — the floor rises monotonically with the state and
the scraper's own value is monotonic by construction.

Before the first `onProgress` arrives (phase `starting`, the WebView still on `about:blank`),
the bar renders `indeterminate` — item #12's additive `Progress` prop, used for exactly this
reason on `#screen=home&state=empty`. There is no progress signal yet and inventing `0.25`
before the read has started would be a fabricated percentage.

### Decision 4 — the runner mounts the component once, with stable identity and callbacks

V8 records two properties of `BankScraperComponent` that dictate how it may be used:

1. The `ScrapeSession` is constructed **and started in the render body** on the first render.
2. `onResult` and `onProgress` are captured into private fields at construction, so later prop
   changes have no effect.

Both are fine, and both are traps if the component is mounted casually. The rules this item
follows, each stated as a code requirement and each covered by a test:

- The component is mounted **only** while a read is in flight, with
  `key={attemptId}` — a new attempt is a new mount, never a re-used session. `attemptId` is
  bumped by exactly one action (**Reintentar**) and by nothing else.
- `config` and `credentials` are built **once per attempt** and held in a ref, so no re-render
  can hand the constructor a different object.
- `onResult` and `onProgress` are stable identities created with `useCallback(…, [])` that read
  through refs. This is not a micro-optimisation: an unstable callback would be captured and then
  silently stale.
- The component is never rendered under React `StrictMode`. The app's root layout does not enable
  it today; a test asserts `apps/mobile/app/_layout.tsx` contains no `StrictMode`, so turning it
  on later fails loudly here rather than starting two reads against one bank.

The runner is a small React-owned object rather than a plain module, because the WebView it
drives is a React element:

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/features/bank-syncing/use-scraper-runner.tsx

export type ScraperRunnerHost = {
  /** The hidden <WebView>, or null when no read is in flight. */
  element: ReactNode;
  /** Item #10's port. Resolves exactly once per call, on the session's single onResult. */
  runner: ScraperRunner;
  /** Stops the in-flight read; safe to call when there is none. */
  cancel: () => void;
};
```

`runner.run(request)` resolves a `Promise<ScrapeResult>` that is settled by whichever comes
first: the session's `onResult`, or a `cancel()` that forces `onResult` synchronously through
`ScrapeSession#finalize()`. A `settled` boolean guards the resolver so a late call cannot settle
it twice. Item #6's `READ_DEADLINE_MS` guarantees settlement even if the page never answers, so
there is no "the promise never settles" branch that could strand item #10's device lock.

### Decision 5 — the credential is read late, held in one place, and dropped on settle

The handoff carries a **key**, not a value (V13). The plaintext therefore enters this screen at
exactly one point and leaves at exactly one point:

```text
runner.run({ connectionId, countryCode, bankId, credentialsKey }):
  1. credentials = await readCredentials(securePort, institutionId)   // item #9's port
     -> null  => reject with ScraperRunError('missing_credentials')   // value-free
  2. credentialsRef.current = credentials
  3. render <BankScraperComponent config credentials={credentialsRef.current} … />
  4. onResult(result) | cancel()  =>  credentialsRef.current = null   // in a finally
  5. resolve(result)
```

Four independent controls keep it out of everything that persists, and each has a test:

1. **The screen's own state type has no string slot for it.** The hook's public state is
   `{ state, progress, steps, failure: { reasonCode } | null, summary, attemptId, phase }`.
   `failure` carries a `FailureReasonCode` and nothing else — there is no `message`, no `detail`
   and no index signature, so "just put the error text in the state" is a type error, not a
   review finding. This mirrors item #9's closed `ConnectFlowState`.
2. **`expo-secure-store` is unreachable from this feature.** Item #9's `secureStoreBoundary`
   ESLint config already applies to `src/**` with `src/lib/secure-store/**` as the only
   exception. A source-text scan test repeats the guarantee so a lint-config regression does not
   silently remove it.
3. **`no-console: 'error'`** for `src/features/bank-syncing/**`, matching what item #9 sets for
   `src/features/connect-bank/**`.
4. **The end-to-end leak test** (Testing Strategy scenario 12) runs a full attempt with sentinel
   values, then scans the store, every `console.*` call, the hook's serialized state, the
   rendered element tree and the `ScrapeResult`'s traces.

The read of the credential is deliberately **late** — inside `run()`, after item #10 has taken
the device lock and marked the connection `syncing` — so a refused request never touches the
keychain at all.

### Decision 6 — the failure code comes from the connection row item #10 just wrote

`SyncRunResult` carries `connectionState` but no failure code (V11), and
`selectFailureReason` / `composeFailureMessageKey` are internal to `src/features/sync/` (item
#10's barrel exports *"`runSync`, `runAppOpenSync`, the types, and nothing else"*). Rather than
reopening a merged contract, this screen reads the row item #10 wrote in the same call:

```text
result = await runSync(deps, request)
  status 'refused'                      -> phase 'refused'
  status 'completed', connectionState 'ok'    -> phase 'succeeded'
  status 'completed', connectionState 'idle'  -> phase 'stopped'   (cancelled read; A1)
  status 'completed', connectionState 'error' -> phase 'failed',
      reasonCode = getConnection(db, connectionId).lastErrorCode ?? 'parse_failed'
```

`getConnection` is a repository function item #10 adds to `institutions.ts`, called from this
item's feature hook — the campaign pattern (V15), not a screen-level query. The read is
deterministic: item #10 writes `last_error_code` inside the sync's single transaction, which has
already committed when `runSync` resolves.

The `?? 'parse_failed'` fallback exists because `connectionState === 'error'` with a null code is
a contradiction the type system cannot rule out; falling back to *"El banco cambió su sitio"* is
the least misleading of the four and is asserted by a test.

**Rejected**: deriving the reason from the `ScrapeResult` the runner already holds. It would
duplicate item #10's `SYNC_FAILURE_PRECEDENCE` (read-level failure outranks product-level, and
`invalid_credentials` outranks everything) in a second place, and the two copies would drift.

**Recorded simplification**: if item #10's implementation ships `SyncRunResult` with the code on
it, step 4 of the implementation-start re-verification says to use it and delete this read.

### Decision 7 — error copy is a total map from a four-value code, never a caught message

`bank_syncing.error.body.<code>` — four keys plus one for the refusal:

| Code | `es` body | Source |
| --- | --- | --- |
| `invalid_credentials` | *El banco rechazó tus datos. Revisa tu clave e inténtalo de nuevo.* | The `bank-credentials&state=error` hint, adapted to third person |
| `session_closed` | *El banco cerró la sesión antes de terminar. Tus credenciales siguen guardadas en el dispositivo.* | The mockup, **verbatim** (Assumption A4) |
| `network` | *No pudimos conectarnos al banco. Revisa tu conexión a internet. Tus credenciales siguen guardadas en el dispositivo.* | Item #10's spec label *"No pudimos conectarnos al banco"* + the mockup's second sentence |
| `parse_failed` | *El banco cambió su sitio y no pudimos leerlo. Tus credenciales siguen guardadas en el dispositivo.* | Item #10's spec label *"El banco cambió su sitio"* + the mockup's second sentence |
| `read_in_progress` | *Ya hay una sincronización en curso. Espera a que termine.* | Item #10's `refused` result; no mockup frame |

The title (*No pudimos completar la conexión*), the danger note (*Si tu banco pide una clave
dinámica o bloqueó la sesión, vuelve a intentarlo en unos minutos.*) and both buttons are drawn
once and never vary — exactly as the mockup draws them.

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/features/bank-syncing/failure-copy.ts
export type SyncFailureKind = FailureReasonCode | 'read_in_progress';

export const FAILURE_BODY_KEY: Record<SyncFailureKind, string> = {
  invalid_credentials: 'bank_syncing.error.body.invalid_credentials',
  session_closed: 'bank_syncing.error.body.session_closed',
  network: 'bank_syncing.error.body.network',
  parse_failed: 'bank_syncing.error.body.parse_failed',
  read_in_progress: 'bank_syncing.error.body.read_in_progress',
};
```

`Record<SyncFailureKind, string>` is what makes *"never a raw exception"* structurally true: the
only input is a code from a closed union, so there is no path by which a bank's own error text,
a caught `Error.message` or a `ScraperTrace` can reach the screen. A test asserts the map is
total and that every value resolves in both catalogues.

**Why not reuse `sync.errors.*`** (Assumption A7): item #10 assigns those four keys to the bank
detail screen (#20), where they render as short **badge labels** (*Revisa tus datos*, *La sesión
con el banco se cerró*). This screen needs full actionable sentences in a different voice. Two
key sets with one shared enum is the honest shape. `failure-copy.test.ts` asserts that
`FAILURE_BODY_KEY`'s key set, minus `read_in_progress`, is exactly `FailureReasonCode`'s four
values — so if item #6 ever adds a fifth reason, this file fails to compile and #20's does too.

### Decision 8 — retry is manual, bounded by construction, and branches on one code

`BEHAVIOR.md`: *"`error` ofrece reintentar (vuelve a `login`) y volver (a `bank-credentials` si
el fallo fue de autenticación). Reintentar es seguro siempre: la re-sincronización es idempotente
(BR5)."* Brief AC3: *"Retry reuses stored credentials without asking again."* Both hold with one
branch:

```ts
// Illustrative — adapt during implementation.
export type RetryAction = 'restart_read' | 'reenter_credentials';

export function resolveRetryAction(kind: SyncFailureKind): RetryAction {
  return kind === 'invalid_credentials' ? 'reenter_credentials' : 'restart_read';
}
```

- `restart_read` bumps `attemptId`, which remounts the component and re-runs `runSync` with the
  same `ConnectHandoff`. The credential is re-read from the keychain by key — the person is never
  asked again.
- `reenter_credentials` is the one exception, and it is not a preference: item #6 puts
  `invalid_credentials` in `NON_RETRYABLE_ERROR_CODES` because repeated sign-in attempts lock the
  person's real bank account, and item #10's Business Rule 24 suspends automatic syncing until a
  credential is supplied again. `router.replace('/(onboarding)/bank-credentials')` takes them to
  the form, which item #9 renders in its `error` state. The button keeps the mockup's label,
  *Reintentar*; only the destination differs.

**Bounded-retry guarantee and its mechanism**: there is no timer, no backoff and no automatic
re-attempt anywhere in this feature. `attemptId` is bumped by exactly one `onPress` handler, and
that button renders only when `phase === 'failed' || phase === 'refused'`, so an attempt can
never start while one is in flight. A test asserts the module contains no `setTimeout` /
`setInterval` and that a second `onPress` while `phase === 'reading'` is a no-op.

*Elegir otro banco* is `router.replace('/(onboarding)/bank-picker')`, which is where the mockup's
secondary button goes.

### Decision 9 — leaving the screen stops the read; the stop is a value, not an error

Consequence of Assumption A1. The hook's effect cleanup calls `host.cancel()`, which calls
`ScrapeSession.cancel()` → `#finalize()`. That path is synchronous, clears the credential holder
**before** teardown, and emits exactly one `ScrapeResult` with `outcome: 'cancelled'`,
`readFailure: null` and `productFailures: []`. Item #10 then stores what was gathered and returns
the connection to `idle` **without** recording a failure (its Decision 8 exit table and Decision
10). The person sees no error they did not cause, and their next attempt is safe because
re-syncing is idempotent (BR5).

Two consequences worth stating because they look like bugs and are not:

- `runSync` keeps running after the screen is gone — it still has to store the partial and write
  the connection record. Its writes are unaffected by the unmount; only the screen's `setState`
  is guarded (`cancelled` flag in the effect, the pattern item #12 established).
- The person can return to a connection in `idle` with some products already stored.
  `bank-connected` refuses to render until a connection has `last_success_at` (item #9's Decision
  15), so they land back in the connect flow rather than on a half-populated success screen.

### Decision 10 — a `__DEV__`-only scripted runner makes every state reachable without a bank

Three of the four states cannot be produced on demand with a real bank: `products` and
`transactions` flash past in seconds, and `error` needs the bank to actually fail. Item #9's plan
faced the same problem and shipped `app/(dev)/connect-fixtures.tsx`; item #12 shipped
`app/(dev)/sample-data.tsx`. This item follows the identical shape:

- `apps/mobile/app/(dev)/sync-fixtures.tsx` — `if (!__DEV__) return null` **before any hook**,
  with `require()` of the implementation **inside** the guard so Metro's dead-code elimination
  drops `src/dev/` from a release bundle. Byte-for-byte the structure of `(dev)/gallery.tsx`.
- `apps/mobile/src/dev/SyncFixtures.tsx` + `src/dev/scripted-runner.ts` — installs a scripted
  `ScraperRunner` into a module-scoped slot that the feature's runner resolver consults **only**
  when `__DEV__` is true and a script has been installed. Scripts: *hold at login*, *hold at
  products*, *hold at transactions*, *complete*, and one per failure reason.
- `apps/mobile/src/test-utils/route-inventory.ts` — `DEV_ONLY_ROUTES` gains
  `'/(dev)/sync-fixtures'`, which is what keeps `route-manifest-parity.test.ts` green.

The scripted runner never touches the keychain and never mounts a WebView, so the fixture surface
cannot become a credential path. A test asserts `src/dev/scripted-runner.ts` contains no
`expo-secure-store` and no `@finanzas/bank-scraper/src/component` import, and that the resolver
returns the real runner when `__DEV__` is false.

### Decision 11 — no new Jest project, and no new Jest project is needed

Item #10 adds a third project (`sync`) for `src/features/sync/**/*.test.ts`, because its tests
need `better-sqlite3` and no React Native mocks. This item's tests are the opposite: pure
functions and component element-tree assertions belong in the `app` project, and the one test
that needs real SQLite (`credential-leak.db.test.ts`) uses the `.db.test.ts` convention items
#12, #9 and #13 all established (V16) — `db.testMatch` already matches
`src/features/**/*.db.test.ts` and `app.testPathIgnorePatterns` already excludes
`\.db\.test\.ts$`.

Two consequences to verify at implementation time rather than assume:

- Item #10's `sync` project matches `src/features/sync/**/*.test.ts`, which does **not** match
  `src/features/bank-syncing/`. The two folder names are distinct on purpose; a glob of
  `src/features/sync*` would swallow this feature. Step 12 of the Implementation Order verifies
  the project assignment by reading `pnpm --filter @finanzas/mobile test`'s per-project output.
- `@testing-library/react-native` is **not** installed and this item does not add it. Following
  item #2's and item #12's precedent, component assertions call the component function directly
  and inspect the returned element tree.

### Decision 12 — the four fidelity targets flip `planned` → `wired`, deterministically

Per item #47's Decision 2, *"flipping a target from `planned` to `wired` is the concrete task
each screen item inherits, and it is machine-checked."* The four `bank-syncing` mappings in
`scripts/mobile-ui/fidelity-targets.json` gain `app_file`, `deep_link` and `ready_test_id`:

| `state_id` | `deep_link` |
| --- | --- |
| `login` | `finanzas:///(onboarding)/bank-syncing?fidelity=1&fidelityScreen=bank-syncing&fidelityState=login` |
| `products` | `finanzas:///(onboarding)/bank-syncing?fidelity=1&fidelityScreen=bank-syncing&fidelityState=products` |
| `transactions` | `finanzas:///(onboarding)/bank-syncing?fidelity=1&fidelityScreen=bank-syncing&fidelityState=transactions` |
| `error` | `finanzas:///(onboarding)/bank-syncing?fidelity=1&fidelityScreen=bank-syncing&fidelityState=error` |

All four keep `app_file: "apps/mobile/app/(onboarding)/bank-syncing.tsx"` and
`ready_test_id: "fidelity-bank-syncing"` — the value `fidelityTestId('bank-syncing')` returns,
placed as `testID` on the route's root view. The seeded `max_mismatch_pct: 6.0` and its
`threshold_note` are **left exactly as item #47 wrote them**; raising a threshold requires a new
note and this item has no evidence to justify one.

`useFidelityPreview()` returns `{ active: false, state: null }` whenever `__DEV__` is false, so
preview mode cannot exist in a release build. When it is active, the route renders the named
state from a fixed presentation and **starts no read at all** — no WebView, no keychain access,
no `runSync`. That is what makes the capture deterministic despite the threshold note's warning
about a mid-flight frame: in preview the bar sits exactly on `PROGRESS_FLOOR[state]`, which is
the mockup's own width.

**Fallback if PR #61 is still open at implementation start**: do not create
`scripts/mobile-ui/fidelity-targets.json` or `src/lib/fidelity-preview.ts` here — inventing a
second copy of #47's contract is worse than deferring. Instead, add the `testID` and the
`fidelityState` handling behind a local `useLocalSearchParams()` read with the same param names,
record the deferral in the PR, and open a follow-up to flip the four targets. Step 1 of the
Implementation Order records which branch was taken.

### Decision 13 — state coverage is a checked list, not a claim

`apps/mobile/src/features/bank-syncing/state-coverage.ts` exports
`BANK_SYNCING_STATE_COVERAGE`: for each of the four manifest `state_id`s, the source file that
renders it and the test that asserts it. `state-coverage.test.ts` reads
`design/mockups/mobile/mockup-manifest.js` **live**, extracts the `bank-syncing` screen's state
list, and asserts set equality with the covered set — so adding a state to the mockups, or
quietly dropping one, fails a test. This mirrors item #9's `state-coverage.ts` and is this plan's
residual-verification mechanism (see below).

---

## Layer-by-Layer Changes

### Database / Data Layer

- [ ] **No migration, no schema change, no new repository function.** This screen writes nothing
      itself: every write is item #10's, inside `runSync`. It performs exactly one read,
      `getConnection(db, connectionId)` (Decision 6), which item #10 adds to
      `apps/mobile/src/db/repositories/institutions.ts`. If item #10's implementation named it
      differently, use whatever it shipped and record the rename — do not add a second reader.
- [ ] **Seed data: none.** Products, movements and connections are produced by a sync, never
      seeded. See [Seed Data](#seed-data).

### Backend / API

- [ ] **None — there is no backend.** The only network egress in the whole app is the hidden
      WebView loading `https://login.portales.bancochile.cl`, and item #6 already fences it with
      three origin gates plus `originWhitelist`. This item adds no request, no socket and no
      telemetry. Nothing this screen renders or holds leaves the device.

### Shared Packages / Libraries

- [ ] `packages/bank-scraper` — **not modified.** Consumed through the barrel (types, `BANK_CONFIGS`,
      `resolveBankConfigOrReject`) and through the deep import `@finanzas/bank-scraper/src/component`
      (the React component). If item #6's `package.json` has no `exports` map when this item
      starts, add one there as its own plan's follow-up F1 anticipates — an additive change,
      recorded in the PR.
- [ ] `packages/shared-domain`, `packages/shared-utils` — **not modified.** Nothing here is a
      domain rule and no date or money arithmetic happens on this screen.

### Frontend / UI — new files

`apps/mobile/src/features/bank-syncing/` (new):

- [ ] `bank-syncing-state.ts` — `BankSyncingState`, `SyncPhase`, `STEP_TO_STATE`,
      `PROGRESS_FLOOR`, `resolveBankSyncingState`, `resolveProgressValue`, and
      `resolveStepStatuses(state)` returning the three rows' `pending | in_progress | done`
      status (Decisions 2, 3; Assumption A3). Pure — no React, no I/O.
- [ ] `failure-copy.ts` — `SyncFailureKind`, `FAILURE_BODY_KEY`, `resolveRetryAction`
      (Decisions 7, 8). Pure.
- [ ] `use-scraper-runner.tsx` — `useScraperRunner(): ScraperRunnerHost` (Decisions 4, 5): builds
      the `BankConfig` through `resolveBankConfigOrReject(BANK_CONFIGS, countryCode, bankId)`,
      reads the credential through item #9's `readCredentials`, renders the hidden
      `BankScraperComponent` keyed by `attemptId`, resolves item #10's `ScraperRunner.run`
      contract, and drops the plaintext in a `finally`. **The only file in the app that imports
      `@finanzas/bank-scraper/src/component`.**
- [ ] `use-bank-sync.ts` — the single feature hook (V15). Awaits `getAppDatabase()`, builds
      `SyncDeps` (`{ db, ports, runner, ready }`), calls `runSync(deps, request)` with the
      `ConnectHandoff` from item #9's connect-flow store, maps `SyncRunResult` + `getConnection`
      onto a `SyncPhase` (Decision 6), owns `attemptId`, and is cancellation-guarded on unmount.
      Screens call neither `getAppDatabase()` nor a repository directly.
- [ ] `components/SyncProgressCard.tsx` — the `mu-card` with `Progress` and the three step rows
      (`#screen=bank-syncing&state=login|products|transactions`).
- [ ] `components/SyncStepRow.tsx` — icon, label, `Badge` (`info` = *En curso*, `ok` = *Listo*,
      `neutral` = *Pendiente*).
- [ ] `components/SyncErrorState.tsx` — the ⚠️ block, the per-code body, the danger `Note`, and
      the two buttons (`#screen=bank-syncing&state=error`).
- [ ] `state-coverage.ts` — `BANK_SYNCING_STATE_COVERAGE` (Decision 13).

`apps/mobile/src/dev/` (new files; `__DEV__` only, Decision 10):

- [ ] `SyncFixtures.tsx` — the fixture panel.
- [ ] `scripted-runner.ts` — the scripted `ScraperRunner` and its module-scoped install slot.

Routes:

- [ ] `apps/mobile/app/(onboarding)/bank-syncing.tsx` — **rewritten** from `RoutePlaceholder`.
      Reads `useFidelityPreview()`; in preview mode renders the named state from a fixed
      presentation and starts no read (Decision 12). Otherwise calls `useBankSync`, resolves the
      state, and composes the sections. Carries `testID={fidelityTestId('bank-syncing')}` on its
      root. No SQL, no business logic, no literal copy.
- [ ] `apps/mobile/app/(dev)/sync-fixtures.tsx` — **new**, `__DEV__`-guarded (Decision 10).
- [ ] `apps/mobile/app/(onboarding)/_layout.tsx` — **not modified.** Items #8 and #9 own
      `screenOptions={{ headerShown: false }}`; this screen draws its own layout inside it.
- [ ] `apps/mobile/app/_layout.tsx` — **not modified.** No provider, no query client, no
      `StrictMode` (Decision 4).

Design system:

- [ ] `apps/mobile/src/components/ui/**` — **not modified.** V4 shows every `mu-*` class this
      screen draws is already owned by a primitive or is a utility, and V5 shows those primitives
      already expose every variant needed (`Button` `muted` + `disabled`, `Badge` `neutral` /
      `info` / `ok`, `Note` `danger`, `Progress` `value` + item #12's `indeterminate`).
- [ ] `apps/mobile/src/test-utils/mu-class-map.ts` — **not modified**, for the same reason.
- [ ] `apps/mobile/src/theme.ts` — **not modified.** No new `componentMetrics` group: the screen
      is a composition of existing primitives and utility spacing.
- [ ] `apps/mobile/src/dev/DesignSystemGallery.tsx` — **not modified.** This item adds no
      primitive, so it adds no gallery section.

Copy:

- [ ] `apps/mobile/src/i18n/es.json` and `en.json` — **modified**: `bank_syncing.*` keys for every
      string the mockup draws plus the five error bodies (Decision 7), and `dev.sync_fixtures.*`
      for the fixture panel. `es` copy is the mockup's, verbatim where the mockup draws it; `en`
      is a faithful translation. Flat, lowercase, snake_case, identical key sets —
      `catalogue-parity.test.ts` enforces the shape.

Routing / test utilities:

- [ ] `apps/mobile/src/test-utils/route-inventory.ts` — **modified**: `DEV_ONLY_ROUTES` gains
      `'/(dev)/sync-fixtures'`.

### Infrastructure / Configuration

- [ ] `apps/mobile/package.json` — **one** dependency:
      `pnpm --filter @finanzas/mobile exec expo install react-native-webview` (Decision 1).
- [ ] `pnpm-lock.yaml` — regenerated by the install. `pnpm check:layout` must stay green.
- [ ] `apps/mobile/eslint.config.mjs` — **modified**: `no-console: 'error'` for
      `src/features/bank-syncing/**`, matching what item #9 sets for `src/features/connect-bank/**`.
      Item #9's `secureStoreBoundary` already covers `src/**` and needs no edit here.
- [ ] `apps/mobile/jest.config.js` — **not modified** (Decision 11).
- [ ] `scripts/mobile-ui/fidelity-targets.json` — **modified**: the four `bank-syncing` mappings
      flip `planned` → `wired` (Decision 12). No threshold is changed.
- [ ] No new CI job, no new script, no `metro.config.js` or `babel.config.js` change.

### Executable workflow shell snippets

- [ ] **None.** This plan adds no executable shell guidance to a framework-owned surface. Every
      command it names is an existing `pnpm`, `git`, `gh` or `xcrun` invocation run verbatim by a
      person or an agent, so no shell contract (`bash` / `bash-zsh`) needs naming and the
      diff-aware snippet linter is not in scope.

---

## Concurrency Safety Checklist

**Classification: applies.** Four independent event sources can be in flight against this
screen's state at once — the WebView's `onMessage` / `onLoadEnd` callbacks driving
`onProgress`, item #6's `READ_DEADLINE_MS` timer, item #10's `runSync` promise, and React's own
mount/unmount and navigation events. They share `attemptId`, the credential ref, the progress
state and the settle-once resolver.

- **Shared mutable state guards** — three pieces of mutable state, each with one writer.
  (1) `credentialsRef` is written once in `run()` and nulled once in its `finally`; nothing else
  touches it. (2) The settle-once `resolved` boolean guarding the runner's promise resolver is
  read-and-set with no `await` between the read and the write, so JavaScript's single-threaded
  event loop makes it atomic — this is stated as a code requirement, and the test drives
  `onResult` and `cancel()` in the same tick to prove only one settlement happens. (3) The hook's
  React state is written only through `setState` from within the guarded effect. Database state
  is not this screen's to guard: item #10's single transaction and its module-level device lock
  own it.
- **Re-entrancy / in-flight tracking** — yes, a second request can arrive: the app-open sweep
  (item #10's `runAppOpenSync`) can be running when the person lands here from the connect flow.
  In-flight state is tracked twice, at two levels. Locally, the retry button renders only when
  `phase === 'failed' || phase === 'refused'`, so a second attempt cannot be started from this
  screen while one is running. Globally, item #10's `acquireReadLock` refuses and `runSync`
  returns `{ status: 'refused', reason: 'read_in_progress' }` **without writing anything**, which
  this screen renders as the `error` state with the `read_in_progress` body (Decision 7). A
  refusal is a value, not an exception.
- **Event deduplication** — `onProgress` can fire many times for the same step (item #6:
  *"the `get-transactions-start` step legitimately reports many times, once per product"*), and
  `onLoadEnd` fires repeatedly for the bank's single-page app. Neither needs deduplication here:
  the step→state map is idempotent and `resolveProgressValue` is monotonic (Decision 3), so a
  repeat is a no-op on screen. `onResult` is emitted **exactly once** by
  `ScrapeSession#finalize()`'s `#finalized` check-and-set; the runner's own `resolved` guard is
  belt-and-braces for the `cancel()`-races-`onResult` case.
- **Listener and resource cleanup** — the hook's effect cleanup calls `host.cancel()`, which runs
  `ScrapeSession.cancel()` → `#finalize()`: it clears the deadline timer, clears the credential
  holder, tears the driver down (navigating the WebView to `about:blank`, destroying the page's
  JavaScript context) and emits the single result. This item registers no listener and no timer
  of its own; the `<WebView>`'s callbacks are unregistered by unmounting it. In-flight `runSync`
  work is **not** cancelled and must not be — it still has to store the partial and write the
  connection record (Decision 9); only the screen's `setState` is discarded, through the
  `cancelled` flag in the effect.
- **Race conditions at initialization** — three, all handled. (1) A read requested before the
  database is ready would query tables that may not exist; `runSync` awaits `deps.ready` before
  touching the database, and this hook supplies item #8's `getAppDatabase()`-derived promise
  (V15). (2) A WebView message arriving before `start()` is dropped by item #6's
  `MessageHandlerService` (`#config` is `undefined`, `message_before_start` trace). (3) An
  `onProgress` arriving before the hook's first commit is captured through a ref, not through a
  closure over stale state, so nothing is lost (Decision 4).
- **Race conditions at teardown** — `MessageHandlerService.handleMessage` returns immediately
  when `session.isFinalized()`, and late messages are dropped **without** tracing so a page that
  keeps posting cannot grow the trace array without bound. On this side, a `setState` that
  resolves after unmount is discarded by the effect's `cancelled` flag. The one ordering that
  matters is stated as a code requirement: **cancel before unmount, never after** — the cleanup
  calls `host.cancel()` synchronously, so `#finalize()` runs while the component is still
  mounted and the port is still alive.
- **Error propagation across async boundaries** — `runner.run` rejects only for a value-free
  `ScraperRunError` (`missing_credentials`, `unsupported_bank`); every read failure comes back as
  a `ScrapeResult`, not as a throw. Item #10 catches a runner rejection and maps it to a `network`
  failure record rather than swallowing it, so the connection is never left `syncing`. The hook
  wraps its `runSync` call in `try` / `catch` and maps an unexpected throw to
  `phase: 'failed'` with `reasonCode: 'parse_failed'` — **the caught error's message is never
  read**, which is what makes *"never a raw exception"* structural rather than aspirational
  (Decision 5, control 1). No promise in this feature is left unhandled: the test suite runs with
  a listener on `unhandledRejection` that fails the run.
- **New concurrent patterns** — the settle-once resolver bridging a callback API to a promise is
  new to this codebase. It is deliberately not a queue and not an event emitter: exactly one
  read can be in flight per attempt, item #6 emits exactly one result, and item #10 refuses a
  second read at the device level.

### Parser-risk classification

**Not applicable.** No file in this plan lives under `scripts/lint/`, `scripts/parse/` or a
similar scanner directory; no module is named for a lint/parser/scanner/tokenizer responsibility;
and nothing here scans structured text with regular expressions. `STEP_TO_STATE` and
`FAILURE_BODY_KEY` are total maps over closed TypeScript unions, checked by the compiler, not
parsers. The two source-text scan **tests** (`no-secure-store-import`, the credential-leak
sentinel scan) are assertions over `String.prototype.includes`, mirroring guards items #6, #9 and
#10 already ship; they add no parsing surface.

### Cross-cutting checklist classification

**Not applicable.** This plan adds no checklist category to `REVIEW.md`, to a planning or
implementation protocol, or to any agent/skill file, and changes no acceptance criteria that
other plans must satisfy. It is a single screen.

---

## Testing Strategy

**Test types**: unit (Jest `app` project, `jest-expo`), integration against real SQLite (Jest
`db` project via the `.db.test.ts` convention), source-scanning enforcement tests, and a manual
smoke runbook on a dev build. No device, no simulator and no network in `pnpm test`.

`@testing-library/react-native` is not installed and this item does not add it: component
assertions call the component function directly and inspect the returned element tree, following
items #2 and #12.

### Test files

| File | Tier | Covers |
| --- | --- | --- |
| `apps/mobile/src/features/bank-syncing/__tests__/bank-syncing-state.test.ts` | `app` | Decisions 2, 3; brief AC1 |
| `apps/mobile/src/features/bank-syncing/__tests__/failure-copy.test.ts` | `app` | Decisions 7, 8; brief AC2 |
| `apps/mobile/src/features/bank-syncing/__tests__/use-scraper-runner.test.tsx` | `app` | Decisions 4, 5, 9; the concurrency checklist |
| `apps/mobile/src/features/bank-syncing/__tests__/use-bank-sync.test.tsx` | `app` | Decision 6; brief AC3 |
| `apps/mobile/src/features/bank-syncing/__tests__/bank-syncing-screen.test.tsx` | `app` | All four manifest states; the fidelity preview |
| `apps/mobile/src/features/bank-syncing/__tests__/state-coverage.test.ts` | `app` | Decision 13 — live manifest set equality |
| `apps/mobile/src/features/bank-syncing/__tests__/no-secure-store-import.test.ts` | `app` | Decision 5, control 2 |
| `apps/mobile/src/features/bank-syncing/credential-leak.db.test.ts` | `db` | Non-negotiable 1 — the negative test |
| `apps/mobile/src/__tests__/route-manifest-parity.test.ts` (existing) | `app` | `/(dev)/sync-fixtures` stays out of the manifest comparison |
| `apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` (existing) | `app` | `es` / `en` key-set equality after the new keys |

### Scenario map

| # | Scenario | Maps to | Test file |
| --- | --- | --- | --- |
| 1 | Each of the five `ScraperStepId` values resolves to its state; a `Record<ScraperStepId, …>` makes a sixth id a compile error | brief AC1; Decision 2 | `bank-syncing-state.test.ts` |
| 2 | `resolveBankSyncingState` returns `error` for `phase: 'failed'` and `'refused'` **whatever** the step id is, including `ready` | Decision 2 | `bank-syncing-state.test.ts` |
| 3 | Feeding the accepted step sequence `load-start → login-start → get-products-start → get-transactions-start` produces the state sequence `login → login → products → transactions`, and the bar value never decreases across the whole sequence, including when the scraper reports `0.95` during `products` and `0.9` during `transactions` | brief AC1; Decision 3 | `bank-syncing-state.test.ts` |
| 4 | `resolveProgressValue` floors at the mockup's `0.25` / `0.60` / `0.90` and passes a larger scraper value through unchanged | Decision 3 | `bank-syncing-state.test.ts` |
| 5 | `resolveStepStatuses` gives, per state, the exact icon/badge triple the mockup draws — including row 1's `✅` in `login` (Assumption A3) | Non-negotiable 6 | `bank-syncing-state.test.ts` |
| 6 | `FAILURE_BODY_KEY` is total over `FailureReasonCode` plus `read_in_progress`, every value resolves in **both** catalogues, and no value is the key itself (the i18next miss signature) | brief AC2; Decision 7 | `failure-copy.test.ts` |
| 7 | `resolveRetryAction` returns `reenter_credentials` for `invalid_credentials` and `restart_read` for the other four | Decision 8 | `failure-copy.test.ts` |
| 8 | The runner resolves exactly once when `onResult` and `cancel()` fire in the same tick, in either order | Concurrency: shared state, teardown | `use-scraper-runner.test.tsx` |
| 9 | `cancel()` before any result settles the promise with the session's `cancelled` outcome; the hook maps it to `phase: 'stopped'` and shows no error | Decision 9; Assumption A1 | `use-scraper-runner.test.tsx`, `use-bank-sync.test.tsx` |
| 10 | The credential ref is `null` after settle, on the success path, the failure path and the cancel path (a `finally`, not three call sites) | Decision 5 | `use-scraper-runner.test.tsx` |
| 11 | `run()` rejects with a value-free `ScraperRunError('missing_credentials')` when the keychain has no entry, and the keychain is **not** read at all when `runSync` refuses | Decision 5 | `use-scraper-runner.test.tsx` |
| 12 | **The negative test.** A full attempt with sentinel `rut` / `password` values in a fake secure store, a fake runner that echoes both into its `ScraperTrace` stream and into a thrown error, and a real in-memory SQLite store: afterwards every column of every table, every captured `console.*` argument, `JSON.stringify` of the hook's state, `JSON.stringify` of the rendered element tree and the recorded `last_error_message` are scanned — **neither sentinel appears anywhere**. The same test asserts the trail was substantive (the fake runner really did emit the sentinels), so a test that scrubbed everything would not pass trivially | Non-negotiable 1; brief AC2 | `credential-leak.db.test.ts` |
| 13 | No file under `src/features/bank-syncing/` contains the module specifier `expo-secure-store`; the only `@finanzas/bank-scraper/src/component` import in `apps/mobile` is `use-scraper-runner.tsx` | Decision 5; Decision 1 | `no-secure-store-import.test.ts` |
| 14 | `SyncRunResult` `{ status: 'refused' }` renders the `error` state with the `read_in_progress` body and **no** `getConnection` call | Decision 6; concurrency: re-entrancy | `use-bank-sync.test.tsx` |
| 15 | `connectionState: 'error'` with each of the four `lastErrorCode` values renders the matching body; a `null` code falls back to `parse_failed` | Decision 6 | `use-bank-sync.test.tsx` |
| 16 | **Retry reuses stored credentials**: after a `session_closed` failure, pressing *Reintentar* bumps `attemptId`, remounts the component, re-reads the same `credentialsKey` and calls `runSync` again — with **no** navigation to `bank-credentials` and no prompt | brief AC3; Decision 8 | `use-bank-sync.test.tsx` |
| 17 | After an `invalid_credentials` failure, *Reintentar* navigates to `/(onboarding)/bank-credentials` and starts no read | brief AC3; Decision 8 | `use-bank-sync.test.tsx` |
| 18 | A second *Reintentar* press while `phase === 'reading'` is a no-op; the feature source contains no `setTimeout` / `setInterval`, so no retry is automatic | Decision 8 (bounded retry) | `use-bank-sync.test.tsx` |
| 19 | All four manifest states render their mockup elements: the three progress states draw the 🔄 block, the bar and the three rows with the right badges; `error` draws ⚠️, the title, the per-code body, the danger note and both buttons | Non-negotiable 6; brief AC2 | `bank-syncing-screen.test.tsx` |
| 20 | Not one user-facing string in the rendered tree is a literal — every one resolves through `t(…)`; `i18next/no-literal-string` covers the same ground at lint time | Non-negotiable 8 | `bank-syncing-screen.test.tsx` |
| 21 | With `useFidelityPreview()` active, each `fidelityState` renders its state, the root carries `testID="fidelity-bank-syncing"`, and **no** read is started (no WebView element, no keychain read, no `runSync` call) | Decision 12 | `bank-syncing-screen.test.tsx` |
| 22 | `BANK_SYNCING_STATE_COVERAGE`'s state set equals the live manifest's `bank-syncing` state set, and every named file and test exists on disk | Decision 13 | `state-coverage.test.ts` |
| 23 | `apps/mobile/app/_layout.tsx` contains no `StrictMode` | Decision 4 | `bank-syncing-screen.test.tsx` |
| 24 | `/(dev)/sync-fixtures` is in `DEV_ONLY_ROUTES`, its route file has a `__DEV__` guard before any hook, and `src/dev/scripted-runner.ts` imports neither `expo-secure-store` nor the scraper component | Decision 10 | `route-manifest-parity.test.ts` (existing), `no-secure-store-import.test.ts` |

### Residual verification strategy

This plan makes one pattern-completeness claim — *"every state the `bank-syncing` screen declares
is implemented"* — and one sweep-shaped claim — *"the four fidelity targets are wired"*. Neither
is left to inspection:

| Claim | Evidence the implementation must produce before `ready-for-human-review` |
| --- | --- |
| All four manifest states implemented | `state-coverage.test.ts` passing, and the `BANK_SYNCING_STATE_COVERAGE` table pasted into the PR with its four rows (state → file → test) |
| All four fidelity targets wired | `pnpm fidelity:contract` output pasted into the PR, showing `4 wired` for `bank-syncing` and the total wired count for the repository; plus `pnpm fidelity --issue 11` results in the runbook |
| No credential anywhere | `credential-leak.db.test.ts` passing, **plus a planted-defect proof recorded in the PR**: add `data: { rut }` to a trace in the fake runner's echo path, re-run, record the failing test name and the file/line, revert with `git checkout --`, re-run green, and confirm `git diff --stat` prints nothing |

The enumeration above is a **live** one: V2 re-read the manifest at plan-write time rather than
copying a count from a sibling plan, and `state-coverage.test.ts` re-reads it on every run.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| **None** | Products, movements and connections are discovered by a sync and are never seeded (item #10's plan, *Seed Data*). The states this screen draws are produced by the `__DEV__` scripted runner (Decision 10), not by rows. | — |

The runbook's prerequisite is a connection created by item #9's connect flow (or its
`(dev)/connect-fixtures` surface), not a seed file.

---

## Documentation Updates

Not performed during Plan Ready — listed for the developer to execute after implementation.

- [ ] `design/mockups/mobile/BEHAVIOR.md` — in the `bank-syncing` section, replace the
      *Pendiente: 🔴 D3* line with the resolved default (**foreground-only in the MVP; leaving the
      screen stops the read, stores what was gathered and returns the connection to `idle` with no
      failure recorded**) and its mechanical reason (the `WebViewPort` is the mounted component's
      ref). In the *Decisiones abiertas* table, mark **D3** as resolved-with-default and keep it
      flagged for LH, since background sync remains a possible future item.
- [ ] `docs/best-practices/stack/bank-scraper.md` — add the hosting contract: which app module
      may import `@finanzas/bank-scraper/src/component`, that `react-native-webview` is an
      `apps/mobile` dependency that requires a dev-build rebuild, and the "mount once per attempt,
      stable `key`, stable callbacks, no `StrictMode`" rules from Decision 4.
- [ ] `docs/best-practices/stack/mobile-ui-fidelity.md` — record `bank-syncing` as the first
      screen whose targets are `wired`, and the preview-mode convention that makes a
      progress-animated screen deterministic to capture.
- [ ] `docs/project/3-software-architecture.md` — update the on-device scraping section so the
      seam is stated end to end: connect flow (key) → syncing screen (WebView host + credential
      read) → sync engine (persistence). Today it describes the scraper without naming its host.
- [ ] `AGENTS.md` — *Common Commands* / *Troubleshooting*: note that the app now depends on
      `react-native-webview` and that a stale dev client fails to resolve it; and add a
      troubleshooting row for "the syncing screen sits on the first step forever" → the bank
      changed a selector, run `pnpm --filter @finanzas/bank-scraper test`.
- [ ] `docs/project/1-business-domain.md` — **no edit.** This item adds no entity and no rule.
- [ ] `docs/project/4-database-model.md` — **no edit.** No schema change (see Layer-by-Layer).

---

## Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Item #6, #8, #9, #10 or #47 has not merged when implementation starts, so half the seam is missing | High | High | Step 1 is a hard gate that stops and escalates rather than stubbing a sibling's surface. Decision 12 is the one place with a defined fallback, and it defers rather than duplicates |
| R2 | `BankScraperComponent`'s start-in-render behaviour double-starts a session under concurrent rendering | Medium | Critical (a second sign-in attempt can lock the person's real bank account) | Decision 4's four rules, the `key={attemptId}` mount, and scenario 23's assertion that `StrictMode` is absent. Item #10's device lock is the second net: a second `runSync` is refused without a write |
| R3 | `react-native-webview`'s prop names differ from the version item #6 pinned | Medium | Low | Item #6's own R3 already flags this and confines it to `bank-scraper.component.tsx`. This item renders that component and touches no WebView prop, so a rename costs zero files here |
| R4 | The fidelity capture is flaky because the bar is mid-flight | Medium | Low | Preview mode starts no read, so the bar sits exactly on `PROGRESS_FLOOR[state]` (Decision 12). Item #47's seeded `6.0` threshold is left untouched as the second net |
| R5 | A credential reaches a log or an error payload through a path the leak test does not drive | Low | Critical | Four independent controls, not one (Decision 5): a closed state type with no string slot, the `secureStoreBoundary` lint rule, `no-console: 'error'`, and a full-attempt sentinel scan with a recorded planted-defect proof |
| R6 | `runSync` never settles, stranding item #10's device lock and leaving the screen spinning | Low | High | Three independent settlement guarantees: `READ_DEADLINE_MS`, `cancel()` on unmount (synchronous `#finalize()`), and item #10's `finally` that releases the lock even on a runner rejection |
| R7 | Assumption A2 is wrong and the success CTA should auto-navigate | Medium | Low | Confined to `SyncProgressCard.tsx` and one branch in the route; the runbook's step 6 records what the person actually experiences so the decision is made on evidence |
| R8 | The two error-copy key sets (`bank_syncing.error.body.*` here, `sync.errors.*` in #20) drift | Medium | Low | Both are `Record<FailureReasonCode, …>` over the same imported union, so a fifth reason breaks both at compile time; scenario 6 asserts totality here |

---

## Code Samples

Every snippet in this document is marked `// Illustrative — adapt during implementation`. The one
sketch not shown inline above is the hook's outcome mapping, which is the plan's load-bearing
piece:

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/features/bank-syncing/use-bank-sync.ts

async function runAttempt(deps: SyncDeps, request: SyncRequest, db: AppDatabase) {
  const result = await runSync(deps, request);

  if (result.status === 'refused') {
    return { phase: 'refused' as const, failure: { reasonCode: 'read_in_progress' as const } };
  }
  if (result.connectionState === 'ok') {
    return { phase: 'succeeded' as const, failure: null, summary: result.summary };
  }
  if (result.connectionState === 'idle') {
    return { phase: 'stopped' as const, failure: null, summary: result.summary };
  }
  // 'error' — the code was written by the sync's own transaction, which has committed.
  const connection = getConnection(db, request.connectionId);
  return {
    phase: 'failed' as const,
    failure: { reasonCode: connection?.lastErrorCode ?? 'parse_failed' },
    summary: result.summary,
  };
}
```

---

## Implementation Order

1. **Gate + implementation-start re-verification.** Run all six checks in
   [Implementation-start re-verification](#implementation-start-re-verification-mandatory-before-the-first-file-edit)
   and record `Still valid` or `Stale or conflicting` for each. Stop and escalate on any
   mismatch. Record which branch of Decision 12's fallback was taken.
2. **Install the WebView.** `pnpm --filter @finanzas/mobile exec expo install react-native-webview`.
   *Verify*: `pnpm check:layout` passes, `pnpm --filter @finanzas/mobile typecheck` passes, and
   the resolved version is recorded in the PR. Rebuild the dev client.
3. **Copy.** Add the `bank_syncing.*` and `dev.sync_fixtures.*` keys to `es.json` and `en.json`,
   taking every `es` string the mockup draws verbatim. *Verify*: `catalogue-parity.test.ts`
   passes.
4. **Pure state module.** `bank-syncing-state.ts` + `bank-syncing-state.test.ts` (scenarios 1-5).
   *Verify*: the monotonicity case in scenario 3 passes.
5. **Pure copy module.** `failure-copy.ts` + `failure-copy.test.ts` (scenarios 6-7).
6. **Runner.** `use-scraper-runner.tsx` + `use-scraper-runner.test.tsx` (scenarios 8-11), driven
   by a fake component and a fake secure-store port — no real WebView in any test.
7. **Hook.** `use-bank-sync.ts` + `use-bank-sync.test.tsx` (scenarios 14-18), with a fake
   `runSync` and a real in-memory store for the `getConnection` read.
8. **Components and route.** `SyncStepRow`, `SyncProgressCard`, `SyncErrorState`, then rewrite
   `app/(onboarding)/bank-syncing.tsx`. `bank-syncing-screen.test.tsx` (scenarios 19-21, 23).
   *Verify*: the mockup is open side by side and every element it draws in each of the four
   states is present.
9. **State coverage.** `state-coverage.ts` + `state-coverage.test.ts` (scenario 22).
10. **Dev fixture surface.** `app/(dev)/sync-fixtures.tsx`, `src/dev/SyncFixtures.tsx`,
    `src/dev/scripted-runner.ts`, and the `DEV_ONLY_ROUTES` entry (scenario 24).
    *Verify*: `route-manifest-parity.test.ts` passes.
11. **Negative tests.** `no-secure-store-import.test.ts` (scenario 13) and
    `credential-leak.db.test.ts` (scenario 12). *Verify*: run the planted-defect proof, record the
    failing test name and the file/line in the PR, revert, re-run green, and confirm
    `git diff --stat` prints nothing.
12. **Lint fence.** `no-console: 'error'` for `src/features/bank-syncing/**` in
    `apps/mobile/eslint.config.mjs`. *Verify*: `pnpm lint` passes, and
    `pnpm --filter @finanzas/mobile test` reports this feature's tests under the `app` and `db`
    projects only — nothing under item #10's `sync` project (Decision 11).
13. **Fidelity targets.** Flip the four `bank-syncing` mappings to `wired` in
    `scripts/mobile-ui/fidelity-targets.json`, adding `app_file`, `deep_link` and
    `ready_test_id`; change no threshold. *Verify*: `pnpm fidelity:contract` passes and its
    summary line goes in the PR.
14. **Full suite.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @finanzas/mobile db:check`.
15. **Walk the smoke runbook end to end** on a dev build, including `pnpm fidelity --issue 11`,
    and update the runbook with anything that turned out to be wrong.
16. **Update the project docs** listed in [Documentation Updates](#documentation-updates).
17. **Add the `CHANGELOG.md` entry** under `[Unreleased]`, verbatim:

    ```markdown
    - **Bank syncing progress screen** (#11): `#screen=bank-syncing` shows the real scraper
      progress — every `ScraperStepId` moves the step list and the bar as it happens, and all four
      manifest states (`login`, `products`, `transactions`, `error`) are implemented. The error
      state explains what went wrong from a four-value failure code, never a raw exception, and
      *Reintentar* re-runs the sync with the credential already in the keychain — except after a
      credential rejection, the one failure that returns to the credentials form. The app's hidden
      `react-native-webview` host lives here, so no credential value ever reaches screen state, a
      log or an error payload.
    ```

---

## Document Quality Gate

- **Spec/brief coverage**: Checked — the brief has three acceptance criteria plus a mockup
  comparison. AC1 ("each scraper step updates the UI as it happens") → Decisions 2-3, scenarios
  1-5, runbook steps 3-5. AC2 ("error states show an actionable message, never a raw exception")
  → Decisions 6-7, scenarios 6, 12, 15, 19, runbook step 7. AC3 ("retry reuses stored credentials
  without asking again") → Decision 8, scenarios 16-18, runbook step 8. The mockup comparison →
  Decision 12, scenario 21, runbook step 10.
- **Implementation-order consistency**: Checked — every file named in Layer-by-Layer appears in
  the Implementation Order and vice versa; `bank-syncing-state.ts`, `failure-copy.ts`,
  `use-scraper-runner.tsx`, `use-bank-sync.ts`, `state-coverage.ts`,
  `app/(onboarding)/bank-syncing.tsx`, `app/(dev)/sync-fixtures.tsx`,
  `src/dev/scripted-runner.ts`, `src/dev/SyncFixtures.tsx`, `src/test-utils/route-inventory.ts`,
  `apps/mobile/eslint.config.mjs`, `scripts/mobile-ui/fidelity-targets.json` and both catalogues
  are spelled identically in every section. `STEP_TO_STATE`, `PROGRESS_FLOOR`,
  `resolveBankSyncingState`, `resolveProgressValue`, `resolveStepStatuses`, `FAILURE_BODY_KEY`,
  `resolveRetryAction`, `SyncPhase`, `BankSyncingState`, `SyncFailureKind`, `attemptId`,
  `ScraperRunnerHost` and `BANK_SYNCING_STATE_COVERAGE` each carry one definition throughout, and
  Decisions are referenced by their own numbers only.
- **Verification support**: Checked — every claim about an existing surface cites a numbered
  Verification Log row (V1-V21) or a named merged plan section. The three claims most likely to
  be wrong (no `mu-*` class is deferred, `react-native-webview` is not installed, the component
  starts its session in the render body) are V4, V6 and V8, each with the exact command.
- **Behavioral guarantees**: Checked — *progress never goes backwards* is enforced by
  `Math.max` in `resolveProgressValue` over a value item #6's `StateManagerService` has already
  made monotonic (V10); *retry is bounded* by there being no timer and one `onPress` handler that
  renders only in a terminal phase (Decision 8); *the promise always settles* by
  `READ_DEADLINE_MS`, the synchronous `cancel()` and item #10's `finally` (R6); *at most one read*
  by item #10's module-level device lock (V11, Decision 6); *no raw exception reaches the screen*
  by the closed `{ reasonCode }` failure type and the `Record<SyncFailureKind, string>` copy map
  (Decisions 5, 7).
- **Complex workflow decision-gate matrix**: Not applicable — this plan changes no workflow
  documentation, protocol, review gate or status-label behaviour. It is a product screen in
  `apps/mobile`.
- **Parser/API/concurrency checklist completeness**: Parser-risk — Not applicable, with the
  rationale in [Parser-risk classification](#parser-risk-classification). Cross-cutting checklist
  — Not applicable, rationale in
  [Cross-cutting checklist classification](#cross-cutting-checklist-classification).
  Concurrent-event-source — **applies**, and all seven items are answered in
  [Concurrency Safety Checklist](#concurrency-safety-checklist), each mapped to a scenario in the
  Testing Strategy (8-11, 14, 18, 23).
- **CHANGELOG literal format**: Checked — Implementation Order step 17 gives the entry verbatim
  in the project's `- **Bold Title** (#N): …` format, not conventional-commit format.
- **Not-applicable rationale**: Checked — each skipped category above carries a one-line reason,
  and the Layer-by-Layer sections that say "not modified" each say why.
</content>
</invoke>
