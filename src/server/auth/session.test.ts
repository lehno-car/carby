import { describe, expect, it } from "vitest";

import { assertAdmin } from "./session";

describe("administrative authorization", () => {
  it("accepts only the admin role", () => {
    expect(() => assertAdmin({ role: "admin" })).not.toThrow();
    expect(() => assertAdmin({ role: "user" })).toThrow("Недостаточно прав");
  });
});
