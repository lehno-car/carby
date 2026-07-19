CREATE TYPE "public"."catalog_import_status" AS ENUM('running', 'completed', 'failed', 'dry_run');--> statement-breakpoint
CREATE TYPE "public"."catalog_request_status" AS ENUM('open', 'in_review', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."catalog_request_type" AS ENUM('missing_make', 'missing_model', 'missing_generation', 'incorrect_years', 'duplicate', 'other');--> statement-breakpoint
CREATE TABLE "catalog_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"request_type" "catalog_request_type" NOT NULL,
	"make_id" uuid,
	"model_id" uuid,
	"generation_id" uuid,
	"comment" text NOT NULL,
	"status" "catalog_request_status" DEFAULT 'open' NOT NULL,
	"admin_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vehicle_catalog_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" varchar(80) NOT NULL,
	"source_version" varchar(80) NOT NULL,
	"status" "catalog_import_status" DEFAULT 'running' NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_generation_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"alias" varchar(220) NOT NULL,
	"normalized_alias" varchar(240) NOT NULL,
	"locale" varchar(12),
	"source_name" varchar(80)
);
--> statement-breakpoint
CREATE TABLE "vehicle_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(80),
	"production_start_year" integer,
	"production_end_year" integer,
	"is_facelift" boolean DEFAULT false NOT NULL,
	"parent_generation_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"source_name" varchar(80) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_make_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"make_id" uuid NOT NULL,
	"alias" varchar(160) NOT NULL,
	"normalized_alias" varchar(180) NOT NULL,
	"locale" varchar(12),
	"source_name" varchar(80)
);
--> statement-breakpoint
CREATE TABLE "vehicle_makes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(140) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"country_code" varchar(2),
	"logo_key" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_special" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_name" varchar(80) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_model_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"alias" varchar(180) NOT NULL,
	"normalized_alias" varchar(200) NOT NULL,
	"locale" varchar(12),
	"source_name" varchar(80)
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"make_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"vehicle_category" varchar(80),
	"is_active" boolean DEFAULT true NOT NULL,
	"source_name" varchar(80) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "car_listings" ADD COLUMN "make_id" uuid;--> statement-breakpoint
ALTER TABLE "car_listings" ADD COLUMN "model_id" uuid;--> statement-breakpoint
ALTER TABLE "car_listings" ADD COLUMN "generation_id" uuid;--> statement-breakpoint
ALTER TABLE "car_listings" ADD COLUMN "manufacture_year" integer;--> statement-breakpoint
ALTER TABLE "catalog_change_requests" ADD CONSTRAINT "catalog_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_change_requests" ADD CONSTRAINT "catalog_change_requests_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_change_requests" ADD CONSTRAINT "catalog_change_requests_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_change_requests" ADD CONSTRAINT "catalog_change_requests_generation_id_vehicle_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."vehicle_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_generation_aliases" ADD CONSTRAINT "vehicle_generation_aliases_generation_id_vehicle_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."vehicle_generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_generations" ADD CONSTRAINT "vehicle_generations_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_generations" ADD CONSTRAINT "vehicle_generations_parent_generation_id_vehicle_generations_id_fk" FOREIGN KEY ("parent_generation_id") REFERENCES "public"."vehicle_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_make_aliases" ADD CONSTRAINT "vehicle_make_aliases_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_model_aliases" ADD CONSTRAINT "vehicle_model_aliases_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_change_requests_status_created_idx" ON "catalog_change_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "catalog_change_requests_user_idx" ON "catalog_change_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vehicle_catalog_imports_started_idx" ON "vehicle_catalog_imports" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_generation_aliases_generation_normalized_uidx" ON "vehicle_generation_aliases" USING btree ("generation_id","normalized_alias");--> statement-breakpoint
CREATE INDEX "vehicle_generation_aliases_normalized_idx" ON "vehicle_generation_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_generations_source_external_uidx" ON "vehicle_generations" USING btree ("source_name","external_id");--> statement-breakpoint
CREATE INDEX "vehicle_generations_model_active_idx" ON "vehicle_generations" USING btree ("model_id","is_active");--> statement-breakpoint
CREATE INDEX "vehicle_generations_years_idx" ON "vehicle_generations" USING btree ("production_start_year","production_end_year");--> statement-breakpoint
CREATE INDEX "vehicle_generations_model_code_idx" ON "vehicle_generations" USING btree ("model_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_make_aliases_make_normalized_uidx" ON "vehicle_make_aliases" USING btree ("make_id","normalized_alias");--> statement-breakpoint
CREATE INDEX "vehicle_make_aliases_normalized_idx" ON "vehicle_make_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_makes_normalized_uidx" ON "vehicle_makes" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_makes_slug_uidx" ON "vehicle_makes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_makes_source_external_uidx" ON "vehicle_makes" USING btree ("source_name","external_id");--> statement-breakpoint
CREATE INDEX "vehicle_makes_featured_sort_idx" ON "vehicle_makes" USING btree ("is_featured","sort_order","normalized_name");--> statement-breakpoint
CREATE INDEX "vehicle_makes_active_search_idx" ON "vehicle_makes" USING btree ("is_active","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_model_aliases_model_normalized_uidx" ON "vehicle_model_aliases" USING btree ("model_id","normalized_alias");--> statement-breakpoint
CREATE INDEX "vehicle_model_aliases_normalized_idx" ON "vehicle_model_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_models_source_external_uidx" ON "vehicle_models" USING btree ("source_name","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_models_make_normalized_source_uidx" ON "vehicle_models" USING btree ("make_id","normalized_name","source_name");--> statement-breakpoint
CREATE INDEX "vehicle_models_make_active_idx" ON "vehicle_models" USING btree ("make_id","is_active");--> statement-breakpoint
CREATE INDEX "vehicle_models_normalized_idx" ON "vehicle_models" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "vehicle_models_make_slug_idx" ON "vehicle_models" USING btree ("make_id","slug");--> statement-breakpoint
ALTER TABLE "car_listings" ADD CONSTRAINT "car_listings_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_listings" ADD CONSTRAINT "car_listings_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_listings" ADD CONSTRAINT "car_listings_generation_id_vehicle_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."vehicle_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_make_id_idx" ON "car_listings" USING btree ("make_id");--> statement-breakpoint
CREATE INDEX "listings_model_id_idx" ON "car_listings" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "listings_generation_id_idx" ON "car_listings" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "listings_manufacture_year_idx" ON "car_listings" USING btree ("manufacture_year");