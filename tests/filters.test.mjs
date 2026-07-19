import test from "node:test";
import assert from "node:assert/strict";
import { parseFilterState, serializeFilterState, matchesFilter } from "../src/lib/filter-state.mjs";

const record = { title: "BacterAI", summary_en: "Microbial closed loop", summary_zh: "微生物闭环", primary_category: "02-end-to-end-systems", resource_class: "core_autonomous_system", loop_stages: ["wet-lab-execution"], biological_domains: ["microbiology"], evidence: { grade: "A" }, autonomy: { scientific: "high", operational: "high" }, curation: { status: "review_pending" }, open_source: "partial", wet_lab: true, year: 2023 };

test("URL filter state round-trips safely", () => {
  const state = { q: "Bacter AI", status: "all", category: "02-end-to-end-systems", wet: "true", view: "list" };
  assert.deepEqual(parseFilterState(serializeFilterState(state)), state);
  assert.deepEqual(parseFilterState("?unknown=x&q=test"), { q: "test" });
});

test("Atlas matcher applies status and all core filter dimensions", () => {
  assert.ok(matchesFilter(record, { q: "微生物", status: "all", category: record.primary_category, class: record.resource_class, stage: "wet-lab-execution", domain: "microbiology", evidence: "A", scientific: "high", operational: "high", open: "partial", wet: "true", year: "2023" }));
  assert.ok(matchesFilter(record, { status: "review_pending" }));
  assert.equal(matchesFilter(record, { status: "verified" }), false);
  assert.equal(matchesFilter(record, { scientific: "none" }), false);
  assert.equal(matchesFilter(record, { year: "ongoing" }), false);
});
