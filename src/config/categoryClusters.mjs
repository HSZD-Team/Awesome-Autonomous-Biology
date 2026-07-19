export const CATEGORY_CLUSTERS = [
  {
    id: "scientific-intelligence",
    label: "Scientific Intelligence",
    color: "#8B5CF6",
    categories: [
      "01-surveys-perspectives",
      "03-scientific-agents",
      "04-experiment-design",
      "13-feedback-learning",
      "21-education-community"
    ]
  },
  {
    id: "experiment-execution",
    label: "Experiment & Execution",
    color: "#FB7185",
    categories: [
      "02-end-to-end-systems",
      "09-protocols",
      "10-lab-orchestration",
      "11-robot-instrument-control",
      "12-measurement-qc-analysis"
    ]
  },
  {
    id: "models-data-digital-biology",
    label: "Models, Data & Digital Biology",
    color: "#22D3EE",
    categories: [
      "05-perturbation-virtual-cell",
      "15-simulators-digital-twins",
      "16-benchmarks-evaluation",
      "17-closed-loop-datasets"
    ]
  },
  {
    id: "infrastructure-tools-standards",
    label: "Infrastructure, Tools & Standards",
    color: "#3B82F6",
    categories: [
      "14-standards-provenance",
      "18-agent-tools",
      "19-open-hardware",
      "20-cloud-commercial"
    ]
  },
  {
    id: "applications-translation",
    label: "Applications & Translation",
    color: "#84CC16",
    categories: [
      "06-protein-sequence-engineering",
      "07-drug-cell-screening",
      "08-synthetic-biology-biofoundries"
    ]
  }
];

export const CATEGORY_CLUSTER_MAP = Object.fromEntries(
  CATEGORY_CLUSTERS.flatMap((cluster) =>
    cluster.categories.map((category) => [category, {
      id: cluster.id,
      label: cluster.label,
      color: cluster.color
    }])
  )
);
