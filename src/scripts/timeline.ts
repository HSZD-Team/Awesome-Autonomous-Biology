const node = document.querySelector<HTMLScriptElement>("[data-timeline-data]");
const payload = node ? JSON.parse(node.textContent || "{}") : { records: [], categories: [] };
const chart = document.querySelector<HTMLElement>("[data-timeline-chart]");
const legend = document.querySelector<HTMLElement>("[data-timeline-legend]");
const selector = document.querySelector<HTMLSelectElement>("[data-timeline-group]");
const palette = ["#16d9d4", "#9c6cff", "#a3e635", "#fbbf24", "#38bdf8", "#fb7185", "#c084fc", "#2dd4bf"];
const categoryLabels = Object.fromEntries(payload.categories.map((category: any) => [category.id, category.label_en]));
function label(value: string) { return categoryLabels[value] ?? value.replaceAll("_", " "); }
function render(groupKey = "primary_category") {
  if (!chart || !legend) return;
  const values = [...new Set(payload.records.map((record: any) => record[groupKey]))].sort();
  const colors = Object.fromEntries(values.map((value, index) => [value, palette[index % palette.length]]));
  const years = [...new Set(payload.records.map((record: any) => record.year ?? "ongoing"))].sort((a: any, b: any) => a === "ongoing" ? 1 : b === "ongoing" ? -1 : b - a);
  legend.replaceChildren(...values.map((value) => { const item = document.createElement("span"); const dot = document.createElement("i"); dot.style.background = colors[value]; item.append(dot, label(value)); return item; }));
  chart.replaceChildren(...years.map((year) => {
    const records = payload.records.filter((record: any) => (record.year ?? "ongoing") === year);
    const row = document.createElement("div"); row.className = "year-row";
    const yearLabel = document.createElement("strong"); yearLabel.textContent = year === "ongoing" ? "Ongoing / date not asserted" : String(year);
    const track = document.createElement("div"); track.className = "year-track";
    records.forEach((record: any) => { const segment = document.createElement("span"); segment.className = "year-segment"; segment.style.background = colors[record[groupKey]]; segment.style.flex = "1"; segment.title = `${record.title} - ${label(record[groupKey])}`; track.append(segment); });
    const count = document.createElement("b"); count.textContent = String(records.length);
    row.append(yearLabel, track, count); return row;
  }));
}
selector?.addEventListener("change", () => render(selector.value));
render();
