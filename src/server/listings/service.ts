import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  carImages,
  carListings,
  users,
  vehicleGenerationAliases,
  vehicleGenerations,
  vehicleMakeAliases,
  vehicleMakes,
  vehicleModelAliases,
  vehicleModels,
} from "@/server/db/schema";
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
  const catalogListings = await attachCatalogNames(listings);
  return catalogListings.map((listing) => ({
    ...listing,
    vin: undefined,
    maskedVin: maskVin(listing.vin),
    images: images
      .filter((image) => image.listingId === listing.id)
      .map((image) => ({ id: image.id, url: imagePath(image.id), position: image.position })),
  }));
}

async function attachCatalogNames<T extends typeof carListings.$inferSelect>(listings: T[]) {
  const makeIds = [...new Set(listings.flatMap((item) => (item.makeId ? [item.makeId] : [])))];
  const modelIds = [...new Set(listings.flatMap((item) => (item.modelId ? [item.modelId] : [])))];
  const generationIds = [
    ...new Set(listings.flatMap((item) => (item.generationId ? [item.generationId] : []))),
  ];
  const [makes, models, generations] = await Promise.all([
    makeIds.length
      ? getDb().select().from(vehicleMakes).where(inArray(vehicleMakes.id, makeIds))
      : [],
    modelIds.length
      ? getDb().select().from(vehicleModels).where(inArray(vehicleModels.id, modelIds))
      : [],
    generationIds.length
      ? getDb()
          .select()
          .from(vehicleGenerations)
          .where(inArray(vehicleGenerations.id, generationIds))
      : [],
  ]);
  const makeById = new Map(makes.map((item) => [item.id, item]));
  const modelById = new Map(models.map((item) => [item.id, item]));
  const generationById = new Map(generations.map((item) => [item.id, item]));
  return listings.map((listing) => {
    const make = listing.makeId ? makeById.get(listing.makeId) : undefined;
    const model = listing.modelId ? modelById.get(listing.modelId) : undefined;
    const generation = listing.generationId ? generationById.get(listing.generationId) : undefined;
    return {
      ...listing,
      make: make?.name ?? listing.make,
      model: model?.name ?? listing.model,
      generation: generation?.name ?? listing.generation,
      year: listing.manufactureYear ?? listing.year,
      catalog: {
        make: make ?? null,
        model: model ?? null,
        generation: generation ?? null,
      },
    };
  });
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
    makeId: params.get("makeId")?.trim() ?? "",
    modelId: params.get("modelId")?.trim() ?? "",
    generationId: params.get("generationId")?.trim() ?? "",
    city: params.get("city")?.trim() ?? "",
    minYear: numberParam(params, "yearFrom") ?? numberParam(params, "minYear"),
    maxYear: numberParam(params, "yearTo") ?? numberParam(params, "maxYear"),
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
  const makeId = options.makeId;
  const modelId = options.modelId;
  const generationId = options.generationId;
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
      sql`exists (select 1 from ${vehicleMakeAliases} where ${vehicleMakeAliases.makeId} = ${carListings.makeId} and ${vehicleMakeAliases.normalizedAlias} ilike ${`%${search}%`})`,
      sql`exists (select 1 from ${vehicleModelAliases} where ${vehicleModelAliases.modelId} = ${carListings.modelId} and ${vehicleModelAliases.normalizedAlias} ilike ${`%${search}%`})`,
      sql`exists (select 1 from ${vehicleGenerationAliases} where ${vehicleGenerationAliases.generationId} = ${carListings.generationId} and ${vehicleGenerationAliases.normalizedAlias} ilike ${`%${search}%`})`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (makeId) conditions.push(eq(carListings.makeId, makeId));
  if (modelId) conditions.push(eq(carListings.modelId, modelId));
  if (generationId) conditions.push(eq(carListings.generationId, generationId));
  if (city) conditions.push(ilike(carListings.city, city));
  for (const [key, column] of scalarFilters) {
    const value = params.get(key);
    if (value) conditions.push(eq(column, value as never));
  }

  const { minYear, maxYear, minPrice, maxPrice, maxMileage } = options;
  if (minYear)
    conditions.push(
      gte(sql`coalesce(${carListings.manufactureYear}, ${carListings.year})`, minYear),
    );
  if (maxYear)
    conditions.push(
      lte(sql`coalesce(${carListings.manufactureYear}, ${carListings.year})`, maxYear),
    );
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
