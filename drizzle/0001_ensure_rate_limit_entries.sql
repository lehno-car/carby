-- Repair deployments where the initial migration was recorded before this table existed.
-- Both statements are idempotent, so the migration is safe when the table is already present.
CREATE TABLE IF NOT EXISTS "rate_limit_entries" (
	"key" varchar(180) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_reset_idx" ON "rate_limit_entries" USING btree ("reset_at");
