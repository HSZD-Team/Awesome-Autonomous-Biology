import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { validateData } from "../scripts/validate-data.mjs";

test("Gold Seed passes schema and deterministic invariants", async () => {
  const { seed, result } = await validateData({ quiet: true });
  assert.equal(result.record_count, 50);
  assert.equal(result.category_count, 21);
  assert.equal(result.unique_id_count, 50);
  assert.equal(result.primary_source_record_count, 50);
  assert.equal(result.verified_count, 47);
  assert.equal(result.review_pending_count, 3);
  assert.equal(result.review_flag_count, 3);
  assert.deepEqual(seed.records.map((record) => record.id), Array.from({ length: 50 }, (_, index) => `AAB-${String(index + 1).padStart(3, "0")}`));
});

test("generated artifacts and both READMEs are synchronized", () => {
  const result = spawnSync(process.execPath, ["scripts/build-index.mjs", "--check"], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("generated website data contains bilingual fields and no candidates", async () => {
  const resources = JSON.parse(await readFile(new URL("../src/data/generated/resources.json", import.meta.url), "utf8"));
  assert.equal(resources.length, 47);
  for (const record of resources) {
    assert.ok(record.summary_en.trim()); assert.ok(record.summary_zh.trim()); assert.equal(record.curation.status, "verified");
  }
  const allResources = JSON.parse(await readFile(new URL("../src/data/generated/all-resources.json", import.meta.url), "utf8"));
  assert.equal(allResources.length, 50);
  assert.deepEqual(allResources.filter((record) => record.curation.status === "review_pending").map((record) => record.id), ["AAB-020", "AAB-029", "AAB-033"]);
  const radar = JSON.parse(await readFile(new URL("../data/candidates/latest.json", import.meta.url), "utf8"));
  assert.ok(radar.candidates.every((candidate) => candidate.status === "review_pending"));
});
