const viewport = document.querySelector<SVGGElement>("[data-graph-viewport]");
const graph = document.querySelector<HTMLElement>("[data-graph]");
const tooltip = document.querySelector<HTMLElement>("[data-graph-tooltip]");
const nodes = [...document.querySelectorAll<SVGGElement>("[data-node-id]")];
const links = [...document.querySelectorAll<SVGElement>("[data-node-link]")];
const edges = [...document.querySelectorAll<SVGLineElement>("[data-edge-type]")];
let scale = 1, x = 0, y = 0, dragging = false, lastX = 0, lastY = 0;
function transform() { viewport?.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`); }
function zoom(delta: number) { scale = Math.max(.55, Math.min(2.8, scale * delta)); transform(); }
function reset() { scale = 1; x = 0; y = 0; nodes.forEach((node) => node.classList.remove("is-focus")); edges.forEach((edge) => edge.style.opacity = ""); transform(); if (tooltip) tooltip.textContent = "Graph reset. Explicit relationships are shown by default."; }
function focusNode(node: SVGGElement) {
  const id = node.dataset.nodeId ?? ""; nodes.forEach((item) => item.classList.toggle("is-focus", item === node));
  edges.forEach((edge) => edge.style.opacity = edge.dataset.source === id || edge.dataset.target === id ? "1" : ".08");
  if (tooltip) tooltip.textContent = `${id} - ${node.dataset.nodeTitle}. Highlighted edges are graph relations, not inferred collaborations.`;
}
document.querySelector("[data-zoom-in]")?.addEventListener("click", () => zoom(1.2));
document.querySelector("[data-zoom-out]")?.addEventListener("click", () => zoom(.82));
document.querySelector("[data-reset]")?.addEventListener("click", reset);
document.querySelector<HTMLInputElement>("[data-shared-toggle]")?.addEventListener("change", (event) => {
  const enabled = (event.currentTarget as HTMLInputElement).checked;
  edges.filter((edge) => edge.dataset.edgeType === "shared_context").forEach((edge) => { edge.hidden = !enabled; });
  links.forEach((link) => { link.hidden = !enabled && link.dataset.explicit !== "true"; });
  if (tooltip) tooltip.textContent = enabled ? "Shared context enabled: dashed edges mean shared category + declared loop stage only." : "Explicit related_to assertions only.";
});
nodes.forEach((node) => { node.addEventListener("mouseenter", () => focusNode(node)); node.addEventListener("focus", () => focusNode(node)); node.addEventListener("click", (event) => { if (!(event.ctrlKey || event.metaKey)) { event.preventDefault(); focusNode(node); } }); });
graph?.addEventListener("wheel", (event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.08 : .92); }, { passive: false });
graph?.addEventListener("pointerdown", (event) => { if ((event.target as Element).closest("[data-node-id]")) return; dragging = true; lastX = event.clientX; lastY = event.clientY; graph.setPointerCapture(event.pointerId); });
graph?.addEventListener("pointermove", (event) => { if (!dragging) return; x += event.clientX - lastX; y += event.clientY - lastY; lastX = event.clientX; lastY = event.clientY; transform(); });
graph?.addEventListener("pointerup", () => { dragging = false; });
transform();
