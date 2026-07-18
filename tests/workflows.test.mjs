import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import yaml from "js-yaml";

const directory = new URL("../.github/workflows/", import.meta.url);
test("all five workflows parse and use explicit minimal permissions", async () => {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".yml"));
  assert.deepEqual(files.sort(), ["ci.yml", "digest-weekly.yml", "discovery-daily.yml", "link-check.yml", "pages.yml"]);
  for (const file of files) {
    const workflowSource = await readFile(new URL(file, directory), "utf8");
    const workflow = yaml.load(workflowSource);
    assert.doesNotMatch(workflowSource, /pnpm\/action-setup@v4\s*\n\s+with:\s*\{version:/, `${file}: pnpm version must come only from packageManager`);
    assert.ok(workflow.jobs); assert.ok(workflow.permissions); assert.equal(JSON.stringify(workflow).includes("pull-requests: write"), false); assert.equal(JSON.stringify(workflow).includes("contents: write"), false);
  }
  const daily = yaml.load(await readFile(new URL("discovery-daily.yml", directory), "utf8"));
  assert.deepEqual(daily.permissions, { contents: "read", issues: "write" });
  const pages = yaml.load(await readFile(new URL("pages.yml", directory), "utf8"));
  assert.deepEqual(pages.permissions, { contents: "read", pages: "write", "id-token": "write" });
});
