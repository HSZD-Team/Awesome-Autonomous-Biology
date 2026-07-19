import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv from "ajv";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("generated graph satisfies its schema and public copy stays synchronized", async () => {
  const [graph, publicGraph, schema] = await Promise.all([
    readJson("src/data/generated/graph.json"),
    readJson("public/data/graph.json"),
    readJson("schemas/graph.schema.json")
  ]);
  const validate = new Ajv({ strict: false, allowUnionTypes: true }).compile(schema);

  assert.equal(validate(graph), true, JSON.stringify(validate.errors, null, 2));
  assert.deepEqual(publicGraph, graph);
  assert.equal(graph.nodes.length, 100);
  assert.equal(new Set(graph.nodes.map((node) => node.id)).size, graph.nodes.length);
  assert.equal(new Set(graph.clusters.flatMap((cluster) => cluster.categories)).size, 21);

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const inferredDegree = new Map();
  for (const edge of graph.edges) {
    assert.ok(nodeIds.has(edge.source));
    assert.ok(nodeIds.has(edge.target));
    if (edge.inferred) {
      assert.equal(edge.type, "shared_context");
      inferredDegree.set(edge.source, (inferredDegree.get(edge.source) ?? 0) + 1);
      inferredDegree.set(edge.target, (inferredDegree.get(edge.target) ?? 0) + 1);
    } else {
      assert.equal(edge.type, "related_to");
    }
  }
  assert.equal(graph.edges.filter((edge) => !edge.inferred).length, 4);
  assert.ok(graph.edges.some((edge) => edge.inferred));
  assert.ok([...inferredDegree.values()].every((degree) => degree <= 3));
});

test("Observatory totals are derived from the same canonical graph", async () => {
  const [graph, observatory] = await Promise.all([
    readJson("src/data/generated/graph.json"),
    readJson("src/data/generated/observatory.json")
  ]);

  assert.equal(observatory.totals.resources, graph.nodes.length);
  assert.equal(observatory.totals.categories, 21);
  assert.equal(observatory.totals.verified, graph.nodes.filter((node) => node.verification_status === "verified").length);
  assert.equal(observatory.totals.review_pending, graph.nodes.filter((node) => node.verification_status === "review_pending").length);
  assert.equal(observatory.recent_additions.last_7_days, null);
  assert.equal(observatory.recent_additions.last_30_days, null);
  assert.match(observatory.recent_additions.note, /do not currently include repository ingestion timestamps/i);
});
