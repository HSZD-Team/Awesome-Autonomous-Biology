const configNode = document.querySelector<HTMLScriptElement>("[data-radar-config]");
const { project = {}, snapshot = { candidates: [] } } = configNode ? JSON.parse(configNode.textContent || "{}") : {};
const statusNode = document.querySelector<HTMLElement>("[data-radar-status]");
const signal = document.querySelector<HTMLElement>("[data-radar-signal]");
const list = document.querySelector<HTMLElement>("[data-candidate-list]");

function renderCandidates(items: any[], source: string) {
  if (!list) return;
  list.replaceChildren(...items.map((item) => {
    const article = document.createElement("article"); article.className = "candidate";
    const badge = document.createElement("span"); badge.className = "unverified"; badge.textContent = "UNVERIFIED / 待核验";
    const title = document.createElement("h3"); const link = document.createElement("a"); link.href = item.html_url || item.canonical_url || "#"; link.rel = "noreferrer"; link.textContent = item.title || "Untitled candidate"; title.append(link);
    const meta = document.createElement("p"); meta.textContent = `${source} - ${item.source ?? "GitHub issue"}${item.score != null ? ` - candidate score ${item.score}` : ""}`;
    const reason = document.createElement("p"); reason.textContent = item.why_matched?.join?.(" - ") || (item.body ?? "").slice(0, 360) || "Awaiting curator review.";
    article.append(badge, title, meta, reason); return article;
  }));
}

function showStatus(title: string, message: string) {
  if (statusNode) { statusNode.hidden = false; statusNode.replaceChildren(); const strong = document.createElement("strong"); strong.textContent = title; statusNode.append(strong, document.createElement("br"), message); }
}

async function loadRadar() {
  const fallback = snapshot.candidates ?? [];
  if (project.github_owner === "YOUR_GITHUB_OWNER") {
    if (signal) signal.textContent = "Snapshot mode";
    showStatus("Repository owner not configured.", fallback.length ? "Showing the committed fallback snapshot." : "No build snapshot exists yet. Set the owner in config/project.yml after creating the repository.");
    renderCandidates(fallback, "Build snapshot"); return;
  }
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(project.github_owner)}/${encodeURIComponent(project.github_repo)}/issues?state=open&labels=radar,review-pending&per_page=100`;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? "Public API rate limit reached" : `GitHub API returned ${response.status}`);
    const issues = (await response.json()).filter((issue: any) => !issue.pull_request);
    if (signal) signal.textContent = "Live API";
    if (statusNode) statusNode.hidden = true;
    if (!issues.length) showStatus("No pending radar issues.", "The live queue is empty; no candidates are invented to fill it.");
    renderCandidates(issues, "Live GitHub issue");
  } catch (error) {
    if (signal) signal.textContent = "Fallback mode";
    showStatus("Live API unavailable.", `${error instanceof Error ? error.message : "Unknown API error"}. ${fallback.length ? "Showing the committed snapshot." : "The committed snapshot is empty."}`);
    renderCandidates(fallback, "Build snapshot");
  }
}
loadRadar();
