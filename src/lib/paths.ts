export function withBase(path = "") {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\//, "")}`;
}

export const loopStageLabels: Record<string, { en: string; zh: string }> = {
  "biological-question": { en: "Biological question", zh: "生物学问题" },
  "hypothesis-experiment-design": { en: "Hypothesis & experiment design", zh: "假设与实验设计" },
  "experiment-selection": { en: "Experiment selection", zh: "实验选择" },
  "protocol-generation": { en: "Protocol generation", zh: "协议生成" },
  "wet-lab-execution": { en: "Wet-lab execution", zh: "湿实验执行" },
  "measurement-qc": { en: "Measurement & QC", zh: "测量与质控" },
  "analysis-interpretation": { en: "Analysis & interpretation", zh: "分析与解释" },
  "model-update-feedback": { en: "Model update & feedback", zh: "模型更新与反馈" },
  "next-experiment-decision": { en: "Next-experiment decision", zh: "下一实验决策" }
};
