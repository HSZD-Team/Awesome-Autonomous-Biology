const labelsNode = document.querySelector<HTMLScriptElement>("[data-loop-labels]");
const stages = labelsNode ? JSON.parse(labelsNode.textContent || "[]") : [];
const nodes = [...document.querySelectorAll<SVGGElement>("[data-loop-stage]")];
const resources = [...document.querySelectorAll<HTMLElement>("[data-stages]")];
function selectStage(stage: string) {
  const index = stages.findIndex((item: any) => item.stage === stage);
  if (index < 0) return;
  nodes.forEach((node) => node.classList.toggle("is-active", node.dataset.loopStage === stage));
  const matching = resources.filter((item) => (item.dataset.stages ?? "").split(" ").includes(stage));
  resources.forEach((item) => { item.hidden = !matching.includes(item); });
  const title = document.querySelector("[data-stage-title]");
  const count = document.querySelector("[data-stage-count]");
  const number = document.querySelector("[data-stage-index]");
  const upstream = document.querySelector("[data-upstream]");
  const downstream = document.querySelector("[data-downstream]");
  if (title) title.textContent = stages[index].en;
  if (count) count.textContent = String(matching.length);
  if (number) number.textContent = String(index + 1).padStart(2, "0");
  if (upstream) upstream.textContent = stages[(index - 1 + stages.length) % stages.length].en;
  if (downstream) downstream.textContent = stages[(index + 1) % stages.length].en;
  history.replaceState({}, "", `${location.pathname}?stage=${encodeURIComponent(stage)}`);
}
nodes.forEach((node) => {
  node.addEventListener("click", () => selectStage(node.dataset.loopStage ?? ""));
  node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectStage(node.dataset.loopStage ?? ""); } });
});
const initial = new URLSearchParams(location.search).get("stage");
if (initial && stages.some((item: any) => item.stage === initial)) selectStage(initial);
