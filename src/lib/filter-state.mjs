export const FILTER_KEYS = ["q", "category", "class", "stage", "domain", "evidence", "scientific", "operational", "open", "wet", "year", "view"];

export function parseFilterState(search = "") {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""]).filter(([, value]) => value !== ""));
}

export function serializeFilterState(state = {}) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (state[key]) params.set(key, String(state[key]));
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function matchesFilter(record, state = {}) {
  const haystack = `${record.title} ${record.summary_en} ${record.summary_zh}`.toLocaleLowerCase();
  if (state.q && !haystack.includes(state.q.toLocaleLowerCase())) return false;
  if (state.category && record.primary_category !== state.category) return false;
  if (state.class && record.resource_class !== state.class) return false;
  if (state.stage && !record.loop_stages.includes(state.stage)) return false;
  if (state.domain && !record.biological_domains.includes(state.domain)) return false;
  if (state.evidence && record.evidence.grade !== state.evidence) return false;
  if (state.scientific && record.autonomy.scientific !== state.scientific) return false;
  if (state.operational && record.autonomy.operational !== state.operational) return false;
  if (state.open && record.open_source !== state.open) return false;
  if (state.wet && String(record.wet_lab) !== state.wet) return false;
  if (state.year && String(record.year ?? "ongoing") !== state.year) return false;
  return true;
}
