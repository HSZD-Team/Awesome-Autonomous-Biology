import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const routes = ["src/pages/index.astro", "src/pages/zh/index.astro", "src/pages/atlas/index.astro", "src/pages/loop-map/index.astro", "src/pages/radar/index.astro", "src/pages/timeline/index.astro", "src/pages/resources/[id].astro", "src/pages/ecosystem/index.astro", "src/pages/digest/index.astro", "src/pages/about/index.astro", "src/pages/contribute/index.astro"];

test("all required page routes exist and dossier uses static paths", async () => {
  await Promise.all(routes.map((route) => access(new URL(route, root))));
  const dossier = await readFile(new URL("src/pages/resources/[id].astro", root), "utf8");
  assert.match(dossier, /getStaticPaths/);
  assert.match(dossier, /generated\/resources\.json/);
  assert.doesNotMatch(dossier, /all-resources\.json|review-flags\.json/); assert.match(dossier, /related_to/);
});

test("global shell has reduced motion and basic accessibility affordances", async () => {
  const [css, layout, header] = await Promise.all([readFile(new URL("src/styles/global.css", root), "utf8"), readFile(new URL("src/layouts/BaseLayout.astro", root), "utf8"), readFile(new URL("src/components/Header.astro", root), "utf8")]);
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /:focus-visible/); assert.match(layout, /skip-link/); assert.match(layout, /lang=/); assert.match(header, /aria-current/); assert.match(header, /aria-expanded/);
});

test("base-path helpers and public JSON are used", async () => {
  const [config, paths, radar] = await Promise.all([readFile(new URL("astro.config.mjs", root), "utf8"), readFile(new URL("src/lib/paths.ts", root), "utf8"), readFile(new URL("src/pages/radar/index.astro", root), "utf8")]);
  assert.match(config, /base:/); assert.match(paths, /BASE_URL/); assert.match(radar, /UNVERIFIED/);
});
