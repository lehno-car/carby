import { z } from "zod";

const sourceSchema = z.object({
  name: z.string().min(1).max(80),
  version: z.string().min(1).max(80),
  url: z.string().url().nullable(),
  license: z.string().min(1),
  licenseUrl: z.string().url().optional(),
  queryEndpoint: z.string().url().optional(),
});

const makeSchema = z.object({
  name: z.string().min(1).max(120),
  normalizedName: z.string().min(1).max(140),
  slug: z.string().min(1).max(140),
  aliases: z.array(z.string().min(1).max(160)).default([]),
  isFeatured: z.boolean(),
  isSpecial: z.boolean(),
  sortOrder: z.number().int(),
  sourceName: z.string().min(1).max(80),
  externalId: z.string().min(1).max(160),
  sourceUrl: z.string().url().nullable(),
});

const modelSchema = z.object({
  makeExternalId: z.string().min(1).max(160),
  name: z.string().min(1).max(160),
  normalizedName: z.string().min(1).max(180),
  slug: z.string().min(1).max(180),
  sourceLabel: z.string().min(1).max(220),
  sourceName: z.string().min(1).max(80),
  externalId: z.string().min(1).max(160),
  sourceUrl: z.string().url().nullable(),
});

const generationSchema = z
  .object({
    modelExternalId: z.string().min(1).max(160),
    name: z.string().min(1).max(200),
    code: z.string().max(80).nullable(),
    productionStartYear: z.number().int().min(1885).max(2100).nullable(),
    productionEndYear: z.number().int().min(1885).max(2100).nullable(),
    isFacelift: z.boolean(),
    parentExternalId: z.string().max(160).nullable(),
    sourceName: z.string().min(1).max(80),
    externalId: z.string().min(1).max(160),
    sourceUrl: z.string().url().nullable(),
  })
  .refine(
    (value) =>
      !value.productionStartYear ||
      !value.productionEndYear ||
      value.productionStartYear <= value.productionEndYear,
    { message: "Generation start year must not exceed end year" },
  );

export const catalogDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  datasetVersion: z.string().min(1).max(80),
  generatedAt: z.string().datetime(),
  sources: z.array(sourceSchema).min(1),
  makes: z.array(makeSchema).min(1),
  models: z.array(modelSchema),
  generations: z.array(generationSchema),
  extractionReport: z.record(z.string(), z.unknown()),
});

export type CatalogDataset = z.infer<typeof catalogDatasetSchema>;

export function validateCatalogDataset(input: unknown) {
  const dataset = catalogDatasetSchema.parse(input);
  const errors: string[] = [];
  const makeIds = new Set(dataset.makes.map((make) => make.externalId));
  const modelIds = new Set(dataset.models.map((model) => model.externalId));

  const duplicateMakeNames = duplicates(dataset.makes.map((make) => make.normalizedName));
  const duplicateMakeIds = duplicates(dataset.makes.map((make) => make.externalId));
  const duplicateModelIds = duplicates(
    dataset.models.map((model) => `${model.sourceName}:${model.externalId}`),
  );
  const duplicateModelNames = duplicates(
    dataset.models.map((model) => `${model.makeExternalId}:${model.normalizedName}`),
  );
  const duplicateGenerationIds = duplicates(
    dataset.generations.map((generation) => `${generation.sourceName}:${generation.externalId}`),
  );
  const duplicateGenerations = duplicates(
    dataset.generations.map(
      (generation) =>
        `${generation.modelExternalId}:${generation.name.toLocaleLowerCase()}:${generation.productionStartYear ?? ""}:${generation.productionEndYear ?? ""}:${generation.code ?? ""}`,
    ),
  );

  if (duplicateMakeNames.length)
    errors.push(`Duplicate make names: ${duplicateMakeNames.join(", ")}`);
  if (duplicateMakeIds.length) errors.push(`Duplicate make IDs: ${duplicateMakeIds.join(", ")}`);
  if (duplicateModelIds.length) errors.push(`Duplicate model IDs: ${duplicateModelIds.join(", ")}`);
  if (duplicateModelNames.length)
    errors.push(`Duplicate models within make: ${duplicateModelNames.join(", ")}`);
  if (duplicateGenerationIds.length) {
    errors.push(`Duplicate generation IDs: ${duplicateGenerationIds.join(", ")}`);
  }
  if (duplicateGenerations.length) {
    errors.push(`Duplicate generations within model: ${duplicateGenerations.join(", ")}`);
  }
  for (const model of dataset.models) {
    if (!makeIds.has(model.makeExternalId)) {
      errors.push(`Model ${model.externalId} references missing make ${model.makeExternalId}`);
    }
  }
  for (const generation of dataset.generations) {
    if (!modelIds.has(generation.modelExternalId)) {
      errors.push(
        `Generation ${generation.externalId} references missing model ${generation.modelExternalId}`,
      );
    }
  }

  return { dataset, errors };
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}
