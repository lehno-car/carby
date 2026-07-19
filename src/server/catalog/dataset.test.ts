import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { validateCatalogDataset } from "./dataset";
import { normalizeCatalogText } from "./normalization";

const requirements = JSON.parse(
  readFileSync(path.resolve("data/catalog/makes-carby-v1.json"), "utf8"),
) as { makes: string[]; featured: string[]; aliases: Record<string, string[]> };
const rawDataset = JSON.parse(
  readFileSync(path.resolve("data/catalog/catalog-wikidata-2026-07-19.json"), "utf8"),
);
const { dataset, errors } = validateCatalogDataset(rawDataset);

describe("vehicle catalog dataset", () => {
  it("contains every required make exactly once", () => {
    expect(errors).toEqual([]);
    expect(dataset.makes.map((item) => item.name)).toEqual(requirements.makes);
    expect(new Set(dataset.makes.map((item) => item.externalId)).size).toBe(dataset.makes.length);
  });

  it("marks precisely the requested featured makes", () => {
    expect(dataset.makes.filter((item) => item.isFeatured).map((item) => item.name)).toEqual(
      requirements.featured,
    );
  });

  it("does not mix listing counters into make names", () => {
    expect(dataset.makes.every((item) => !/\b\d+\b/.test(item.name))).toBe(true);
  });

  it("keeps all model and generation references valid", () => {
    const makeIds = new Set(dataset.makes.map((item) => item.externalId));
    const modelIds = new Set(dataset.models.map((item) => item.externalId));
    expect(dataset.models.every((item) => makeIds.has(item.makeExternalId))).toBe(true);
    expect(dataset.generations.every((item) => modelIds.has(item.modelExternalId))).toBe(true);
  });

  it("has stable unique source keys for idempotent upserts", () => {
    for (const items of [dataset.makes, dataset.models, dataset.generations]) {
      const keys = items.map((item) => `${item.sourceName}:${item.externalId}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("does not contain invalid generation year ranges", () => {
    expect(
      dataset.generations.every(
        (item) =>
          item.productionStartYear == null ||
          item.productionEndYear == null ||
          item.productionStartYear <= item.productionEndYear,
      ),
    ).toBe(true);
  });

  it("normalizes documented aliases consistently", () => {
    const lookup = new Map<string, string>();
    for (const make of dataset.makes) {
      lookup.set(make.normalizedName, make.name);
      for (const alias of make.aliases) lookup.set(normalizeCatalogText(alias), make.name);
    }
    for (const aliases of Object.values(requirements.aliases)) {
      for (const alias of aliases) expect(normalizeCatalogText(alias)).not.toBe("");
    }
    expect(lookup.get(normalizeCatalogText("ВАЗ"))).toBe("Lada (ВАЗ)");
    expect(lookup.get(normalizeCatalogText("Deepal"))).toBe("Shenlan (Deepal)");
    expect(lookup.get(normalizeCatalogText("VW"))).toBe("Volkswagen");
    expect(lookup.get(normalizeCatalogText("БМВ"))).toBe("BMW");
    expect(normalizeCatalogText("Škoda")).toBe(normalizeCatalogText("Skoda"));
    expect(normalizeCatalogText("Mercedes–Benz")).toBe("mercedes benz");
  });
});
