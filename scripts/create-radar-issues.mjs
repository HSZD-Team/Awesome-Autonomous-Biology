import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadProject, normalizeDoi } from "./lib/data.mjs";

const token = process.env.GITHUB_TOKEN;
const apiVersion = "2022-11-28";
async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...options, headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": apiVersion, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error(`GitHub ${options.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
function issueBody(candidate) {
  return `> [!WARNING]\n> **UNVERIFIED / 待核验.** Automated discovery candidate; not part of the verified Atlas.\n\n## Candidate\n\n- DOI: ${candidate.doi ?? "not supplied"}\n- Canonical URL: ${candidate.canonical_url ?? "not supplied"}\n- Source: ${candidate.source_type}\n- Published: ${candidate.published_date ?? "not asserted"}\n- Potential category: ${candidate.potential_category}\n- Matched query: ${candidate.matched_query}\n- Fetched: ${candidate.fetched_at}\n- Candidate score: ${candidate.score}/100\n\n### Transparent score\n\n\`\`\`json\n${JSON.stringify(candidate.score_components, null, 2)}\n\`\`\`\n\n### Why matched\n\n${candidate.why_matched.map((reason) => `- ${reason}`).join("\n") || "- Query match only; requires careful review."}\n\n## Human review checklist\n\n- [ ] Identity and duplicate check\n- [ ] Biology-specific scope\n- [ ] Primary source\n- [ ] Loop-stage evidence\n- [ ] Scientific vs operational autonomy\n- [ ] License/open-source warning\n- [ ] Bilingual summaries\n\nThis issue must not promote the candidate to verified data automatically.`;
}
async function ensureLabel(repo, name, color, description) {
  try { await api(`/repos/${repo}/labels/${encodeURIComponent(name)}`); return true; }
  catch { try { await api(`/repos/${repo}/labels`, { method: "POST", body: JSON.stringify({ name, color, description }) }); return true; } catch (error) { console.warn(`Label unavailable (${name}): ${error.message}`); return false; } }
}
async function unifiedFallback(repo, candidates, reason) {
  const day = new Date().toISOString().slice(0, 10); const title = `[Radar] ${day} unified review queue`;
  const existing = await api(`/repos/${repo}/issues?state=open&per_page=100`); const match = existing.find((issue) => issue.title === title);
  const body = `> **UNVERIFIED / 待核验**\n\nLabel/category creation was unavailable, so candidates were consolidated instead of requesting broader permissions.\n\nReason: ${reason}\n\n${candidates.map((candidate) => `## ${candidate.title}\n\n- DOI: ${candidate.doi ?? "not supplied"}\n- URL: ${candidate.canonical_url ?? "not supplied"}\n- Potential category: ${candidate.potential_category}\n- Score: ${candidate.score}\n- Status: review_pending`).join("\n\n")}`;
  if (match) await api(`/repos/${repo}/issues/${match.number}`, { method: "PATCH", body: JSON.stringify({ body }) });
  else await api(`/repos/${repo}/issues`, { method: "POST", body: JSON.stringify({ title, body }) });
  console.log(`Unified radar issue ${match ? "updated" : "created"}: ${title}`);
}

export async function createRadarIssues() {
  const [project, snapshot] = await Promise.all([loadProject(), readFile(new URL("../data/candidates/latest.json", import.meta.url), "utf8").then(JSON.parse)]);
  const repo = process.env.GITHUB_REPOSITORY || (project.github_owner === "YOUR_GITHUB_OWNER" ? null : `${project.github_owner}/${project.github_repo}`);
  if (!token || !repo) { console.log("Radar issue creation skipped: GITHUB_TOKEN/repository identity unavailable. Snapshot remains review_pending."); return; }
  if (!snapshot.candidates.length) { console.log(`Radar completed with zero candidates (status=${snapshot.status}); no empty issue created.`); return; }
  const baseLabels = await Promise.all([ensureLabel(repo, "radar", "16d9d4", "Automated discovery candidate"), ensureLabel(repo, "review-pending", "fbbf24", "Requires human verification")]);
  if (baseLabels.includes(false)) { await unifiedFallback(repo, snapshot.candidates, "base labels could not be ensured"); return; }
  const existing = await api(`/repos/${repo}/issues?state=all&labels=radar&per_page=100`);
  let created = 0, updated = 0, skipped = 0;
  for (const candidate of snapshot.candidates) {
    const doi = normalizeDoi(candidate.doi ?? "");
    const duplicate = existing.find((issue) => doi ? issue.body?.toLowerCase().includes(`doi: ${doi}`) : candidate.canonical_url && issue.body?.includes(candidate.canonical_url));
    const categoryOkay = await ensureLabel(repo, candidate.potential_category, "334155", "Radar category suggestion; not verified classification");
    if (!categoryOkay) { await unifiedFallback(repo, snapshot.candidates, `category label unavailable: ${candidate.potential_category}`); return; }
    const body = issueBody(candidate); const title = `[Radar] ${candidate.title}`.slice(0, 240); const labels = ["radar", "review-pending", candidate.potential_category];
    if (duplicate) { if (duplicate.state === "open") { await api(`/repos/${repo}/issues/${duplicate.number}`, { method: "PATCH", body: JSON.stringify({ body, labels }) }); updated++; } else skipped++; }
    else { await api(`/repos/${repo}/issues`, { method: "POST", body: JSON.stringify({ title, body, labels }) }); created++; }
  }
  console.log(JSON.stringify({ created, updated, skipped_closed_duplicates: skipped }, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) createRadarIssues().catch((error) => { console.error(error.message); process.exitCode = 1; });
