import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  integer,
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

export const usersRelations = relations(users, ({ many }) => ({
  listings: many(carListings),
  favorites: many(favorites),
  reports: many(reports),
}));

export const listingsRelations = relations(carListings, ({ one, many }) => ({
  owner: one(users, { fields: [carListings.ownerId], references: [users.id] }),
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
};

export const activeListing = sql`${carListings.status} = 'active'`;
