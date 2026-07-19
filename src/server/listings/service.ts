import { and, asc, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import { carImages, carListings, users } from "@/server/db/schema";
import { ApiError } from "@/server/http";
import { maskVin } from "@/server/listings/validation";

export type AuthUser = typeof users.$inferSelect;

export function assertOwnerOrAdmin(listing: typeof carListings.$inferSelect, user: AuthUser) {
  if (listing.ownerId !== user.id && user.role !== "admin") {
    throw new ApiError(403, "Нельзя изменять чужое объявление", "FORBIDDEN");
  }
}

export async function getListingOrThrow(id: string) {
  const [listing] = await getDb().select().from(carListings).where(eq(carListings.id, id)).limit(1);
  if (!listing) throw new ApiError(404, "Объявление не найдено", "NOT_FOUND");
  return listing;
}

export function imagePath(id: string, variant: "full" | "thumb" = "thumb") {
  return `/api/images/${id}?variant=${variant}`;
}

export async function attachImages<T extends typeof carListings.$inferSelect>(listings: T[]) {
  if (!listings.length)
    return [] as Array<T & { images: Array<{ id: string; url: string; position: number }> }>;
  const images = await getDb()
    .select({ id: carImages.id, listingId: carImages.listingId, position: carImages.position })
    .from(carImages)
    .where(
      inArray(
        carImages.listingId,
        listings.map((listing) => listing.id),
      ),
    )
    .orderBy(asc(carImages.position));
  return listings.map((listing) => ({
    ...listing,
    vin: undefined,
    maskedVin: maskVin(listing.vin),
    images: images
      .filter((image) => image.listingId === listing.id)
      .map((image) => ({ id: image.id, url: imagePath(image.id), position: image.position })),
  }));
}

function numberParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function parseListOptions(params: URLSearchParams) {
  const requestedSort = params.get("sort");
  const allowedSorts = ["newest", "price_asc", "price_desc", "mileage_asc"] as const;
  const sort = allowedSorts.find((value) => value === requestedSort) ?? "newest";
  return {
    query: params.get("q")?.trim() ?? "",
    make: params.get("make")?.trim() ?? "",
    model: params.get("model")?.trim() ?? "",
    city: params.get("city")?.trim() ?? "",
    minYear: numberParam(params, "minYear"),
    maxYear: numberParam(params, "maxYear"),
    minPrice: numberParam(params, "minPrice"),
    maxPrice: numberParam(params, "maxPrice"),
    maxMileage: numberParam(params, "maxMileage"),
    page: Math.max(1, Math.floor(numberParam(params, "page") ?? 1)),
    limit: Math.min(30, Math.max(1, Math.floor(numberParam(params, "limit") ?? 12))),
    sort,
  };
}

export async function listActiveListings(params: URLSearchParams) {
  const options = parseListOptions(params);
  const conditions: SQL[] = [eq(carListings.status, "active")];
  const search = options.query;
  const make = options.make;
  const model = options.model;
  const city = options.city;
  const scalarFilters = [
    ["bodyType", carListings.bodyType],
    ["fuelType", carListings.fuelType],
    ["transmission", carListings.transmission],
    ["drivetrain", carListings.drivetrain],
    ["currency", carListings.currency],
  ] as const;

  if (search) {
    const searchCondition = or(
      ilike(carListings.make, `%${search}%`),
      ilike(carListings.model, `%${search}%`),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (make) conditions.push(ilike(carListings.make, make));
  if (model) conditions.push(ilike(carListings.model, model));
  if (city) conditions.push(ilike(carListings.city, city));
  for (const [key, column] of scalarFilters) {
    const value = params.get(key);
    if (value) conditions.push(eq(column, value as never));
  }

  const { minYear, maxYear, minPrice, maxPrice, maxMileage } = options;
  if (minYear) conditions.push(gte(carListings.year, minYear));
  if (maxYear) conditions.push(lte(carListings.year, maxYear));
  if (minPrice) conditions.push(gte(carListings.price, minPrice));
  if (maxPrice) conditions.push(lte(carListings.price, maxPrice));
  if (maxMileage) conditions.push(lte(carListings.mileage, maxMileage));

  const { page, limit, sort } = options;
  const order =
    sort === "price_asc"
      ? asc(carListings.price)
      : sort === "price_desc"
        ? desc(carListings.price)
        : sort === "mileage_asc"
          ? asc(carListings.mileage)
          : desc(carListings.createdAt);

  const rows = await getDb()
    .select()
    .from(carListings)
    .where(and(...conditions))
    .orderBy(order, desc(carListings.id))
    .limit(limit + 1)
    .offset((page - 1) * limit);
  const hasMore = rows.length > limit;
  return { items: await attachImages(rows.slice(0, limit)), page, hasMore };
}
