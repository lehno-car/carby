import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/server/auth/session";
import { validateCatalogDataset } from "@/server/catalog/dataset";
import { catalogSlug, normalizeCatalogText } from "@/server/catalog/normalization";
import {
  listCatalogGenerations,
  listCatalogMakes,
  listCatalogModels,
} from "@/server/catalog/service";
import { getDb } from "@/server/db";
import {
  carListings,
  catalogChangeRequests,
  vehicleCatalogImports,
  vehicleGenerationAliases,
  vehicleGenerations,
  vehicleMakeAliases,
  vehicleMakes,
  vehicleModelAliases,
  vehicleModels,
} from "@/server/db/schema";
import { ApiError, apiError, readJson } from "@/server/http";

const entitySchema = z.enum(["make", "model", "generation"]);
const createSchema = z.discriminatedUnion("entity", [
  z.object({
    action: z.literal("create"),
    entity: z.literal("make"),
    name: z.string().trim().min(1).max(120),
    countryCode: z.string().trim().length(2).toUpperCase().nullable().optional(),
    isFeatured: z.boolean().optional(),
    isSpecial: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("create"),
    entity: z.literal("model"),
    makeId: z.uuid(),
    name: z.string().trim().min(1).max(160),
  }),
  z.object({
    action: z.literal("create"),
    entity: z.literal("generation"),
    modelId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().max(80).nullable().optional(),
    productionStartYear: z.number().int().min(1886).max(2200).nullable().optional(),
    productionEndYear: z.number().int().min(1886).max(2200).nullable().optional(),
    isFacelift: z.boolean().optional(),
  }),
]);
const aliasSchema = z.object({
  action: z.literal("alias"),
  entity: entitySchema,
  id: z.uuid(),
  alias: z.string().trim().min(1).max(220),
  locale: z.string().trim().max(12).nullable().optional(),
});
const mergeSchema = z.object({
  action: z.literal("merge"),
  entity: entitySchema,
  sourceId: z.uuid(),
  targetId: z.uuid(),
});
const patchSchema = z.object({
  entity: entitySchema,
  id: z.uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().nullable().optional(),
  code: z.string().trim().max(80).nullable().optional(),
  productionStartYear: z.number().int().min(1886).max(2200).nullable().optional(),
  productionEndYear: z.number().int().min(1886).max(2200).nullable().optional(),
  isFeatured: z.boolean().optional(),
  isSpecial: z.boolean().optional(),
  isFacelift: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const params = new URL(request.url).searchParams;
    const view = params.get("view") ?? "makes";
    if (view === "preview") {
      const file = path.resolve("data/catalog/catalog-wikidata-2026-07-19.json");
      const { dataset, errors } = validateCatalogDataset(JSON.parse(await readFile(file, "utf8")));
      const [makes, models, generations] = await Promise.all([
        getDb()
          .select({ sourceName: vehicleMakes.sourceName, externalId: vehicleMakes.externalId })
          .from(vehicleMakes),
        getDb()
          .select({ sourceName: vehicleModels.sourceName, externalId: vehicleModels.externalId })
          .from(vehicleModels),
        getDb()
          .select({
            sourceName: vehicleGenerations.sourceName,
            externalId: vehicleGenerations.externalId,
          })
          .from(vehicleGenerations),
      ]);
      const existing = {
        makes: new Set(makes.map(sourceKey)),
        models: new Set(models.map(sourceKey)),
        generations: new Set(generations.map(sourceKey)),
      };
      const created = {
        makes: dataset.makes.filter((item) => !existing.makes.has(sourceKey(item))).length,
        models: dataset.models.filter((item) => !existing.models.has(sourceKey(item))).length,
        generations: dataset.generations.filter(
          (item) => !existing.generations.has(sourceKey(item)),
        ).length,
      };
      return NextResponse.json({
        status: errors.length ? "invalid" : "dry_run",
        datasetVersion: dataset.datasetVersion,
        totals: {
          makes: dataset.makes.length,
          models: dataset.models.length,
          generations: dataset.generations.length,
        },
        created,
        updated: {
          makes: dataset.makes.length - created.makes,
          models: dataset.models.length - created.models,
          generations: dataset.generations.length - created.generations,
        },
        skipped: {
          models: arrayLength(dataset.extractionReport.unmatchedModels),
          generations: arrayLength(dataset.extractionReport.unmatchedGenerations),
        },
        errors,
      });
    }
    if (view === "imports") {
      const items = await getDb()
        .select()
        .from(vehicleCatalogImports)
        .orderBy(desc(vehicleCatalogImports.startedAt))
        .limit(100);
      return NextResponse.json({ items });
    }
    if (view === "aliases") {
      const entity = entitySchema.parse(params.get("entity"));
      const id = z.uuid().parse(params.get("id"));
      const table =
        entity === "make"
          ? vehicleMakeAliases
          : entity === "model"
            ? vehicleModelAliases
            : vehicleGenerationAliases;
      const idColumn =
        entity === "make"
          ? vehicleMakeAliases.makeId
          : entity === "model"
            ? vehicleModelAliases.modelId
            : vehicleGenerationAliases.generationId;
      const items = await getDb()
        .select()
        .from(table)
        .where(eq(idColumn, id))
        .orderBy(asc(table.alias));
      return NextResponse.json({ items });
    }
    const common = {
      query: params.get("query") ?? "",
      page: Number(params.get("page") || 1),
      limit: Number(params.get("limit") || 100),
      includeInactive: true,
    };
    if (view === "models") {
      return NextResponse.json(
        await listCatalogModels(z.uuid().parse(params.get("makeId")), common),
      );
    }
    if (view === "generations") {
      return NextResponse.json(
        await listCatalogGenerations(z.uuid().parse(params.get("modelId")), common),
      );
    }
    return NextResponse.json(await listCatalogMakes(common));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    const action = z.object({ action: z.enum(["create", "alias", "merge"]) }).parse(body).action;
    if (action === "alias")
      return NextResponse.json(
        { item: await createAlias(aliasSchema.parse(body)) },
        { status: 201 },
      );
    if (action === "merge")
      return NextResponse.json({ item: await mergeCatalogItems(mergeSchema.parse(body)) });

    const input = createSchema.parse(body);
    const externalId = `manual:${crypto.randomUUID()}`;
    if (input.entity === "make") {
      const [item] = await getDb()
        .insert(vehicleMakes)
        .values({
          name: input.name,
          normalizedName: normalizeCatalogText(input.name),
          slug: `${catalogSlug(input.name)}-${externalId.slice(-8)}`,
          countryCode: input.countryCode ?? null,
          isFeatured: input.isFeatured ?? false,
          isSpecial: input.isSpecial ?? false,
          sourceName: "admin",
          externalId,
        })
        .returning();
      return NextResponse.json({ item }, { status: 201 });
    }
    if (input.entity === "model") {
      const [make] = await getDb()
        .select({ id: vehicleMakes.id })
        .from(vehicleMakes)
        .where(eq(vehicleMakes.id, input.makeId))
        .limit(1);
      if (!make) throw new ApiError(404, "Марка не найдена", "CATALOG_MAKE_NOT_FOUND");
      const [item] = await getDb()
        .insert(vehicleModels)
        .values({
          makeId: input.makeId,
          name: input.name,
          normalizedName: normalizeCatalogText(input.name),
          slug: `${catalogSlug(input.name)}-${externalId.slice(-8)}`,
          sourceName: "admin",
          externalId,
        })
        .returning();
      return NextResponse.json({ item }, { status: 201 });
    }
    assertYearRange(input.productionStartYear, input.productionEndYear);
    const [model] = await getDb()
      .select({ id: vehicleModels.id })
      .from(vehicleModels)
      .where(eq(vehicleModels.id, input.modelId))
      .limit(1);
    if (!model) throw new ApiError(404, "Модель не найдена", "CATALOG_MODEL_NOT_FOUND");
    const [item] = await getDb()
      .insert(vehicleGenerations)
      .values({
        modelId: input.modelId,
        name: input.name,
        code: input.code || null,
        productionStartYear: input.productionStartYear ?? null,
        productionEndYear: input.productionEndYear ?? null,
        isFacelift: input.isFacelift ?? false,
        sourceName: "admin",
        externalId,
      })
      .returning();
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const input = patchSchema.parse(await readJson(request));
    if (input.entity === "make") {
      const [item] = await getDb()
        .update(vehicleMakes)
        .set({
          ...(input.name
            ? { name: input.name, normalizedName: normalizeCatalogText(input.name) }
            : {}),
          ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
          ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
          ...(input.isSpecial !== undefined ? { isSpecial: input.isSpecial } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        })
        .where(eq(vehicleMakes.id, input.id))
        .returning();
      return NextResponse.json({ item });
    }
    if (input.entity === "model") {
      const [item] = await getDb()
        .update(vehicleModels)
        .set({
          ...(input.name
            ? { name: input.name, normalizedName: normalizeCatalogText(input.name) }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        })
        .where(eq(vehicleModels.id, input.id))
        .returning();
      return NextResponse.json({ item });
    }
    const [current] = await getDb()
      .select()
      .from(vehicleGenerations)
      .where(eq(vehicleGenerations.id, input.id))
      .limit(1);
    if (!current) throw new ApiError(404, "Поколение не найдено", "CATALOG_NOT_FOUND");
    assertYearRange(
      input.productionStartYear !== undefined
        ? input.productionStartYear
        : current.productionStartYear,
      input.productionEndYear !== undefined ? input.productionEndYear : current.productionEndYear,
    );
    const [item] = await getDb()
      .update(vehicleGenerations)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code || null } : {}),
        ...(input.productionStartYear !== undefined
          ? { productionStartYear: input.productionStartYear }
          : {}),
        ...(input.productionEndYear !== undefined
          ? { productionEndYear: input.productionEndYear }
          : {}),
        ...(input.isFacelift !== undefined ? { isFacelift: input.isFacelift } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(eq(vehicleGenerations.id, input.id))
      .returning();
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error);
  }
}

function assertYearRange(start: number | null | undefined, end: number | null | undefined) {
  if (start != null && end != null && start > end) {
    throw new ApiError(400, "Год начала не может быть позже года окончания", "CATALOG_YEAR_RANGE");
  }
}

async function createAlias(input: z.infer<typeof aliasSchema>) {
  const normalizedAlias = normalizeCatalogText(input.alias);
  if (input.entity === "make") {
    const [item] = await getDb()
      .insert(vehicleMakeAliases)
      .values({
        makeId: input.id,
        alias: input.alias,
        normalizedAlias,
        locale: input.locale,
        sourceName: "admin",
      })
      .onConflictDoNothing()
      .returning();
    return item ?? null;
  }
  if (input.entity === "model") {
    const [item] = await getDb()
      .insert(vehicleModelAliases)
      .values({
        modelId: input.id,
        alias: input.alias,
        normalizedAlias,
        locale: input.locale,
        sourceName: "admin",
      })
      .onConflictDoNothing()
      .returning();
    return item ?? null;
  }
  const [item] = await getDb()
    .insert(vehicleGenerationAliases)
    .values({
      generationId: input.id,
      alias: input.alias,
      normalizedAlias,
      locale: input.locale,
      sourceName: "admin",
    })
    .onConflictDoNothing()
    .returning();
  return item ?? null;
}

async function mergeCatalogItems(input: z.infer<typeof mergeSchema>) {
  if (input.sourceId === input.targetId)
    throw new ApiError(400, "Нельзя объединить запись саму с собой", "CATALOG_MERGE_SELF");
  return getDb().transaction(async (tx) => {
    if (input.entity === "generation") {
      const [source, target] = await Promise.all([
        tx
          .select()
          .from(vehicleGenerations)
          .where(eq(vehicleGenerations.id, input.sourceId))
          .limit(1)
          .then((rows) => rows[0]),
        tx
          .select()
          .from(vehicleGenerations)
          .where(eq(vehicleGenerations.id, input.targetId))
          .limit(1)
          .then((rows) => rows[0]),
      ]);
      if (!source || !target) throw new ApiError(404, "Поколение не найдено", "CATALOG_NOT_FOUND");
      if (source.modelId !== target.modelId) {
        throw new ApiError(
          409,
          "Сначала объедините модели: поколения относятся к разным моделям",
          "CATALOG_MERGE_HIERARCHY_MISMATCH",
        );
      }
      const sourceAliases = await tx
        .select()
        .from(vehicleGenerationAliases)
        .where(eq(vehicleGenerationAliases.generationId, source.id));
      await tx
        .insert(vehicleGenerationAliases)
        .values([
          {
            generationId: target.id,
            alias: source.name,
            normalizedAlias: normalizeCatalogText(source.name),
            sourceName: "merge",
          },
          ...sourceAliases.map((alias) => ({
            generationId: target.id,
            alias: alias.alias,
            normalizedAlias: alias.normalizedAlias,
            locale: alias.locale,
            sourceName: alias.sourceName ?? "merge",
          })),
        ])
        .onConflictDoNothing();
      await tx
        .update(carListings)
        .set({ generationId: target.id, generation: target.name })
        .where(eq(carListings.generationId, source.id));
      await tx
        .update(catalogChangeRequests)
        .set({ generationId: target.id })
        .where(eq(catalogChangeRequests.generationId, source.id));
      await tx
        .update(vehicleGenerations)
        .set({ isActive: false })
        .where(eq(vehicleGenerations.id, source.id));
      return { sourceId: source.id, targetId: target.id, entity: input.entity };
    }
    if (input.entity === "model") {
      await mergeModels(tx, input.sourceId, input.targetId);
      return { sourceId: input.sourceId, targetId: input.targetId, entity: input.entity };
    }
    const [source, target] = await Promise.all([
      tx
        .select()
        .from(vehicleMakes)
        .where(eq(vehicleMakes.id, input.sourceId))
        .limit(1)
        .then((rows) => rows[0]),
      tx
        .select()
        .from(vehicleMakes)
        .where(eq(vehicleMakes.id, input.targetId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);
    if (!source || !target) throw new ApiError(404, "Марка не найдена", "CATALOG_NOT_FOUND");
    const sourceAliases = await tx
      .select()
      .from(vehicleMakeAliases)
      .where(eq(vehicleMakeAliases.makeId, source.id));
    const sourceModels = await tx
      .select()
      .from(vehicleModels)
      .where(eq(vehicleModels.makeId, source.id));
    for (const sourceModel of sourceModels) {
      const [duplicate] = await tx
        .select()
        .from(vehicleModels)
        .where(
          and(
            eq(vehicleModels.makeId, target.id),
            eq(vehicleModels.normalizedName, sourceModel.normalizedName),
          ),
        )
        .limit(1);
      if (duplicate) await mergeModels(tx, sourceModel.id, duplicate.id, true);
      else
        await tx
          .update(vehicleModels)
          .set({ makeId: target.id })
          .where(eq(vehicleModels.id, sourceModel.id));
    }
    await tx
      .insert(vehicleMakeAliases)
      .values([
        {
          makeId: target.id,
          alias: source.name,
          normalizedAlias: normalizeCatalogText(source.name),
          sourceName: "merge",
        },
        ...sourceAliases.map((alias) => ({
          makeId: target.id,
          alias: alias.alias,
          normalizedAlias: alias.normalizedAlias,
          locale: alias.locale,
          sourceName: alias.sourceName ?? "merge",
        })),
      ])
      .onConflictDoNothing();
    await tx
      .update(carListings)
      .set({ makeId: target.id, make: target.name })
      .where(eq(carListings.makeId, source.id));
    await tx
      .update(catalogChangeRequests)
      .set({ makeId: target.id })
      .where(eq(catalogChangeRequests.makeId, source.id));
    await tx.update(vehicleMakes).set({ isActive: false }).where(eq(vehicleMakes.id, source.id));
    return { sourceId: source.id, targetId: target.id, entity: input.entity };
  });
}

type CatalogTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function mergeModels(
  tx: CatalogTransaction,
  sourceId: string,
  targetId: string,
  allowDifferentMake = false,
) {
  const [source, target] = await Promise.all([
    tx
      .select()
      .from(vehicleModels)
      .where(eq(vehicleModels.id, sourceId))
      .limit(1)
      .then((rows) => rows[0]),
    tx
      .select()
      .from(vehicleModels)
      .where(eq(vehicleModels.id, targetId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  if (!source || !target) throw new ApiError(404, "Модель не найдена", "CATALOG_NOT_FOUND");
  if (!allowDifferentMake && source.makeId !== target.makeId) {
    throw new ApiError(
      409,
      "Сначала объедините марки: модели относятся к разным маркам",
      "CATALOG_MERGE_HIERARCHY_MISMATCH",
    );
  }
  const sourceAliases = await tx
    .select()
    .from(vehicleModelAliases)
    .where(eq(vehicleModelAliases.modelId, source.id));
  await tx
    .insert(vehicleModelAliases)
    .values([
      {
        modelId: target.id,
        alias: source.name,
        normalizedAlias: normalizeCatalogText(source.name),
        sourceName: "merge",
      },
      ...sourceAliases.map((alias) => ({
        modelId: target.id,
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        locale: alias.locale,
        sourceName: alias.sourceName ?? "merge",
      })),
    ])
    .onConflictDoNothing();
  await tx
    .update(vehicleGenerations)
    .set({ modelId: target.id })
    .where(eq(vehicleGenerations.modelId, source.id));
  await tx
    .update(carListings)
    .set({ modelId: target.id, model: target.name })
    .where(eq(carListings.modelId, source.id));
  await tx
    .update(catalogChangeRequests)
    .set({ modelId: target.id })
    .where(eq(catalogChangeRequests.modelId, source.id));
  await tx.update(vehicleModels).set({ isActive: false }).where(eq(vehicleModels.id, source.id));
}

function sourceKey(item: { sourceName: string; externalId: string }) {
  return `${item.sourceName}:${item.externalId}`;
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
