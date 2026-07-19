-- This table may already exist on deployments that used the previous runtime
-- repair. Keep the migration idempotent so those databases can adopt it safely.
CREATE TABLE IF NOT EXISTS "telegram_login_requests" (
	"token" varchar(80) PRIMARY KEY NOT NULL,
	"telegram_id" bigint,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_login_requests_status_idx" ON "telegram_login_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_login_requests_expires_idx" ON "telegram_login_requests" USING btree ("expires_at");
