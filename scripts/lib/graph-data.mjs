import { CATEGORY_CLUSTERS, CATEGORY_CLUSTER_MAP } from "../../src/config/categoryClusters.mjs";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const LOOP_STAGE_ORDER = [
  "biological-question",
  "hypothesis-experiment-design",
  "experiment-selection",
  "protocol-generation",
  "wet-lab-execution",
  "measurement-qc",
  "analysis-interpretation",
  "model-update-feedback",
  "next-experiment-decision"
];

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function spiralPoint(index, count, spread) {
  const radius = spread * Math.sqrt((index + 0.65) / Math.max(1, count));
  const angle = index * GOLDEN_ANGLE;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function sharedValues(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function pairKey(source, target) {
  return [source, target].sort().join("::");
}

function buildEdges(records) {
  const ids = new Set(records.map((record) => record.id));
  const explicit = [];
  const occupied = new Set();

  for (const record of records) {
    for (const target of record.related_to ?? []) {
      if (!ids.has(target) || target === record.id) continue;
      const key = pairKey(record.id, target);
      if (occupied.has(key)) continue;
      occupied.add(key);
      const targetRecord = records.find((candidate) => candidate.id === target);
      explicit.push({
        id: `edge-${record.id.toLowerCase()}-${target.toLowerCase()}-related`,
        source: record.id,
        target,
        type: "related_to",
        inferred: false,
        weight: 1,
        reasons: ["Explicit related_to field in canonical data"],
        provenance_status: record.curation.status === "verified" && targetRecord?.curation.status === "verified"
          ? "source_records_verified"
          : "source_record_review_pending"
      });
    }
  }

  const candidates = [];
  for (let index = 0; index < records.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < records.length; otherIndex += 1) {
      const source = records[index];
      const target = records[otherIndex];
      const key = pairKey(source.id, target.id);
      if (occupied.has(key)) continue;

      const stages = sharedValues(source.loop_stages, target.loop_stages);
      const domains = sharedValues(source.biological_domains, target.biological_domains);
      const sameCategory = source.primary_category === target.primary_category;
      const sameClass = source.resource_class === target.resource_class;
      const score = (sameCategory ? 3 : 0)
        + Math.min(3, stages.length) * 0.65
        + Math.min(2, domains.length) * 0.9
        + (sameClass ? 0.4 : 0);

      if (score < 3.8) continue;
      const reasons = [];
      if (sameCategory) reasons.push(`shared category: ${source.primary_category}`);
      if (stages.length) reasons.push(`shared declared loop stages: ${stages.join(", ")}`);
      if (domains.length) reasons.push(`shared biological domains: ${domains.join(", ")}`);
      if (sameClass) reasons.push(`shared resource class: ${source.resource_class}`);
      candidates.push({ source: source.id, target: target.id, score, reasons });
    }
  }

  candidates.sort((left, right) =>
    right.score - left.score
    || left.source.localeCompare(right.source)
    || left.target.localeCompare(right.target)
  );

  const inferredDegree = new Map(records.map((record) => [record.id, 0]));
  const inferred = [];
  for (const candidate of candidates) {
    if ((inferredDegree.get(candidate.source) ?? 0) >= 3) continue;
    if ((inferredDegree.get(candidate.target) ?? 0) >= 3) continue;
    inferredDegree.set(candidate.source, (inferredDegree.get(candidate.source) ?? 0) + 1);
    inferredDegree.set(candidate.target, (inferredDegree.get(candidate.target) ?? 0) + 1);
    inferred.push({
      id: `edge-${candidate.source.toLowerCase()}-${candidate.target.toLowerCase()}-context`,
      source: candidate.source,
      target: candidate.target,
      type: "shared_context",
      inferred: true,
      weight: round(Math.min(1, candidate.score / 7.15), 3),
      reasons: candidate.reasons,
      provenance_status: "deterministic_organizational_similarity"
    });
  }

  return [...explicit, ...inferred];
}

function assignEcosystemLayouts(nodes) {
  const centers = {
    "scientific-intelligence": { x: 0.24, y: 0.22 },
    "experiment-execution": { x: 0.72, y: 0.2 },
    "models-data-digital-biology": { x: 0.16, y: 0.59 },
    "infrastructure-tools-standards": { x: 0.5, y: 0.79 },
    "applications-translation": { x: 0.84, y: 0.57 }
  };
  for (const cluster of CATEGORY_CLUSTERS) {
    const group = nodes.filter((node) => node.cluster.id === cluster.id);
    group.forEach((node, index) => {
      const offset = spiralPoint(index, group.length, group.length > 22 ? 0.19 : 0.16);
      const center = centers[cluster.id];
      node.layouts.ecosystem = {
        x: round(Math.max(0.035, Math.min(0.965, center.x + offset.x))),
        y: round(Math.max(0.08, Math.min(0.93, center.y + offset.y)))
      };
    });
  }
}

function assignLoopLayouts(nodes) {
  for (const [stageIndex, stage] of LOOP_STAGE_ORDER.entries()) {
    const group = nodes.filter((node) => node.closed_loop_stage[0] === stage);
    const angle = (-90 + stageIndex * 40) * Math.PI / 180;
    const center = { x: 0.5 + Math.cos(angle) * 0.38, y: 0.5 + Math.sin(angle) * 0.39 };
    group.forEach((node, index) => {
      const offset = spiralPoint(index, group.length, 0.085);
      node.layouts.closedLoop = {
        x: round(Math.max(0.035, Math.min(0.965, center.x + offset.x))),
        y: round(Math.max(0.07, Math.min(0.93, center.y + offset.y)))
      };
    });
  }
}

function assignTimelineLayouts(nodes) {
  const knownYears = nodes.map((node) => node.year).filter(Number.isFinite);
  const minYear = Math.min(...knownYears);
  const maxYear = Math.max(...knownYears);
  const clusterBands = [0.15, 0.24, 0.75, 0.84, 0.91];
  const yearSlots = new Map();

  for (const node of nodes) {
    const key = Number.isFinite(node.year) ? String(node.year) : "undated";
    const slot = yearSlots.get(key) ?? 0;
    yearSlots.set(key, slot + 1);
    const clusterIndex = CATEGORY_CLUSTERS.findIndex((cluster) => cluster.id === node.cluster.id);
    const baseX = Number.isFinite(node.year)
      ? 0.08 + ((node.year - minYear) / Math.max(1, maxYear - minYear)) * 0.78
      : 0.93;
    const jitter = ((stableHash(node.id) % 1000) / 1000 - 0.5) * 0.045;
    node.layouts.timeline = {
      x: round(Math.max(0.04, Math.min(0.96, baseX + ((slot % 3) - 1) * 0.006))),
      y: round(Math.max(0.08, Math.min(0.94, clusterBands[clusterIndex] + jitter)))
    };
  }
}

export function buildGraphData(records, categories, datasetVersion) {
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
  const edges = buildEdges(records);
  const degree = new Map(records.map((record) => [record.id, 0]));
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const nodes = records.map((record) => {
    const cluster = CATEGORY_CLUSTER_MAP[record.primary_category];
    if (!cluster) throw new Error(`No visual cluster mapping for ${record.primary_category}`);
    const graphDegree = degree.get(record.id) ?? 0;
    return {
      id: record.id,
      name: record.title,
      slug: record.id.toLowerCase(),
      category: record.primary_category,
      category_label: categoryById[record.primary_category]?.label_en ?? record.primary_category,
      cluster,
      resource_type: record.resource_class,
      resource_types: record.resource_types,
      description: record.summary_en,
      url: record.urls.canonical,
      github_url: record.urls.code?.includes("github.com") ? record.urls.code : null,
      code_url: record.urls.code,
      paper_url: record.urls.paper,
      data_url: record.urls.data,
      official_url: record.urls.official,
      tags: unique([...record.resource_types, ...record.biological_domains]),
      biological_domains: record.biological_domains,
      verification_status: record.curation.status,
      evidence_level: record.evidence.grade,
      closed_loop_stage: record.loop_stages,
      layout_stage: record.loop_stages[0] ?? null,
      last_updated: record.curation.last_verified,
      year: record.year,
      wet_lab: record.wet_lab,
      graph_degree: graphDegree,
      size: round(4.2 + Math.min(5.8, Math.sqrt(graphDegree) * 1.45), 2),
      dossier_path: `resources/${record.id.toLowerCase()}/`,
      atlas_path: `atlas/?status=all&category=${encodeURIComponent(record.primary_category)}`,
      layouts: {}
    };
  });

  assignEcosystemLayouts(nodes);
  assignLoopLayouts(nodes);
  assignTimelineLayouts(nodes);

  const mappedCategories = new Set(CATEGORY_CLUSTERS.flatMap((cluster) => cluster.categories));
  if (mappedCategories.size !== categories.length || categories.some((category) => !mappedCategories.has(category.id))) {
    throw new Error("The five-cluster mapping must cover each canonical category exactly once");
  }

  return {
    schema_version: "1.0",
    dataset_version: datasetVersion,
    methods: {
      node_size: "Degree-based only; no stars, citations, or popularity values are inferred.",
      explicit_edges: "Canonical related_to assertions.",
      inferred_edges: "Deterministic shared-context similarity with score >= 3.8 and at most three inferred edges per node.",
      layout: "Deterministic build-time positions for ecosystem, first-declared-stage closed loop, and public-year timeline modes."
    },
    clusters: CATEGORY_CLUSTERS.map(({ categories: clusterCategories, ...cluster }) => ({
      ...cluster,
      category_count: clusterCategories.length,
      categories: clusterCategories
    })),
    nodes,
    edges
  };
}

export function buildObservatoryData(records, categories, stats, graph) {
  const countBy = (values) => Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length])
  );
  const platformPattern = /(platform|laboratory|labos|biofoundry)/i;
  const dates = records.map((record) => record.curation.last_verified).filter(Boolean);
  const updateCounts = countBy(dates);
  const yearCounts = countBy(records.map((record) => Number.isFinite(record.year) ? String(record.year) : "Undated"));
  const clusterCounts = Object.fromEntries(graph.clusters.map((cluster) => [
    cluster.id,
    graph.nodes.filter((node) => node.cluster.id === cluster.id).length
  ]));
  const loopStageCounts = Object.fromEntries(LOOP_STAGE_ORDER.map((stage) => [
    stage,
    records.filter((record) => record.loop_stages.includes(stage)).length
  ]));

  return {
    dataset_version: stats.dataset_version,
    totals: {
      resources: stats.record_count,
      categories: stats.category_count,
      verified: stats.verified_count,
      review_pending: stats.review_pending_count
    },
    link_presence: {
      papers: records.filter((record) => Boolean(record.urls.paper)).length,
      code: records.filter((record) => Boolean(record.urls.code)).length,
      datasets: records.filter((record) => Boolean(record.urls.data)).length,
      platforms: records.filter((record) => record.resource_types.some((type) => platformPattern.test(type))).length
    },
    recent_additions: {
      last_7_days: null,
      last_30_days: null,
      note: "Canonical records do not currently include repository ingestion timestamps; no addition count is inferred."
    },
    category_distribution: categories.map((category) => ({
      id: category.id,
      label: category.label_en,
      count: category.actual_count ?? stats.category_counts[category.id] ?? 0,
      cluster: CATEGORY_CLUSTER_MAP[category.id]
    })),
    cluster_distribution: graph.clusters.map((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      color: cluster.color,
      count: clusterCounts[cluster.id]
    })),
    loop_stage_distribution: LOOP_STAGE_ORDER.map((stage) => ({ stage, count: loopStageCounts[stage] })),
    evidence_distribution: Object.entries(stats.evidence_counts).map(([grade, count]) => ({ grade, count })),
    verification_distribution: [
      { status: "verified", count: stats.verified_count },
      { status: "review_pending", count: stats.review_pending_count },
      { status: "archived", count: stats.archived_count }
    ],
    resource_class_distribution: Object.entries(stats.resource_class_counts).map(([resource_class, count]) => ({ resource_class, count })),
    public_year_distribution: Object.entries(yearCounts)
      .map(([year, count]) => ({ year, count }))
      .sort((left, right) => left.year === "Undated" ? 1 : right.year === "Undated" ? -1 : Number(left.year) - Number(right.year)),
    curation_audit_distribution: Object.entries(updateCounts).map(([date, count]) => ({ date, count })),
    recently_verified_or_reviewed: [...records]
      .sort((left, right) => (right.curation.last_verified ?? "").localeCompare(left.curation.last_verified ?? "") || right.id.localeCompare(left.id))
      .slice(0, 8)
      .map((record) => ({
        id: record.id,
        name: record.title,
        status: record.curation.status,
        date: record.curation.last_verified,
        category: categoryByIdSafe(categories, record.primary_category),
        dossier_path: `resources/${record.id.toLowerCase()}/`
      }))
  };
}

function categoryByIdSafe(categories, id) {
  return categories.find((category) => category.id === id)?.label_en ?? id;
}
