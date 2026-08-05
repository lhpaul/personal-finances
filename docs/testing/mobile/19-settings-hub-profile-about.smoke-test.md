# Smoke Test Runbook: Settings — hub, local profile and about

**Feature**: Settings hub, local profile and about (`#screen=settings`, `#screen=settings-account`,
`#screen=settings-about`) — issue
[#19](https://github.com/lhpaul/personal-finances/issues/19)
**Work item brief**: [issue #19](https://github.com/lhpaul/personal-finances/issues/19) — a
Refactor-type item, so there is no spec. The behaviour contract is
[`design/mockups/mobile/BEHAVIOR.md` → `settings`, `settings-account`, `settings-about`](../../../design/mockups/mobile/BEHAVIOR.md).
**Implementation plan**: [`2_19-settings-hub-profile-about_implementation-plan.md`](../../specs/developments/20260802181729_19-settings-hub-profile-about/2_19-settings-hub-profile-about_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

> **Read this before you start.** Step 6 destroys everything on the device: the SQLite store and
> every bank credential in the keychain. It is irreversible and there is no server copy. Run this
> runbook on a simulator or a test device, never on a phone holding a real bank connection you
> care about.

---

## Prerequisites

- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0; `pnpm install` has been run and `pnpm check:layout`
      passes.
- [ ] **A dev build, not Expo Go.** These screens depend on `expo-sqlite`, `expo-crypto` and
      `expo-secure-store` — all native modules. If `expo-secure-store` arrived with item #9 since
      your last build, the dev client must be **rebuilt**; a stale client fails to resolve it at
      runtime with a confusing "native module missing" error.
- [ ] The Metro dev server is running: `pnpm dev:mobile`.
- [ ] The mockup is open for side-by-side comparison: `open design/mockups/mobile/index.html`.
- [ ] There is no login step in this product — the profile is the device (`AGENTS.md`
      non-negotiable 7). Ignore any "log out first" habit from other runbooks; proving that no such
      step exists is Step 8.

---

## Test Data

| Item | Value |
| --- | --- |
| Settings hub | `/settings` — deep link `finanzas:///settings` |
| Local profile | `/settings/account` — deep link `finanzas:///settings/account` |
| About | `/settings/about` — deep link `finanzas:///settings/about` |
| Mockup reference | `design/mockups/mobile/index.html#screen=settings`, `…#screen=settings-account&state=default`, `…#screen=settings-account&state=delete-confirm`, `…#screen=settings-about` |
| On-device fixture | `apps/mobile/src/db/__fixtures__/store-v1.sql` — loaded through item #12's `__DEV__` sample-data panel (`finanzas://sample-data`) when it has landed |
| Credential entry | Written by connecting a bank through item #9's flow, or planted by item #9's `__DEV__` connect-fixtures panel |

> **Why the device needs data**: the hub's five subtitles and all four profile rows are live
> figures (plan Decision 15). On a store with no connection they render their documented empty
> fallbacks, which Step 3 checks — but Steps 2 and 4 need a populated store.

---

## Smoke Test Steps

### Step 1: Reach the hub

**Maps to**: brief scope ("the settings hub"), plan Decision 14.

1. Launch the dev build with a populated store (sample-data panel, or a real Banco de Chile
   connection plus one sync).
2. Navigate to settings: tap the ⚙️ in the home header, or deep-link `finanzas:///settings`.
3. Open `design/mockups/mobile/index.html#screen=settings` beside it.

**Expected result**: a top bar reading **Configuración** with a back affordance, then one grouped
list of exactly five rows in this order, each with its glyph, title, live subtitle and a chevron:

| Row | Subtitle must be |
| --- | --- |
| 👤 Perfil local | the connected RUT, formatted `12.345.678-9` |
| 🏦 Bancos conectados | *«N banco(s) · M productos»* matching the real connection and product counts |
| 🔔 Recordatorios | *«9:00 AM · días laborales»*-shaped, matching the reminder settings |
| 🗂 Categorías | *«N de gastos · M de ingresos»* matching the real category counts |
| ℹ️ Acerca de | *«Versión X.Y.Z»* — **this reads the real app version, not the mockup's `1.0.0`** (plan Decision 9, Assumption A6) |

There is **no sixth row** and no sign-out affordance. Tapping the back affordance returns to
`/(tabs)/home`.

### Step 2: The local profile — `settings-account&state=default`

**Maps to**: brief scope ("the local-profile screen"), plan Decisions 5, 10, 15, 16.

1. Tap **Perfil local**.
2. Open `#screen=settings-account&state=default` beside it.

**Expected result**, top to bottom:

- Top bar **Perfil local** with a back affordance to `/settings`.
- The 📱 device card: **Este dispositivo** and the green badge **Sin cuenta · sin servidor**.
- Four label/value rows:
  - **RUT** — the RUT stored in the keychain, formatted with dots and a check digit.
  - **Usando la app desde** — a long month and year in lower case, e.g. *«enero 2025»* (**not**
    `ene 2025`). Cross-check it against `first_launch_at`: it must be the month the app was first
    launched on this device, not today's month, unless they are the same.
  - **Datos almacenados** — *«Solo en este dispositivo»*.
  - **Movimientos guardados** — the **total** number of stored movements. Verify it counts excluded
    movements too: exclude one movement from the transactions flow (if #16 has landed) and confirm
    this number does **not** drop (plan Decision 16).
- The 🔒 green note about there being no account to create and no session to start.
- One button, **Borrar todos mis datos**, in the soft-danger style. **There is no second button and
  no sign-out.**

### Step 3: The empty-state fallbacks

**Maps to**: plan Assumption A5, Decision 15.

1. On a device with **no** connected bank (fresh install, or after Step 6), deep-link to
   `finanzas:///settings` and then `finanzas:///settings/account`.

**Expected result**: the hub's *Perfil local* subtitle reads **Sin bancos conectados** and the
*Bancos conectados* subtitle reads the same; the profile screen's **RUT** value renders an em dash
(**—**). No screen renders a fabricated RUT, and nothing crashes.

### Step 4: About — `settings-about`

**Maps to**: brief scope ("about — version display, no telemetry, no data-sending links"), plan
Decisions 8, 9, Assumption A4.

1. From the hub, tap **Acerca de**.
2. Open `#screen=settings-about` beside it.

**Expected result**:

- Top bar **Acerca de** with a back affordance to `/settings`.
- The 💰 brand block: **Finanzas** and *«Versión X.Y.Z (MVP)»* with the **real** app version.
- The 🔒 green note: **Privacidad por diseño.** followed by the sentence about credentials and
  movements being encrypted on this phone and there being no servers with financial data.
- A list of three rows — 📄 *Política de privacidad*, 📑 *Términos de servicio*, 💬 *Enviar
  feedback* — drawn exactly as the mockup draws them and **inert**: tapping each one does nothing,
  opens no browser, opens no mail composer and triggers no navigation (plan Decision 8).

**Also verify, with the device offline**: put the simulator/device in airplane mode, then open the
hub, the profile and about in turn. Every screen must render completely. Any spinner, error or
missing value would mean something on these screens talks to a network, which the product does not
have.

### Step 5: The confirmation — `settings-account&state=delete-confirm`

**Maps to**: **brief AC3** ("the destructive action is behind a confirmation modal that states
there is no backup"), plan Decision 7.

1. On the profile screen, tap **Borrar todos mis datos**.
2. Open `#screen=settings-account&state=delete-confirm` beside it.

**Expected result**: a centred modal over a dimmed profile screen, with the ❌ icon, the title
**Borrar todos mis datos**, the paragraph stating the action is **permanente** and cannot be
undone and naming movements, categories and bank credentials, then the line **No tenemos copia en
ningún servidor.**, then two buttons: **Cancelar** (outline) and **Borrar todo** (danger).

3. Tap **Cancelar**.

**Expected result**: the modal closes and the profile screen is unchanged — nothing was deleted.
Re-open the profile screen and confirm the movement count is still what it was in Step 2.

### Step 6: The wipe — the destructive path

**Maps to**: **brief AC1 and AC2**, plan Decisions 1-4.

> Point of no return. Everything below assumes you are willing to lose this device's data.

1. Before wiping, write down: the movement count from Step 2, the connected bank name, and the RUT.
2. Tap **Borrar todos mis datos**, then **Borrar todo**.

**Expected result**: the app lands on **`onboarding-intro`** — the first onboarding screen — with
no confirmation toast and no interstitial (plan Assumption A2). The back gesture must **not**
return to the settings stack.

3. Force-quit the app and relaunch it.

**Expected result**: it opens on `onboarding-intro` again — the launch gate genuinely resolves to
onboarding because the store is new, not because a flag was flipped (plan Decision 4).

4. Walk onboarding as far as the bank credential form (item #9's `bank-credentials` screen).

**Expected result**: the RUT field is **empty and editable**, not pre-filled and locked. A locked,
pre-filled RUT would mean a credential entry survived the wipe — that is the on-device signature of
an AC1 failure, and it is the reason this step exists.

5. Reconnect the bank, complete a sync, then return to `/settings/account`.

**Expected result**: the movement count and the *Usando la app desde* month reflect the **new**
store, not the pre-wipe one. The month is the current month.

### Step 7: The wipe fails closed (optional, developer-assisted)

**Maps to**: plan Decision 1's fail-closed rule, Assumption A3.

This needs a temporary local edit and is worth doing once, when the wipe is first implemented.

1. Temporarily make the secure-store adapter's `deleteItem` a no-op (a one-line local change; do
   not commit it).
2. Populate the store, connect a bank, then run the wipe.

**Expected result**: the app **stays on the profile screen** and shows a danger note reading *«No
pudimos borrar todos tus datos. No se borró nada; inténtalo de nuevo.»*. The modal closes. The
movement count is unchanged, the bank is still connected, and the app has **not** navigated to
onboarding — the store was never touched because the credential read-back failed (plan Decision 1,
step 3). The message names no key and no credential value.

3. Revert the local edit and rebuild.

### Step 8: No sign-out affordance exists

**Maps to**: **brief AC4**, plan Decision 13.

1. Walk every settings surface: `/settings`, `/settings/account`, `/settings/about`, and the three
   adjacent placeholders `/settings/banks`, `/settings/notifications`, `/settings/categories`.
2. On each, read every button, row and note.

**Expected result**: nothing offers to close a session, sign out, log out, leave an account or sign
in. The only destructive action anywhere is **Borrar todos mis datos**, and the only account-shaped
copy is the badge **Sin cuenta · sin servidor** and the note explaining that there is no account to
create.

3. Confirm the mechanical guard agrees:

   ```bash
   pnpm --filter @finanzas/mobile test -- no-sign-out
   ```

**Expected result**: the suite passes and reports a non-zero number of scanned files (a broken file
walk must not make it vacuously pass).

### Step 9: Design fidelity — expected vs actual

**Maps to**: **brief AC5** ("Open `design/mockups/mobile/index.html` and compare side by side
before marking done"), plan Resolution R3.

Reference assets for this item are the HTML mockups in `design/mockups/mobile/` — specifically
`index.html` at `#screen=settings`, `#screen=settings-account&state=default`,
`#screen=settings-account&state=delete-confirm` and `#screen=settings-about`, with
`mockup-manifest.js` as the state contract.

**If `scripts/mobile-ui/` exists** (item #47 has landed):

```bash
pnpm fidelity --issue 19
```

**Expected result**: all four targets report `PASS` under their thresholds. Paste the summary table
into the PR.

**Always, whether or not the tooling exists** — the manual comparison:

1. Open each of the four mockup URLs above beside the running app on the matching screen/state.
2. Compare, in this order: the top bar; card and list grouping; spacing between blocks; type sizes
   and weights; the badge and note colours; the two button styles in the modal.
3. Record PASS/FAIL per target, with expected-vs-actual detail on any failure.

**Expected result**: each screen matches its reference. Two differences are **expected and not
failures**, both recorded in the plan:

- the version string (the mockup draws `1.0.0`, the app reads the real `app.config.js` version —
  Assumption A6), and
- the RUT and the movement count (the mockup draws sample values `18.456.789-0` and `57`).

Any other difference is a finding.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below.
- Confirm no console output during the whole run contains a RUT-shaped string, a password, or a
  `bank_creds.` key (dot separator, not the plan's original colon — item #100 found
  `expo-secure-store`'s key validator rejects a colon).
- Shut down the app and the Metro server.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion in the work item brief.

- [ ] **AC1** — after the wipe, no credential entry survives: the credential form's RUT field is
      empty and editable (Step 6.4), and `wipe-local-data.node.test.ts` proves the fake secure
      store is completely empty, including an orphan key with no connection row.
- [ ] **AC1** — after the wipe, the database file is gone: the movement count, the connected bank
      and the first-use month all reflect a brand-new store (Steps 6.3 and 6.5).
- [ ] **AC2** — after the wipe the app returns to `onboarding-intro`, and still does after a
      force-quit and relaunch (Steps 6.2 and 6.3).
- [ ] **AC3** — the destructive action is behind a confirmation modal, and that modal states there
      is no backup on any server (Step 5).
- [ ] **AC3** — **Cancelar** deletes nothing (Step 5.3).
- [ ] **AC4** — no sign-out affordance exists on any settings surface, confirmed by reading and by
      `no-sign-out.test.ts` (Step 8).
- [ ] **AC5** — all four mockup targets compared side by side, PASS recorded for each, with only
      the two expected sample-data differences (Step 9).
- [ ] Both manifest states of `settings-account` (`default`, `delete-confirm`) were reached and
      compared (Steps 2 and 5).
- [ ] The about screen sends nothing anywhere: three inert rows, and every screen renders fully in
      airplane mode (Step 4).
- [ ] A failed wipe leaves the device untouched and says so without naming a key (Step 7, when run).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Populated store (connection, products, movements, categories) | Steps 1, 2, 5, 6 | Item #12's `__DEV__` sample-data panel at `finanzas://sample-data` → **Cargar datos de ejemplo** (loads `apps/mobile/src/db/__fixtures__/store-v1.sql`), or a real Banco de Chile connection plus one sync |
| Credential entry in the keychain | Steps 2, 6.4 | Connect a bank through item #9's flow, or item #9's `__DEV__` connect-fixtures panel |
| Empty store | Step 3 | Delete the app from the simulator, or complete Step 6 |
| No new shipped seed data | — | This item adds none; `pnpm --filter @finanzas/mobile db:seed` must produce no diff to `store-v1.sql` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Native module missing at launch | The dev client predates `expo-secure-store` (item #9) | Rebuild the dev client; Expo Go cannot run this app |
| The hub's subtitles all show fallback copy | The store is empty, or the sample-data fixture was not loaded | Load the fixture or connect a bank; confirm on the profile screen that the movement count is non-zero |
| After the wipe, settings still shows the old figures | The memoized database handle was not invalidated | `resetAppDatabase()` is the only sanctioned invalidation path (plan Decision 3); check that `resetStore` is wired into `use-wipe-local-data.ts` |
| After the wipe, the credential form arrives with a locked RUT | A credential entry survived — an **AC1 failure** | Compare the keys `collectCredentialKeys` derived against what the keychain actually holds; the usual cause is a key written outside `credentialsKeyFor` (which `secure-store-key-namespace.test.ts` should have caught) |
| The wipe navigates to onboarding but a back gesture returns to settings | `router.dismissAll()` was skipped before `router.replace` | Plan Decision 4 |
| *Usando la app desde* shows `ene 2025` | `formatMonthYear` was used instead of `formatLongMonthYear` | Plan Decision 10 |
| The about version reads `0.0.0` | Expected — `app.config.js` still carries the pre-release version | Plan Decision 9 and Assumption A6; not a finding |

---

## Known Limitations

- **Step 6 is not repeatable without setup cost.** Every run of the destructive path requires
  reconnecting a bank and re-syncing before the runbook can be run again from Step 1.
- **Step 7 requires a temporary local code edit** and is therefore developer-assisted rather than a
  pure black-box step. The automated equivalent (scenario 2 in the plan's Testing Strategy) runs on
  every commit; Step 7 exists only to confirm the on-device presentation of that failure.
- **The keychain cannot be enumerated from the runbook.** "No credential entry survives" is
  verified indirectly on-device (the RUT field is editable again) and directly only in the Node
  test, where the store is a fake whose contents can be listed. That asymmetry is inherent to
  `expo-secure-store` and is why the plan makes the key-space derivation a tested property.
- **Fidelity is a lightweight visual comparison**, not a pixel diff, unless item #47's tooling has
  landed.
