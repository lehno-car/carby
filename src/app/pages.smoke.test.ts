import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("main application artifacts", () => {
  it.each([
    "page.tsx",
    "favorites/page.tsx",
    "sell/page.tsx",
    "my/page.tsx",
    "profile/page.tsx",
    "admin/page.tsx",
    "listing/[id]/page.tsx",
  ])("contains app/%s", (file) => {
    expect(existsSync(path.join(process.cwd(), "src/app", file))).toBe(true);
  });

  it("enforces uniqueness for favorites in the generated migration", () => {
    const migration = readFileSync(
      path.join(process.cwd(), "drizzle/0000_blushing_malice.sql"),
      "utf8",
    );
    expect(migration).toContain('PRIMARY KEY("user_id","listing_id")');
  });
});
