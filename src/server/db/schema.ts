import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const listingStatus = pgEnum("listing_status", [
  "draft",
  "pending",
  "active",
  "rejected",
  "sold",
  "archived",
]);
export const currency = pgEnum("currency", ["BYN", "RUB", "USD"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);
export const moderationAction = pgEnum("moderation_action", ["approved", "rejected"]);
export const catalogImportStatus = pgEnum("catalog_import_status", [
  "running",
  "completed",
  "failed",
  "dry_run",
]);
export const catalogRequestType = pgEnum("catalog_request_type", [
  "missing_make",
  "missing_model",
  "missing_generation",
  "incorrect_years",
  "duplicate",
  "other",
]);
export const catalogRequestStatus = pgEnum("catalog_request_status", [
  "open",
  "in_review",
  "resolved",
  "rejected",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    telegramId: bigint("telegram_id", { mode: "bigint" }).notNull(),
    username: varchar("username", { length: 64 }),
    firstName: varchar("first_name", { length: 128 }).notNull(),
    lastName: varchar("last_name", { length: 128 }),
    photoUrl: text("photo_url"),
    phone: varchar("phone", { length: 32 }),
    role: userRole("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_telegram_id_uidx").on(table.telegramId)],
);

export const vehicleMakes = pgTable(
  "vehicle_makes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }),
    logoKey: text("logo_key"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isSpecial: boolean("is_special").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    sourceName: varchar("source_name", { length: 80 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("vehicle_makes_normalized_uidx").on(table.normalizedName),
    uniqueIndex("vehicle_makes_slug_uidx").on(table.slug),
    uniqueIndex("vehicle_makes_source_external_uidx").on(table.sourceName, table.externalId),
    index("vehicle_makes_featured_sort_idx").on(
      table.isFeatured,
      table.sortOrder,
      table.normalizedName,
    ),
    index("vehicle_makes_active_search_idx").on(table.isActive, table.normalizedName),
  ],
);

export const vehicleModels = pgTable(
  "vehicle_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    makeId: uuid("make_id")
      .notNull()
      .references(() => vehicleMakes.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    vehicleCategory: varchar("vehicle_category", { length: 80 }),
    isActive: boolean("is_active").notNull().default(true),
    sourceName: varchar("source_name", { length: 80 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("vehicle_models_source_external_uidx").on(table.sourceName, table.externalId),
    uniqueIndex("vehicle_models_make_normalized_source_uidx").on(
      table.makeId,
      table.normalizedName,
      table.sourceName,
    ),
    index("vehicle_models_make_active_idx").on(table.makeId, table.isActive),
    index("vehicle_models_normalized_idx").on(table.normalizedName),
    index("vehicle_models_make_slug_idx").on(table.makeId, table.slug),
  ],
);

export const vehicleGenerations = pgTable(
  "vehicle_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => vehicleModels.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 80 }),
    productionStartYear: integer("production_start_year"),
    productionEndYear: integer("production_end_year"),
    isFacelift: boolean("is_facelift").notNull().default(false),
    parentGenerationId: uuid("parent_generation_id").references(
      (): AnyPgColumn => vehicleGenerations.id,
      { onDelete: "set null" },
    ),
    isActive: boolean("is_active").notNull().default(true),
    sourceName: varchar("source_name", { length: 80 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("vehicle_generations_source_external_uidx").on(table.sourceName, table.externalId),
    index("vehicle_generations_model_active_idx").on(table.modelId, table.isActive),
    index("vehicle_generations_years_idx").on(table.productionStartYear, table.productionEndYear),
    index("vehicle_generations_model_code_idx").on(table.modelId, table.code),
    check(
      "vehicle_generations_year_range_check",
      sql`${table.productionStartYear} is null or ${table.productionEndYear} is null or ${table.productionStartYear} <= ${table.productionEndYear}`,
    ),
  ],
);

export const vehicleMakeAliases = pgTable(
  "vehicle_make_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    makeId: uuid("make_id")
      .notNull()
      .references(() => vehicleMakes.id, { onDelete: "cascade" }),
    alias: varchar("alias", { length: 160 }).notNull(),
    normalizedAlias: varchar("normalized_alias", { length: 180 }).notNull(),
    locale: varchar("locale", { length: 12 }),
    sourceName: varchar("source_name", { length: 80 }),
  },
  (table) => [
    uniqueIndex("vehicle_make_aliases_make_normalized_uidx").on(
      table.makeId,
      table.normalizedAlias,
    ),
    index("vehicle_make_aliases_normalized_idx").on(table.normalizedAlias),
  ],
);

export const vehicleModelAliases = pgTable(
  "vehicle_model_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => vehicleModels.id, { onDelete: "cascade" }),
    alias: varchar("alias", { length: 180 }).notNull(),
    normalizedAlias: varchar("normalized_alias", { length: 200 }).notNull(),
    locale: varchar("locale", { length: 12 }),
    sourceName: varchar("source_name", { length: 80 }),
  },
  (table) => [
    uniqueIndex("vehicle_model_aliases_model_normalized_uidx").on(
      table.modelId,
      table.normalizedAlias,
    ),
    index("vehicle_model_aliases_normalized_idx").on(table.normalizedAlias),
  ],
);

export const vehicleGenerationAliases = pgTable(
  "vehicle_generation_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => vehicleGenerations.id, { onDelete: "cascade" }),
    alias: varchar("alias", { length: 220 }).notNull(),
    normalizedAlias: varchar("normalized_alias", { length: 240 }).notNull(),
    locale: varchar("locale", { length: 12 }),
    sourceName: varchar("source_name", { length: 80 }),
  },
  (table) => [
    uniqueIndex("vehicle_generation_aliases_generation_normalized_uidx").on(
      table.generationId,
      table.normalizedAlias,
    ),
    index("vehicle_generation_aliases_normalized_idx").on(table.normalizedAlias),
  ],
);

export const vehicleCatalogImports = pgTable(
  "vehicle_catalog_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceName: varchar("source_name", { length: 80 }).notNull(),
    sourceVersion: varchar("source_version", { length: 80 }).notNull(),
    status: catalogImportStatus("status").notNull().default("running"),
    createdCount: integer("created_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    report: jsonb("report").notNull().default({}),
  },
  (table) => [index("vehicle_catalog_imports_started_idx").on(table.startedAt)],
);

export const catalogChangeRequests = pgTable(
  "catalog_change_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    requestType: catalogRequestType("request_type").notNull(),
    makeId: uuid("make_id").references(() => vehicleMakes.id, { onDelete: "set null" }),
    modelId: uuid("model_id").references(() => vehicleModels.id, { onDelete: "set null" }),
    generationId: uuid("generation_id").references(() => vehicleGenerations.id, {
      onDelete: "set null",
    }),
    comment: text("comment").notNull(),
    status: catalogRequestStatus("status").notNull().default("open"),
    adminResponse: text("admin_response"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("catalog_change_requests_status_created_idx").on(table.status, table.createdAt),
    index("catalog_change_requests_user_idx").on(table.userId),
  ],
);

export const carListings = pgTable(
  "car_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    make: varchar("make", { length: 80 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    generation: varchar("generation", { length: 120 }),
    year: integer("year").notNull(),
    makeId: uuid("make_id").references(() => vehicleMakes.id, { onDelete: "restrict" }),
    modelId: uuid("model_id").references(() => vehicleModels.id, { onDelete: "restrict" }),
    generationId: uuid("generation_id").references(() => vehicleGenerations.id, {
      onDelete: "set null",
    }),
    manufactureYear: integer("manufacture_year"),
    price: bigint("price", { mode: "number" }).notNull(),
    currency: currency("currency").notNull().default("BYN"),
    mileage: integer("mileage").notNull(),
    bodyType: varchar("body_type", { length: 40 }).notNull(),
    fuelType: varchar("fuel_type", { length: 40 }).notNull(),
    transmission: varchar("transmission", { length: 40 }).notNull(),
    drivetrain: varchar("drivetrain", { length: 40 }).notNull(),
    engineVolume: numeric("engine_volume", { precision: 3, scale: 1 }),
    horsepower: integer("horsepower"),
    color: varchar("color", { length: 64 }),
    vin: varchar("vin", { length: 17 }),
    country: varchar("country", { length: 80 }).notNull().default("Беларусь"),
    city: varchar("city", { length: 80 }).notNull(),
    description: text("description").notNull(),
    sellerPhone: varchar("seller_phone", { length: 32 }),
    sellerTelegram: varchar("seller_telegram", { length: 64 }),
    status: listingStatus("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("listings_status_created_idx").on(table.status, table.createdAt),
    index("listings_make_model_idx").on(table.make, table.model),
    index("listings_price_idx").on(table.price),
    index("listings_year_idx").on(table.year),
    index("listings_owner_idx").on(table.ownerId),
    index("listings_city_idx").on(table.city),
    index("listings_make_id_idx").on(table.makeId),
    index("listings_model_id_idx").on(table.modelId),
    index("listings_generation_id_idx").on(table.generationId),
    index("listings_manufacture_year_idx").on(table.manufactureYear),
  ],
);

export const carImages = pgTable(
  "car_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => carListings.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    thumbnailKey: text("thumbnail_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    size: integer("size").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("car_images_object_key_uidx").on(table.objectKey),
    index("car_images_listing_position_idx").on(table.listingId, table.position),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => carListings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.listingId] }),
    index("favorites_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => carListings.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 80 }).notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reports_listing_idx").on(table.listingId),
    index("reports_status_idx").on(table.status),
  ],
);

export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => carListings.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: moderationAction("action").notNull(),
    reason: text("reason"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("moderation_listing_created_idx").on(table.listingId, table.createdAt)],
);

export const rateLimitEntries = pgTable(
  "rate_limit_entries",
  {
    key: varchar("key", { length: 180 }).primaryKey(),
    count: integer("count").notNull().default(1),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limit_reset_idx").on(table.resetAt)],
);

export const telegramLoginRequests = pgTable(
  "telegram_login_requests",
  {
    token: varchar("token", { length: 80 }).primaryKey(),
    telegramId: bigint("telegram_id", { mode: "bigint" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("telegram_login_requests_status_idx").on(table.status),
    index("telegram_login_requests_expires_idx").on(table.expiresAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  listings: many(carListings),
  favorites: many(favorites),
  reports: many(reports),
  catalogChangeRequests: many(catalogChangeRequests),
}));

export const vehicleMakesRelations = relations(vehicleMakes, ({ many }) => ({
  models: many(vehicleModels),
  aliases: many(vehicleMakeAliases),
  listings: many(carListings),
}));

export const vehicleModelsRelations = relations(vehicleModels, ({ one, many }) => ({
  make: one(vehicleMakes, { fields: [vehicleModels.makeId], references: [vehicleMakes.id] }),
  generations: many(vehicleGenerations),
  aliases: many(vehicleModelAliases),
  listings: many(carListings),
}));

export const vehicleGenerationsRelations = relations(vehicleGenerations, ({ one, many }) => ({
  model: one(vehicleModels, {
    fields: [vehicleGenerations.modelId],
    references: [vehicleModels.id],
  }),
  parent: one(vehicleGenerations, {
    fields: [vehicleGenerations.parentGenerationId],
    references: [vehicleGenerations.id],
    relationName: "generation_parent",
  }),
  facelifts: many(vehicleGenerations, { relationName: "generation_parent" }),
  aliases: many(vehicleGenerationAliases),
  listings: many(carListings),
}));

export const vehicleMakeAliasesRelations = relations(vehicleMakeAliases, ({ one }) => ({
  make: one(vehicleMakes, {
    fields: [vehicleMakeAliases.makeId],
    references: [vehicleMakes.id],
  }),
}));

export const vehicleModelAliasesRelations = relations(vehicleModelAliases, ({ one }) => ({
  model: one(vehicleModels, {
    fields: [vehicleModelAliases.modelId],
    references: [vehicleModels.id],
  }),
}));

export const vehicleGenerationAliasesRelations = relations(vehicleGenerationAliases, ({ one }) => ({
  generation: one(vehicleGenerations, {
    fields: [vehicleGenerationAliases.generationId],
    references: [vehicleGenerations.id],
  }),
}));

export const listingsRelations = relations(carListings, ({ one, many }) => ({
  owner: one(users, { fields: [carListings.ownerId], references: [users.id] }),
  makeRecord: one(vehicleMakes, { fields: [carListings.makeId], references: [vehicleMakes.id] }),
  modelRecord: one(vehicleModels, {
    fields: [carListings.modelId],
    references: [vehicleModels.id],
  }),
  generationRecord: one(vehicleGenerations, {
    fields: [carListings.generationId],
    references: [vehicleGenerations.id],
  }),
  images: many(carImages),
  favorites: many(favorites),
  reports: many(reports),
  moderationEvents: many(moderationEvents),
}));

export const imagesRelations = relations(carImages, ({ one }) => ({
  listing: one(carListings, { fields: [carImages.listingId], references: [carListings.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  listing: one(carListings, { fields: [favorites.listingId], references: [carListings.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id] }),
  listing: one(carListings, { fields: [reports.listingId], references: [carListings.id] }),
}));

export const moderationRelations = relations(moderationEvents, ({ one }) => ({
  listing: one(carListings, {
    fields: [moderationEvents.listingId],
    references: [carListings.id],
  }),
  admin: one(users, { fields: [moderationEvents.adminId], references: [users.id] }),
}));

export const schema = {
  users,
  carListings,
  carImages,
  favorites,
  reports,
  moderationEvents,
  rateLimitEntries,
  telegramLoginRequests,
  vehicleMakes,
  vehicleModels,
  vehicleGenerations,
  vehicleMakeAliases,
  vehicleModelAliases,
  vehicleGenerationAliases,
  vehicleCatalogImports,
  catalogChangeRequests,
};

export const activeListing = sql`${carListings.status} = 'active'`;
