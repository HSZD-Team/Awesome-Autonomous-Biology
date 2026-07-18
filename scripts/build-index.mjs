import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateData } from "./validate-data.mjs";
import { loadProject, prettyJson, datasetStats } from "./lib/data.mjs";

const CHECK = process.argv.includes("--check");
const ROOT = new URL("../", import.meta.url);

function linkList(urls) {
  const labels = { paper: "Paper", code: "Code", data: "Data", official: "Official" };
  return Object.entries(labels).filter(([key]) => urls[key]).map(([key, label]) => `[${label}](${urls[key]})`).join(" · ");
}

function loopMermaid(zh = false) {
  const names = zh
    ? ["生物学问题", "假设与实验设计", "实验选择", "协议生成", "湿实验执行", "测量与质控", "分析与解释", "模型更新与反馈利用", "下一实验决策"]
    : ["Biological question", "Hypothesis & experiment design", "Experiment selection", "Protocol generation", "Wet-lab execution", "Measurement & QC", "Analysis & interpretation", "Model update & feedback utilization", "Next-experiment decision"];
  return `\`\`\`mermaid\nflowchart TB\n  subgraph R1[ ]\n    direction LR\n    S1["1. ${names[0]}"] --> S2["2. ${names[1]}"] --> S3["3. ${names[2]}"]\n  end\n  subgraph R2[ ]\n    direction RL\n    S4["4. ${names[3]}"] --> S5["5. ${names[4]}"] --> S6["6. ${names[5]}"]\n  end\n  subgraph R3[ ]\n    direction LR\n    S7["7. ${names[6]}"] --> S8["8. ${names[7]}"] --> S9["9. ${names[8]}"]\n  end\n  S3 --> S4\n  S6 --> S7\n  S9 -. next cycle .-> S1\n\`\`\``;
}

function categoriesTable(categories, counts, zh = false) {
  const header = zh ? "| # | 一级目录 | 英文名称 | 种子数 |\n|---:|---|---|---:|" : "| # | Primary category | 中文 | Seeds |\n|---:|---|---|---:|";
  return [header, ...categories.map((category, index) => zh
    ? `| ${index + 1} | ${category.label_zh} | ${category.label_en} | ${counts[category.id] ?? 0} |`
    : `| ${index + 1} | ${category.label_en} | ${category.label_zh} | ${counts[category.id] ?? 0} |`)].join("\n");
}

function recordsList(seed, categories, zh = false) {
  const records = seed.records.filter((record) => record.curation.status === "verified");
  return categories.map((category) => {
    const items = records.filter((record) => record.primary_category === category.id).map((record) => {
      const year = record.year ?? (zh ? "日期未断言" : "date not asserted");
      const summary = zh ? record.summary_zh : record.summary_en;
      const metadata = zh
        ? `年份 ${year} · 证据 ${record.evidence.grade} · 科学自治 ${record.autonomy.scientific} · 操作自治 ${record.autonomy.operational}`
        : `Year ${year} · Evidence ${record.evidence.grade} · Scientific autonomy ${record.autonomy.scientific} · Operational autonomy ${record.autonomy.operational}`;
      return `- **[${record.title}](${record.urls.canonical})** — ${summary}  \n  ${metadata}${linkList(record.urls) ? ` · ${linkList(record.urls)}` : ""}`;
    });
    return `### ${zh ? category.label_zh : category.label_en}\n\n${items.join("\n")}`;
  }).join("\n\n");
}

function renderReadme(seed, project, zh = false) {
  const stats = datasetStats(seed);
  const categories = seed.controlled_vocabularies.primary_categories;
  const seedCategoryCounts = Object.fromEntries(categories.map((category) => [category.id, category.seed_count]));
  const lang = zh ? "[English](README.md) | **简体中文**" : "**English** | [简体中文](README_zh.md)";
  const title = "Awesome Autonomous Biology";
  if (zh) return `${lang}\n\n# ${title}\n\n> 面向生物学发现闭环的、按证据分级的自主生物学资源图谱。\n\n[![Awesome](https://awesome.re/badge.svg)](https://awesome.re) ![Gold Seed](https://img.shields.io/badge/Gold_Seed-${stats.record_count}-16d9d4) ![Categories](https://img.shields.io/badge/Categories-${stats.category_count}-8b5cf6) [![MIT](https://img.shields.io/badge/code-MIT-a3e635)](LICENSE) [![CC BY 4.0](https://img.shields.io/badge/curation-CC_BY_4.0-a3e635)](LICENSE-DATA)\n\n**一句话定义：** 这是一个 biology-specific、closed-loop、evidence-graded 的可审计资源目录。\n\n- **它是什么：** 帮助研究者定位自主生物学系统、科学决策模块、基础设施、数据/评测资源和生态教育入口。\n- **它不是什么：** 泛 AI Agent、泛实验室自动化或泛机器人清单，也不把“用了 AI/机器人”当作端到端科学自治。\n\n> [!IMPORTANT]\n> **automation ≠ scientific autonomy；inclusion ≠ endorsement。** 科学自治和操作自治分别标注。收录不代表项目能力背书，也不重新授权任何第三方资源。\n\n## 九阶段干湿闭环\n\n${loopMermaid(true)}\n\n九阶段是信息组织模型；单个资源不必、也不会被视觉暗示为覆盖全部阶段。\n\n## 分类法\n\n一级目录回答“它是什么”；闭环阶段、资源类型、生物领域、开放程度、证据等级及双自治评分回答“它做什么”。\n\n${categoriesTable(categories, seedCategoryCounts, true)}\n\n## Gold Seed v0.1\n\n当前数据集由同一 YAML 事实源生成：**${stats.record_count} 条策展种子记录，其中 ${stats.verified_count} 条当前 verified、${stats.review_pending_count} 条因链接审计 review_pending；共 ${stats.category_count} 个一级目录、${stats.resource_class_count} 种 resource class**。最近核验日期为 **${stats.latest_verified}**。\n\n## Awesome 清单\n\n${recordsList(seed, categories, true)}\n\n## 探索与维护\n\n- **Website：** 启用 GitHub Pages 后访问项目站点；本地运行 \`pnpm dev\`。\n- **How to explore：** Atlas 支持可分享 URL 的多维筛选；Loop Map 按九阶段导航；Timeline、Ecosystem、Radar 和 Digest 提供互补视图。\n- **Data schema：** [严格 JSON Schema](schemas/resource.schema.json)；事实源为 [Gold Seed YAML](data/gold-seed-v0.1.yml)；链接审计状态见 [review flags](data/review-flags.yml)。\n- **Update pipeline：** 自动发现仅创建 \`review_pending\` 候选；人工核验 PR 才能进入 verified Atlas。\n- **Contributing：** 见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [CURATION.md](CURATION.md)。\n- **Citation：** 见 [CITATION.cff](CITATION.cff)。\n- **License：** 原创代码采用 [MIT](LICENSE)；原创策展元数据与双语摘要采用 [CC BY 4.0](LICENSE-DATA)。第三方论文、代码、数据、标准、硬件和商标仍归原权利人所有。\n\n## 推送前配置\n\n只需在 [\`config/project.yml\`](config/project.yml) 中把 GitHub owner 占位值改成你的用户名或组织名；本地构建对占位值有安全回退。\n\n---\n\n数据与 README 均由确定性脚本生成。请勿手工修改本清单；运行 \`pnpm generate\`。\n`;
  return `${lang}\n\n# ${title}\n\n> A biology-specific, closed-loop, evidence-graded atlas of autonomous biology.\n\n[![Awesome](https://awesome.re/badge.svg)](https://awesome.re) ![Gold Seed](https://img.shields.io/badge/Gold_Seed-${stats.record_count}-16d9d4) ![Categories](https://img.shields.io/badge/Categories-${stats.category_count}-8b5cf6) [![MIT](https://img.shields.io/badge/code-MIT-a3e635)](LICENSE) [![CC BY 4.0](https://img.shields.io/badge/curation-CC_BY_4.0-a3e635)](LICENSE-DATA)\n\n**In one sentence:** an auditable map of resources that support one or more stages of a closed biological discovery loop.\n\n- **What this is:** a focused index of autonomous biology systems, scientific decision modules, infrastructure, data/evaluation resources, and ecosystem entry points.\n- **What this is not:** a generic AI-agent, laboratory-automation, or robotics list—and not a claim that AI or robotic control equals end-to-end scientific autonomy.\n\n> [!IMPORTANT]\n> **Automation ≠ scientific autonomy; inclusion ≠ endorsement.** Scientific and operational autonomy are scored separately. Inclusion neither endorses a capability claim nor relicenses any third-party resource.\n\n## The nine-stage dry–wet loop\n\n${loopMermaid(false)}\n\nThe loop is an information model. A resource need not cover every stage, and the atlas never implies undeclared coverage.\n\n## Taxonomy\n\nPrimary categories answer “what is it?” Multidimensional tags describe what it does: loop stage, resource type, biology domain, openness, evidence grade, and separate scientific/operational autonomy.\n\n${categoriesTable(categories, seedCategoryCounts, false)}\n\n## Gold Seed v0.1\n\nThe dataset is generated from one YAML fact source: **${stats.record_count} curated seed records: ${stats.verified_count} currently verified and ${stats.review_pending_count} review-pending after link audit; ${stats.category_count} primary categories and ${stats.resource_class_count} resource classes**. Latest verification: **${stats.latest_verified}**.\n\n## Awesome list\n\n${recordsList(seed, categories, false)}\n\n## Explore and maintain\n\n- **Website:** available at the project Pages URL after GitHub Pages is enabled; run \`pnpm dev\` locally.\n- **How to explore:** Atlas offers URL-shareable filters; Loop Map navigates the nine stages; Timeline, Ecosystem, Radar, and Digest provide complementary views.\n- **Data schema:** [strict JSON Schema](schemas/resource.schema.json); fact source: [Gold Seed YAML](data/gold-seed-v0.1.yml); link-audit state: [review flags](data/review-flags.yml).\n- **Update pipeline:** automated discovery creates only \`review_pending\` candidates; only a human-reviewed PR can enter the verified Atlas.\n- **Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md) and [CURATION.md](CURATION.md).\n- **Citation:** see [CITATION.cff](CITATION.cff).\n- **License:** original code is [MIT](LICENSE); original curation metadata and bilingual summaries are [CC BY 4.0](LICENSE-DATA). Third-party papers, code, data, standards, hardware, and trademarks remain under their original rights.\n\n## Before publishing\n\nReplace the GitHub owner placeholder in [\`config/project.yml\`](config/project.yml) with your account or organization. Local builds safely fall back while it remains unchanged.\n\n---\n\nData and this README are deterministically generated. Do not hand-edit the list; run \`pnpm generate\`.\n`;
}

async function emit(relative, content) {
  const target = new URL(relative, ROOT);
  if (CHECK) {
    const current = await readFile(target, "utf8").catch(() => null);
    if (current !== content) throw new Error(`${relative} is out of date; run pnpm generate`);
    return;
  }
  await mkdir(new URL(".", target), { recursive: true });
  await writeFile(target, content, "utf8");
}

export async function buildIndex() {
  const [{ seed, reviewFlags }, project] = await Promise.all([validateData({ quiet: true }), loadProject()]);
  const verified = seed.records.filter((record) => record.curation.status === "verified");
  const stats = datasetStats(seed);
  const categoryById = Object.fromEntries(seed.controlled_vocabularies.primary_categories.map((category) => [category.id, category]));
  const allResources = seed.records.map((record) => ({ ...record, category: categoryById[record.primary_category] }));
  const resources = allResources.filter((record) => record.curation.status === "verified");
  const categories = seed.controlled_vocabularies.primary_categories.map((category) => ({ ...category, actual_count: stats.category_counts[category.id] ?? 0 }));
  const search = resources.map((record) => ({
    id: record.id,
    title: record.title,
    summary_en: record.summary_en,
    summary_zh: record.summary_zh,
    category: record.category.label_en,
    category_zh: record.category.label_zh,
    stages: record.loop_stages,
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
    "public/data/search-index.json": prettyJson(search),
    "README.md": renderReadme(seed, project, false),
    "README_zh.md": renderReadme(seed, project, true)
  };
  for (const [path, content] of Object.entries(generated)) await emit(path, content);
  console.log(`${CHECK ? "Checked" : "Generated"} ${Object.keys(generated).length} artifacts from ${seed.records.length} seed records (${verified.length} verified).`);
  return { resources, categories, stats, project };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildIndex().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
