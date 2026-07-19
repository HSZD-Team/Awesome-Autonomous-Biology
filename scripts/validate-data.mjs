import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import yaml from "js-yaml";
import {
  canonicalUrl,
  datasetStats,
  legacySeedUrl,
  loadSeed,
  normalizeDoi,
  normalizeTitle,
  rootLegacySeedUrl,
  seedUrl,
  sha256
} from "./lib/data.mjs";

function collectDuplicateGroups(records, getValue, normalize) {
  const groups = new Map();
  for (const record of records) {
    const value = getValue(record);
    if (!value) continue;
    const key = normalize(value);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function githubRepository(record) {
  for (const value of Object.values(record.urls)) {
    if (!value) continue;
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== "github.com") continue;
    const [owner, repository] = url.pathname.split("/").filter(Boolean);
    if (owner && repository) return `https://github.com/${owner}/${repository}`;
  }
  return "";
}

function duplicateIsExplained(group) {
  const ids = new Set(group.map((record) => record.id));
  const connected = new Set([group[0].id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of group) {
      const related = new Set(record.related_to ?? []);
      if (connected.has(record.id) || [...connected].some((id) => related.has(id))) {
        if (!connected.has(record.id)) {
          connected.add(record.id);
          changed = true;
        }
        for (const target of related) {
          if (ids.has(target) && !connected.has(target)) {
            connected.add(target);
            changed = true;
          }
        }
      }
    }
  }
  return connected.size === group.length;
}

export async function validateData({ quiet = false } = {}) {
  const errors = [];
  const [rawSeed, schemaText, rootLegacyText, legacySeedText, canonicalSeedText, reviewFlagsText] = await Promise.all([
    loadSeed(),
    readFile(new URL("../schemas/resource.schema.json", import.meta.url), "utf8"),
    readFile(rootLegacySeedUrl, "utf8"),
    readFile(legacySeedUrl, "utf8"),
    readFile(seedUrl, "utf8"),
    readFile(new URL("../data/review-flags.yml", import.meta.url), "utf8")
  ]);
  const legacySeed = yaml.load(legacySeedText);
  const reviewFlags = yaml.load(reviewFlagsText);
  const seed = structuredClone(rawSeed);
  const schema = JSON.parse(schemaText);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(rawSeed)) errors.push(...validate.errors.map((error) => `schema ${error.instancePath || "/"} ${error.message}`));

  if (rootLegacyText !== legacySeedText) errors.push("data/gold-seed-v0.1.yml is not an exact copy of GOLD_SEED_V0.1.yml");
  if (rawSeed.dataset_version !== "0.2") errors.push(`dataset_version must be 0.2, found ${rawSeed.dataset_version}`);
  if (rawSeed.records.length !== rawSeed.record_count || rawSeed.record_count !== 100) errors.push(`record_count mismatch: declared ${rawSeed.record_count}, actual ${rawSeed.records.length}`);
  if (JSON.stringify(rawSeed.records.slice(0, 50)) !== JSON.stringify(legacySeed.records)) errors.push("AAB-001..AAB-050 must remain semantically identical to the v0.1 snapshot");
  if (JSON.stringify(rawSeed.controlled_vocabularies.resource_classes) !== JSON.stringify(legacySeed.controlled_vocabularies.resource_classes)) errors.push("resource class vocabulary changed from v0.1");
  if (JSON.stringify(rawSeed.controlled_vocabularies.loop_stages) !== JSON.stringify(legacySeed.controlled_vocabularies.loop_stages)) errors.push("loop-stage vocabulary changed from v0.1");
  if (JSON.stringify(rawSeed.controlled_vocabularies.autonomy_levels) !== JSON.stringify(legacySeed.controlled_vocabularies.autonomy_levels)) errors.push("autonomy vocabulary changed from v0.1");
  if (JSON.stringify(rawSeed.controlled_vocabularies.curation_statuses) !== JSON.stringify(legacySeed.controlled_vocabularies.curation_statuses)) errors.push("curation-status vocabulary changed from v0.1");
  if (JSON.stringify(rawSeed.controlled_vocabularies.evidence_grades) !== JSON.stringify(legacySeed.controlled_vocabularies.evidence_grades)) errors.push("evidence vocabulary changed from v0.1");

  const vocab = rawSeed.controlled_vocabularies;
  const categoryIds = new Set(vocab.primary_categories.map((category) => category.id));
  const recordIds = new Set(rawSeed.records.map((record) => record.id));
  const uniqueIds = new Set();
  const expectedIds = Array.from({ length: 100 }, (_, index) => `AAB-${String(index + 1).padStart(3, "0")}`);
  const actualIds = rawSeed.records.map((record) => record.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) errors.push("IDs must be ordered and continuous from AAB-001 through AAB-100");
  const seedCount = vocab.primary_categories.reduce((total, category) => total + category.seed_count, 0);
  if (categoryIds.size !== 21 || vocab.primary_categories.length !== 21) errors.push("exactly 21 unique primary categories are required");
  if (seedCount !== rawSeed.records.length) errors.push(`category seed_count sum ${seedCount} != records ${rawSeed.records.length}`);

  const actualCategoryCounts = new Map([...categoryIds].map((id) => [id, 0]));
  const commercialOrEcosystem = new Set(["14-standards-provenance", "20-cloud-commercial", "21-education-community"]);
  for (const record of rawSeed.records) {
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
    if (!record.boundary_note_zh?.trim()) errors.push(`${record.id}: boundary_note_zh is required`);
    if (record.curation.status === "verified" && (!record.curation.last_verified || !record.curation.curator || !record.curation.decision_note)) errors.push(`${record.id}: verified record lacks audit metadata`);
    if (record.curation.status === "review_pending" && (!record.curation.curator || !record.curation.decision_note)) errors.push(`${record.id}: review_pending record lacks curator or decision note`);
    if (Number(record.id.slice(-3)) >= 51 && record.curation.status !== "review_pending") errors.push(`${record.id}: v0.2 extension records must remain review_pending`);
    for (const relatedId of record.related_to ?? []) if (!recordIds.has(relatedId)) errors.push(`${record.id}: unknown related_to ID ${relatedId}`);
    for (const [kind, value] of Object.entries(record.urls)) {
      if (value == null) continue;
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) errors.push(`${record.id}: ${kind} URL must use HTTP(S)`);
      } catch {
        errors.push(`${record.id}: invalid ${kind} URL`);
      }
    }
    for (const value of record.evidence.primary_sources ?? []) {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) errors.push(`${record.id}: primary source must use HTTP(S)`);
      } catch {
        errors.push(`${record.id}: invalid primary source URL`);
      }
    }
    if (commercialOrEcosystem.has(record.primary_category) && record.resource_class === "core_autonomous_system") errors.push(`${record.id}: ecosystem/commercial/standards record incorrectly marked core_autonomous_system`);
  }
  for (const category of vocab.primary_categories) {
    const actual = actualCategoryCounts.get(category.id);
    if (actual !== category.seed_count) errors.push(`${category.id}: declared seed_count ${category.seed_count}, actual ${actual}`);
  }
  if (uniqueIds.size !== 100) errors.push(`expected 100 unique IDs, found ${uniqueIds.size}`);

  const duplicateChecks = [
    ["normalized title", (record) => record.title, normalizeTitle],
    ["canonical URL", (record) => record.urls.canonical, canonicalUrl],
    ["DOI", (record) => record.urls.paper, normalizeDoi],
    ["GitHub repository", githubRepository, canonicalUrl]
  ];
  for (const [label, getter, normalize] of duplicateChecks) {
    for (const [value, group] of collectDuplicateGroups(rawSeed.records, getter, normalize)) {
      if (!duplicateIsExplained(group)) errors.push(`unexplained duplicate ${label} ${value}: ${group.map((record) => record.id).join(", ")}`);
    }
  }

  const flaggedIds = new Set();
  for (const flag of reviewFlags.flags ?? []) {
    if (!recordIds.has(flag.id)) errors.push(`review flag references unknown ID ${flag.id}`);
    if (flaggedIds.has(flag.id)) errors.push(`duplicate review flag for ${flag.id}`);
    flaggedIds.add(flag.id);
    if (flag.status !== "review_pending") errors.push(`${flag.id}: review flag status must be review_pending`);
    if (!flag.field?.trim() || !flag.observation?.trim()) errors.push(`${flag.id}: review flag requires field and observation`);
    const record = seed.records.find((item) => item.id === flag.id);
    const knownUrls = record ? [...Object.values(record.urls), ...(record.evidence.primary_sources ?? [])].filter(Boolean) : [];
    if (record && !knownUrls.includes(flag.url)) errors.push(`${flag.id}: review flag URL is not present in the Gold Seed record`);
    if (record) record.curation.status = "review_pending";
  }
  for (const record of seed.records.filter((item) => item.curation.status === "review_pending")) {
    if (!flaggedIds.has(record.id)) errors.push(`${record.id}: review_pending record lacks a review flag`);
  }

  if (errors.length) {
    const error = new Error(`Gold Seed validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):\n- ${errors.join("\n- ")}`);
    error.validationErrors = errors;
    throw error;
  }
  const result = {
    ok: true,
    seed_sha256: sha256(canonicalSeedText),
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
