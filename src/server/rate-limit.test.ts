import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";

import * as schema from "@/server/db/schema";

import { buildRateLimitUpsert } from "./rate-limit";

describe("rate limit query", () => {
  it("reuses the typed excluded reset_at value during conflict updates", () => {
    const db = drizzle.mock({ schema });
    const query = buildRateLimitUpsert(
      db,
      "auth:test",
      new Date("2026-07-19T12:00:00.000Z"),
    ).toSQL();

    expect(query.sql).toContain('excluded."reset_at"');
    expect(query.params).toHaveLength(3);
    expect(query.params[2]).toBe("2026-07-19T12:00:00.000Z");
  });
});
