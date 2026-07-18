import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import yaml from "js-yaml";

export const ROOT = new URL("../../", import.meta.url);
export const seedUrl = new URL("../../data/gold-seed-v0.1.yml", import.meta.url);
export const rootSeedUrl = new URL("../../GOLD_SEED_V0.1.yml", import.meta.url);

export async function loadYaml(url) {
  return yaml.load(await readFile(url, "utf8"));
}

export async function loadSeed() {
  return loadYaml(seedUrl);
}

export async function loadProject() {
  return loadYaml(new URL("../../config/project.yml", import.meta.url));
}

export function stableJson(value) {
  return `${JSON.stringify(value, Object.keys(value).sort(), 2)}\n`;
}

export function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeTitle(title = "") {
  return title.toLocaleLowerCase("en").normalize("NFKD").replace(/[^a-z0-9\p{L}]+/gu, " ").trim();
}

export function normalizeDoi(value = "") {
  return value.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
}

export function canonicalUrl(value = "") {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((key) => url.searchParams.delete(key));
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function datasetStats(seed) {
  const verified = seed.records.filter((record) => record.curation.status === "verified");
  const reviewPending = seed.records.filter((record) => record.curation.status === "review_pending");
  const countBy = (key) => Object.fromEntries(
    [...new Set(verified.map((record) => record[key]))].sort().map((value) => [value, verified.filter((record) => record[key] === value).length])
  );
  return {
    record_count: seed.records.length,
    verified_count: verified.length,
    review_pending_count: reviewPending.length,
    category_count: seed.controlled_vocabularies.primary_categories.length,
    resource_class_count: new Set(verified.map((record) => record.resource_class)).size,
    latest_verified: verified.map((record) => record.curation.last_verified).filter(Boolean).sort().at(-1) ?? null,
    category_counts: countBy("primary_category"),
    resource_class_counts: countBy("resource_class"),
    ongoing_count: verified.filter((record) => record.year == null).length
  };
}
