import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateData } from "./validate-data.mjs";
import { loadProject, prettyJson, datasetStats } from "./lib/data.mjs";

const DEFAULT_CHECK = process.argv.includes("--check");
const ROOT = new URL("../", import.meta.url);
const STATUS_ORDER = { verified: 0, review_pending: 1, archived: 2 };

function linkList(urls) {
  const labels = { paper: "Paper", code: "Code", data: "Data", official: "Official" };
  return Object.entries(labels).filter(([key]) => urls[key]).map(([key, label]) => `[${label}](${urls[key]})`).join(" · ");
}

function sortedRecords(records) {
  return [...records].sort((a, b) => {
    const status = (STATUS_ORDER[a.curation.status] ?? 99) - (STATUS_ORDER[b.curation.status] ?? 99);
    if (status) return status;
    if (a.year == null && b.year != null) return 1;
    if (a.year != null && b.year == null) return -1;
    if (a.year !== b.year) return (b.year ?? 0) - (a.year ?? 0);
    return a.title.localeCompare(b.title, "en");
  });
}

function categoriesTable(categories, counts, zh = false) {
  const header = zh ? "| # | 一级目录 | 英文名称 | 记录数 |\n|---:|---|---|---:|" : "| # | Primary category | 中文 | Records |\n|---:|---|---|---:|";
  return [header, ...categories.map((category, index) => zh
    ? `| ${index + 1} | ${category.label_zh} | ${category.label_en} | ${counts[category.id] ?? 0} |`
    : `| ${index + 1} | ${category.label_en} | ${category.label_zh} | ${counts[category.id] ?? 0} |`)].join("\n");
}

function renderStats(seed, zh = false) {
  const stats = datasetStats(seed);
  const statusLine = zh
    ? `**${stats.record_count} 是研究记录总数，不是已人工核验数量。** 当前为 ${stats.verified_count} 条 \`verified\`、${stats.review_pending_count} 条 \`review_pending\`、${stats.archived_count} 条 \`archived\`。`
    : `**${stats.record_count} is the total research-record count, not the number human-verified.** The current split is ${stats.verified_count} \`verified\`, ${stats.review_pending_count} \`review_pending\`, and ${stats.archived_count} \`archived\`.`;
  const details = zh
    ? `数据版本 **v${stats.dataset_version}** · 21 类覆盖 **${stats.category_count}/${stats.category_count}** · resource class **${stats.resource_class_count}** 种 · 涉及湿实验 **${stats.wet_lab_count}** 条 · 年份未断言 **${stats.ongoing_count}** 条 · 最近一次 verified 核验 **${stats.latest_verified ?? "无"}** · 数据生成日期 **${stats.generated_on}**。`
    : `Dataset **v${stats.dataset_version}** · category coverage **${stats.category_count}/${stats.category_count}** · **${stats.resource_class_count}** resource classes · **${stats.wet_lab_count}** wet-lab records · **${stats.ongoing_count}** records with no asserted year · latest verified audit **${stats.latest_verified ?? "none"}** · dataset generated **${stats.generated_on}**.`;
  const evidence = zh
    ? `证据等级：A **${stats.evidence_counts.A ?? 0}** · B **${stats.evidence_counts.B ?? 0}** · C **${stats.evidence_counts.C ?? 0}**。`
    : `Evidence grades: A **${stats.evidence_counts.A ?? 0}** · B **${stats.evidence_counts.B ?? 0}** · C **${stats.evidence_counts.C ?? 0}**.`;
  return `${statusLine}\n\n${details}\n\n${evidence}\n\n${categoriesTable(seed.controlled_vocabularies.primary_categories, stats.category_counts, zh)}`;
}

function recordsList(seed, zh = false) {
  return seed.controlled_vocabularies.primary_categories.map((category) => {
    const items = sortedRecords(seed.records.filter((record) => record.primary_category === category.id)).map((record) => {
      const year = record.year ?? (zh ? "日期未断言" : "date not asserted");
      const status = record.curation.status === "review_pending"
        ? (zh ? "⚠️ review_pending（待人工复核）" : "⚠️ review_pending (human review required)")
        : record.curation.status;
      const summaries = zh
        ? `${record.summary_zh}<br>\n  _EN: ${record.summary_en}_`
        : `${record.summary_en}<br>\n  _中文：${record.summary_zh}_`;
      const metadata = zh
        ? `年份 ${year} · 状态 **${status}** · 证据 ${record.evidence.grade} · 科学自治 ${record.autonomy.scientific} · 操作自治 ${record.autonomy.operational}`
        : `Year ${year} · Status **${status}** · Evidence ${record.evidence.grade} · Scientific autonomy ${record.autonomy.scientific} · Operational autonomy ${record.autonomy.operational}`;
      const links = linkList(record.urls);
      return `- **[${record.title}](${record.urls.canonical})** — ${summaries}<br>\n  ${metadata}${links ? ` · ${links}` : ""}`;
    });
    const empty = zh ? "_此分类暂无记录。_" : "_No records in this category._";
    return `### ${zh ? category.label_zh : category.label_en}\n\n${items.join("\n") || empty}`;
  }).join("\n\n");
}

function replaceGeneratedRegion(source, name, content) {
  const start = `<!-- AAB:${name}:START -->`;
  const end = `<!-- AAB:${name}:END -->`;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) throw new Error(`README marker pair ${name} is missing or malformed`);
  if (source.indexOf(start, startIndex + start.length) >= 0 || source.indexOf(end, endIndex + end.length) >= 0) throw new Error(`README marker pair ${name} must be unique`);
  return `${source.slice(0, startIndex + start.length)}\n${content.trim()}\n${source.slice(endIndex)}`;
}

function renderReadmeRegions(source, seed, zh = false) {
  return replaceGeneratedRegion(
    replaceGeneratedRegion(source, "STATS", renderStats(seed, zh)),
    "RESOURCE_LIST",
    recordsList(seed, zh)
  );
}

async function emit(relative, content, check) {
  const target = new URL(relative, ROOT);
  if (check) {
    const current = await readFile(target, "utf8").catch(() => null);
    if (current !== content) throw new Error(`${relative} is out of date; run pnpm generate`);
    return;
  }
  await mkdir(new URL(".", target), { recursive: true });
  await writeFile(target, content, "utf8");
}

export async function buildIndex({ check = DEFAULT_CHECK } = {}) {
  const [{ seed, reviewFlags }, project, readmeEn, readmeZh] = await Promise.all([
    validateData({ quiet: true }),
    loadProject(),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../README_zh.md", import.meta.url), "utf8")
  ]);
  const verified = seed.records.filter((record) => record.curation.status === "verified");
  const stats = datasetStats(seed);
  const categoryById = Object.fromEntries(seed.controlled_vocabularies.primary_categories.map((category) => [category.id, category]));
  const allResources = seed.records.map((record) => ({ ...record, category: categoryById[record.primary_category] }));
  const resources = allResources.filter((record) => record.curation.status === "verified");
  const categories = seed.controlled_vocabularies.primary_categories.map((category) => ({
    ...category,
    actual_count: stats.category_counts[category.id] ?? 0,
    verified_count: stats.verified_category_counts[category.id] ?? 0,
    review_pending_count: allResources.filter((record) => record.primary_category === category.id && record.curation.status === "review_pending").length
  }));
  const search = allResources.map((record) => ({
    id: record.id,
    title: record.title,
    summary_en: record.summary_en,
    summary_zh: record.summary_zh,
    category: record.category.label_en,
    category_zh: record.category.label_zh,
    stages: record.loop_stages,
    status: record.curation.status,
    href: `resources/${record.id.toLowerCase()}/`
  }));
  const generated = {
    "src/data/generated/resources.json": prettyJson(resources),
    "src/data/generated/all-resources.json": prettyJson(allResources),
    "src/data/generated/review-flags.json": prettyJson(reviewFlags),
    "src/data/generated/categories.json": prettyJson(categories),
    "src/data/generated/stats.json": prettyJson(stats),
    "src/data/generated/vocabularies.json": prettyJson(seed.controlled_vocabularies),
    "src/data/generated/project.json": prettyJson(project),
    "src/data/generated/search-index.json": prettyJson(search),
    "public/data/resources.json": prettyJson(resources),
    "public/data/all-resources.json": prettyJson(allResources),
    "public/data/search-index.json": prettyJson(search),
    "public/data/stats.json": prettyJson(stats),
    "README.md": renderReadmeRegions(readmeEn, seed, false),
    "README_zh.md": renderReadmeRegions(readmeZh, seed, true)
  };
  for (const [path, content] of Object.entries(generated)) await emit(path, content, check);
  console.log(`${check ? "Checked" : "Generated"} ${Object.keys(generated).length} artifacts from Gold Seed v${seed.dataset_version}: ${seed.records.length} total, ${verified.length} verified.`);
  return { resources, allResources, categories, stats, project };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildIndex().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
