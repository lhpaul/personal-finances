-- Transaction detail and exclusion (#16) — implementation plan Decision 11 / Seed Data.
--
-- A small, hand-written, reviewed DELTA of `INSERT OR REPLACE` statements. It assumes a
-- bootstrapped store (schema + starter seeds already present, i.e. `ensureDatabaseReady()` has
-- already run at least once) and reproduces the mockup's own sample values — `$35.000`, `Líder
-- S.A.`, `viernes, 24 de enero de 2025`, `11:20`, `Cta. corriente ••4821` — none of which match
-- `store-v1.sql`'s seeded rows, so the fidelity captures need this fixture even though the
-- runbook could otherwise run from the bundled store. Ids are literal and prefixed `detail-`, so
-- the file is diffable and idempotent, and so the four deep links of Decision 12 can name a
-- concrete movement. `store-v1.sql` is not modified.
--
-- Three movements, sharing the same bank facts and merchant, differing only in the person's own
-- layer:
--   * `detail-tx-categorized`   — auto-suggested category, a note. Drives `categorized` and
--                                 `exclude-sheet`.
--   * `detail-tx-uncategorized` — no category, no note. Drives `uncategorized`.
--   * `detail-tx-excluded`      — a person-chosen category (`category_source = 'user'`, so the
--                                 auto-suggestion caption is absent, matching the mockup's own
--                                 drawing without special-casing the state — Decision 4), excluded
--                                 with reason `shared_expense`. Drives `excluded`.
--
-- No row here writes `included_amount` — a partial-inclusion value can never silently enter a
-- capture (implementation plan Layer-by-Layer, Database / Data Layer).

INSERT OR REPLACE INTO "user_financial_institutions" ("id", "financial_institution_id", "status", "credentials_key", "sync_status", "last_sync_at", "last_success_at", "last_error_code", "last_error_message", "created_at") VALUES ('detail-connection', 'banco-de-chile', 'active', 'secure-store-key-detail-connection', 'idle', '2025-01-24T14:20:00.000Z', '2025-01-24T14:20:00.000Z', NULL, NULL, '2025-01-01T00:00:00.000Z');

INSERT OR REPLACE INTO "user_financial_products" ("id", "user_financial_institution_id", "external_id", "type", "name", "currency_code", "assets", "metadata", "updated_at") VALUES ('detail-product', 'detail-connection', 'checking-detail', 'checking', 'Cta. corriente', 'CLP', NULL, '{"mask":"4821"}', '2025-01-24T14:20:00.000Z');

INSERT OR REPLACE INTO "merchants" ("id", "name", "assets", "transaction_category_id", "country_code", "user_id", "created_at") VALUES ('detail-merchant-lider', 'Líder S.A.', NULL, 'supermercado', 'CL', NULL, '2025-01-01T00:00:00.000Z');

-- `categorized` / `exclude-sheet`: auto-suggested category, a note (AC2 — the auto-suggestion
-- caption renders because category_source = 'auto').
INSERT OR REPLACE INTO "transactions" ("id", "user_financial_product_id", "external_id", "dedup_hash", "amount", "type", "currency_code", "occurred_at", "date_local", "raw_description", "note", "merchant_id", "transaction_category_id", "category_source", "review_flag", "excluded_at", "exclusion_reason", "exclusion_note", "included_amount", "metadata", "is_manual", "created_at", "updated_at") VALUES ('detail-tx-categorized', 'detail-product', 'ext-detail-categorized', 'dedup-detail-categorized', 35000, 'debit', 'CLP', '2025-01-24T14:20:00.000Z', '2025-01-24', 'COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL', 'Compras semanales', 'detail-merchant-lider', 'supermercado', 'auto', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2025-01-24T14:20:00.000Z', '2025-01-24T14:20:00.000Z');

-- `uncategorized`: identical bank facts and merchant; no category, no note.
INSERT OR REPLACE INTO "transactions" ("id", "user_financial_product_id", "external_id", "dedup_hash", "amount", "type", "currency_code", "occurred_at", "date_local", "raw_description", "note", "merchant_id", "transaction_category_id", "category_source", "review_flag", "excluded_at", "exclusion_reason", "exclusion_note", "included_amount", "metadata", "is_manual", "created_at", "updated_at") VALUES ('detail-tx-uncategorized', 'detail-product', 'ext-detail-uncategorized', 'dedup-detail-uncategorized', 35000, 'debit', 'CLP', '2025-01-24T14:20:00.000Z', '2025-01-24', 'COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL', NULL, 'detail-merchant-lider', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2025-01-24T14:20:00.000Z', '2025-01-24T14:20:00.000Z');

-- `excluded`: identical bank facts and merchant; person-chosen category (caption absent —
-- Decision 4), excluded with reason `shared_expense` (the mockup's own drawn note text).
INSERT OR REPLACE INTO "transactions" ("id", "user_financial_product_id", "external_id", "dedup_hash", "amount", "type", "currency_code", "occurred_at", "date_local", "raw_description", "note", "merchant_id", "transaction_category_id", "category_source", "review_flag", "excluded_at", "exclusion_reason", "exclusion_note", "included_amount", "metadata", "is_manual", "created_at", "updated_at") VALUES ('detail-tx-excluded', 'detail-product', 'ext-detail-excluded', 'dedup-detail-excluded', 35000, 'debit', 'CLP', '2025-01-24T14:20:00.000Z', '2025-01-24', 'COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL', 'Compras semanales', 'detail-merchant-lider', 'supermercado', 'user', NULL, '2025-01-25T12:00:00.000Z', 'shared_expense', NULL, NULL, NULL, 0, '2025-01-24T14:20:00.000Z', '2025-01-25T12:00:00.000Z');
