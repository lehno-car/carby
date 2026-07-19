CREATE TYPE "public"."currency" AS ENUM('BYN', 'RUB', 'USD');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending', 'active', 'rejected', 'sold', 'archived');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "car_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"thumbnail_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"make" varchar(80) NOT NULL,
	"model" varchar(80) NOT NULL,
	"generation" varchar(120),
	"year" integer NOT NULL,
	"price" bigint NOT NULL,
	"currency" "currency" DEFAULT 'BYN' NOT NULL,
	"mileage" integer NOT NULL,
	"body_type" varchar(40) NOT NULL,
	"fuel_type" varchar(40) NOT NULL,
	"transmission" varchar(40) NOT NULL,
	"drivetrain" varchar(40) NOT NULL,
	"engine_volume" numeric(3, 1),
	"horsepower" integer,
	"color" varchar(64),
	"vin" varchar(17),
	"country" varchar(80) DEFAULT 'Беларусь' NOT NULL,
	"city" varchar(80) NOT NULL,
	"description" text NOT NULL,
	"seller_phone" varchar(32),
	"seller_telegram" varchar(64),
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"listing_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" "moderation_action" NOT NULL,
	"reason" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_entries" (
	"key" varchar(180) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"reason" varchar(80) NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" varchar(64),
	"first_name" varchar(128) NOT NULL,
	"last_name" varchar(128),
	"photo_url" text,
	"phone" varchar(32),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "car_images" ADD CONSTRAINT "car_images_listing_id_car_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."car_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_listings" ADD CONSTRAINT "car_listings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_car_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."car_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_listing_id_car_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."car_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_car_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."car_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "car_images_object_key_uidx" ON "car_images" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "car_images_listing_position_idx" ON "car_images" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listings_status_created_idx" ON "car_listings" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "listings_make_model_idx" ON "car_listings" USING btree ("make","model");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "car_listings" USING btree ("price");--> statement-breakpoint
CREATE INDEX "listings_year_idx" ON "car_listings" USING btree ("year");--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "car_listings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "listings_city_idx" ON "car_listings" USING btree ("city");--> statement-breakpoint
CREATE INDEX "favorites_user_created_idx" ON "favorites" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_listing_created_idx" ON "moderation_events" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "rate_limit_reset_idx" ON "rate_limit_entries" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "reports_listing_idx" ON "reports" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_id_uidx" ON "users" USING btree ("telegram_id");