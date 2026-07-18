import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { loadProject, loadSeed, loadYaml, normalizeDoi, normalizeTitle, canonicalUrl, prettyJson } from "./lib/data.mjs";
import { deduplicateCandidates, candidateIdentity } from "./deduplicate.mjs";

const OFFLINE = process.argv.includes("--offline");
const OUTPUT = new URL("../data/candidates/latest.json", import.meta.url);
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const biologyTerms = ["biology", "biological", "protein", "enzyme", "cell", "genomic", "microb", "assay", "drug", "biofoundry", "laboratory", "lab"];
const loopTerms = ["autonomous", "self-driving", "closed-loop", "robot scientist", "active learning", "bayesian optimization", "feedback", "experiment design", "next experiment"];

function asArray(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function text(value) { if (value == null) return ""; if (typeof value === "object") return value["#text"] ?? value._ ?? ""; return String(value); }
function dateOnly(value) { const match = String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/); return match?.[0] ?? null; }
function doiFromUrl(url) { const match = String(url ?? "").match(/doi\.org\/(10\.\d{4,9}\/[^?#\s]+)/i); return match ? decodeURIComponent(match[1]) : ""; }

async function fetchWithRetry(url, options, settings) {
  let lastError;
  for (let attempt = 0; attempt <= settings.max_retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(settings.timeout_ms), headers: { "User-Agent": "awesome-autonomous-biology/0.1 (deterministic-curation-radar)", Accept: "application/json, application/atom+xml, application/rss+xml, text/xml;q=0.9", ...(options?.headers ?? {}) } });
      if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") throw new Error(`rate limit reached; reset=${response.headers.get("x-ratelimit-reset") ?? "unknown"}`);
      if (response.status === 429 || response.status >= 500) throw new Error(`temporary HTTP ${response.status}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < settings.max_retries) await new Promise((resolve) => setTimeout(resolve, settings.backoff_ms * 2 ** attempt));
    }
  }
  throw lastError;
}

function candidateScore(candidate, quality) {
  const haystack = `${candidate.title} ${candidate.abstract ?? ""}`.toLocaleLowerCase();
  const biologyHits = biologyTerms.filter((term) => haystack.includes(term));
  const loopHits = loopTerms.filter((term) => haystack.includes(term));
  const year = Number(String(candidate.published_date ?? "").slice(0, 4));
  const currentYear = new Date().getUTCFullYear();
  const components = {
    biology_relevance: Math.min(25, biologyHits.length * 6),
    closed_loop_relevance: Math.min(30, loopHits.length * 8),
    primary_source_quality: Math.round(20 * quality),
    code_data_availability: Math.min(15, (candidate.code_url ? 8 : 0) + (candidate.data_url ? 7 : 0)),
    recency: Number.isFinite(year) ? Math.max(0, 10 - Math.max(0, currentYear - year) * 2) : 0
  };
  return { score: Object.values(components).reduce((sum, value) => sum + value, 0), score_components: components, why_matched: [...biologyHits.map((term) => `biology term: ${term}`), ...loopHits.map((term) => `closed-loop term: ${term}`)].slice(0, 8) };
}

function normalize(raw, context) {
  const doi = normalizeDoi(raw.doi || doiFromUrl(raw.canonical_url));
  const canonical = canonicalUrl(raw.canonical_url || (doi ? `https://doi.org/${doi}` : ""));
  const scored = candidateScore(raw, context.quality);
  return {
    id: `candidate-${normalizeTitle(raw.title).replace(/\s+/g, "-").slice(0, 72) || "untitled"}`,
    title: String(raw.title ?? "").trim(),
    abstract: String(raw.abstract ?? "").trim() || null,
    doi: doi || null,
    canonical_url: canonical || null,
    code_url: raw.code_url ?? null,
    data_url: raw.data_url ?? null,
    authors: asArray(raw.authors).flatMap((author) => String(author).split(/,|;| and /)).map((author) => author.trim()).filter(Boolean).slice(0, 30),
    published_date: dateOnly(raw.published_date),
    source_type: context.source,
    source_record_id: raw.source_record_id ?? null,
    matched_query: context.query,
    potential_category: context.category,
    fetched_at: context.fetchedAt,
    status: "review_pending",
    ...scored
  };
}

async function collectEuropePmc(query, source, settings, fetchedAt) {
  const url = new URL(source.endpoint); url.searchParams.set("query", query.query); url.searchParams.set("format", "json"); url.searchParams.set("pageSize", settings.results_per_query);
  const json = await (await fetchWithRetry(url, {}, settings)).json();
  return asArray(json.resultList?.result).map((item) => normalize({ title: item.title, abstract: item.abstractText, doi: item.doi, canonical_url: item.doi ? `https://doi.org/${item.doi}` : `https://europepmc.org/article/${item.source}/${item.id}`, authors: item.authorString, published_date: item.firstPublicationDate, source_record_id: item.id }, { source: source.id, query: query.query, category: query.category, quality: source.primary_source_quality, fetchedAt }));
}

async function collectCrossref(query, source, settings, fetchedAt) {
  const url = new URL(source.endpoint); url.searchParams.set("query", query.query); url.searchParams.set("rows", settings.results_per_query); url.searchParams.set("select", "DOI,title,author,published,URL,abstract,type");
  const json = await (await fetchWithRetry(url, {}, settings)).json();
  return asArray(json.message?.items).map((item) => normalize({ title: asArray(item.title)[0], abstract: item.abstract, doi: item.DOI, canonical_url: item.URL, authors: asArray(item.author).map((author) => [author.given, author.family].filter(Boolean).join(" ")), published_date: asArray(item.published?.["date-parts"])[0]?.join("-"), source_record_id: item.DOI }, { source: source.id, query: query.query, category: query.category, quality: source.primary_source_quality, fetchedAt }));
}

async function collectArxiv(query, source, settings, fetchedAt) {
  const url = new URL(source.endpoint); url.searchParams.set("search_query", `all:\"${query.query}\"`); url.searchParams.set("start", "0"); url.searchParams.set("max_results", settings.results_per_query);
  const parsed = xml.parse(await (await fetchWithRetry(url, { headers: { Accept: "application/atom+xml" } }, settings)).text());
  return asArray(parsed.feed?.entry).map((item) => normalize({ title: text(item.title), abstract: text(item.summary), canonical_url: text(item.id), doi: text(item["arxiv:doi"]), authors: asArray(item.author).map((author) => text(author.name)), published_date: text(item.published), source_record_id: text(item.id) }, { source: source.id, query: query.query, category: query.category, quality: source.primary_source_quality, fetchedAt }));
}

async function collectGithub(query, source, settings, fetchedAt) {
  const url = new URL(source.endpoint); url.searchParams.set("q", `${query.query} in:name,description,readme`); url.searchParams.set("per_page", settings.results_per_query);
  const token = process.env.GITHUB_TOKEN;
  const json = await (await fetchWithRetry(url, { headers: token ? { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } : {} }, settings)).json();
  return asArray(json.items).map((item) => normalize({ title: item.full_name, abstract: item.description, canonical_url: item.html_url, code_url: item.html_url, authors: item.owner?.login, published_date: item.created_at, source_record_id: String(item.id) }, { source: source.id, query: query.query, category: query.category, quality: source.primary_source_quality, fetchedAt }));
}

async function collectPreprints(source, settings, queries, fetchedAt) {
  const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 7); const iso = (date) => date.toISOString().slice(0, 10);
  const url = `${source.endpoint}/${iso(start)}/${iso(end)}/0/json`;
  const json = await (await fetchWithRetry(url, {}, settings)).json();
  const output = [];
  for (const item of asArray(json.collection)) {
    const haystack = `${item.title} ${item.abstract}`.toLocaleLowerCase();
    const match = queries.find((query) => query.query.toLocaleLowerCase().split(" ").some((term) => term.length > 5 && haystack.includes(term)));
    if (match) output.push(normalize({ title: item.title, abstract: item.abstract, doi: item.doi, canonical_url: item.doi ? `https://doi.org/${item.doi}` : "", authors: item.authors, published_date: item.date, source_record_id: item.doi }, { source: source.id, query: match.query, category: match.category, quality: source.primary_source_quality, fetchedAt }));
  }
  return output;
}

async function collectFeeds(source, settings, queries, fetchedAt) {
  const output = [];
  for (const feed of source.feeds ?? []) {
    const parsed = xml.parse(await (await fetchWithRetry(feed, { headers: { Accept: "application/rss+xml, application/atom+xml, text/xml" } }, settings)).text());
    const items = asArray(parsed.rss?.channel?.item ?? parsed.feed?.entry);
    for (const item of items.slice(0, settings.results_per_query)) {
      const title = text(item.title); const abstract = text(item.description ?? item.summary ?? item.content); const haystack = `${title} ${abstract}`.toLocaleLowerCase();
      const match = queries.find((query) => query.query.toLocaleLowerCase().split(" ").some((term) => term.length > 5 && haystack.includes(term)));
      if (match) output.push(normalize({ title, abstract, canonical_url: text(item.link?.["@_href"] ?? item.link), authors: text(item.author?.name ?? item["dc:creator"]), published_date: text(item.pubDate ?? item.published ?? item.updated), source_record_id: text(item.guid ?? item.id) }, { source: source.id, query: match.query, category: match.category, quality: source.primary_source_quality, fetchedAt }));
    }
  }
  return output;
}

export async function discover() {
  if (OFFLINE) { const snapshot = JSON.parse(await readFile(OUTPUT, "utf8")); console.log(JSON.stringify({ offline: true, status: snapshot.status, candidates: snapshot.candidates.length }, null, 2)); return snapshot; }
  const [sourceConfig, queryConfig, seed] = await Promise.all([loadYaml(new URL("../config/discovery-sources.yml", import.meta.url)), loadYaml(new URL("../config/search-queries.yml", import.meta.url)), loadSeed(), loadProject()]);
  const settings = sourceConfig; const queries = queryConfig.queries; const fetchedAt = new Date().toISOString(); const candidates = []; const sourceErrors = [];
  for (const source of sourceConfig.sources.filter((item) => item.enabled)) {
    try {
      if (source.id === "biorxiv-medrxiv") candidates.push(...await collectPreprints(source, settings, queries, fetchedAt));
      else if (source.id === "official-feeds") candidates.push(...await collectFeeds(source, settings, queries, fetchedAt));
      else for (const query of queries) {
        try {
          if (source.id === "europe-pmc") candidates.push(...await collectEuropePmc(query, source, settings, fetchedAt));
          if (source.id === "crossref") candidates.push(...await collectCrossref(query, source, settings, fetchedAt));
          if (source.id === "arxiv") candidates.push(...await collectArxiv(query, source, settings, fetchedAt));
          if (source.id === "github") candidates.push(...await collectGithub(query, source, settings, fetchedAt));
        } catch (error) { sourceErrors.push({ source: source.id, query: query.query, error: error instanceof Error ? error.message : String(error) }); }
      }
    } catch (error) { sourceErrors.push({ source: source.id, query: null, error: error instanceof Error ? error.message : String(error) }); }
  }
  const relevant = candidates.filter((candidate) => candidate.title && candidate.score_components.biology_relevance > 0 && candidate.score_components.closed_loop_relevance > 0);
  const { unique, duplicates } = deduplicateCandidates(relevant);
  const verifiedIdentities = seed.records.map((record) => candidateIdentity({ title: record.title, canonical_url: record.urls.canonical, doi: doiFromUrl(record.urls.paper) }));
  const notVerified = unique.filter((candidate) => { const id = candidateIdentity(candidate); return !verifiedIdentities.some((known) => (id.doi && id.doi === known.doi) || (id.url && id.url === known.url) || (id.title && id.title === known.title)); });
  notVerified.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const snapshot = { generated_at: fetchedAt, status: sourceErrors.length ? (notVerified.length ? "partial" : "external_sources_unavailable") : "complete", candidate_count: notVerified.length, candidates: notVerified.slice(0, 200), duplicate_count: duplicates.length + unique.length - notVerified.length, source_errors: sourceErrors, notice: "All entries are review_pending. Candidate scores rank attention and are not factual judgments." };
  await writeFile(OUTPUT, prettyJson(snapshot), "utf8");
  console.log(JSON.stringify({ status: snapshot.status, candidates: snapshot.candidate_count, duplicates: snapshot.duplicate_count, source_errors: sourceErrors.length }, null, 2));
  return snapshot;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) discover().catch((error) => { console.error(`Discovery ended without fabricated output: ${error.message}`); process.exitCode = 1; });
