# Encrypt the local database at rest — Implementation Plan

**Work item brief**: [#25 — Encrypt the local database at rest](https://github.com/lhpaul/personal-finances/issues/25)
(Refactor item — there is no spec; the issue body is the brief)
**Smoke test runbook**: [`docs/testing/mobile/25-encrypt-local-database.smoke-test.md`](../../../testing/mobile/25-encrypt-local-database.smoke-test.md)

---

## Summary

**Approach**: Turn on the SQLCipher build of `expo-sqlite` (already vendored in the installed
version — no new npm or native dependency), hold a 32-byte random key in `expo-secure-store`, and
move the store to a **second database filename** rather than encrypting the existing file in
place. A new install creates `finanzas.enc.db` encrypted from its first byte. An existing install
copies `finanzas.db` into `finanzas.enc.db` with `ATTACH … KEY` + `sqlcipher_export()`, verifies
the copy row-by-row with the census comparator this repository already ships, writes a commit
marker inside the encrypted store, and only then deletes the plaintext file. Because there are two
files and one marker, every crash point is recoverable from what is on disk, and the plaintext
original is never mutated and never deleted before its replacement has been verified.

**Estimated complexity**: **L**

**Rationale**: The code volume is modest (one new `src/db/encryption/` folder, three edited files,
one config line). The cost is elsewhere: this is the only change in the product that can
irreversibly destroy a user's data, it crosses a native build boundary that no JS test tier can
exercise, and it edits surfaces owned by three other in-flight items (#8, #9, #19). The plan spends
most of its weight on the failure states and on being explicit about what the Node test tier does
and does not prove.

**Dependencies**: This item must land **last among the data-layer items.**

| Depends on | Why | State at plan time (`3ac49ee`) |
| --- | --- | --- |
| [#3 local database](https://github.com/lhpaul/personal-finances/issues/3) | Owns `src/db/client.ts`, `bootstrap.ts`, `migrate.ts`, `checks/preservation.ts` — every seam this item extends | **Implemented and merged** (`e86f852`); files present in the tree |
| [#9 connect a bank](https://github.com/lhpaul/personal-finances/issues/9) | Owns `src/lib/secure-store/` — `SecureStorePort`, the Expo adapter, the `secureStoreBoundary` lint rule. This item stores the database key through that port | Plan merged; **implementation not started** |
| [#8 onboarding](https://github.com/lhpaul/personal-finances/issues/8) | Owns `src/db/runtime.ts` → `getAppDatabase()`, the memoized launch path this item inserts the key read and the migration into | Plan merged; implementation open as **PR [#72](https://github.com/lhpaul/personal-finances/pull/72)** |
| [#19 settings hub](https://github.com/lhpaul/personal-finances/issues/19) | Owns `wipeLocalData`, `collectCredentialKeys`, `resetAppDatabase()` and `secure-store-key-namespace.test.ts`. The wipe must delete the database key, and #19's namespace test **fails by design** when a second key namespace appears | Plan merged; implementation not started |
| [#10 sync engine](https://github.com/lhpaul/personal-finances/issues/10) | Not a code dependency. A **sequencing** dependency: the store must be full of real scraped rows and stable before the container changes underneath it | Plan merged; implementation not started |

Implementation Order **Step 0** is a landing-tree verification gate that turns each row above into
a concrete file check the implementer runs before editing anything. If Step 0 fails, stop and
report — do not stub the missing seam.

---

## Verification Log

Every claim below was produced against repo revision **`3ac49ee`** (`origin/develop`) on
**2026-08-02**. The `expo-sqlite` source was read from the installed package tree at
`.claude/worktrees/item-47/node_modules/expo-sqlite` (version `16.0.10`, matching the lockfile);
the plan worktree has no `node_modules` of its own.

| # | Check | Command / source | Result |
| --- | --- | --- | --- |
| V1 | Repo revision | `git rev-parse --short HEAD` | `3ac49ee` (equals `origin/develop`); worktree clean |
| V2 | `expo-sqlite` version in use | `grep -n "expo-sqlite@" pnpm-lock.yaml` and `apps/mobile/package.json` | Locked at **`16.0.10`**, declared `~16.0.10` |
| V3 | **SQLCipher is vendored, not an add-on** | `ls node_modules/expo-sqlite/vendor/` | `sqlite3/` and **`sqlcipher/`** — `vendor/sqlcipher/sqlite3.c` is present in the installed package |
| V4 | SQLCipher is opt-in via the config plugin | `plugin/build/withSQLite.d.ts` | `Props` declares `useSQLCipher?: boolean` at top level and per-platform (`android`, `ios`) |
| V5 | How the flag reaches the native build | `plugin/build/withSQLite.js` | Writes the gradle property `expo.sqlite.useSQLCipher` (Android) and the Podfile property `expo.sqlite.useSQLCipher` (iOS) |
| V6 | iOS honours the property | `ios/ExpoSQLite.podspec` lines 44-50 | `if podfile_properties['expo.sqlite.useSQLCipher'] == 'true'` → swaps in `vendor/sqlcipher` and adds `-DSQLITE_HAS_CODEC=1 -DSQLCIPHER_CRYPTO_CC -DSQLITE_EXTRA_INIT=sqlcipher_extra_init …` |
| V7 | Android honours the property | `android/build.gradle` lines 16-24 | `USE_SQLCIPHER = findProperty('expo.sqlite.useSQLCipher') == 'true'`; `SQLITE3_SRC_DIR` switches to `vendor/sqlcipher` |
| V8 | SQLCipher version and Android 16 KB page-size fix | `node_modules/expo-sqlite/CHANGELOG.md` | SQLCipher **4.7.0**; *"Fixed Android 16kb page size issue when enabling `useSQLCipher`"* landed in **16.0.9** — the installed 16.0.10 includes it |
| V9 | **`PRAGMA rekey` cannot encrypt a plaintext database** | `vendor/sqlcipher/sqlite3.c`, `exsqlite3_rekey_v2` (~line 110951) | *"no codec attached to db %s: rekey can't be used on an unencrypted database"* → returns `SQLITE_MISUSE` |
| V10 | The sanctioned conversion path, in SQLCipher's own words | `vendor/sqlcipher/sqlite3.c`, PRAGMA error text (~line 148178) | *"PRAGMA rekey can only be run on an existing encrypted database. **Use sqlcipher_export() and ATTACH to convert encrypted/plaintext databases.**"* |
| V11 | `sqlcipher_export` is registered as a SQL function | `vendor/sqlcipher/sqlite3.c` ~line 107908 | `exsqlite3_create_function_v2(db, "sqlcipher_export", -1, SQLITE_TEXT, …)` |
| V12 | **What `sqlcipher_export` copies** | `sqlcipher_exportFunc` body, ~lines 111138-111260 | `CREATE TABLE` (rootpage > 0), `CREATE INDEX`, `CREATE UNIQUE INDEX`, `INSERT … SELECT *` per table, `sqlite_sequence` contents, and `view`/`trigger`/virtual-table rows copied into the target `sqlite_schema`. **`PRAGMA user_version` is not copied** |
| V13 | Raw hex keys are supported | `vendor/sqlcipher/sqlite3.c` ~lines 108762-109317 | `x'hex(key)…hex(salt)'` and `x'hex(key)'` forms; parser requires the literal to start with `x'` |
| V14 | A capability probe exists | `vendor/sqlcipher/sqlite3.c` ~line 110176 | `PRAGMA cipher_version` is handled only under the SQLCipher build; a plain SQLite build returns no row |
| V15 | Nothing runs before we can set the key | `build/SQLiteDatabase.js` `openDatabaseSync`; `ios/SQLiteModule.swift` `initDb` (~line 346); `android/…/SQLiteModule.kt` `initDb` (~line 356) | `openDatabaseSync` → `new NativeDatabase(...)` → `initSync()`; on **both** platforms `initDb` only installs the update hook. No SQL is executed on open |
| V16 | `SQLiteOpenOptions` has no key field | `build/NativeDatabase.d.ts` | `enableChangeListener`, `useNewConnection`, `finalizeUnusedStatementsBeforeClosing`, `libSQLOptions` — the key must be set with `PRAGMA key`, not an open option |
| V17 | Connections are cached by path + options | `ios/SQLiteModule.swift` ~line 108; `android/…/SQLiteModule.kt` ~line 110 | Identical predicate on both platforms: `databasePath == databasePath && openOptions == options && !useNewConnection` — a second `openDatabaseSync` of the same name returns the **same keyed handle** |
| V18 | `deleteDatabase` semantics | `ios/SQLiteModule.swift` ~lines 510-529; `android/…/SQLiteModule.kt` ~lines 523-538 | Identical on both platforms: throws `DeleteDatabaseException` if a cached handle for **that path** is open; throws `DatabaseNotFoundException` if the file is absent; removes **only** the main file (no `-wal` / `-shm` sweep) |
| V19 | The app does not enable WAL | `grep -rn "journal_mode" apps/mobile` | No hit. `client.ts` sets only `PRAGMA foreign_keys = ON`, so the store is in the default rollback-journal mode and has no persistent sidecar files |
| V20 | The migration ledger is a table, not `user_version` | `apps/mobile/src/db/bootstrap.ts` `countAppliedMigrations` | `select count(*) … from __drizzle_migrations` — a real table, therefore inside V12's copy set |
| V21 | Nothing in the app reads `user_version` | `grep -rn "user_version" apps/mobile` | Zero hits |
| V22 | Tables whose rows must survive the copy | `grep -n "DUMP_TABLE_ORDER" -A15 apps/mobile/scripts/db/dump.ts` | 12 declared tables (`users` … `seed_ledger`) plus `__drizzle_migrations`, dumped by direct introspection |
| V23 | A census comparator already exists | `apps/mobile/src/db/checks/preservation.ts` | `Census`, `CensusTable`, `findPreservationViolations(before, after)` returning `table_missing_after_migration` / `row_lost` / `column_value_changed` |
| V24 | `expo-crypto` can produce the key | `node_modules/expo-crypto/build/Crypto.d.ts` | `getRandomBytesAsync(byteCount): Promise<Uint8Array>` — and `expo-crypto` is **already** a dependency of `@finanzas/mobile` |
| V25 | `expo-secure-store` is not installed yet | `grep -rn "expo-secure-store" apps/mobile/package.json` | No hit — it arrives with #9. Confirms the #9 dependency is real, not defensive |
| V26 | The `expo-sqlite` plugin entry today | `apps/mobile/app.config.js` | `plugins: ['expo-router', 'expo-localization', 'expo-sqlite']` — a bare string with no props object |
| V27 | The SQL access boundary this item must respect | `apps/mobile/src/db/__tests__/db-access-boundary.test.ts`, root `eslint.config.mjs` (`dbAccessBoundary`) | `drizzle-orm`, `drizzle-orm/*`, `expo-sqlite`, `better-sqlite3` are forbidden outside `src/db/**` |
| V28 | #19's namespace test will reject a second key namespace | #19 plan, Decision 2 | *"A future item that adds a second namespace fails that test and is forced to extend `collectCredentialKeys` in the same change."* |
| V29 | `db:check` runs in CI | `.github/workflows/ci.yml` line 111 | `pnpm --filter @finanzas/mobile db:check` |
| V30 | Design assets for this item | Issue #25 body; `grep -rn -i "encrypt\|cifrad\|sqlcipher" design/mockups/mobile/mockup-manifest.js` | No `## Design assets` section in the brief; **zero** mockup hits. This item ships no product screen |
| V31 | The boundary test's exact scan scope | `apps/mobile/src/db/__tests__/db-access-boundary.test.ts` | `ROOTS = [app/, src/]`, filtered by `isUnderDbDir`. So **`src/dev/` is in scope** and may not import `expo-sqlite` — this is what forces Decision 12's split |

### The escalation question, answered

The brief and the dispatch note both asked whether `expo-sqlite` can genuinely encrypt at rest, or
whether this needs a native-dependency decision. **It can, and it does not need a new dependency.**
V3-V8 establish that SQLCipher 4.7.0 ships inside the `expo-sqlite@16.0.10` package that is already
installed, and that a single config-plugin prop selects it.

What it **does** need is a **native rebuild**, which is a real and non-negotiable consequence
recorded as Decision 2 and Risk R1: this change can never be delivered by a JS-only OTA update, and
every developer, every EAS profile and every existing dev client must be rebuilt. That is inside
the brief's scope (*"Adopt SQLCipher (or `expo-sqlite` encryption)"*) and inside the project's
existing constraint that the app already requires a dev build, so it is recorded as an assumption
with a mitigation rather than raised as a blocking escalation.

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Plan artifact base branch and artifact owner | Base `develop`; this repository owns the plan | `.ai-dev-workflow.yaml` declares no `repository.mode`, so `single_repo` applies; branch cut from `origin/develop` | 2026-08-02, `3ac49ee` | Current invocation (item #25 only) | `Verified` |
| **The `expo-sqlite` config-plugin entry in `app.config.js`** | Today a bare string `'expo-sqlite'`; this item converts it to `['expo-sqlite', { useSQLCipher: true }]` | `apps/mobile/app.config.js` (V26) | 2026-08-02, `3ac49ee` | The three open PRs (#72, #61, #46). File lists checked with `gh pr view <n> --json files`; **none** touches `apps/mobile/app.config.js` | `Verified` |
| **The secure-store port surface and key namespace** | `SecureStorePort { getItem, setItem, deleteItem }` in `src/lib/secure-store/types.ts`; `credentialsKeyFor(id) === 'bank_creds:' + id`; no list-keys method | #9 implementation plan (merged), *Frontend/UI — new files* and Decisions 4-5; corroborated by `docs/project/4-database-model.md` line 151 | 2026-08-02, `3ac49ee` | Open PRs #72, #61, #46 — none creates or edits `src/lib/secure-store/**`. #9 itself has no open PR at this revision | `Verified` — this item **widens** `setItem` (Decision 4) and **adds** the `db_key:` namespace (Decision 3); it introduces no competing port |
| **The memoized runtime handle** | `src/db/runtime.ts` → `getAppDatabase(): Promise<AppDatabase>`, module-level single-flight, `__resetAppDatabaseForTests()` | Read directly from `origin/feature/8-onboarding-intro-value-ready:apps/mobile/src/db/runtime.ts` | 2026-08-02, `3ac49ee` | Same-surface open PR **#72 only**. It **creates** the file; this item **extends** it and adds no second launch path | `Verified` — ordering dependency recorded in Step 0 |
| **`expo-sqlite` version and its SQLCipher capability** | `~16.0.10`, SQLCipher 4.7.0 vendored, Android 16 KB fix included | `apps/mobile/package.json`, `pnpm-lock.yaml`, `node_modules/expo-sqlite/{vendor,CHANGELOG.md}` (V2, V3, V8) | 2026-08-02, `3ac49ee` | Open PRs #72, #61, #46 — #61 edits the **root** `package.json` (fidelity-kit devDependencies), #46 edits `packages/bank-scraper/package.json`. Neither touches `apps/mobile/package.json` or the `expo-sqlite` pin | `Verified` |

No `Conflict` rows. Nothing here needs parent-orchestrator resolution before implementation begins.
Implementation **Step 0** re-verifies every row above against the tree the item actually lands on;
a `Stale or conflicting` result there is a stop-before-edits condition per protocol 02.

---

## Key Decisions

Indices are stable within this document and are referenced by the Layer-by-Layer, Testing and
Implementation Order sections.

### Decision 1 — `sqlcipher_export`, not `PRAGMA rekey`

This is the single most consequential research finding and it disqualifies the obvious approach.
`PRAGMA rekey` **cannot** encrypt a plaintext database: SQLCipher's own implementation returns
`SQLITE_MISUSE` with *"rekey can't be used on an unencrypted database"* (V9), and its PRAGMA error
text points at the alternative in so many words — *"Use sqlcipher_export() and ATTACH to convert
encrypted/plaintext databases"* (V10).

So the conversion is a **copy into a second file**, not a transformation of the first:

```sql
-- Illustrative — adapt during implementation. Executed on the open plaintext handle.
ATTACH DATABASE '<encrypted path>' AS encrypted KEY "x'<64 hex chars>'";
SELECT sqlcipher_export('encrypted');
DETACH DATABASE encrypted;
```

V12 records exactly what that copies: every table with storage and its rows, plain and unique
indexes, `sqlite_sequence`, and the schema rows for views, triggers and virtual tables. Two
consequences matter here:

- `__drizzle_migrations` **is** copied (it is an ordinary table — V20), so the encrypted store
  arrives with the migration ledger intact and Drizzle re-applies nothing. This is what keeps
  non-negotiable #5 satisfied: **this item adds no Drizzle migration at all** (Decision 6).
- `PRAGMA user_version` is **not** copied. Nothing in this app reads it (V21), but the migration
  copies it across anyway — one cheap statement, and it removes a silent divergence that a future
  tool might trip over.

### Decision 2 — SQLCipher is a native build flag, and that is a hard delivery constraint

`app.config.js`'s plugins array becomes:

```js
// Illustrative — adapt during implementation.
plugins: ['expo-router', 'expo-localization', ['expo-sqlite', { useSQLCipher: true }]],
```

That writes `expo.sqlite.useSQLCipher=true` into the gradle properties and the Podfile properties
(V5), which makes the podspec and `build.gradle` compile `vendor/sqlcipher/sqlite3.c` with
`-DSQLITE_HAS_CODEC=1` instead of the plain SQLite source (V6, V7).

Three consequences the implementer must not discover late:

1. **No JS-only delivery.** A binary built without the flag has no `PRAGMA key` support. Shipping
   this item's JavaScript to such a binary over the air is the worst possible outcome, because
   plain SQLite **silently ignores unknown pragmas** — the app would believe it had encrypted a
   store that is still plaintext. Decision 8 makes that state impossible to reach silently.
2. **Everyone rebuilds.** `npx expo prebuild --clean` (or a fresh EAS build) for every developer,
   every simulator, every internal build. Expo Go could never run this app anyway (it needs a dev
   build for the WebView scraper).
3. **No new dependency.** Nothing is added to `apps/mobile/package.json`. `expo-crypto` (V24) and
   #9's `expo-secure-store` cover the key; `expo-file-system` is deliberately **not** added
   (Decision 7).

### Decision 3 — the key: 32 random bytes, hex, in `expo-secure-store` under `db_key:main`

```text
DB_KEY_STORAGE_KEY = 'db_key:main'
```

- **Material**: `Crypto.getRandomBytesAsync(32)` (V24), rendered as 64 lowercase hex characters and
  passed as a SQLCipher **raw key** — `PRAGMA key = "x'<64 hex>'"` (V13). Raw-key form skips PBKDF2
  derivation on every open, and the per-database salt still lives in the encrypted file header, so
  two devices with the same key would still produce different ciphertext.
- **Provenance**: generated on the device, from the device CSPRNG, once. It is **not** derived from
  anything in this repository, from the bundle, from the device identifier, or from any user input.
  Non-negotiable #1's rule for bank credentials, extended verbatim to the database key.
- **Storage**: `expo-secure-store` only, through #9's `SecureStorePort`. Never in SQLite, never in
  `app_settings`, never in a log line, never in an error payload. `src/db/encryption/**` is added
  to the `no-console: 'error'` override that #9 applies to `src/lib/secure-store/**`, and no error
  message in these modules interpolates key material — the errors carry a state name, never a
  value.
- **The one-way rule**, implemented by `ensureDatabaseKey` in `src/db/encryption/key.ts`: the key
  is generated **only** when `getItem(DB_KEY_STORAGE_KEY)` returns `null` **and** no encrypted
  store with content exists. Regenerating a key while an encrypted store exists destroys every byte
  in it. Decision 5 makes this an explicit, tested, fail-closed branch rather than an implicit
  assumption.

### Decision 4 — the database key is stored `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, unlike a credential

#9 writes credentials with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` and hard-codes it
in the adapter, because a credential is only ever read during a foreground, user-initiated sync.
The database key is different: **anything that wakes the app needs it**, including #18's local
notification handling, which can run while the device is locked. A `WHEN_UNLOCKED` key would make
the store unreadable in exactly that case.

So this item widens the port by one optional argument, leaving every existing call site unchanged:

```ts
// apps/mobile/src/lib/secure-store/types.ts — Illustrative, adapt during implementation.
export type SecureStoreAccessibility = 'when_unlocked_this_device' | 'after_first_unlock_this_device';

export interface SecureStorePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string, options?: { accessibility?: SecureStoreAccessibility }): Promise<void>;
  deleteItem(key: string): Promise<void>;
}
```

The Expo adapter maps the union to `SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` /
`SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` and **defaults to `when_unlocked_this_device`**,
so #9's behaviour is byte-identical when the option is omitted. Both are `…ThisDeviceOnly` classes,
so neither the credentials nor the database key are carried into an encrypted device backup — which
is the property #9's Decision 4 was protecting and which this item must not weaken.

### Decision 5 — two filenames and a marker row, not a rename

The riskiest available design is "encrypt in place and swap the files". This plan does not do that.
`deleteDatabase` is the only file operation `expo-sqlite` exposes (V18) — there is no rename, and
adding a filesystem dependency to get one would buy a more dangerous design. Instead:

| Constant | Value | Meaning |
| --- | --- | --- |
| `LEGACY_DATABASE_NAME` | `finanzas.db` | The plaintext store #3 created. Read-only from this item's point of view, until it is deleted |
| `ENCRYPTED_DATABASE_NAME` | `finanzas.enc.db` | The encrypted store. Canonical from this item forward |
| `ENCRYPTION_MARKER_SETTING` | `encryption_migrated_at` | An `app_settings` row **inside the encrypted store**. Its presence is the commit point |
| `EXPORT_ALIAS` | `encrypted` | The `ATTACH` alias used during the copy |

`resolveEncryptionState` is a **pure** function over a probe result and returns one of six states:

| State | Probe shape | Action |
| --- | --- | --- |
| `fresh_install` | encrypted store has no user tables; legacy store has no user tables | Delete the empty legacy probe file; bootstrap the encrypted store normally |
| `already_encrypted` | encrypted store has user tables **and** the marker; no legacy store | Open and proceed. The steady state |
| `plaintext_orphan_after_success` | encrypted store has user tables **and** the marker; legacy store still present | Delete the legacy store, then proceed. Recovers a crash between commit and cleanup |
| `migration_required` | encrypted store has no user tables; legacy store has user tables | Run the copy (Decision 6) |
| `resume_after_partial_copy` | encrypted store has user tables but **no** marker | Delete the encrypted store, then re-enter `migration_required`. The partial copy is worthless and the plaintext original is untouched |
| `unrecoverable_key_missing` | no key in secure store, but the encrypted store has content | **Stop.** Throw `DatabaseKeyMissingError`. Never generate a replacement key, never delete the store |

Every state is derived from what is on disk plus one secure-store read. There is no marker file, no
extra bookkeeping table on the plaintext side, and no state that only exists in memory — so a
process killed at any instant resumes correctly on the next launch. The plaintext store is **never
written to** at any point in this flow.

### Decision 6 — the migration sequence, and where the commit point is

```text
migratePlaintextToEncrypted({ port, keyHex, now }):
   1. legacy = port.openPlain(LEGACY_DATABASE_NAME)
   2. legacy.exec('PRAGMA wal_checkpoint(TRUNCATE);')         // no-op today (V19); cheap insurance
   3. legacy.attachEncrypted(EXPORT_ALIAS, ENCRYPTED_DATABASE_NAME, keyHex)
   4. legacy.exportMainTo(EXPORT_ALIAS)                        // SELECT sqlcipher_export('encrypted')
   5. legacy.copyUserVersionTo(EXPORT_ALIAS)                   // Decision 1
   6. before = buildCensus(legacy, 'main')
      after  = buildCensus(legacy, EXPORT_ALIAS)
      findings = findPreservationViolations(before, after)
      if findings.length > 0 -> abort (see below)
   7. legacy.detach(EXPORT_ALIAS)
   8. legacy.close()
   9. encrypted = port.openKeyed(ENCRYPTED_DATABASE_NAME, keyHex)
  10. setSetting(encrypted.db, ENCRYPTION_MARKER_SETTING, now())   <-- COMMIT POINT
  11. port.deleteDatabaseIfPresent(LEGACY_DATABASE_NAME)
      // The encrypted handle stays open and is returned to the caller. `deleteDatabase`
      // rejects only a cached handle for *that* path (V18), and step 8 already closed the
      // legacy one, so nothing blocks this deletion.
```

**Step 6 is the safety property.** It reuses `findPreservationViolations` from
`src/db/checks/preservation.ts` (V23) — the comparator `db:check` mode 3 already uses to prove
migrations lose nothing — over a census built from both schemas of the *same open connection*, so
the comparison reads real rows out of the real encrypted pages, not out of a buffer. The census
covers the 12 declared tables from `DUMP_TABLE_ORDER` plus `__drizzle_migrations` (V22). Any
finding aborts: detach, close, delete the encrypted store, leave `finanzas.db` exactly as it was,
and throw `DatabaseEncryptionMigrationError` carrying the finding kinds (table and column names
only — never row values).

**Crash analysis**, which is the whole point of the design:

| Killed at | On-disk state | Next launch resolves to | Data loss |
| --- | --- | --- | --- |
| Steps 1-5 | Encrypted store partial, no marker | `resume_after_partial_copy` → delete, retry | None |
| Step 6 abort | Encrypted store deleted by the abort path | `migration_required` → retry | None |
| Steps 7-9 | Encrypted store complete, no marker | `resume_after_partial_copy` → delete, retry (the copy is repeated, which is wasteful and correct) | None |
| Between 10 and 11 | Both stores present, marker written | `plaintext_orphan_after_success` → delete legacy | None |
| After 11 | Encrypted store only | `already_encrypted` | None |

The migration is idempotent in the sense non-negotiable #4 means it: running it twice converges on
the same end state, and the only way to lose the plaintext store is to have already produced and
verified its encrypted replacement.

### Decision 7 — no `expo-file-system`; existence is probed by opening and counting

Determining "does `finanzas.db` exist and have content?" without a filesystem module is done by
opening it and counting user tables:

```sql
SELECT count(*) AS n FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%';
```

Opening a missing database **creates an empty file**, so the `fresh_install` branch deletes that
zero-table probe artefact with `deleteDatabase` before continuing. That is deterministic, it is
exactly reproducible in Node against `better-sqlite3`, and it avoids adding a native module for one
boolean.

Two `expo-sqlite` behaviours constrain the code (V18): `deleteDatabase` **throws** if any cached
handle for that path is still open, so every close is explicit and ordered; and it **throws** if
the file does not exist, so deletion is wrapped in a "delete if present" helper that treats
not-found as success. It also removes only the main file — which is safe precisely because the app
never enables WAL (V19), and the plan does not start.

Connection caching (V17) is the other trap: `openDatabaseSync` returns a *cached, already-keyed*
handle for the same path and options. `PRAGMA key` must therefore be issued exactly once per real
open, which is guaranteed by routing every open through `client.ts` — already the only
`expo-sqlite` importer in the repository (V27) — and by the single-flight in `runtime.ts`.

### Decision 8 — a capability probe, because a silently-plaintext database is the worst outcome

Before anything else, the runtime runs:

```sql
PRAGMA cipher_version;
```

A SQLCipher build returns one row (V14). A plain SQLite build returns **no rows** and no error,
because SQLite ignores unknown pragmas. That asymmetry is what makes this probe the right guard: it
is the only cheap way to distinguish "encrypted" from "the flag was never compiled in and every
`PRAGMA key` I issued was silently discarded".

If the probe returns nothing, the app throws `DatabaseEncryptionUnavailableError` and **does not
open the store**. It does not fall back to plaintext. A user whose build is misconfigured gets a
launch failure — loud, diagnosable, and recoverable by rebuilding — instead of a database they
believe is encrypted and is not.

### Decision 9 — the encryption seam is adapter-level, and the Node tier runs unencrypted

`better-sqlite3` bundles plain SQLite; it has no SQLCipher and cannot be given one. So the Node test
tier can never execute `PRAGMA key` for effect. Rather than pretend otherwise, the seam is drawn so
that everything *except* the cryptography is Node-testable:

```ts
// apps/mobile/src/db/encryption/types.ts — Illustrative, adapt during implementation.
export interface CipherHandle {
  db: AppDatabase;
  exec(sql: string): void;
  userTableCount(schema?: string): number;
  attachEncrypted(alias: string, databaseName: string, keyHex: string): void;
  exportMainTo(alias: string): void;
  copyUserVersionTo(alias: string): void;
  detach(alias: string): void;
  close(): void;
}

export interface CipherDatabasePort {
  cipherVersion(): string | null;
  openPlain(databaseName: string): CipherHandle;
  openKeyed(databaseName: string, keyHex: string): CipherHandle;
  deleteDatabaseIfPresent(databaseName: string): void;
}
```

Two implementations:

- **`client.ts` (device)** builds the real port over `expo-sqlite`. `openKeyed` opens, then issues
  `PRAGMA key` as its **first** statement (safe — V15 proves nothing runs before it), then
  `PRAGMA foreign_keys = ON`, preserving #3's Decision 5.
- **`testing/cipher-port.ts` (Node)** builds a port over `better-sqlite3` where `openKeyed` ignores
  the key and `exportMainTo` performs a plain-SQLite `ATTACH` + schema-and-rows copy that mirrors
  V12's statement set. **This is a labelled test double.** It exists to exercise the orchestration,
  not to prove SQLCipher works.

What the Node tier therefore proves: the six-state resolver, the resume and abort paths, the census
gate, the fail-closed key branches, the wipe ordering, and — via Decision 10 — the exact SQL text
the device will execute. What it cannot prove, and what the device tier owns: that
`PRAGMA key` encrypts, that `sqlcipher_export` copies faithfully through a codec, and that a
wrong key is rejected. Those three are enumerated in the Testing Strategy as device-only
assertions, each with a runbook step.

### Decision 10 — the SQL text lives in a pure module so a typo fails in Node

Every statement the cipher port emits is generated by pure functions in
`apps/mobile/src/db/encryption/statements.ts`, which both the Expo adapter and a contract test
import:

```ts
// apps/mobile/src/db/encryption/statements.ts — Illustrative, adapt during implementation.
const RAW_KEY_HEX = /^[0-9a-f]{64}$/;

export function isValidRawKeyHex(candidate: string): boolean {
  return RAW_KEY_HEX.test(candidate);
}

export function keyPragma(keyHex: string): string {
  assertRawKeyHex(keyHex);
  return `PRAGMA key = "x'${keyHex}'";`;
}

export function attachEncryptedStatement(alias: string, path: string, keyHex: string): string { /* … */ }
export function exportStatement(alias: string): string { /* … */ }
export function detachStatement(alias: string): string { /* … */ }
```

`PRAGMA` does not accept bind parameters, so the key is interpolated — which is exactly why
`assertRawKeyHex` throws on anything that is not 64 lowercase hex characters **before** any string
is built. The value is machine-generated from `getRandomBytesAsync`, so the guard should never
fire; it is there so that it cannot be made to fire by a future change. The alias is a module
constant and the path is derived, never user-supplied.

The contract test asserts the produced text character-for-character, so `PRAGMA key = x'…'`
(missing the required quoting — V13 requires the literal to start with `x'`), a lost semicolon, or
a misspelled `sqlcipher_export` all fail in Jest, in Node, in milliseconds — even though their
*effects* cannot be observed there.

### Decision 11 — the wipe deletes the database key last, and #19's namespace test is widened

#19 defines "every credential key" as a derivation over two tables plus a source-text scan test,
because a keychain cannot be enumerated (#19 Decision 2). Adding `db_key:main` is precisely the
event that test was built to catch (V28), so this item pays that debt in the same change:

1. `collectCredentialKeys(db)` becomes **`collectSecureStoreKeys(db)`** and returns the credential
   keys **plus** `DB_KEY_STORAGE_KEY`.
2. `apps/mobile/src/__tests__/secure-store-key-namespace.test.ts` is widened to accept a key
   argument that is either a `credentialsKeyFor(...)` call **or** the `DB_KEY_STORAGE_KEY`
   identifier, and gains an assertion that `collectSecureStoreKeys` covers both namespaces.
3. `WipeResult` gains a fourth variant, `'db_key_failed'`, with one new i18n key pair.

**Ordering is a correctness property, not a preference.** The revised sequence is:

```text
wipeLocalData({ db, secureStore, resetStore }):
  1. keys = collectSecureStoreKeys(db)                  // credentials ∪ { DB_KEY_STORAGE_KEY }
  2. delete every credential key; verify; fail closed  -> 'credentials_failed'
  3. resetStore()   // deletes finanzas.enc.db          -> 'store_failed'
  4. delete DB_KEY_STORAGE_KEY; verify                  -> 'db_key_failed'
  5. 'ok'
```

The database key is deleted **after** the store file, never before. Deleting the key first and then
failing to delete the file would leave the user holding an encrypted store nothing can ever open —
a bricked profile with no recovery. In the chosen order the worst case is a stale key protecting a
file that no longer exists, which the next launch simply reuses for the new store. Step 2 keeps
#19's fail-closed semantics for credentials, which are the higher-value secret.

### Decision 12 — a `__DEV__`-only probe carries the device-tier assertions, split across the SQL boundary

The probe must open databases, and opening a database means importing `expo-sqlite` — which
`dbAccessBoundary` and `db-access-boundary.test.ts` forbid everywhere under `src/**` except
`src/db/**` (V27, V31). `src/dev/` is under `src/`, so the probe is **split in two**:

- `apps/mobile/src/db/encryption/diagnostics.ts` — `runEncryptionDiagnostics(port): EncryptionDiagnostics`.
  All database work lives here, inside the sanctioned directory, behind the same
  `CipherDatabasePort` as everything else. Returns a plain serialisable result object.
- `apps/mobile/src/dev/encryption-probe.ts` — renders that object in the existing `/gallery` dev
  route (`src/dev/` is the repository's established never-ships convention). It imports **no**
  SQL library, so the boundary test keeps passing unchanged.

The result object reports the `EncryptionState` **that was resolved at launch and memoized**, not
a fresh file probe. This matters: per Decision 7 an existence check works by opening the file, and
opening a missing `finanzas.db` would **recreate** it — a diagnostic that resurrects the legacy
store every time someone opens the gallery would be worse than no diagnostic. The four active
probes below all target the encrypted store, which is known to exist by the time the probe runs.

| Probe | Expected on a correct build |

| Probe | Expected on a correct build |
| --- | --- |
| `PRAGMA cipher_version` | A version string (`4.7.0`) |
| Open `finanzas.enc.db` with **no** key, then `SELECT count(*) FROM sqlite_schema` | Fails — `file is not a database` (`SQLITE_NOTADB`) |
| Open `finanzas.enc.db` with a **wrong** key, same query | Fails the same way |
| Open with the stored key | Succeeds; reports per-table row counts |

This is what makes the brief's third acceptance criterion — *"The database file is unreadable
without the key — verified by test"* — a real assertion rather than an inference. It runs on a
device, against the actual encrypted file, in the actual SQLCipher build.

It **never prints the key**. It reports a boolean `key present`, the four probe outcomes above,
and — so the runbook can tell "the wipe issued a new key" from "the wipe left the old one" — a
short **fingerprint**: the first eight characters of `digestSha256(keyHex)`, which is one-way and
carries no usable key material. The probe is gated on `__DEV__` and reachable only from the
dev-only gallery route, so it cannot ship.

---

## Layer-by-Layer Changes

### Database / Data Layer

New folder — `apps/mobile/src/db/encryption/`:

- [ ] `types.ts` — `CipherDatabasePort`, `CipherHandle`, `EncryptionState` (the six-value union
      from Decision 5), `EncryptionProbe`.
- [ ] `errors.ts` — `DatabaseEncryptionUnavailableError`, `DatabaseKeyMissingError`,
      `DatabaseEncryptionMigrationError`. Typed, mirroring `DatabaseMigrationError`'s shape in
      `migrate.ts`. No message interpolates key material or row values.
- [ ] `constants.ts` — `LEGACY_DATABASE_NAME`, `ENCRYPTED_DATABASE_NAME`,
      `ENCRYPTION_MARKER_SETTING`, `EXPORT_ALIAS`, `DB_KEY_STORAGE_KEY` (Decision 5, Decision 3).
- [ ] `statements.ts` — pure SQL text builders and `isValidRawKeyHex` (Decision 10).
- [ ] `state.ts` — `resolveEncryptionState(probe): EncryptionState`. **Pure**; no SQLite, no I/O.
- [ ] `key.ts` — `ensureDatabaseKey(port, randomBytes): Promise<string>`; the one-way generation
      rule and the `unrecoverable_key_missing` fail-closed branch (Decision 3, Decision 5).
- [ ] `census.ts` — `buildCensus(handle, schema): Census` over `DUMP_TABLE_ORDER` plus
      `__drizzle_migrations` (V22), producing the `Census` shape `preservation.ts` already
      defines (V23).
- [ ] `migrate-to-encrypted.ts` — `migratePlaintextToEncrypted(...)`, the orchestrator of
      Decision 6, written entirely against `CipherDatabasePort`.
- [ ] `open-encrypted-store.ts` — the composition entry point: probe capability → resolve key →
      probe files → dispatch on `EncryptionState` → return an opened, keyed `CipherHandle`.
      Memoizes the resolved `EncryptionState` so `diagnostics.ts` can report it without
      re-probing (Decision 12).
- [ ] `diagnostics.ts` — `runEncryptionDiagnostics(port)`, the device-tier probe's database half.
      Lives under `src/db/` because it must import through the cipher port; returns a plain
      serialisable result (Decision 12, V31).

Modified:

- [ ] `apps/mobile/src/db/client.ts` — builds the Expo `CipherDatabasePort`. `openAppDatabase()`
      now targets `ENCRYPTED_DATABASE_NAME` and issues `PRAGMA key` **before**
      `PRAGMA foreign_keys = ON`. Keeps `deleteAppDatabaseFile` (#19's Decision 3) and adds
      `deleteDatabaseIfPresent`. Remains the only `expo-sqlite` importer (V27).
- [ ] `apps/mobile/src/db/runtime.ts` (**created by #8 / PR #72**) — `getAppDatabase()` awaits the
      key read and `open-encrypted-store.ts` inside its existing single-flight, before
      `ensureDatabaseReady`. `resetAppDatabase()` (#19's) targets the encrypted name.
- [ ] `apps/mobile/src/db/testing/cipher-port.ts` (new) — the labelled `better-sqlite3` test double
      (Decision 9).
- [ ] `apps/mobile/src/db/testing/memory-db.ts` — unchanged in behaviour; gains one helper that
      opens a **file-backed** temp pair for the migration tests, since `:memory:` cannot be
      `ATTACH`ed to a second file.

**No Drizzle migration is added.** `drizzle/`, `drizzle/meta/` and the committed
`src/db/__fixtures__/store-v*.sql` snapshots are untouched, so `db:check` modes 0-3 (V29) keep
passing without modification. The schema on both sides of the copy is byte-identical; only the
container changes.

### Shared Packages / Libraries

- [ ] **None.** `@finanzas/shared-domain` and `@finanzas/shared-utils` are pure and stay that way.

### Frontend / UI

- [ ] `apps/mobile/src/lib/secure-store/types.ts` (**#9's**) — widen `setItem` with the optional
      accessibility option (Decision 4).
- [ ] `apps/mobile/src/lib/secure-store/expo-secure-store.adapter.ts` (**#9's**) — map the
      accessibility union onto `SecureStore` constants; default unchanged.
- [ ] `apps/mobile/src/features/settings/wipe-local-data.ts` (**#19's**) —
      `collectCredentialKeys` → `collectSecureStoreKeys`; the four-step ordered sequence; the
      `'db_key_failed'` variant (Decision 11).
- [ ] `apps/mobile/src/features/settings/use-wipe-local-data.ts` (**#19's**) — map the new result
      variant onto the existing `error` phase. The phase union itself is unchanged.
- [ ] `apps/mobile/src/i18n/es.json` and `en.json` — one new key for the `db_key_failed` error
      copy. Spanish copy follows the tone of #19's existing wipe-failure strings; there is no
      mockup for this state (V30), so it reuses the same visual treatment as `store_failed`.
- [ ] `apps/mobile/src/dev/encryption-probe.ts` (new) + its entry in the existing dev gallery
      route — **rendering only**, no SQL-library import, consuming
      `src/db/encryption/diagnostics.ts` (Decision 12, V31). `__DEV__`-gated; never linked from a
      product screen. Confirm `db-access-boundary.test.ts` still passes after adding it.
- [ ] **No product screen, no new route, no mockup state.** V30 confirms the mockups contain
      nothing for encryption. The migration runs inside the existing launch path and is invisible
      when it succeeds.

### Infrastructure / Configuration

- [ ] `apps/mobile/app.config.js` — `'expo-sqlite'` → `['expo-sqlite', { useSQLCipher: true }]`
      (Decision 2).
- [ ] `apps/mobile/package.json` — **no change.** No dependency is added or removed.
- [ ] `apps/mobile/eslint.config.mjs` — extend #9's `no-console: 'error'` override to
      `src/db/encryption/**`.
- [ ] `apps/mobile/jest.config.js` — the existing `db` project's `testMatch` already covers
      `src/db/**/*.test.ts`, so `src/db/encryption/__tests__/**` needs **no config change**.
      Confirm this at Step 0 rather than assuming it.
- [ ] `.github/workflows/ci.yml` — **no change.** `db:check` and `pnpm test` cover the new code as
      they stand; nothing in CI can build a native binary, which is why the device tier is a
      runbook and not a CI job.

---

## Testing Strategy

**Test types**: Unit (Jest, Node tier) + Smoke (device runbook). No new E2E flow: Maestro cannot
assert on ciphertext, and #22 owns the E2E suite.

### Coverage against the brief's acceptance criteria

| Brief AC | Node-tier evidence | Device-tier evidence |
| --- | --- | --- |
| **AC1** — a new install creates an encrypted database | `state.test.ts` → `fresh_install` resolves with no legacy probe file surviving; `open-encrypted-store.test.ts` → the keyed open path is taken and `PRAGMA key` is the first statement recorded | Runbook Step 2 (fresh install) + probe: `cipher_version` non-empty, open-without-key rejected |
| **AC2** — an existing unencrypted database migrates without data loss | `migrate-to-encrypted.test.ts` over the `better-sqlite3` double, seeded from `src/db/__fixtures__/store-v1.sql`: census before/after is violation-free; every crash point of Decision 6's table resumes to the correct state | Runbook Step 3 (upgrade over a synced store): row counts per table identical before and after; a movement, a category edit and a merchant alias all survive |
| **AC3** — the file is unreadable without the key, verified by test | `statement-contract.test.ts` (exact SQL text); `header-signature.test.ts` (the plaintext-magic detector, positive and negative) | Runbook Step 5 + probe: open with no key → `SQLITE_NOTADB`; open with a wrong key → `SQLITE_NOTADB`; open with the stored key → succeeds |

### Node-tier unit tests

| File | Asserts |
| --- | --- |
| `src/db/encryption/__tests__/state.test.ts` | All six `EncryptionState` values from Decision 5, one test per state, plus the two "impossible" probe shapes that must throw rather than guess |
| `src/db/encryption/__tests__/key.test.ts` | Key reuse when present; generation when absent **and** no encrypted content; `DatabaseKeyMissingError` when absent **and** encrypted content exists; the generated value is 64 lowercase hex characters; no test output or error message contains the key |
| `src/db/encryption/__tests__/statement-contract.test.ts` | Exact text of `keyPragma`, `attachEncryptedStatement`, `exportStatement`, `detachStatement`; `isValidRawKeyHex` rejects uppercase, 63 and 65 characters, non-hex characters, and an embedded quote |
| `src/db/encryption/__tests__/census.test.ts` | `buildCensus` covers all 12 declared tables plus `__drizzle_migrations`; a deliberately dropped row is reported as `row_lost`; a mutated column as `column_value_changed` |
| `src/db/encryption/__tests__/migrate-to-encrypted.test.ts` | The happy path leaves the marker written and the legacy store deleted; a census violation aborts with the legacy store byte-identical and the encrypted store gone; each crash point of Decision 6 resumes correctly on a second run; running the whole flow twice is a no-op the second time |
| `src/db/encryption/__tests__/capability.test.ts` | A port reporting `cipherVersion() === null` causes `DatabaseEncryptionUnavailableError` and **no** database open |
| `src/features/settings/__tests__/wipe-local-data.db.test.ts` (**extends #19's**) | `collectSecureStoreKeys` includes `DB_KEY_STORAGE_KEY`; the database key is deleted after the store file; a failing key deletion yields `'db_key_failed'`; a failing store deletion never reaches the key deletion |
| `src/__tests__/secure-store-key-namespace.test.ts` (**#19's, widened**) | See the parser-risk addendum below |

**Seed data for AC2**: the migration tests load the committed
`apps/mobile/src/db/__fixtures__/store-v1.sql` snapshot into the plaintext side of the file-backed
pair. No new fixture is created — that snapshot is already the repository's canonical "a store with
real content" artefact and is regenerated deterministically by `pnpm --filter @finanzas/mobile
db:seed`.

### What the Node tier deliberately does not prove

Stated plainly so no reviewer infers more coverage than exists. `better-sqlite3` has no SQLCipher,
so three properties are **device-only**, and each has a numbered runbook step:

1. `PRAGMA key` actually encrypts the pages (runbook Step 5).
2. `sqlcipher_export` copies faithfully **through a codec**, not just through plain SQLite
   (runbook Step 3's row-count comparison, taken from the real encrypted store).
3. A wrong or absent key is rejected rather than silently producing an empty database (runbook
   Step 5).

The mitigation for (2) is not the test double — it is Decision 6's census gate, which runs **on the
device, in production, on every migration**, and refuses to reach the commit point if the copy is
not faithful. The user's data is protected by a runtime check, not by a test.

### Parser-risk addendum

**Classification: applicable, narrowly.** This item does not add a parser, but it materially
changes the accepted grammar of an existing source-text scanner: #19's
`apps/mobile/src/__tests__/secure-store-key-namespace.test.ts`, which scans every `setItem(` call
site under `apps/mobile/src/**` and fails when the key argument is not a `credentialsKeyFor(...)`
call (V28). Widening it to also accept `DB_KEY_STORAGE_KEY` is a change to a matcher, and a
too-permissive matcher silently destroys the guarantee that the wipe covers every key.

**Edge-case enumeration** — concrete inputs the widened matcher must classify correctly:

| # | Input | Expected |
| --- | --- | --- |
| E1 | `port.setItem(credentialsKeyFor(id), value)` | Accepted (unchanged #9 behaviour) |
| E2 | `port.setItem(DB_KEY_STORAGE_KEY, keyHex)` | Accepted (this item) |
| E3 | `port.setItem('db_key:main', keyHex)` | **Rejected** — a hard-coded literal bypasses the constant the wipe collects |
| E4 | `port.setItem(someOtherKey, value)` | **Rejected** — an unknown third namespace |
| E5 | `port.setItem(`db_key:${scope}`, value)` | **Rejected** — a template literal is not an enumerable namespace |
| E6 | `// port.setItem(anything, value)` in a comment | Not flagged — comments are not call sites |
| E7 | `'setItem('` inside a string literal (this test file describes itself) | Not flagged — the scanner must not match its own documentation |
| E8 | Two `setItem(` calls on one physical line | Both classified independently |
| E9 | `setItem(\n  DB_KEY_STORAGE_KEY,\n  keyHex,\n)` split across lines | Accepted — the matcher must not be line-anchored |
| E10 | `deleteItem(DB_KEY_STORAGE_KEY)` | Not a `setItem` call site; ignored by this scanner |

**Unit test mapping** — one automated case per row, all in
`apps/mobile/src/__tests__/secure-store-key-namespace.test.ts`, driven by an exported classifier
function so the cases can be fed as strings rather than by planting files in the tree:

| Test case | Covers |
| --- | --- |
| `accepts a credentialsKeyFor call` | E1 |
| `accepts the database key constant` | E2 |
| `rejects a hard-coded key literal` | E3 |
| `rejects an unknown identifier` | E4 |
| `rejects a template literal key` | E5 |
| `ignores a commented-out call` | E6 |
| `ignores an occurrence inside a string literal` | E7 |
| `classifies two call sites on one line independently` | E8 |
| `matches a call split across lines` | E9 |
| `ignores deleteItem call sites` | E10 |

The existing whole-tree scan is kept as-is on top of these unit cases, so the test still fails when
a real future file introduces a third namespace.

**Suppression semantics**: not applicable — the scanner recognises no inline suppression directive,
and this item does not add one. #3's Decision 8 established the project's position that a safety
scanner with an escape hatch is not a safety scanner; that position is unchanged here.

### Concurrent-event-source addendum

**Classification: applicable.** Three execution contexts can reach the store: app launch
(`getAppDatabase`), a background wake from #18's local notifications, and #19's wipe teardown. They
share one piece of mutable state — the memoized `handle` promise in `src/db/runtime.ts` — and this
item inserts an `await`-heavy migration into exactly that path.

- **Shared mutable state guards**: the memoized `handle` in `runtime.ts` is written **once, before
  the first `await`**, inside `getAppDatabase()`. Every concurrent caller receives the same
  promise, so the capability probe, key read and migration run exactly once per process. This item
  adds no second module-level mutable variable; `resolveEncryptionState` and everything in
  `statements.ts` are pure, and the `CipherHandle` is owned by the single async function that
  created it.
- **Re-entrancy / in-flight tracking**: a second launch-path call arriving mid-migration is
  absorbed by that single-flight — it awaits the same promise rather than starting a second copy.
  Cross-**process** re-entrancy (the OS killing the app mid-migration and the user relaunching) is
  not preventable by a promise, and is handled instead by Decision 5's on-disk state resolution:
  the relaunch finds an unmarked encrypted store, discards it, and starts over.
- **Event deduplication**: the migration is not event-driven; it is a step in a single-flighted
  launch sequence. Repeated invocation is idempotent by Decision 6 — `already_encrypted` is a
  no-op path, and the commit marker makes "did this already happen?" a disk fact rather than an
  in-memory flag.
- **Listener and resource cleanup**: `CipherHandle.close()` is called on every path, success and
  failure, from a `finally`. This is not stylistic: `deleteDatabase` **throws** while a cached
  handle is open (V18), so a leaked handle turns a recoverable retry into a permanent failure. The
  abort path detaches the export alias before closing. This item registers no listener and no
  timer.
- **Race conditions at initialization**: a background wake that calls `getAppDatabase()` while the
  migration is running simply awaits it — the store is either fully migrated or the promise
  rejects. Nothing observes a half-migrated store, because the encrypted handle is not returned to
  any caller until after the commit marker is written.
- **Race conditions at teardown**: the wipe is the teardown. #19's `resetAppDatabase()` clears the
  memo **before** awaiting the deletion, so a caller arriving mid-wipe starts a fresh
  open-and-bootstrap against a file that is being deleted; #19 already resolves this by ordering
  the memo clear first, and this item preserves that order. The one addition is Decision 11's
  rule that the database key is deleted **after** the store file, so a caller that slips through
  between the two finds a store that no longer exists rather than one it cannot decrypt.
- **Error propagation across async boundaries**: every failure surfaces as one of the three typed
  errors in `errors.ts`, propagated through the single-flight promise, which clears the memo on
  rejection so the next launch genuinely retries. Nothing is caught and discarded. There is no
  `void`-ed promise and no floating `.catch()` in this item's code.

**New concurrent patterns**: none. This follows the single-flight-promise pattern that
`bootstrap.ts` and `runtime.ts` already established; the only genuinely new idea is that
cross-process resumption is resolved from disk rather than from memory, which is Decision 5.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| A populated plaintext store | The committed deterministic snapshot: seeded categories, institutions, merchants plus scraped transactions. Loaded into the plaintext side of the file-backed test pair for every AC2 migration test | `apps/mobile/src/db/__fixtures__/store-v1.sql` (existing — **not** modified) |
| Marker row | `app_settings` key `encryption_migrated_at`, ISO-8601 value, written by the migration's commit step | Written at runtime by `migrate-to-encrypted.ts`; no seed file |

**No new fixture, no new seed, no schema change.** Adding one would put this item in tension with
`db:check` mode 3, which asserts every committed snapshot survives the migration history.

---

## Documentation Updates

To be executed by the developer during implementation, not now.

- [ ] `docs/project/3-software-architecture.md` — **Security Model** table, `Database` row: replace
      *"Not encrypted at rest in the MVP … SQLCipher is a fast follow, tracked in the backlog"*
      with the shipped state (SQLCipher via `expo-sqlite`'s `useSQLCipher`, raw 32-byte key in
      `expo-secure-store` under `db_key:main`). Update the `Deletion` row to say the wipe removes
      the encrypted store **and** the database key. Add a line to the **Tech Stack** `Storage` row
      noting the build-flag dependency, and to **Environment Strategy** that a JS-only OTA cannot
      deliver this change.
- [ ] `docs/project/4-database-model.md` — the *Secrets* row currently says secrets live in
      `expo-secure-store`; extend it to name the database key as a second entry in that store, and
      record `encryption_migrated_at` in the `app_settings` keys list.
- [ ] `docs/project/2-repo-architecture.md` — add `src/db/encryption/` to the `apps/mobile/` tree
      sketch.
- [ ] `AGENTS.md` — add a Troubleshooting row for *"App fails to launch with
      `DatabaseEncryptionUnavailableError`"* → the binary was built without `useSQLCipher`; run
      `npx expo prebuild --clean` and rebuild the dev client. Add a second row for *"App fails to
      launch with `DatabaseKeyMissingError`"* → the keychain entry was removed while an encrypted
      store exists; this is unrecoverable by design and the only remedy is a wipe. Extend
      non-negotiable #1 to name the database key alongside bank credentials.
- [ ] `docs/best-practices/stack/` — if a `expo`/`react-native` conventions file names the dev-build
      requirement, add the `useSQLCipher` rebuild trigger there. Verify at implementation time
      rather than assuming the file exists.

---

## Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | The JS ships to a binary built without `useSQLCipher`; plain SQLite silently ignores `PRAGMA key` and the store stays plaintext while the app reports success | Medium | **Critical** — a silent, total failure of the feature's only purpose | Decision 8's `PRAGMA cipher_version` probe fails the launch loudly instead. No plaintext fallback exists in the code |
| R2 | The database key is lost or replaced while an encrypted store holds data | Low | **Critical** — irreversible total data loss | Decision 3's one-way generation rule + Decision 5's `unrecoverable_key_missing` state: the code refuses to generate a replacement key and never deletes the store. Fails closed with a typed error |
| R3 | A crash mid-migration leaves a partial or corrupt store | Medium | High | Decision 5/6: two files, one commit marker, plaintext never mutated, every crash point mapped to a resolving state and covered by a test |
| R4 | `sqlcipher_export` copies something subtly wrong (a trigger, a partial index, `sqlite_sequence`) | Low | High | Decision 6's census gate runs **on device, in production** and blocks the commit point on any finding. V12 records exactly what the function copies, and V22 the tables the census covers |
| R5 | A dev or CI machine runs an old binary after the flag lands and reports confusing failures | High | Low | R1's probe gives an unambiguous error naming the cause; the AGENTS.md troubleshooting row names the fix; the runbook's prerequisites make the rebuild step explicit |
| R6 | This item lands before #9/#19/#8 and stubs their seams | Medium | High | Implementation Step 0 is a hard gate with concrete file checks; a missing seam is a stop-and-report, not a stub |
| R7 | Raw-key interpolation into `PRAGMA` text becomes an injection vector | Very low | High | Decision 10: `assertRawKeyHex` rejects anything outside `^[0-9a-f]{64}$` before any string is built; the value is machine-generated and never user-supplied |
| R8 | WAL gets enabled later; `deleteDatabase` leaves `-wal`/`-shm` orphans holding plaintext pages (V18) | Low | Medium | V19 records that WAL is off today and this plan does not turn it on. The Documentation Updates entry in `4-database-model.md` should note that enabling WAL later requires revisiting the deletion path |
| R9 | A large store makes the migration slow enough to look like a hang at launch | Low | Medium | The copy is a single native `sqlcipher_export`, not a JS row loop, over a store bounded by one user's movements. Runbook Step 3 records the observed duration so a regression has a baseline |

---

## Assumptions

Stated because no human was available to confirm them; each is either backed by a Verification Log
row or is a reversible design choice.

1. **Enabling `useSQLCipher` is in scope for this item** and the resulting native-rebuild
   requirement is acceptable. Backed by the brief's own wording and by the app's existing dev-build
   requirement. (Decision 2)
2. **`finanzas.enc.db` is an acceptable new filename.** Nothing else in the repository references
   the database filename — `client.ts` keeps it as a private constant (#19 Decision 3) — so this is
   contained. (Decision 5)
3. **`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` is the right protection class for the database key**,
   even though #9 chose `WHEN_UNLOCKED_THIS_DEVICE_ONLY` for credentials. Both exclude the value
   from device backups, which is the property non-negotiable #1 protects. (Decision 4)
4. **Widening #9's `SecureStorePort.setItem` is preferable to a parallel API.** The option is
   optional and defaults to #9's current behaviour, so no #9 call site changes. (Decision 4)
5. **A fourth `WipeResult` variant is preferable to reusing `'store_failed'`.** Honest reporting of
   which step failed is worth one i18n key. (Decision 11)
6. **The migration needs no UI.** It runs inside the existing launch path, there is no mockup for
   it (V30), and the expected duration for one user's movement history does not warrant a screen.
   If Step 0 finds the store materially larger than expected after #10 lands, raise it rather than
   inventing a screen.
7. **`expo-secure-store`'s default protection class is not relied upon anywhere.** #9's plan flags
   the default as unverified; this item always passes the option explicitly, so the assumption is
   not load-bearing here.

---

## Implementation Order

### Step 0 — landing-tree verification gate (mandatory; do not edit any file before this passes)

This item must land **last among the data-layer items**. Sequencing is the orchestrator's call, but
the tree this lands on is verifiable, and a missing seam here means stubbing another item's design.
Run these checks and record the results in the PR description:

1. `test -f apps/mobile/src/lib/secure-store/types.ts` and
   `apps/mobile/src/lib/secure-store/expo-secure-store.adapter.ts` exist, and `SecureStorePort`
   declares `getItem` / `setItem` / `deleteItem` — **#9 has landed**.
2. `test -f apps/mobile/src/db/runtime.ts` and it exports `getAppDatabase` — **#8 has landed**.
3. `apps/mobile/src/features/settings/wipe-local-data.ts` exists and exports
   `collectCredentialKeys` and `wipeLocalData`; `apps/mobile/src/__tests__/secure-store-key-namespace.test.ts`
   exists — **#19 has landed**.
4. `grep -rn "upsertTransaction\|dedup" apps/mobile/src/db/repositories/transactions.ts` shows the
   sync write path is implemented — **#10 has landed** and the store holds real rows.
5. `grep -n "expo-sqlite" apps/mobile/package.json` still shows `~16.0.10` or later, and
   `node_modules/expo-sqlite/vendor/sqlcipher/sqlite3.c` still exists — **V2/V3 still hold**.
6. `grep -n "expo-sqlite" apps/mobile/app.config.js` still shows a bare string entry — **V26 still
   holds and no sibling item changed the plugin entry**.
7. `grep -n "testMatch" -A3 apps/mobile/jest.config.js` confirms the `db` project still matches
   `src/db/**/*.test.ts`.
8. `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm --filter @finanzas/mobile db:check` are all
   green **before** any edit, so every later failure is attributable to this item.

Any failing check is a **stop and report**, not a workaround.

### Steps 1-15

1. **Turn on the build flag.** Edit `apps/mobile/app.config.js` (Decision 2). Run
   `npx expo prebuild --clean` and build a dev client. Verify `PRAGMA cipher_version` returns a
   version from a throwaway snippet before writing any product code — if it does not, stop: nothing
   later in this plan can work, and the cause is the build, not the code.
2. **Constants, types and errors.** `src/db/encryption/{constants,types,errors}.ts` (Decisions 3, 5).
3. **Pure statement builders.** `src/db/encryption/statements.ts` + `statement-contract.test.ts`
   (Decision 10). Tests pass before anything touches a database.
4. **The state resolver.** `src/db/encryption/state.ts` + `state.test.ts` — all six states
   (Decision 5). Still pure; still no SQLite.
5. **The census builder.** `src/db/encryption/census.ts` + `census.test.ts` over
   `store-v1.sql` (Decision 6, V22, V23).
6. **The test double.** `src/db/testing/cipher-port.ts` + the file-backed pair helper in
   `testing/memory-db.ts` (Decision 9). Label it unmistakably as a double in its doc comment.
7. **Key management.** `src/db/encryption/key.ts` + `key.test.ts`, including the
   `unrecoverable_key_missing` fail-closed branch (Decisions 3, 5).
8. **The migration orchestrator.** `src/db/encryption/migrate-to-encrypted.ts` +
   `migrate-to-encrypted.test.ts` covering the happy path, the census abort, every crash point in
   Decision 6's table, and double execution.
9. **The composition entry point.** `src/db/encryption/open-encrypted-store.ts` +
   `capability.test.ts` (Decision 8).
10. **The Expo adapter.** Extend `src/db/client.ts` with the real `CipherDatabasePort`; wire
    `src/db/runtime.ts`'s single-flight to the new open path (Decision 9). Confirm the
    `db-access-boundary` test still passes — no new file outside `src/db/**` imports
    `expo-sqlite`.
11. **The secure-store widening.** `src/lib/secure-store/types.ts` and the Expo adapter
    (Decision 4). Re-run #9's tests; nothing there should change.
12. **The wipe.** `wipe-local-data.ts`, `use-wipe-local-data.ts`, the two i18n catalogues, and the
    widened `secure-store-key-namespace.test.ts` with all ten parser-risk cases (Decision 11 and
    the parser-risk addendum).
13. **The dev probe, in two halves.** `src/db/encryption/diagnostics.ts` (the database half) then
    `src/dev/encryption-probe.ts` and its gallery entry (the rendering half) — Decision 12.
    Confirm the probe is `__DEV__`-gated, unreachable from any product screen, and that
    `db-access-boundary.test.ts` still passes.
14. **Verify and document.**
    - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @finanzas/mobile db:check` — all
      green. `db:check` must pass **unchanged**; if it needed a change, the schema moved and this
      plan's premise is wrong.
    - Confirm `git diff --stat` shows **no** change to `apps/mobile/drizzle/`,
      `apps/mobile/src/db/__fixtures__/` or `apps/mobile/package.json`.
    - Execute the smoke runbook on a device, both the fresh-install and the upgrade paths.
    - Apply the **Documentation Updates** section above.
15. **CHANGELOG.** Add under `[Unreleased]`, in the project's `**Bold Title** (#N):` format:

    ```markdown
    - **Encrypt the local database at rest** (#25): the on-device SQLite store is now SQLCipher-encrypted with a 32-byte key held only in `expo-secure-store`. Existing unencrypted databases migrate on first launch via a verified `sqlcipher_export` copy that never deletes the original until the replacement is confirmed row-for-row. Requires a native rebuild — this change cannot be delivered as a JS-only update.
    ```

    Note: this entry belongs in the **implementation** PR. Per protocol 02 Step 5.9 this plan PR
    adds no CHANGELOG entry.

---

## Residual Verification Strategy

This item makes a completeness claim — *"the wipe deletes every secure-store key"* — and a
correctness claim — *"no row is lost in the migration"*. Neither may be asserted by prose at
`ready-for-human-review`. The implementation must produce:

| Claim | Evidence source | Form of evidence |
| --- | --- | --- |
| The wipe covers every key namespace | `apps/mobile/src/__tests__/secure-store-key-namespace.test.ts` | The test's pass line **plus** the list of `setItem` call sites it found, which the test prints — so a vacuous pass caused by a broken walk is visible in the output |
| No row is lost in the migration | `migrate-to-encrypted.test.ts` census assertions **and** the device runbook's per-table row-count table | Per-table counts before and after, pasted into the PR from the runbook run — not a summary sentence |
| The encrypted file is unreadable without the key | The `__DEV__` probe's four outcomes (Decision 12), run on a device | The probe's output pasted into the PR, showing `SQLITE_NOTADB` for both the no-key and wrong-key opens |
| Nothing about the schema changed | `git diff --stat` scoped to `apps/mobile/drizzle/` and `apps/mobile/src/db/__fixtures__/` | An empty diff, plus a green unmodified `db:check` |
| The build flag is actually on | `PRAGMA cipher_version` from the dev probe | The reported SQLCipher version string (expected `4.7.0` — V8) |
