# Smoke Test Runbook: Encrypt the local database at rest

**Feature**: Encrypt the local database at rest (#25)
**Work item brief**: [#25](https://github.com/lhpaul/personal-finances/issues/25) — Refactor item; the issue body is the brief, there is no spec
**Implementation plan**: [`2_25-encrypt-local-database_implementation-plan.md`](../../specs/developments/20260802195509_25-encrypt-local-database/2_25-encrypt-local-database_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Why this runbook is device-only

`better-sqlite3` — the driver the whole Node test tier runs on — has no SQLCipher and cannot be
given one. Three properties of this feature are therefore **impossible to assert in Jest** and are
owned entirely by this runbook:

1. `PRAGMA key` actually encrypts the pages.
2. `sqlcipher_export` copies faithfully **through a codec**.
3. A wrong or absent key is rejected rather than silently opening an empty database.

Steps 3 and 5 are those assertions. They are not optional coverage — they are the only coverage.

**No design-fidelity step appears in this runbook.** This item ships no product screen, and the
mockup manifest contains nothing for encryption or migration (implementation plan Verification Log
row V30). There is no baseline to compare against and none is invented.

---

## Prerequisites

- [ ] **A freshly prebuilt dev client.** Run `npx expo prebuild --clean` and build. A dev client
      built before this item landed does **not** contain SQLCipher, and every step below will fail
      in a way that looks like a code bug. This is the most common way to waste an hour on this
      runbook.
- [ ] A physical device or simulator with the dev client installed.
- [ ] `pnpm dev:mobile` running.
- [ ] Access to the dev-only gallery route (`finanzas://gallery`) — the encryption probe lives
      there.
- [ ] For Step 3 you need a **pre-upgrade build**: the last commit on `develop` *before* this
      item, built as a separate dev client (or the same client run before the update). Keep it
      installable — you cannot fabricate an unencrypted store from an encrypted build.

---

## Test Data

| Item | Value |
| --- | --- |
| Legacy plaintext database | `finanzas.db` |
| Encrypted database | `finanzas.enc.db` |
| Secure-store key for the database key | `db_key:main` |
| Commit marker | `app_settings` row with key `encryption_migrated_at` |
| Dev probe | `finanzas://gallery` → **Encryption probe** |
| Expected SQLCipher version | `4.7.0` |

---

## Smoke Test Steps

### Step 1: Confirm the build actually contains SQLCipher

**Maps to**: implementation plan Decision 2 and Decision 8. This step gates every step after it.

1. Launch the app on the freshly built dev client.
2. Navigate to `finanzas://gallery` and open **Encryption probe**.
3. Read the `PRAGMA cipher_version` line.

**Expected result**: a version string is reported (expected `4.7.0`). The app launched normally.

**If it reports nothing**: the binary was built without `useSQLCipher`. Stop here — the app should
also have refused to launch with `DatabaseEncryptionUnavailableError`, and if it launched *and*
reported no version, that is a **blocking defect** in the capability probe, not a build problem.

---

### Step 2: A new install creates an encrypted database

**Maps to**: brief acceptance criterion 1 — *"A new install creates an encrypted database"*.

1. Fully uninstall the app from the device (not just a data clear — remove the app).
2. Reinstall the dev client and launch.
3. Complete onboarding far enough to reach the home screen, so seeds and the `users` row exist.
4. Open the encryption probe.

**Expected result**:

- The probe reports **key present: yes**.
- Opening `finanzas.enc.db` **with the stored key** succeeds and reports per-table row counts, with
  the seeded categories and institutions present.
- The probe reports that no legacy `finanzas.db` remains.
- **The probe never prints the key itself** — only `key present: yes`. If any key material appears
  on screen, that is a blocking defect (non-negotiable #1).

---

### Step 3: An existing unencrypted database migrates without data loss

**Maps to**: brief acceptance criterion 2 — *"An existing unencrypted database migrates without
data loss"*. This is the highest-risk step in the item.

**Part A — build the pre-upgrade state**

1. Install the **pre-upgrade** build (see Prerequisites).
2. Complete onboarding, connect Banco de Chile, and run a real sync so the store holds actual
   movements.
3. Categorize at least three movements, create one merchant alias, and exclude one transaction
   with a reason. This puts rows in `transactions`, `merchants`, `merchant_aliases` and
   `transaction_categories` — several of the tables the census covers.
4. Record the **per-table row counts** from the pre-upgrade build's own dev tooling into the table
   below. Also note one specific transaction's description, amount and category so you can find it
   by eye afterwards.

| Table | Rows before |
| --- | --- |
| `users` | |
| `financial_institutions` | |
| `user_financial_institutions` | |
| `transaction_categories` | |
| `user_financial_products` | |
| `merchants` | |
| `merchant_aliases` | |
| `transactions` | |
| `app_settings` | |
| `user_budgets` | |
| `user_recurring_transactions` | |
| `seed_ledger` | |
| `__drizzle_migrations` | |

**Part B — upgrade in place**

1. **Without uninstalling**, install the new build over the old one.
2. Launch the app. Note the time from launch to the home screen becoming interactive.

**Expected result**:

- The app reaches the home screen. **No migration UI appears** — a successful migration is
  invisible by design.
- The transaction you noted in Part A step 4 is present, on the same date, with the same amount
  and the same category.
- The excluded transaction is still excluded, with the same reason.
- The merchant alias still groups the same movements.
- Onboarding does **not** restart. (If it does, the store was recreated rather than migrated —
  blocking defect.)

**Part C — prove nothing was lost**

1. Open the encryption probe and read the per-table row counts from the encrypted store.
2. Fill in the column below and compare.

| Table | Rows after | Matches before? |
| --- | --- | --- |
| `users` | | |
| `financial_institutions` | | |
| `user_financial_institutions` | | |
| `transaction_categories` | | |
| `user_financial_products` | | |
| `merchants` | | |
| `merchant_aliases` | | |
| `transactions` | | |
| `app_settings` | | |
| `user_budgets` | | |
| `user_recurring_transactions` | | |
| `seed_ledger` | | |
| `__drizzle_migrations` | | |

**Expected result**: every row matches, with exactly one permitted difference — `app_settings` may
be **one row larger**, because the migration writes the `encryption_migrated_at` marker. Any other
difference is a blocking defect.

3. Record the launch duration from Part B step 2 here: `________`. This is the baseline for
   risk R9; it is not a pass/fail threshold on this run.

**Expected result**: the probe reports that `finanzas.db` no longer exists.

---

### Step 4: The migration is resumable and never destroys the original

**Maps to**: implementation plan Decision 5 and Decision 6 (non-negotiable #5 — a bad migration is
unrecoverable in the field). This step deliberately interrupts the riskiest operation.

1. Rebuild the Part A pre-upgrade state (repeat Step 3 Part A, or restore a device backup of it).
2. Install the new build but **do not** let the first launch finish: launch the app and force-quit
   it (swipe away / stop the process) within the first second, before the home screen appears.
3. Launch again and let it finish.

**Expected result**:

- The second launch completes and the home screen renders with all the Part A data intact.
- The per-table counts still match Step 3 Part C.
- The app never shows a corrupt or empty state at any point.

4. Repeat the force-quit once more, this time force-quitting **immediately after** the home screen
   first renders, then launch a third time.

**Expected result**: the third launch is fast and uneventful — the store is already migrated and
marked, so no copy is repeated.

---

### Step 5: The database file is unreadable without the key

**Maps to**: brief acceptance criterion 3 — *"The database file is unreadable without the key —
verified by test"*.

1. Open the encryption probe.
2. Read the three open results it reports.

**Expected result**:

| Probe | Expected |
| --- | --- |
| Open `finanzas.enc.db` with **no key**, then query `sqlite_schema` | **Fails** — `file is not a database` / `SQLITE_NOTADB` |
| Open `finanzas.enc.db` with a **wrong key**, same query | **Fails** the same way |
| Open with the **stored key**, same query | **Succeeds**, reports the table list |

Any open that succeeds without the correct key is a **blocking defect** — it means the store is
not actually encrypted, regardless of what `cipher_version` reported.

**Optional supplementary check (no app change required)**: pull the app container off the device
(Xcode → Devices → Download Container on iOS; `adb exec-out run-as cl.finanzas.mobile cat …` on
Android) and inspect the first 16 bytes of `finanzas.enc.db`:

```bash
xxd -l 16 finanzas.enc.db
```

**Expected result**: the bytes are **not** the ASCII string `SQLite format 3`. A plaintext SQLite
file always begins with that magic; an encrypted SQLCipher file begins with its random salt.

---

### Step 6: The wipe deletes the database key

**Maps to**: the dispatch constraint that #19's wipe must also delete the database key
(implementation plan Decision 11).

1. From the state left by Step 3 (a migrated store with real data), go to **Ajustes** →
   **Eliminar cuenta** and confirm the deletion.
2. Wait for the wipe to report success.
3. Open the encryption probe **before** completing onboarding again.

**Expected result**:

- The probe reports **key present: no** — the `db_key:main` entry is gone.
- The probe reports that neither `finanzas.enc.db` nor `finanzas.db` holds user data.
- The app has returned to `onboarding-intro`.

4. Complete onboarding again and reopen the probe.

**Expected result**: **key present: yes** again, and it is a **different** key — the wipe did not
leave the old one behind for the new store to reuse. (The probe reports a short non-reversible
fingerprint of the key for this comparison, never the key.)

---

### Step 7: A misconfigured build fails loudly, not silently

**Maps to**: implementation plan Decision 8 and risk R1. Skip this step only if you cannot produce
a non-SQLCipher build; note the skip in the results.

1. Temporarily revert `apps/mobile/app.config.js` to the bare `'expo-sqlite'` plugin entry.
2. `npx expo prebuild --clean` and build a dev client from the **current** JavaScript.
3. Launch it.

**Expected result**: the app **fails to launch** with `DatabaseEncryptionUnavailableError`. It does
**not** open a plaintext store, and it does **not** report success. A launch that succeeds here is
the single worst outcome this feature can produce and is a blocking defect.

4. Restore `app.config.js`, prebuild and rebuild before continuing.

---

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below.
- Paste the Step 3 Part C row-count table and the Step 5 probe output into the PR description
  (implementation plan, *Residual Verification Strategy*).
- Uninstall the test builds and restore your normal dev client.

---

## Assertions Checklist

Each checkbox maps to a brief acceptance criterion or to a non-negotiable this item touches.

- [ ] **AC1** — a fresh install creates `finanzas.enc.db` and it opens only with the stored key (Step 2)
- [ ] **AC2** — an existing unencrypted store migrates with every per-table row count preserved, apart from the single new `encryption_migrated_at` marker row (Step 3)
- [ ] **AC2** — the migrated store keeps a specific known transaction's date, amount, category, exclusion and merchant grouping (Step 3 Part B)
- [ ] **AC2** — onboarding does not restart after the upgrade (Step 3 Part B)
- [ ] **AC3** — opening the encrypted file with no key fails with `SQLITE_NOTADB` (Step 5)
- [ ] **AC3** — opening the encrypted file with a wrong key fails with `SQLITE_NOTADB` (Step 5)
- [ ] **AC3** — the file header is not the plaintext SQLite magic (Step 5, optional check)
- [ ] **Non-negotiable #1** — the key is never displayed, logged or written anywhere but `expo-secure-store`; the probe shows only presence and a fingerprint (Steps 2, 6)
- [ ] **Non-negotiable #5** — an interrupted migration resumes without data loss, and the plaintext original survives until its replacement is verified (Step 4)
- [ ] **Wipe** — "Eliminar cuenta" removes the database key as well as the store, and a new profile gets a new key (Step 6)
- [ ] **Fail-closed** — a build without SQLCipher refuses to launch rather than falling back to plaintext (Step 7)
- [ ] `PRAGMA cipher_version` reports a SQLCipher version on the shipped build (Step 1)

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Seeded categories, institutions, merchants | Present after any successful bootstrap | Automatic — `ensureDatabaseReady()` on first launch |
| Real scraped movements | Needed for Step 3's before/after comparison | Connect Banco de Chile in the pre-upgrade build and run a sync |
| Categorizations, an alias, an exclusion | Needed so the census covers more than seed tables | Perform them by hand in the pre-upgrade build (Step 3 Part A) |

There is **no new seed fixture** for this item. The Jest tier uses the existing committed
`apps/mobile/src/db/__fixtures__/store-v1.sql`; this runbook uses real synced data, because the
point of Step 3 is to exercise the migration against a store the tests cannot construct.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| App fails to launch with `DatabaseEncryptionUnavailableError` | The binary was built without `useSQLCipher` | `npx expo prebuild --clean` and rebuild the dev client. This is expected behaviour, not a bug |
| App fails to launch with `DatabaseKeyMissingError` | The keychain entry was removed while an encrypted store still holds data | Unrecoverable by design (implementation plan risk R2). Uninstall and reinstall to start clean. Do not add a "regenerate the key" path |
| `PRAGMA cipher_version` reports nothing but the app launched anyway | The capability probe is not wired into the launch path | Blocking defect — the probe is the only thing standing between a user and a silently plaintext database |
| Migration appears to hang at launch | A large store, or a `CipherHandle` left open so `deleteDatabase` throws | Check the probe for a leftover `finanzas.enc.db` without the marker; a second launch should discard and retry it. If it retries forever, the commit-marker write is failing |
| `deleteDatabase` throws `DeleteDatabaseException` | A cached `expo-sqlite` handle is still open for that path (see plan V17, V18) | Every open must be closed in a `finally` before deletion. This is a code defect, not an environment issue |
| Row counts match but a transaction looks wrong | Not a migration failure — check whether the sync engine re-synced and updated the row | Compare `updated_at`; re-run Step 3 without triggering a sync after the upgrade |
| Onboarding restarts after the upgrade | The migration did not run and the app created a fresh encrypted store | Blocking defect — the legacy store's existence probe (plan Decision 7) is not detecting `finanzas.db` |

---

## Known Limitations

- **Steps 3, 4 and 7 need three separate builds** (pre-upgrade, current, and a deliberately
  misconfigured one). There is no way around this: an encrypted build cannot create the
  unencrypted store that Step 3 needs as its input.
- **The device tier is manual.** CI cannot build a native binary, so none of these assertions can
  be automated in this repository as it stands. If #22's Maestro suite later gains a device-build
  job, Steps 2, 3 and 6 are the candidates to automate; Steps 5 and 7 are not, because they need
  process-level failure assertions Maestro does not express.
- **The optional file-header check in Step 5 needs desktop tooling** (Xcode or `adb`). It is
  supplementary — the probe's no-key and wrong-key opens are the authoritative assertion.
- **Step 4 cannot target an exact crash point.** Force-quitting hits an arbitrary moment in the
  copy; the intent is to sample the interrupted-migration space, not to enumerate it. Enumeration
  is the Jest tier's job (`migrate-to-encrypted.test.ts`).
