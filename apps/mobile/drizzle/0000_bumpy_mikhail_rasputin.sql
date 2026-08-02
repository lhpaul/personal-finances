CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `financial_institutions` (
	`id` text PRIMARY KEY NOT NULL,
	`country_code` text NOT NULL,
	`name` text NOT NULL,
	`assets` text,
	`metadata` text,
	`scraper_status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `financial_institutions_scraper_status_idx` ON `financial_institutions` (`scraper_status`);--> statement-breakpoint
CREATE TABLE `merchant_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`raw_pattern` text NOT NULL,
	`match_type` text DEFAULT 'prefix' NOT NULL,
	`match_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_aliases_raw_pattern_unique` ON `merchant_aliases` (`raw_pattern`);--> statement-breakpoint
CREATE INDEX `merchant_aliases_merchant_id_idx` ON `merchant_aliases` (`merchant_id`);--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`assets` text,
	`transaction_category_id` text,
	`country_code` text,
	`user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`transaction_category_id`) REFERENCES `transaction_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seed_ledger` (
	`seed_key` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`seeded_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaction_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`income` integer NOT NULL,
	`labels` text NOT NULL,
	`assets` text,
	`user_id` text,
	`parent_category_id` text,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_category_id`) REFERENCES `transaction_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_categories_slug_unique` ON `transaction_categories` (`slug`);--> statement-breakpoint
CREATE INDEX `transaction_categories_income_sort_order_idx` ON `transaction_categories` (`income`,`sort_order`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_financial_product_id` text NOT NULL,
	`external_id` text,
	`dedup_hash` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`currency_code` text DEFAULT 'CLP' NOT NULL,
	`occurred_at` text NOT NULL,
	`date_local` text NOT NULL,
	`raw_description` text NOT NULL,
	`note` text,
	`merchant_id` text,
	`transaction_category_id` text,
	`category_source` text,
	`review_flag` text,
	`excluded_at` text,
	`exclusion_reason` text,
	`exclusion_note` text,
	`included_amount` integer,
	`metadata` text,
	`is_manual` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_financial_product_id`) REFERENCES `user_financial_products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_category_id`) REFERENCES `transaction_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_product_external_unique` ON `transactions` (`user_financial_product_id`,`external_id`) WHERE "transactions"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_dedup_hash_unique` ON `transactions` (`dedup_hash`);--> statement-breakpoint
CREATE INDEX `transactions_date_local_idx` ON `transactions` ("date_local" desc);--> statement-breakpoint
CREATE INDEX `transactions_category_id_idx` ON `transactions` (`transaction_category_id`);--> statement-breakpoint
CREATE INDEX `transactions_merchant_id_idx` ON `transactions` (`merchant_id`);--> statement-breakpoint
CREATE INDEX `transactions_uncategorized_idx` ON `transactions` (`transaction_category_id`) WHERE "transactions"."transaction_category_id" is null and "transactions"."excluded_at" is null;--> statement-breakpoint
CREATE TABLE `user_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_category_id` text NOT NULL,
	`period` text NOT NULL,
	`amount` integer NOT NULL,
	`currency_code` text DEFAULT 'CLP' NOT NULL,
	`user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`transaction_category_id`) REFERENCES `transaction_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_financial_institutions` (
	`id` text PRIMARY KEY NOT NULL,
	`financial_institution_id` text NOT NULL,
	`status` text NOT NULL,
	`credentials_key` text NOT NULL,
	`sync_status` text NOT NULL,
	`last_sync_at` text,
	`last_success_at` text,
	`last_error_code` text,
	`last_error_message` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`financial_institution_id`) REFERENCES `financial_institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_financial_institutions_institution_unique` ON `user_financial_institutions` (`financial_institution_id`);--> statement-breakpoint
CREATE TABLE `user_financial_products` (
	`id` text PRIMARY KEY NOT NULL,
	`user_financial_institution_id` text NOT NULL,
	`external_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`currency_code` text DEFAULT 'CLP' NOT NULL,
	`assets` text,
	`metadata` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_financial_institution_id`) REFERENCES `user_financial_institutions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_financial_products_institution_external_unique` ON `user_financial_products` (`user_financial_institution_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `user_recurring_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_category_id` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`currency_code` text DEFAULT 'CLP' NOT NULL,
	`income` integer DEFAULT 0 NOT NULL,
	`due_day` integer NOT NULL,
	`user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`transaction_category_id`) REFERENCES `transaction_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`first_name` text,
	`last_name` text,
	`national_id_type` text DEFAULT 'rut' NOT NULL,
	`country_code` text DEFAULT 'CL' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_single_profile_idx` ON `users` ((1));--> statement-breakpoint
-- Implementation plan Decision 16: the two ✨ Otros categories can never be deleted, in either
-- direction (spec Business Rule 17, AC9). The repository `deleteCategory` refuses them by slug;
-- this trigger is the store-level backstop for a raw DELETE that bypasses the repository.
-- Appended by hand — drizzle-kit's differ does not model triggers, so it never appears as a
-- "pending difference" in db:check mode 1, and a future `drizzle-kit generate` cannot drop it.
CREATE TRIGGER `protect_otros_categories`
BEFORE DELETE ON `transaction_categories`
FOR EACH ROW WHEN old.slug IN ('otros-gasto', 'otros-ingreso')
BEGIN
  SELECT RAISE(ABORT, 'otros-gasto and otros-ingreso cannot be deleted');
END;