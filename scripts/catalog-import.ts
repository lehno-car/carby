import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { validateCatalogDataset } from "../src/server/catalog/dataset";
import { normalizeCatalogText } from "../src/server/catalog/normalization";
import { closeDb, getDb } from "../src/server/db";
import {
  carListings,
  vehicleCatalogImports,
  vehicleGenerationAliases,
  vehicleGenerations,
  vehicleMakeAliases,
  vehicleMakes,
  vehicleModelAliases,
  vehicleModels,
} from "../src/server/db/schema";

async function main() {
  const argumentsMap = new Map(
    process.argv.slice(2).map((argument) => {
      const [key, ...value] = argument.replace(/^--/, "").split("=");
      return [key, value.join("=") || "true"];
    }),
  );
  const dryRun = argumentsMap.get("dry-run") === "true";
  const offline = argumentsMap.get("offline") === "true";
  const file = path.resolve(
    argumentsMap.get("file") || "data/catalog/catalog-wikidata-2026-07-19.json",
  );

  const raw = JSON.parse(await readFile(file, "utf8"));
  const { dataset, errors } = validateCatalogDataset(raw);
  if (errors.length) {
    console.error(JSON.stringify({ status: "invalid", errors }, null, 2));
    process.exitCode = 1;
  } else if ((offline || !process.env.DATABASE_URL) && dryRun) {
    console.log(
      JSON.stringify(
        {
          status: "dry_run_offline",
          file,
          datasetVersion: dataset.datasetVersion,
          makes: dataset.makes.length,
          models: dataset.models.length,
          generations: dataset.generations.length,
          note: "DATABASE_URL is absent; schema and referential integrity were validated without database writes.",
        },
        null,
        2,
      ),
    );
  } else {
    if (offline) throw new Error("--offline can only be used together with --dry-run");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for catalog import");
    const db = getDb();
    let importId: string | null = null;

    try {
      const sourceName = dataset.sources
        .map((source) => source.name)
        .join(" + ")
        .slice(0, 80);
      if (!dryRun && argumentsMap.get("force") !== "true") {
        const [completed] = await db
          .select({ id: vehicleCatalogImports.id })
          .from(vehicleCatalogImports)
          .where(
            and(
              eq(vehicleCatalogImports.sourceName, sourceName),
              eq(vehicleCatalogImports.sourceVersion, dataset.datasetVersion),
              eq(vehicleCatalogImports.status, "completed"),
            ),
          )
          .limit(1);
        if (completed) {
          console.log(
            JSON.stringify(
              {
                status: "already_imported",
                importId: completed.id,
                datasetVersion: dataset.datasetVersion,
              },
              null,
              2,
            ),
          );
          return;
        }
      }
      const existing = await loadExistingKeys();
      const createdCount =
        dataset.makes.filter((item) => !existing.makes.has(key(item))).length +
        dataset.models.filter((item) => !existing.models.has(key(item))).length +
        dataset.generations.filter((item) => !existing.generations.has(key(item))).length;
      const updatedCount =
        dataset.makes.length + dataset.models.length + dataset.generations.length - createdCount;
      const skippedCount =
        arrayLength(dataset.extractionReport.unmatchedModels) +
        arrayLength(dataset.extractionReport.unmatchedGenerations);

      if (dryRun) {
        console.log(
          JSON.stringify(
            {
              status: "dry_run",
              file,
              datasetVersion: dataset.datasetVersion,
              createdCount,
              updatedCount,
              skippedCount,
              errors: [],
            },
            null,
            2,
          ),
        );
      } else {
        const [importRow] = await db
          .insert(vehicleCatalogImports)
          .values({
            sourceName,
            sourceVersion: dataset.datasetVersion,
            status: "running",
            report: { file, sources: dataset.sources },
          })
          .returning({ id: vehicleCatalogImports.id });
        if (!importRow) throw new Error("Could not create catalog import journal entry");
        importId = importRow.id;

        const migrationReport = await db.transaction(async (tx) => {
          for (const batch of chunks(dataset.makes, 100)) {
            await tx
              .insert(vehicleMakes)
              .values(
                batch.map((item) => ({
                  name: item.name,
                  normalizedName: item.normalizedName,
                  slug: item.slug,
                  isFeatured: item.isFeatured,
                  isSpecial: item.isSpecial,
                  isActive: true,
                  sortOrder: item.sortOrder,
                  sourceName: item.sourceName,
                  externalId: item.externalId,
                  sourceUrl: item.sourceUrl,
                })),
              )
              .onConflictDoUpdate({
                target: vehicleMakes.normalizedName,
                set: {
                  name: sql`excluded."name"`,
                  slug: sql`excluded."slug"`,
                  isFeatured: sql`excluded."is_featured"`,
                  isSpecial: sql`excluded."is_special"`,
                  sortOrder: sql`excluded."sort_order"`,
                  sourceUrl: sql`excluded."source_url"`,
                  updatedAt: new Date(),
                },
              });
          }

          const importedMakes = await tx
            .select()
            .from(vehicleMakes)
            .where(
              inArray(
                vehicleMakes.externalId,
                dataset.makes.map((item) => item.externalId),
              ),
            );
          const makeByExternalId = new Map(importedMakes.map((item) => [item.externalId, item]));
          const makeAliases = dataset.makes.flatMap((item) => {
            const make = makeByExternalId.get(item.externalId);
            return make
              ? item.aliases.map((alias) => ({
                  makeId: make.id,
                  alias,
                  normalizedAlias: normalizeCatalogText(alias),
                  sourceName: item.sourceName,
                }))
              : [];
          });
          for (const batch of chunks(makeAliases, 200)) {
            if (batch.length)
              await tx.insert(vehicleMakeAliases).values(batch).onConflictDoNothing();
          }

          for (const batch of chunks(dataset.models, 100)) {
            await tx
              .insert(vehicleModels)
              .values(
                batch.map((item) => {
                  const make = makeByExternalId.get(item.makeExternalId);
                  if (!make) throw new Error(`Missing imported make ${item.makeExternalId}`);
                  return {
                    makeId: make.id,
                    name: item.name,
                    normalizedName: item.normalizedName,
                    slug: item.slug,
                    sourceName: item.sourceName,
                    externalId: item.externalId,
                    sourceUrl: item.sourceUrl,
                    isActive: true,
                  };
                }),
              )
              .onConflictDoUpdate({
                target: [vehicleModels.sourceName, vehicleModels.externalId],
                set: {
                  name: sql`excluded."name"`,
                  normalizedName: sql`excluded."normalized_name"`,
                  slug: sql`excluded."slug"`,
                  sourceUrl: sql`excluded."source_url"`,
                  updatedAt: new Date(),
                },
              });
          }

          const importedModels = await tx
            .select()
            .from(vehicleModels)
            .where(
              inArray(
                vehicleModels.externalId,
                dataset.models.map((item) => item.externalId),
              ),
            );
          const modelByExternalId = new Map(importedModels.map((item) => [item.externalId, item]));

          for (const batch of chunks(dataset.generations, 100)) {
            await tx
              .insert(vehicleGenerations)
              .values(
                batch.map((item) => {
                  const model = modelByExternalId.get(item.modelExternalId);
                  if (!model) throw new Error(`Missing imported model ${item.modelExternalId}`);
                  return {
                    modelId: model.id,
                    name: item.name,
                    code: item.code,
                    productionStartYear: item.productionStartYear,
                    productionEndYear: item.productionEndYear,
                    isFacelift: item.isFacelift,
                    isActive: true,
                    sourceName: item.sourceName,
                    externalId: item.externalId,
                    sourceUrl: item.sourceUrl,
                  };
                }),
              )
              .onConflictDoUpdate({
                target: [vehicleGenerations.sourceName, vehicleGenerations.externalId],
                set: {
                  name: sql`excluded."name"`,
                  code: sql`excluded."code"`,
                  productionStartYear: sql`excluded."production_start_year"`,
                  productionEndYear: sql`excluded."production_end_year"`,
                  isFacelift: sql`excluded."is_facelift"`,
                  sourceUrl: sql`excluded."source_url"`,
                  updatedAt: new Date(),
                },
              });
          }

          return backfillLegacyListings(tx);
        });

        await db
          .update(vehicleCatalogImports)
          .set({
            status: "completed",
            createdCount,
            updatedCount,
            skippedCount,
            errorCount: 0,
            finishedAt: new Date(),
            report: {
              file,
              sources: dataset.sources,
              extractionReport: dataset.extractionReport,
              legacyListingMigration: migrationReport,
            },
          })
          .where(eq(vehicleCatalogImports.id, importId));

        console.log(
          JSON.stringify(
            {
              status: "completed",
              importId,
              datasetVersion: dataset.datasetVersion,
              makes: dataset.makes.length,
              models: dataset.models.length,
              generations: dataset.generations.length,
              createdCount,
              updatedCount,
              skippedCount,
              legacyListingMigration: migrationReport,
            },
            null,
            2,
          ),
        );
      }
    } catch (error) {
      if (importId) {
        await db
          .update(vehicleCatalogImports)
          .set({
            status: "failed",
            errorCount: 1,
            finishedAt: new Date(),
            report: { file, error: error instanceof Error ? error.message : "Unknown error" },
          })
          .where(eq(vehicleCatalogImports.id, importId));
      }
      throw error;
    } finally {
      await closeDb();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function key(item: { sourceName: string; externalId: string }) {
  return `${item.sourceName}:${item.externalId}`;
}

async function loadExistingKeys() {
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
  return {
    makes: new Set(makes.map(key)),
    models: new Set(models.map(key)),
    generations: new Set(generations.map(key)),
  };
}

async function backfillLegacyListings(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
) {
  const [makes, makeAliases, models, modelAliases, generations, generationAliases, listings] =
    await Promise.all([
      tx.select().from(vehicleMakes),
      tx.select().from(vehicleMakeAliases),
      tx.select().from(vehicleModels),
      tx.select().from(vehicleModelAliases),
      tx.select().from(vehicleGenerations),
      tx.select().from(vehicleGenerationAliases),
      tx
        .select()
        .from(carListings)
        .where(
          or(
            isNull(carListings.makeId),
            isNull(carListings.modelId),
            isNull(carListings.manufactureYear),
          ),
        ),
    ]);

  const makeMap = new Map(makes.map((item) => [item.normalizedName, item]));
  for (const alias of makeAliases) {
    const make = makes.find((item) => item.id === alias.makeId);
    if (make) makeMap.set(alias.normalizedAlias, make);
  }
  const modelMap = new Map(models.map((item) => [`${item.makeId}:${item.normalizedName}`, item]));
  for (const alias of modelAliases) {
    const model = models.find((item) => item.id === alias.modelId);
    if (model) modelMap.set(`${model.makeId}:${alias.normalizedAlias}`, model);
  }
  const generationMap = new Map(
    generations.map((item) => [`${item.modelId}:${normalizeCatalogText(item.name)}`, item]),
  );
  for (const alias of generationAliases) {
    const generation = generations.find((item) => item.id === alias.generationId);
    if (generation) generationMap.set(`${generation.modelId}:${alias.normalizedAlias}`, generation);
  }

  const report = {
    matched: 0,
    partiallyMatched: 0,
    unmatched: [] as Array<{
      listingId: string;
      make: string;
      model: string;
      generation: string | null;
    }>,
  };
  for (const listing of listings) {
    const make = makeMap.get(normalizeCatalogText(listing.make));
    const model = make
      ? modelMap.get(`${make.id}:${normalizeCatalogText(listing.model)}`)
      : undefined;
    const generation =
      model && listing.generation
        ? generationMap.get(`${model.id}:${normalizeCatalogText(listing.generation)}`)
        : undefined;

    await tx
      .update(carListings)
      .set({
        manufactureYear: listing.manufactureYear ?? listing.year,
        makeId: make?.id ?? listing.makeId,
        modelId: model?.id ?? listing.modelId,
        generationId: generation?.id ?? listing.generationId,
      })
      .where(eq(carListings.id, listing.id));

    if (make && model) {
      if (!listing.generation || generation) report.matched += 1;
      else report.partiallyMatched += 1;
    } else {
      report.unmatched.push({
        listingId: listing.id,
        make: listing.make,
        model: listing.model,
        generation: listing.generation,
      });
    }
  }
  return report;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
