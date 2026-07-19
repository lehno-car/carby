import "dotenv/config";

import { sql } from "drizzle-orm";

import { closeDb, getDb } from "../src/server/db";
import {
  vehicleCatalogImports,
  vehicleGenerations,
  vehicleMakes,
  vehicleModels,
} from "../src/server/db/schema";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for catalog stats");
  try {
    const [
      makes,
      models,
      generations,
      generationsWithYears,
      generationsWithCodes,
      linkedListings,
      imports,
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
        select count(*)::int as count from vehicle_generations
        where production_start_year is not null or production_end_year is not null
      `),
      getDb().execute<{ count: number }>(sql`
        select count(*)::int as count from vehicle_generations where code is not null
      `),
      getDb().execute<{ linked: number; unlinked: number }>(sql`
        select
          count(*) filter (where make_id is not null and model_id is not null)::int as linked,
          count(*) filter (where make_id is null or model_id is null)::int as unlinked
        from car_listings
      `),
      getDb().select().from(vehicleCatalogImports),
    ]);
    console.log(
      JSON.stringify(
        {
          makes: makes[0]?.count ?? 0,
          models: models[0]?.count ?? 0,
          generations: generations[0]?.count ?? 0,
          generationsWithYears: generationsWithYears[0]?.count ?? 0,
          generationsWithCodes: generationsWithCodes[0]?.count ?? 0,
          listings: linkedListings[0] ?? { linked: 0, unlinked: 0 },
          imports,
        },
        null,
        2,
      ),
    );
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
