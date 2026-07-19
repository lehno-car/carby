import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  console.log("Checking database migrations...");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Database migrations are up to date");
} finally {
  await client.end({ timeout: 5 });
}
