import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateData } from "../scripts/validate-data.mjs";
import { buildIndex } from "../scripts/build-index.mjs";

test("Gold Seed v0.2 passes schema and deterministic invariants", async () => {
  const { seed, rawSeed, result } = await validateData({ quiet: true });
  assert.equal(result.dataset_version, "0.2");
  assert.equal(result.record_count, 100);
  assert.equal(result.category_count, 21);
  assert.equal(result.unique_id_count, 100);
  assert.equal(result.primary_source_record_count, 100);
  assert.equal(result.verified_count, 44);
  assert.equal(result.review_pending_count, 56);
  assert.equal(result.archived_count, 0);
  assert.equal(result.review_flag_count, 56);
  assert.deepEqual(seed.records.map((record) => record.id), Array.from({ length: 100 }, (_, index) => `AAB-${String(index + 1).padStart(3, "0")}`));
  assert.ok(rawSeed.records.slice(50).every((record) => record.curation.status === "review_pending"));
  assert.equal(Object.keys(result.category_counts).length, 21);
  assert.equal(Object.values(result.category_counts).reduce((sum, count) => sum + count, 0), 100);
  assert.equal(Object.values(result.evidence_counts).reduce((sum, count) => sum + count, 0), 100);
});

test("generated artifacts and both README marker regions are synchronized", async () => {
  const result = await buildIndex({ check: true });
  assert.equal(result.stats.record_count, 100);
});

test("generated website data separates verified records from review-pending candidates", async () => {
  const resources = JSON.parse(await readFile(new URL("../src/data/generated/resources.json", import.meta.url), "utf8"));
  assert.equal(resources.length, 44);
  for (const record of resources) {
    assert.ok(record.summary_en.trim());
    assert.ok(record.summary_zh.trim());
    assert.equal(record.curation.status, "verified");
  }
  const allResources = JSON.parse(await readFile(new URL("../src/data/generated/all-resources.json", import.meta.url), "utf8"));
  assert.equal(allResources.length, 100);
  assert.deepEqual(allResources.filter((record) => record.curation.status === "review_pending").map((record) => record.id), [
    "AAB-020", "AAB-021", "AAB-024", "AAB-029", "AAB-033", "AAB-036",
    ...Array.from({ length: 50 }, (_, index) => `AAB-${String(index + 51).padStart(3, "0")}`)
  ]);
  const search = JSON.parse(await readFile(new URL("../src/data/generated/search-index.json", import.meta.url), "utf8"));
  assert.equal(search.length, 100);
  assert.equal(search.filter((item) => item.status === "review_pending").length, 56);
  const radar = JSON.parse(await readFile(new URL("../data/candidates/latest.json", import.meta.url), "utf8"));
  assert.ok(radar.candidates.every((candidate) => candidate.status === "review_pending"));
});

test("README editorial shells keep exactly one generator contract per region", async () => {
  for (const path of ["../README.md", "../README_zh.md"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of ["STATS", "RESOURCE_LIST"]) {
      assert.equal(source.split(`<!-- AAB:${marker}:START -->`).length - 1, 1);
      assert.equal(source.split(`<!-- AAB:${marker}:END -->`).length - 1, 1);
    }
    assert.match(source, /automation.*scientific autonomy/is);
    assert.match(source, /100 (?:is|是).*research|100 是研究记录总数/is);
  }
});
