import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import yaml from "js-yaml";
import { loadSeed, rootSeedUrl, seedUrl, sha256, datasetStats } from "./lib/data.mjs";

export async function validateData({ quiet = false } = {}) {
  const errors = [];
  const [rawSeed, schemaText, rootSeedText, copiedSeedText, reviewFlagsText] = await Promise.all([
    loadSeed(),
    readFile(new URL("../schemas/resource.schema.json", import.meta.url), "utf8"),
    readFile(rootSeedUrl, "utf8"),
    readFile(seedUrl, "utf8"),
    readFile(new URL("../data/review-flags.yml", import.meta.url), "utf8")
  ]);
  const reviewFlags = yaml.load(reviewFlagsText);
  const seed = structuredClone(rawSeed);
  const schema = JSON.parse(schemaText);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(seed)) {
    errors.push(...validate.errors.map((error) => `schema ${error.instancePath || "/"} ${error.message}`));
  }

  if (rootSeedText !== copiedSeedText) errors.push("data/gold-seed-v0.1.yml is not an exact copy of GOLD_SEED_V0.1.yml");
  if (seed.records.length !== seed.record_count || seed.record_count !== 50) errors.push(`record_count mismatch: declared ${seed.record_count}, actual ${seed.records.length}`);

  const vocab = seed.controlled_vocabularies;
  const categoryIds = new Set(vocab.primary_categories.map((category) => category.id));
  const recordIds = new Set(seed.records.map((record) => record.id));
  const uniqueIds = new Set();
  const seedCount = vocab.primary_categories.reduce((total, category) => total + category.seed_count, 0);
  if (categoryIds.size !== 21 || vocab.primary_categories.length !== 21) errors.push("exactly 21 unique primary categories are required");
  if (seedCount !== seed.records.length) errors.push(`category seed_count sum ${seedCount} != records ${seed.records.length}`);

  const actualCategoryCounts = new Map([...categoryIds].map((id) => [id, 0]));
  const commercialOrEcosystem = new Set(["14-standards-provenance", "20-cloud-commercial", "21-education-community"]);
  for (const record of seed.records) {
    if (!/^AAB-\d{3}$/.test(record.id)) errors.push(`${record.id}: invalid ID format`);
    if (uniqueIds.has(record.id)) errors.push(`${record.id}: duplicate ID`);
    uniqueIds.add(record.id);
    if (!categoryIds.has(record.primary_category)) errors.push(`${record.id}: uncontrolled category ${record.primary_category}`);
    else actualCategoryCounts.set(record.primary_category, actualCategoryCounts.get(record.primary_category) + 1);
    if (!vocab.resource_classes.includes(record.resource_class)) errors.push(`${record.id}: uncontrolled resource_class`);
    if (record.loop_stages.some((stage) => !vocab.loop_stages.includes(stage))) errors.push(`${record.id}: uncontrolled loop_stage`);
    if (!vocab.autonomy_levels.includes(record.autonomy.scientific) || !vocab.autonomy_levels.includes(record.autonomy.operational)) errors.push(`${record.id}: uncontrolled autonomy level`);
    if (!Object.hasOwn(vocab.evidence_grades, record.evidence.grade)) errors.push(`${record.id}: uncontrolled evidence grade`);
    if (!vocab.curation_statuses.includes(record.curation.status)) errors.push(`${record.id}: uncontrolled curation status`);
    if (!record.evidence.primary_sources?.length) errors.push(`${record.id}: at least one primary source is required`);
    if (!record.summary_en?.trim() || !record.summary_zh?.trim()) errors.push(`${record.id}: bilingual summaries are required`);
    if (record.curation.status === "verified" && (!record.curation.last_verified || !record.curation.curator || !record.curation.decision_note)) errors.push(`${record.id}: verified record lacks audit metadata`);
    for (const relatedId of record.related_to ?? []) if (!recordIds.has(relatedId)) errors.push(`${record.id}: unknown related_to ID ${relatedId}`);
    for (const [kind, value] of Object.entries(record.urls)) {
      if (value) {
        try { new URL(value); } catch { errors.push(`${record.id}: invalid ${kind} URL`); }
      }
    }
    for (const value of record.evidence.primary_sources ?? []) {
      try { new URL(value); } catch { errors.push(`${record.id}: invalid primary source URL`); }
    }
    if (commercialOrEcosystem.has(record.primary_category) && record.resource_class === "core_autonomous_system") errors.push(`${record.id}: ecosystem/commercial/standards record incorrectly marked core_autonomous_system`);
  }
  for (const category of vocab.primary_categories) {
    const actual = actualCategoryCounts.get(category.id);
    if (actual !== category.seed_count) errors.push(`${category.id}: declared seed_count ${category.seed_count}, actual ${actual}`);
  }
  if (uniqueIds.size !== 50) errors.push(`expected 50 unique IDs, found ${uniqueIds.size}`);

  const flaggedIds = new Set();
  for (const flag of reviewFlags.flags ?? []) {
    if (!recordIds.has(flag.id)) errors.push(`review flag references unknown ID ${flag.id}`);
    if (flaggedIds.has(flag.id)) errors.push(`duplicate review flag for ${flag.id}`);
    flaggedIds.add(flag.id);
    if (flag.status !== "review_pending") errors.push(`${flag.id}: review flag status must be review_pending`);
    const record = seed.records.find((item) => item.id === flag.id);
    const knownUrls = record ? [...Object.values(record.urls), ...(record.evidence.primary_sources ?? [])].filter(Boolean) : [];
    if (record && !knownUrls.includes(flag.url)) errors.push(`${flag.id}: review flag URL is not present in the Gold Seed record`);
    if (record) record.curation.status = "review_pending";
  }
  if (errors.length) {
    const error = new Error(`Gold Seed validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):\n- ${errors.join("\n- ")}`);
    error.validationErrors = errors;
    throw error;
  }
  const result = {
    ok: true,
    seed_sha256: sha256(copiedSeedText),
    record_count: seed.records.length,
    category_count: categoryIds.size,
    unique_id_count: uniqueIds.size,
    primary_source_record_count: seed.records.filter((record) => record.evidence.primary_sources.length > 0).length,
    related_reference_count: seed.records.reduce((count, record) => count + (record.related_to?.length ?? 0), 0),
    review_flag_count: flaggedIds.size,
    ...datasetStats(seed)
  };
  if (!quiet) console.log(JSON.stringify(result, null, 2));
  return { seed, rawSeed, reviewFlags, result };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateData().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
