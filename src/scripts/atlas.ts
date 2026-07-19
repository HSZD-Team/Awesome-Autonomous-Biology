import { FILTER_KEYS, matchesFilter, parseFilterState, serializeFilterState } from "../lib/filter-state.mjs";
const form = document.querySelector<HTMLFormElement>("[data-atlas-filters]");
const dataNode = document.querySelector<HTMLScriptElement>("[data-atlas-data]");
const records = dataNode ? JSON.parse(dataNode.textContent || "[]") : [];
const resultRoot = document.querySelector<HTMLElement>("[data-atlas-results]");
const count = document.querySelector<HTMLElement>("[data-result-count]");
const scope = document.querySelector<HTMLElement>("[data-result-scope]");
const empty = document.querySelector<HTMLElement>("[data-no-results]");
const shells = new Map([...document.querySelectorAll<HTMLElement>("[data-resource-shell]")].map((element) => [element.dataset.id, element]));
const matrixCells = [...document.querySelectorAll<HTMLElement>("[data-matrix-cell]")];
function currentState() {
  const state: Record<string, string> = {};
  if (form) for (const element of Array.from(form.elements) as HTMLInputElement[]) if (element.name && element.value) state[element.name] = element.value;
  state.view = resultRoot?.dataset.view || "cards";
  return state;
}
function setView(view = "cards") {
  if (!resultRoot || !["cards", "list", "matrix"].includes(view)) return;
  resultRoot.dataset.view = view;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
}
function applyState(state: Record<string, string>, updateUrl = true) {
  if (form) for (const element of Array.from(form.elements) as HTMLInputElement[]) if (element.name) element.value = state[element.name] ?? "";
  setView(state.view || "cards");
  const matching = records.filter((record: any) => matchesFilter(record, state));
  const ids = new Set(matching.map((record: any) => record.id));
  shells.forEach((element, id) => { element.hidden = !ids.has(id); });
  if (count) count.textContent = String(matching.length);
  if (scope) scope.textContent = state.status === "review_pending" ? "review-pending candidates" : state.status === "all" ? "research records" : "verified resources";
  if (empty) empty.hidden = matching.length !== 0 || state.view === "matrix";
  for (const cell of matrixCells) {
    const value = matching.filter((record: any) => record.primary_category === cell.dataset.category && record.loop_stages.includes(cell.dataset.stage)).length;
    cell.textContent = String(value);
    cell.dataset.count = String(value);
  }
  if (updateUrl) history.replaceState({}, "", `${location.pathname}${serializeFilterState(currentState())}${location.hash}`);
}
form?.addEventListener("input", () => applyState(currentState()));
form?.addEventListener("change", () => applyState(currentState()));
document.querySelector("[data-clear-filters]")?.addEventListener("click", () => applyState({ status: "verified", view: resultRoot?.dataset.view || "cards" }));
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.addEventListener("click", () => { setView(button.dataset.view); applyState(currentState()); }));
window.addEventListener("popstate", () => {
  const state = parseFilterState(location.search);
  if (!state.status) state.status = "verified";
  applyState(state, false);
});
const initial = parseFilterState(location.search);
if (!initial.status) initial.status = "verified";
for (const key of FILTER_KEYS) if (!(key in initial)) initial[key] = "";
applyState(initial, false);
