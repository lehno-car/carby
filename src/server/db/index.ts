import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");

  if (!client) {
    client = postgres(url, {
      max: process.env.NODE_ENV === "production" ? 10 : 2,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    database = drizzle(client, { schema });
  }

  return database!;
}

export async function closeDb() {
  if (client) await client.end({ timeout: 5 });
  client = undefined;
  database = undefined;
}
