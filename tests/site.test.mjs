import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const routes = ["src/pages/index.astro", "src/pages/zh/index.astro", "src/pages/atlas/index.astro", "src/pages/loop-map/index.astro", "src/pages/radar/index.astro", "src/pages/timeline/index.astro", "src/pages/resources/[id].astro", "src/pages/ecosystem/index.astro", "src/pages/digest/index.astro", "src/pages/about/index.astro", "src/pages/contribute/index.astro"];

test("all required routes exist and all research-record views use v0.2 all-resources data", async () => {
  await Promise.all(routes.map((route) => access(new URL(route, root))));
  const recordViews = ["src/pages/atlas/index.astro", "src/pages/loop-map/index.astro", "src/pages/timeline/index.astro", "src/pages/resources/[id].astro", "src/pages/ecosystem/index.astro", "src/pages/radar/index.astro"];
  for (const route of recordViews) {
    const source = await readFile(new URL(route, root), "utf8");
    assert.match(source, /generated\/all-resources\.json/, route);
  }
  const dossier = await readFile(new URL("src/pages/resources/[id].astro", root), "utf8");
  assert.match(dossier, /getStaticPaths/);
  assert.match(dossier, /related_to/);
  assert.match(dossier, /REVIEW_PENDING/);
});

test("Atlas defaults to verified and exposes shareable all/review-pending status filters", async () => {
  const [atlas, filter] = await Promise.all([
    readFile(new URL("src/pages/atlas/index.astro", root), "utf8"),
    readFile(new URL("src/lib/filter-state.mjs", root), "utf8")
  ]);
  assert.match(atlas, /value="verified" selected/);
  assert.match(atlas, /value="all"/);
  assert.match(atlas, /value="review_pending"/);
  assert.match(filter, /"status"/);
  assert.match(filter, /record\.curation\.status/);
});

test("global shell retains accessibility and reduced-motion affordances", async () => {
  const [css, layout, header] = await Promise.all([readFile(new URL("src/styles/global.css", root), "utf8"), readFile(new URL("src/layouts/BaseLayout.astro", root), "utf8"), readFile(new URL("src/components/Header.astro", root), "utf8")]);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(layout, /skip-link/);
  assert.match(layout, /lang=/);
  assert.match(header, /aria-current/);
  assert.match(header, /aria-expanded/);
});

test("base-path helpers, public data, and visible candidate queue are used", async () => {
  const [config, paths, radar] = await Promise.all([readFile(new URL("astro.config.mjs", root), "utf8"), readFile(new URL("src/lib/paths.ts", root), "utf8"), readFile(new URL("src/pages/radar/index.astro", root), "utf8")]);
  assert.match(config, /base:/);
  assert.match(paths, /BASE_URL/);
  assert.match(radar, /REVIEW_PENDING/);
  assert.match(radar, /reviewFlags/);
});
