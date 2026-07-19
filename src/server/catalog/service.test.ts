import { describe, expect, it } from "vitest";

import type { vehicleGenerations, vehicleMakes, vehicleModels } from "@/server/db/schema";
import { ApiError } from "@/server/http";

import { validateVehicleSelectionRecords } from "./service";

const make = { id: "make", isActive: true, isSpecial: false } as typeof vehicleMakes.$inferSelect;
const model = { id: "model", makeId: "make", isActive: true } as typeof vehicleModels.$inferSelect;
const generation = {
  id: "generation",
  modelId: "model",
  isActive: true,
  productionStartYear: 2018,
  productionEndYear: 2022,
} as typeof vehicleGenerations.$inferSelect;
const input = { makeId: "make", modelId: "model", generationId: "generation", year: 2020 };

describe("catalog selection validation", () => {
  it("accepts a valid hierarchy", () => {
    expect(
      validateVehicleSelectionRecords(input, { make, model, generation }).yearWarning,
    ).toBeNull();
  });

  it("rejects a model from another make", () => {
    expect(() =>
      validateVehicleSelectionRecords(input, {
        make,
        model: { ...model, makeId: "other" },
        generation,
      }),
    ).toThrow(ApiError);
  });

  it("rejects a generation from another model", () => {
    expect(() =>
      validateVehicleSelectionRecords(input, {
        make,
        model,
        generation: { ...generation, modelId: "other" },
      }),
    ).toThrow(ApiError);
  });

  it("warns near the source range and rejects an obvious mismatch", () => {
    expect(
      validateVehicleSelectionRecords({ ...input, year: 2017 }, { make, model, generation })
        .yearWarning,
    ).toContain("2018");
    expect(() =>
      validateVehicleSelectionRecords({ ...input, year: 2010 }, { make, model, generation }),
    ).toThrow(ApiError);
  });

  it("rejects inactive catalog records for a new listing", () => {
    expect(() =>
      validateVehicleSelectionRecords(input, {
        make,
        model: { ...model, isActive: false },
        generation,
      }),
    ).toThrow(ApiError);
  });
});
