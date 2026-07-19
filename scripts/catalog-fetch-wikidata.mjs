import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.join("=") || true];
  }),
);
const version = String(args.version || new Date().toISOString().slice(0, 10));
const baseFile = path.resolve(String(args.base || "data/catalog/makes-carby-v1.json"));
const outputFile = path.resolve(
  String(args.output || `data/catalog/catalog-wikidata-${version}.json`),
);

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ё/g, "е")
    .toLocaleLowerCase("ru")
    .replace(/[‐‑‒–—―-]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slug(value) {
  const transliteration = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return normalize(value)
    .split("")
    .map((character) => transliteration[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function qid(uri) {
  return uri?.split("/").at(-1) ?? "";
}

function year(value) {
  if (!value) return null;
  const parsed = Number(value.slice(0, 4));
  return Number.isInteger(parsed) && parsed >= 1885 && parsed <= new Date().getFullYear() + 2
    ? parsed
    : null;
}

async function sparql(query) {
  const endpoint = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint, {
    headers: {
      accept: "application/sparql-results+json",
      "user-agent": "CarbyCatalogImporter/1.0 (open-data import; Railway marketplace project)",
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Wikidata query failed with HTTP ${response.status}`);
  return (await response.json()).results.bindings;
}

function preferredLabel(rows, key) {
  const values = rows
    .map((row) => row[key])
    .filter(Boolean)
    .sort((a, b) => {
      const languageScore = (item) => (item["xml:lang"] === "en" ? 0 : 1);
      return languageScore(a) - languageScore(b) || a.value.localeCompare(b.value, "en");
    });
  return values[0]?.value ?? null;
}

function displayModelName(sourceLabel, make) {
  const prefixes = [make.name, ...(make.aliases ?? [])].sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (sourceLabel.toLocaleLowerCase("en").startsWith(`${prefix.toLocaleLowerCase("en")} `)) {
      return sourceLabel.slice(prefix.length).trim();
    }
  }
  return sourceLabel;
}

const base = JSON.parse(await readFile(baseFile, "utf8"));
const featured = new Set(base.featured);
const special = new Set(base.special);
const makes = base.makes.map((name, index) => ({
  name,
  normalizedName: normalize(name),
  slug: slug(name),
  aliases: base.aliases[name] ?? [],
  isFeatured: featured.has(name),
  isSpecial: special.has(name),
  sortOrder: featured.has(name) ? base.featured.indexOf(name) : 1000 + index,
  sourceName: base.source.name,
  externalId: `carby-make:${slug(name)}`,
  sourceUrl: base.source.url,
}));

const makeLookup = new Map();
for (const make of makes) {
  makeLookup.set(normalize(make.name), make);
  for (const alias of make.aliases) makeLookup.set(normalize(alias), make);
}

const modelQuery = `
SELECT DISTINCT ?model ?modelLabel ?brand ?brandLabel ?manufacturer ?manufacturerLabel WHERE {
  ?model wdt:P31 wd:Q59773381 .
  OPTIONAL { ?model wdt:P1716 ?brand . ?brand rdfs:label ?brandLabel . FILTER(LANG(?brandLabel) IN ("en", "ru")) }
  OPTIONAL { ?model wdt:P176 ?manufacturer . ?manufacturer rdfs:label ?manufacturerLabel . FILTER(LANG(?manufacturerLabel) IN ("en", "ru")) }
  ?model rdfs:label ?modelLabel .
  FILTER(LANG(?modelLabel) IN ("en", "ru"))
}`;

const generationQuery = `
SELECT DISTINCT ?generation ?generationLabel ?model ?start ?end ?code WHERE {
  ?generation wdt:P31 wd:Q3231690 ; wdt:P179 ?model .
  ?model wdt:P31 wd:Q59773381 .
  ?generation rdfs:label ?generationLabel .
  FILTER(LANG(?generationLabel) IN ("en", "ru"))
  OPTIONAL { { ?generation wdt:P571 ?start . } UNION { ?generation wdt:P580 ?start . } }
  OPTIONAL { { ?generation wdt:P576 ?end . } UNION { ?generation wdt:P582 ?end . } }
  OPTIONAL { ?generation wdt:P13351 ?code . }
}`;

console.log("Fetching Wikidata automobile model series...");
const modelRows = await sparql(modelQuery);
console.log("Fetching Wikidata generations explicitly linked to a model series...");
const generationRows = await sparql(generationQuery);

const groupedModels = Map.groupBy(modelRows, (row) => qid(row.model.value));
const modelCandidates = [];
const models = [];
const modelByExternalId = new Map();
const unmatchedModels = [];

for (const [externalId, rows] of groupedModels) {
  const brandCandidates = [
    ...rows.map((row) => row.brandLabel?.value),
    ...rows.map((row) => row.manufacturerLabel?.value),
  ].filter(Boolean);
  const make = brandCandidates
    .map((candidate) => makeLookup.get(normalize(candidate)))
    .find(Boolean);
  const sourceLabel = preferredLabel(rows, "modelLabel");
  if (!make || !sourceLabel) {
    unmatchedModels.push({
      externalId,
      label: sourceLabel,
      brandCandidates: [...new Set(brandCandidates)],
    });
    continue;
  }
  const name = displayModelName(sourceLabel, make);
  const record = {
    makeExternalId: make.externalId,
    name,
    normalizedName: normalize(name),
    slug: slug(name),
    sourceLabel,
    sourceName: "Wikidata",
    externalId,
    sourceUrl: `https://www.wikidata.org/wiki/${externalId}`,
  };
  modelCandidates.push(record);
}

const duplicateModels = [];
for (const [identity, candidates] of Map.groupBy(
  modelCandidates,
  (item) => `${item.makeExternalId}:${item.normalizedName}`,
)) {
  const sorted = candidates.toSorted(
    (a, b) => Number(a.externalId.slice(1)) - Number(b.externalId.slice(1)),
  );
  const canonical = sorted[0];
  models.push(canonical);
  for (const candidate of sorted) modelByExternalId.set(candidate.externalId, canonical);
  if (sorted.length > 1) {
    duplicateModels.push({
      identity,
      canonicalExternalId: canonical.externalId,
      mergedExternalIds: sorted.slice(1).map((item) => item.externalId),
    });
  }
}

const groupedGenerations = Map.groupBy(generationRows, (row) => qid(row.generation.value));
const generationCandidates = [];
const generations = [];
const unmatchedGenerations = [];
for (const [externalId, rows] of groupedGenerations) {
  const sourceModelExternalId = qid(rows[0]?.model?.value);
  const modelRecord = modelByExternalId.get(sourceModelExternalId);
  if (!modelRecord) {
    unmatchedGenerations.push({ externalId, modelExternalId: sourceModelExternalId });
    continue;
  }
  const name = preferredLabel(rows, "generationLabel");
  if (!name) continue;
  const starts = rows.map((row) => year(row.start?.value)).filter((value) => value !== null);
  const ends = rows.map((row) => year(row.end?.value)).filter((value) => value !== null);
  const codes = [...new Set(rows.map((row) => row.code?.value).filter(Boolean))].sort();
  const productionStartYear = starts.length ? Math.min(...starts) : null;
  const productionEndYear = ends.length ? Math.max(...ends) : null;
  if (productionStartYear && productionEndYear && productionStartYear > productionEndYear) {
    unmatchedGenerations.push({
      externalId,
      modelExternalId: sourceModelExternalId,
      reason: "invalid-year-range",
    });
    continue;
  }
  generationCandidates.push({
    modelExternalId: modelRecord.externalId,
    name,
    code: codes.length ? codes.join(", ").slice(0, 80) : null,
    productionStartYear,
    productionEndYear,
    isFacelift: /\b(facelift|restyling|рестайлинг)\b/i.test(name),
    parentExternalId: null,
    sourceName: "Wikidata",
    externalId,
    sourceUrl: `https://www.wikidata.org/wiki/${externalId}`,
  });
}

const duplicateGenerations = [];
for (const [identity, candidates] of Map.groupBy(
  generationCandidates,
  (item) =>
    `${item.modelExternalId}:${normalize(item.name)}:${item.productionStartYear ?? ""}:${item.productionEndYear ?? ""}:${item.code ?? ""}`,
)) {
  const sorted = candidates.toSorted(
    (a, b) => Number(a.externalId.slice(1)) - Number(b.externalId.slice(1)),
  );
  generations.push(sorted[0]);
  if (sorted.length > 1) {
    duplicateGenerations.push({
      identity,
      canonicalExternalId: sorted[0].externalId,
      mergedExternalIds: sorted.slice(1).map((item) => item.externalId),
    });
  }
}

const result = {
  schemaVersion: 1,
  datasetVersion: `wikidata-${version}`,
  generatedAt: new Date().toISOString(),
  sources: [
    base.source,
    {
      name: "Wikidata",
      version,
      url: "https://www.wikidata.org/",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      queryEndpoint: "https://query.wikidata.org/sparql",
    },
  ],
  makes,
  models: models.sort(
    (a, b) =>
      a.makeExternalId.localeCompare(b.makeExternalId) || a.name.localeCompare(b.name, "en"),
  ),
  generations: generations.sort(
    (a, b) =>
      a.modelExternalId.localeCompare(b.modelExternalId) || a.name.localeCompare(b.name, "en"),
  ),
  extractionReport: {
    sourceModelSeries: groupedModels.size,
    importedModels: models.length,
    sourceGenerations: groupedGenerations.size,
    importedGenerations: generations.length,
    unmatchedModels,
    unmatchedGenerations,
    duplicateModels,
    duplicateGenerations,
    limitations: [
      "Wikidata coverage is incomplete and uneven across brands and countries.",
      "Only items explicitly typed as automobile model series are imported as models.",
      "Only automobile model items explicitly linked with part of the series are imported as generations.",
      "Production years and model codes remain null when Wikidata does not provide explicit values.",
    ],
  },
};

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `Saved ${makes.length} makes, ${models.length} models and ${generations.length} generations to ${outputFile}`,
);
