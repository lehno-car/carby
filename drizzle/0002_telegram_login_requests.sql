CREATE TABLE IF NOT EXISTS "telegram_login_requests" (
  "token" varchar(80) PRIMARY KEY NOT NULL,
  "telegram_id" bigint,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "telegram_login_requests_status_idx"
  ON "telegram_login_requests" ("status");

CREATE INDEX IF NOT EXISTS "telegram_login_requests_expires_idx"
  ON "telegram_login_requests" ("expires_at");
