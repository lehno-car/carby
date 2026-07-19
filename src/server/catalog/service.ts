import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  carListings,
  vehicleCatalogImports,
  vehicleGenerationAliases,
  vehicleGenerations,
  vehicleMakeAliases,
  vehicleMakes,
  vehicleModelAliases,
  vehicleModels,
} from "@/server/db/schema";
import { ApiError } from "@/server/http";
import { normalizeCatalogText } from "@/server/catalog/normalization";

type PageOptions = {
  query?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
};

function pageValues(options: PageOptions) {
  return {
    page: Math.max(1, Math.floor(options.page ?? 1)),
    limit: Math.min(100, Math.max(1, Math.floor(options.limit ?? 30))),
  };
}

export async function listCatalogMakes(options: PageOptions & { featured?: boolean }) {
  const { page, limit } = pageValues(options);
  const conditions: SQL[] = [];
  if (!options.includeInactive) conditions.push(eq(vehicleMakes.isActive, true));
  if (options.featured !== undefined)
    conditions.push(eq(vehicleMakes.isFeatured, options.featured));
  const query = normalizeCatalogText(options.query ?? "");
  if (query) {
    conditions.push(sql`(
      ${vehicleMakes.normalizedName} ilike ${`%${query}%`}
      or exists (
        select 1 from ${vehicleMakeAliases}
        where ${vehicleMakeAliases.makeId} = ${vehicleMakes.id}
          and ${vehicleMakeAliases.normalizedAlias} ilike ${`%${query}%`}
      )
    )`);
  }

  const rows = await getDb()
    .select()
    .from(vehicleMakes)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(vehicleMakes.isFeatured), asc(vehicleMakes.sortOrder), asc(vehicleMakes.name))
    .limit(limit + 1)
    .offset((page - 1) * limit);
  const items = rows.slice(0, limit);
  const counts = await activeListingCounts(
    "make",
    items.map((item) => item.id),
  );
  return {
    items: items.map((item) => ({ ...item, activeListingCount: counts.get(item.id) ?? 0 })),
    page,
    hasMore: rows.length > limit,
  };
}

export async function listCatalogModels(makeId: string, options: PageOptions) {
  const { page, limit } = pageValues(options);
  const conditions: SQL[] = [eq(vehicleModels.makeId, makeId)];
  if (!options.includeInactive) conditions.push(eq(vehicleModels.isActive, true));
  const query = normalizeCatalogText(options.query ?? "");
  if (query) {
    conditions.push(sql`(
      ${vehicleModels.normalizedName} ilike ${`%${query}%`}
      or exists (
        select 1 from ${vehicleModelAliases}
        where ${vehicleModelAliases.modelId} = ${vehicleModels.id}
          and ${vehicleModelAliases.normalizedAlias} ilike ${`%${query}%`}
      )
    )`);
  }
  const rows = await getDb()
    .select()
    .from(vehicleModels)
    .where(and(...conditions))
    .orderBy(asc(vehicleModels.name))
    .limit(limit + 1)
    .offset((page - 1) * limit);
  const items = rows.slice(0, limit);
  const counts = await activeListingCounts(
    "model",
    items.map((item) => item.id),
  );
  return {
    items: items.map((item) => ({ ...item, activeListingCount: counts.get(item.id) ?? 0 })),
    page,
    hasMore: rows.length > limit,
  };
}

export async function listCatalogGenerations(
  modelId: string,
  options: PageOptions & { year?: number },
) {
  const { page, limit } = pageValues(options);
  const conditions: SQL[] = [eq(vehicleGenerations.modelId, modelId)];
  if (!options.includeInactive) conditions.push(eq(vehicleGenerations.isActive, true));
  if (options.year) {
    const start = or(
      sql`${vehicleGenerations.productionStartYear} is null`,
      lte(vehicleGenerations.productionStartYear, options.year),
    );
    const end = or(
      sql`${vehicleGenerations.productionEndYear} is null`,
      gte(vehicleGenerations.productionEndYear, options.year),
    );
    if (start) conditions.push(start);
    if (end) conditions.push(end);
  }
  const query = normalizeCatalogText(options.query ?? "");
  if (query) {
    conditions.push(sql`(
      lower(${vehicleGenerations.name}) ilike ${`%${query}%`}
      or lower(coalesce(${vehicleGenerations.code}, '')) ilike ${`%${query}%`}
      or exists (
        select 1 from ${vehicleGenerationAliases}
        where ${vehicleGenerationAliases.generationId} = ${vehicleGenerations.id}
          and ${vehicleGenerationAliases.normalizedAlias} ilike ${`%${query}%`}
      )
    )`);
  }
  const rows = await getDb()
    .select()
    .from(vehicleGenerations)
    .where(and(...conditions))
    .orderBy(desc(vehicleGenerations.productionStartYear), asc(vehicleGenerations.name))
    .limit(limit + 1)
    .offset((page - 1) * limit);
  return { items: rows.slice(0, limit), page, hasMore: rows.length > limit };
}

export async function searchCatalog(queryValue: string, limit = 20) {
  const query = normalizeCatalogText(queryValue);
  if (query.length < 1) return { makes: [], models: [], generations: [] };
  const safeLimit = Math.min(30, Math.max(1, limit));
  const [makes, models, generations] = await Promise.all([
    listCatalogMakes({ query, limit: safeLimit }),
    getDb()
      .select({
        id: vehicleModels.id,
        name: vehicleModels.name,
        makeId: vehicleModels.makeId,
        makeName: vehicleMakes.name,
      })
      .from(vehicleModels)
      .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
      .where(
        and(
          eq(vehicleModels.isActive, true),
          eq(vehicleMakes.isActive, true),
          or(
            ilike(vehicleModels.normalizedName, `%${query}%`),
            sql`exists (select 1 from ${vehicleModelAliases} where ${vehicleModelAliases.modelId} = ${vehicleModels.id} and ${vehicleModelAliases.normalizedAlias} ilike ${`%${query}%`})`,
          ),
        ),
      )
      .orderBy(asc(vehicleMakes.name), asc(vehicleModels.name))
      .limit(safeLimit),
    getDb()
      .select({
        id: vehicleGenerations.id,
        name: vehicleGenerations.name,
        code: vehicleGenerations.code,
        modelId: vehicleGenerations.modelId,
        modelName: vehicleModels.name,
        makeName: vehicleMakes.name,
      })
      .from(vehicleGenerations)
      .innerJoin(vehicleModels, eq(vehicleGenerations.modelId, vehicleModels.id))
      .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
      .where(
        and(
          eq(vehicleGenerations.isActive, true),
          or(
            ilike(vehicleGenerations.name, `%${query}%`),
            ilike(vehicleGenerations.code, `%${query}%`),
            sql`exists (select 1 from ${vehicleGenerationAliases} where ${vehicleGenerationAliases.generationId} = ${vehicleGenerations.id} and ${vehicleGenerationAliases.normalizedAlias} ilike ${`%${query}%`})`,
          ),
        ),
      )
      .limit(safeLimit),
  ]);
  return { makes: makes.items, models, generations };
}

export async function catalogVersion() {
  const [latest] = await getDb()
    .select()
    .from(vehicleCatalogImports)
    .orderBy(desc(vehicleCatalogImports.startedAt))
    .limit(1);
  return latest ?? null;
}

export async function validateVehicleSelection(input: {
  makeId: string;
  modelId: string;
  generationId?: string | null;
  year: number;
  allowInactive?: boolean;
}) {
  const [make] = await getDb()
    .select()
    .from(vehicleMakes)
    .where(eq(vehicleMakes.id, input.makeId))
    .limit(1);
  const [model] = await getDb()
    .select()
    .from(vehicleModels)
    .where(eq(vehicleModels.id, input.modelId))
    .limit(1);
  let generation: typeof vehicleGenerations.$inferSelect | null = null;
  if (input.generationId) {
    const [foundGeneration] = await getDb()
      .select()
      .from(vehicleGenerations)
      .where(eq(vehicleGenerations.id, input.generationId))
      .limit(1);
    generation = foundGeneration ?? null;
  }
  return validateVehicleSelectionRecords(input, {
    make: make ?? null,
    model: model ?? null,
    generation,
  });
}

export function validateVehicleSelectionRecords(
  input: {
    makeId: string;
    modelId: string;
    generationId?: string | null;
    year: number;
    allowInactive?: boolean;
  },
  records: {
    make: typeof vehicleMakes.$inferSelect | null;
    model: typeof vehicleModels.$inferSelect | null;
    generation: typeof vehicleGenerations.$inferSelect | null;
  },
) {
  const { make, model } = records;
  if (!make || !model || model.makeId !== make.id) {
    throw new ApiError(400, "Модель не принадлежит выбранной марке", "CATALOG_MODEL_MAKE_MISMATCH");
  }
  if (!input.allowInactive && (!make.isActive || !model.isActive || make.isSpecial)) {
    throw new ApiError(
      400,
      "Эта марка или модель недоступна для новых объявлений",
      "CATALOG_INACTIVE",
    );
  }

  const generation = records.generation;
  let yearWarning: string | null = null;
  if (input.generationId) {
    if (!generation || generation.modelId !== model.id) {
      throw new ApiError(
        400,
        "Поколение не принадлежит выбранной модели",
        "CATALOG_GENERATION_MODEL_MISMATCH",
      );
    }
    if (!input.allowInactive && !generation.isActive) {
      throw new ApiError(400, "Это поколение недоступно", "CATALOG_INACTIVE");
    }
    const start = generation.productionStartYear;
    const end = generation.productionEndYear;
    if ((start && input.year < start) || (end && input.year > end)) {
      yearWarning = `Выбранный год не входит в указанный источником период ${start ?? "?"}–${end ?? "н.в."}`;
    }
    if ((start && input.year < start - 2) || (end && input.year > end + 2)) {
      throw new ApiError(
        400,
        "Год выпуска явно не соответствует выбранному поколению",
        "CATALOG_GENERATION_YEAR_MISMATCH",
      );
    }
  }

  return { make, model, generation, yearWarning };
}

async function activeListingCounts(kind: "make" | "model", ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const column = kind === "make" ? carListings.makeId : carListings.modelId;
  const rows = await getDb()
    .select({ id: column, count: sql<number>`count(*)::int` })
    .from(carListings)
    .where(and(eq(carListings.status, "active"), inArray(column, ids)))
    .groupBy(column);
  return new Map(rows.flatMap((row) => (row.id ? [[row.id, row.count] as const] : [])));
}
