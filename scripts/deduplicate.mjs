import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalUrl, normalizeDoi, normalizeTitle, prettyJson } from "./lib/data.mjs";

export function candidateIdentity(candidate) {
  const doi = normalizeDoi(candidate.doi ?? "");
  const url = canonicalUrl(candidate.canonical_url ?? candidate.url ?? "");
  const title = normalizeTitle(candidate.title ?? "");
  return { doi: doi || null, url: url || null, title: title || null };
}

export function deduplicateCandidates(candidates) {
  const seen = { doi: new Map(), url: new Map(), title: new Map() };
  const unique = [], duplicates = [];
  for (const candidate of candidates) {
    const identity = candidateIdentity(candidate);
    const match = (identity.doi && seen.doi.get(identity.doi)) || (identity.url && seen.url.get(identity.url)) || (identity.title && seen.title.get(identity.title));
    if (match) { duplicates.push({ candidate, duplicate_of: match.id ?? match.title, matched_by: identity.doi && seen.doi.has(identity.doi) ? "doi" : identity.url && seen.url.has(identity.url) ? "canonical_url" : "normalized_title" }); continue; }
    unique.push(candidate);
    if (identity.doi) seen.doi.set(identity.doi, candidate);
    if (identity.url) seen.url.set(identity.url, candidate);
    if (identity.title) seen.title.set(identity.title, candidate);
  }
  return { unique, duplicates };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = process.argv[2]; const output = process.argv[3];
  if (!input) { console.error("Usage: node scripts/deduplicate.mjs INPUT.json [OUTPUT.json]"); process.exitCode = 2; }
  else {
    const payload = JSON.parse(await readFile(input, "utf8"));
    const result = deduplicateCandidates(payload.candidates ?? payload);
    if (output) await writeFile(output, prettyJson(result), "utf8");
    console.log(JSON.stringify({ unique: result.unique.length, duplicates: result.duplicates.length }, null, 2));
  }
}
