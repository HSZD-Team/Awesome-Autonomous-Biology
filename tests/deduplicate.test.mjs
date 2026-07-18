import test from "node:test";
import assert from "node:assert/strict";
import { deduplicateCandidates } from "../scripts/deduplicate.mjs";

test("candidate deduplication follows DOI then URL then normalized title", () => {
  const input = [
    { id: "a", title: "A Study", doi: "10.1000/ABC", canonical_url: "https://example.org/a" },
    { id: "b", title: "Different", doi: "https://doi.org/10.1000/abc", canonical_url: "https://example.org/b" },
    { id: "c", title: "URL match", canonical_url: "https://example.org/a/" },
    { id: "d", title: "  A-Study!  ", canonical_url: "https://example.org/d" },
    { id: "e", title: "Unique", canonical_url: "https://example.org/e" }
  ];
  const result = deduplicateCandidates(input);
  assert.deepEqual(result.unique.map((item) => item.id), ["a", "e"]);
  assert.deepEqual(result.duplicates.map((item) => item.matched_by), ["doi", "canonical_url", "normalized_title"]);
});
