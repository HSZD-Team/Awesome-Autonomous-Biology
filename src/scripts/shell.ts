const root = document.documentElement;
const base = root.dataset.base ?? "/";
const palette = document.querySelector<HTMLDialogElement>("[data-command-palette]");
const search = document.querySelector<HTMLInputElement>("[data-palette-search]");
const results = document.querySelector<HTMLElement>("[data-palette-results]");
const indexNode = document.querySelector<HTMLScriptElement>("[data-palette-index]");
const entries = indexNode ? JSON.parse(indexNode.textContent || "[]") : [];
let activeIndex = 0;

function resolveHref(path: string) {
  if (/^https?:/.test(path)) return path;
  return `${base}${path.replace(/^\//, "")}`;
}

function filteredEntries() {
  const query = (search?.value ?? "").trim().toLocaleLowerCase();
  return entries.filter((entry: any) => !query || `${entry.title} ${entry.subtitle ?? ""} ${entry.keywords ?? ""}`.toLocaleLowerCase().includes(query)).slice(0, 12);
}

function renderPalette() {
  if (!results) return;
  const matches = filteredEntries();
  activeIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));
  results.replaceChildren(...matches.map((entry: any, index: number) => {
    const link = document.createElement("a");
    link.href = resolveHref(entry.href);
    link.role = "option";
    link.ariaSelected = String(index === activeIndex);
    link.className = index === activeIndex ? "is-active" : "";
    const title = document.createElement("span");
    title.textContent = entry.title;
    const meta = document.createElement("small");
    meta.textContent = entry.subtitle ? `${entry.type} - ${entry.subtitle}` : entry.type;
    link.append(title, meta);
    return link;
  }));
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state compact";
    empty.textContent = "No matching destination.";
    results.append(empty);
  }
}

function openPalette() {
  palette?.showModal();
  activeIndex = 0;
  renderPalette();
  requestAnimationFrame(() => search?.focus());
}

document.querySelectorAll("[data-open-palette]").forEach((button) => button.addEventListener("click", openPalette));
document.querySelectorAll("[data-close-palette]").forEach((button) => button.addEventListener("click", () => palette?.close()));
search?.addEventListener("input", () => { activeIndex = 0; renderPalette(); });
search?.addEventListener("keydown", (event) => {
  const matches = filteredEntries();
  if (event.key === "ArrowDown") { event.preventDefault(); activeIndex = (activeIndex + 1) % Math.max(1, matches.length); renderPalette(); }
  if (event.key === "ArrowUp") { event.preventDefault(); activeIndex = (activeIndex - 1 + matches.length) % Math.max(1, matches.length); renderPalette(); }
  if (event.key === "Enter" && matches[activeIndex]) window.location.href = resolveHref(matches[activeIndex].href);
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); openPalette(); }
});
palette?.addEventListener("click", (event) => { if (event.target === palette) palette.close(); });

const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
toggle?.addEventListener("click", () => {
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  document.querySelector(".primary-nav")?.classList.toggle("is-open", !expanded);
});

document.querySelectorAll<HTMLAnchorElement>("[data-repository-link]").forEach((link) => {
  link.title = "Set the repository owner in config/project.yml before publishing";
});
const siteHeader = document.querySelector<HTMLElement>(".site-header");
const syncHeaderSurface = () => siteHeader?.classList.toggle("is-scrolled", window.scrollY > 12);
syncHeaderSurface();
window.addEventListener("scroll", syncHeaderSurface, { passive: true });
