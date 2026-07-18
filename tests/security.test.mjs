import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const ignored = new Set(["node_modules", "dist", ".git", "pnpm-lock.yaml", "GOLD_SEED_V0.1.yml", "gold-seed-v0.1.yml", "awesome-autonomous-biology-readme"]);
async function files(url) { const output = []; for (const entry of await readdir(url, { withFileTypes: true })) { if (ignored.has(entry.name)) continue; const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, url); if (entry.isDirectory()) output.push(...await files(child)); else if ((await stat(child)).size < 500000) output.push(child); } return output; }
test("repository source contains no common real-secret signatures", async () => {
  const patterns = [/ghp_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /sk-[A-Za-z0-9]{32,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
  for (const file of await files(root)) { const value = await readFile(file, "utf8").catch(() => ""); for (const pattern of patterns) assert.doesNotMatch(value, pattern, file.pathname); }
});
