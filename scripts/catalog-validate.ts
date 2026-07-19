import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { sql } from "drizzle-orm";

import { validateCatalogDataset } from "../src/server/catalog/dataset";
import { closeDb, getDb } from "../src/server/db";
import { vehicleGenerations, vehicleMakes, vehicleModels } from "../src/server/db/schema";

async function main() {
  const fileArgument = process.argv.find((argument) => argument.startsWith("--file="));
  const offline = process.argv.includes("--offline");
  const file = path.resolve(
    fileArgument?.slice("--file=".length) || "data/catalog/catalog-wikidata-2026-07-19.json",
  );
  const raw = JSON.parse(await readFile(file, "utf8"));
  const { dataset, errors } = validateCatalogDataset(raw);

  const result: Record<string, unknown> = {
    status: errors.length ? "invalid" : "ok",
    file,
    datasetVersion: dataset.datasetVersion,
    fileCounts: {
      makes: dataset.makes.length,
      models: dataset.models.length,
      generations: dataset.generations.length,
    },
    errors,
  };

  if (process.env.DATABASE_URL && !offline) {
    try {
      const [
        makeCount,
        modelCount,
        generationCount,
        orphanModels,
        orphanGenerations,
        invalidYears,
      ] = await Promise.all([
        getDb()
          .select({ count: sql<number>`count(*)::int` })
          .from(vehicleMakes),
        getDb()
          .select({ count: sql<number>`count(*)::int` })
          .from(vehicleModels),
        getDb()
          .select({ count: sql<number>`count(*)::int` })
          .from(vehicleGenerations),
        getDb().execute<{ count: number }>(sql`
          select count(*)::int as count from vehicle_models m
          left join vehicle_makes mk on mk.id = m.make_id where mk.id is null
        `),
        getDb().execute<{ count: number }>(sql`
          select count(*)::int as count from vehicle_generations g
          left join vehicle_models m on m.id = g.model_id where m.id is null
        `),
        getDb().execute<{ count: number }>(sql`
          select count(*)::int as count from vehicle_generations
          where production_start_year is not null and production_end_year is not null
            and production_start_year > production_end_year
        `),
      ]);
      result.databaseCounts = {
        makes: makeCount[0]?.count ?? 0,
        models: modelCount[0]?.count ?? 0,
        generations: generationCount[0]?.count ?? 0,
      };
      result.databaseIntegrity = {
        orphanModels: orphanModels[0]?.count ?? 0,
        orphanGenerations: orphanGenerations[0]?.count ?? 0,
        invalidYearRanges: invalidYears[0]?.count ?? 0,
      };
      if (
        (orphanModels[0]?.count ?? 0) ||
        (orphanGenerations[0]?.count ?? 0) ||
        (invalidYears[0]?.count ?? 0)
      ) {
        result.status = "invalid";
      }
    } finally {
      await closeDb();
    }
  }

  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "ok") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
