import { describe, expect, it } from "vitest";

import type { carListings, users } from "@/server/db/schema";
import { ApiError } from "@/server/http";

import { assertOwnerOrAdmin, parseListOptions } from "./service";

describe("listing access and filters", () => {
  const listing = { ownerId: "owner" } as typeof carListings.$inferSelect;

  it("allows the owner and an admin but rejects another user", () => {
    expect(() =>
      assertOwnerOrAdmin(listing, { id: "owner", role: "user" } as typeof users.$inferSelect),
    ).not.toThrow();
    expect(() =>
      assertOwnerOrAdmin(listing, { id: "admin", role: "admin" } as typeof users.$inferSelect),
    ).not.toThrow();
    expect(() =>
      assertOwnerOrAdmin(listing, { id: "stranger", role: "user" } as typeof users.$inferSelect),
    ).toThrow(ApiError);
  });

  it("normalizes pagination, filtering and sorting", () => {
    const options = parseListOptions(
      new URLSearchParams(
        "q= passat &yearFrom=2018&maxPrice=80000&makeId=11111111-1111-4111-8111-111111111111&page=-4&limit=999&sort=price_asc",
      ),
    );
    expect(options).toMatchObject({
      query: "passat",
      minYear: 2018,
      makeId: "11111111-1111-4111-8111-111111111111",
      maxPrice: 80000,
      page: 1,
      limit: 30,
      sort: "price_asc",
    });
    expect(parseListOptions(new URLSearchParams("sort=DROP TABLE")).sort).toBe("newest");
  });
});
