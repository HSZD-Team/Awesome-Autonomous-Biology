type LayoutMode = "ecosystem" | "closedLoop" | "timeline";
type Point = { x: number; y: number };
type GraphNode = {
  id: string;
  name: string;
  category_label: string;
  cluster: { id: string; label: string; color: string };
  resource_type: string;
  resource_types: string[];
  description: string;
  url: string;
  github_url: string | null;
  paper_url: string | null;
  tags: string[];
  biological_domains: string[];
  verification_status: string;
  evidence_level: string;
  closed_loop_stage: string[];
  last_updated: string;
  year: number | null;
  size: number;
  dossier_path: string;
  atlas_path: string;
  layouts: Record<LayoutMode, Point>;
};
type GraphEdge = {
  source: string;
  target: string;
  type: "related_to" | "shared_context";
  inferred: boolean;
  weight: number;
};
type GraphPayload = {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    clusters: Array<{ id: string; label: string; color: string }>;
  };
  base: string;
};

const root = document.querySelector<HTMLElement>("[data-home-graph]");
const dataNode = document.querySelector<HTMLScriptElement>("[data-home-graph-data]");
const canvas = document.querySelector<HTMLCanvasElement>("[data-map-canvas]");
const context = canvas?.getContext("2d");
const loading = document.querySelector<HTMLElement>("[data-map-loading]");
const tooltip = document.querySelector<HTMLElement>("[data-map-tooltip]");
const live = document.querySelector<HTMLElement>("[data-map-live]");
const detail = document.querySelector<HTMLElement>("[data-map-detail]");
const searchForm = document.querySelector<HTMLFormElement>("[data-map-search]");
const searchInput = document.querySelector<HTMLInputElement>("[data-map-search-input]");
const searchResults = document.querySelector<HTMLElement>("[data-map-search-results]");

if (!root || !dataNode || !canvas || !context || !detail || !loading) {
  loading?.classList.add("is-error");
  const message = loading?.querySelector("p");
  if (message) message.textContent = "The graph could not initialize. Browse the Atlas instead.";
} else {
  initialize();
}

function initialize() {
  let payload: GraphPayload;
  try {
    payload = JSON.parse(dataNode!.textContent || "{}");
  } catch {
    showFailure("The graph data could not be read.");
    return;
  }

  const nodes = payload.graph.nodes;
  const edges = payload.graph.edges;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const connected = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set()]));
  edges.forEach((edge) => {
    connected.get(edge.source)?.add(edge.target);
    connected.get(edge.target)?.add(edge.source);
  });

  const mediaReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let mode: LayoutMode = "ecosystem";
  let paused = mediaReduced.matches;
  let selected: GraphNode | null = null;
  let hovered: GraphNode | null = null;
  let keyboardIndex = -1;
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  let draggingCanvas = false;
  let draggedNode: GraphNode | null = null;
  let dragMoved = false;
  let pointerStart = { x: 0, y: 0 };
  let transitionStart = 0;
  let transitionFrom = new Map<string, Point>();
  let transitionTo = new Map<string, Point>();
  const currentPositions = new Map<string, Point>();
  const manualPositions = new Map<string, Map<string, Point>>();
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;

  for (const node of nodes) currentPositions.set(node.id, { ...node.layouts[mode] });
  setPauseButton();

  function showFailure(message: string) {
    loading?.classList.add("is-error");
    const paragraph = loading?.querySelector("p");
    if (paragraph) paragraph.textContent = message;
  }

  function resolveInternal(path: string) {
    return payload.base + path.replace(/^\//, "");
  }

  function rgba(hex: string, alpha: number) {
    const value = hex.replace("#", "");
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
  }

  function resize() {
    const bounds = root!.getBoundingClientRect();
    width = Math.max(320, bounds.width);
    height = Math.max(520, bounds.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas!.width = Math.round(width * dpr);
    canvas!.height = Math.round(height * dpr);
    canvas!.style.width = width + "px";
    canvas!.style.height = height + "px";
    context!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function worldToScreen(point: Point) {
    return {
      x: (point.x * width - width / 2) * zoom + width / 2 + pan.x,
      y: (point.y * height - height / 2) * zoom + height / 2 + pan.y
    };
  }

  function screenToWorld(point: Point) {
    return {
      x: ((point.x - pan.x - width / 2) / zoom + width / 2) / width,
      y: ((point.y - pan.y - height / 2) / zoom + height / 2) / height
    };
  }

  function effectivePosition(node: GraphNode, time: number) {
    const base = currentPositions.get(node.id) ?? node.layouts[mode];
    if (paused || mediaReduced.matches || transitionStart) return base;
    const seed = Number(node.id.slice(-3));
    const phase = seed * 0.71;
    const speed = 0.82 + (seed % 9) * 0.035;
    const driftX = Math.min(0.008, 6.5 / Math.max(width, 1));
    const driftY = Math.min(0.01, 5 / Math.max(height, 1));
    return {
      x: base.x + Math.sin(time / (2100 / speed) + phase) * driftX,
      y: base.y + Math.cos(time / (2600 / speed) + phase * 0.73) * driftY
    };
  }

  function updateTransition(time: number) {
    if (!transitionStart) return;
    const progress = Math.min(1, (time - transitionStart) / (mediaReduced.matches ? 1 : 720));
    const eased = 1 - (1 - progress) ** 3;
    for (const node of nodes) {
      const from = transitionFrom.get(node.id) ?? node.layouts[mode];
      const to = transitionTo.get(node.id) ?? node.layouts[mode];
      currentPositions.set(node.id, {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased
      });
    }
    if (progress >= 1) transitionStart = 0;
  }

  function draw(time: number) {
    updateTransition(time);
    context!.clearRect(0, 0, width, height);
    const activeId = selected?.id ?? hovered?.id;
    const activeNeighbors = activeId ? connected.get(activeId) ?? new Set<string>() : null;

    for (const edge of edges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) continue;
      const sourcePoint = worldToScreen(effectivePosition(source, time));
      const targetPoint = worldToScreen(effectivePosition(target, time));
      const activeEdge = Boolean(activeId && (edge.source === activeId || edge.target === activeId));
      const dimmed = Boolean(activeId && !activeEdge);
      context!.beginPath();
      context!.moveTo(sourcePoint.x, sourcePoint.y);
      context!.lineTo(targetPoint.x, targetPoint.y);
      context!.lineWidth = activeEdge ? 1.55 : edge.inferred ? 0.55 : 1.05;
      context!.strokeStyle = activeEdge
        ? rgba(source.cluster.color, 0.68)
        : edge.inferred
          ? "rgba(91, 120, 145, " + (dimmed ? 0.018 : 0.105) + ")"
          : "rgba(58, 102, 146, " + (dimmed ? 0.03 : 0.24) + ")";
      context!.setLineDash(edge.inferred ? [2.5, 4.5] : []);
      context!.stroke();
    }
    context!.setLineDash([]);

    const showLabels = width > 900;
    for (const node of nodes) {
      const point = worldToScreen(effectivePosition(node, time));
      const isActive = node === selected || node === hovered;
      const isNeighbor = Boolean(activeNeighbors?.has(node.id));
      const dimmed = Boolean(activeId && !isActive && !isNeighbor);
      const radius = Math.max(3.1, node.size * zoom * 0.78);

      if (isActive) {
        const glow = context!.createRadialGradient(point.x, point.y, radius, point.x, point.y, radius * 4.2);
        glow.addColorStop(0, rgba(node.cluster.color, 0.26));
        glow.addColorStop(1, rgba(node.cluster.color, 0));
        context!.fillStyle = glow;
        context!.beginPath();
        context!.arc(point.x, point.y, radius * 4.2, 0, Math.PI * 2);
        context!.fill();
      }

      context!.globalAlpha = dimmed ? 0.16 : 1;
      context!.fillStyle = rgba(node.cluster.color, node.verification_status === "verified" ? 0.84 : 0.52);
      context!.strokeStyle = node.verification_status === "verified" ? "#ffffff" : rgba(node.cluster.color, 0.95);
      context!.lineWidth = isActive ? 2.2 : 0.8;
      context!.setLineDash(node.verification_status === "verified" ? [] : [2, 2]);
      context!.beginPath();
      context!.arc(point.x, point.y, isActive ? radius * 1.32 : radius, 0, Math.PI * 2);
      context!.fill();
      context!.stroke();
      context!.setLineDash([]);

      if (showLabels && (isActive || node.size >= 7.2)) {
        context!.font = isActive ? "600 11px Inter, sans-serif" : "500 9px Inter, sans-serif";
        context!.textAlign = "center";
        context!.textBaseline = "top";
        const label = node.name.length > 24 ? node.name.slice(0, 22) + "..." : node.name;
        const textWidth = context!.measureText(label).width;
        context!.fillStyle = "rgba(248, 250, 252, 0.92)";
        context!.fillRect(point.x - textWidth / 2 - 5, point.y + radius + 5, textWidth + 10, 18);
        context!.fillStyle = "#142235";
        context!.fillText(label, point.x, point.y + radius + 8);
      }
      context!.globalAlpha = 1;
    }

    if (mode === "timeline") drawTimelineAxis();
    frame = requestAnimationFrame(draw);
  }

  function drawTimelineAxis() {
    const years = nodes.map((node) => node.year).filter((year): year is number => Number.isFinite(year));
    const min = Math.min(...years);
    const max = Math.max(...years);
    context!.save();
    context!.strokeStyle = "rgba(43, 80, 112, 0.16)";
    context!.fillStyle = "#66788a";
    context!.font = "600 10px Inter, sans-serif";
    context!.textAlign = "center";
    const step = Math.max(1, Math.ceil((max - min) / 7));
    for (let year = min; year <= max; year += step) {
      const x = worldToScreen({ x: 0.08 + ((year - min) / Math.max(1, max - min)) * 0.78, y: 0 }).x;
      context!.beginPath();
      context!.moveTo(x, height * 0.1);
      context!.lineTo(x, height * 0.93);
      context!.stroke();
      context!.fillText(String(year), x, height * 0.955);
    }
    context!.fillText("Undated", worldToScreen({ x: 0.93, y: 0 }).x, height * 0.955);
    context!.restore();
  }

  function hitTest(clientX: number, clientY: number) {
    const bounds = canvas!.getBoundingClientRect();
    const point = { x: clientX - bounds.left, y: clientY - bounds.top };
    let nearest: GraphNode | null = null;
    let nearestDistance = Infinity;
    for (const node of nodes) {
      const screen = worldToScreen(currentPositions.get(node.id) ?? node.layouts[mode]);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      const threshold = Math.max(10, node.size * zoom + 5);
      if (distance <= threshold && distance < nearestDistance) {
        nearest = node;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  function showTooltip(node: GraphNode, clientX: number, clientY: number) {
    if (!tooltip) return;
    tooltip.textContent = node.name;
    tooltip.hidden = false;
    const bounds = root!.getBoundingClientRect();
    tooltip.style.left = Math.min(bounds.width - 220, Math.max(12, clientX - bounds.left + 14)) + "px";
    tooltip.style.top = Math.min(bounds.height - 60, Math.max(70, clientY - bounds.top + 14)) + "px";
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function setText(selector: string, value: string) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  }

  function setExternal(selector: string, href: string | null) {
    const link = document.querySelector<HTMLAnchorElement>(selector);
    if (!link) return;
    link.hidden = !href;
    if (href) link.href = href;
  }

  function openDetail(node: GraphNode) {
    selected = node;
    setText("[data-detail-title]", node.name);
    setText("[data-detail-type]", node.category_label + " · " + node.resource_type.replaceAll("_", " "));
    setText("[data-detail-description]", node.description);
    setText("[data-detail-evidence]", "Level " + node.evidence_level);
    setText("[data-detail-status]", node.verification_status.replaceAll("_", " "));
    setText("[data-detail-updated]", node.last_updated || "Not asserted");

    const cluster = document.querySelector<HTMLElement>("[data-detail-cluster]");
    if (cluster) {
      cluster.textContent = node.cluster.label;
      cluster.style.setProperty("--detail-color", node.cluster.color);
    }

    const tags = document.querySelector<HTMLElement>("[data-detail-tags]");
    tags?.replaceChildren(...node.tags.slice(0, 6).map((value) => {
      const tag = document.createElement("span");
      tag.textContent = value;
      return tag;
    }));

    const dossier = document.querySelector<HTMLAnchorElement>("[data-detail-dossier]");
    const atlas = document.querySelector<HTMLAnchorElement>("[data-detail-atlas]");
    if (dossier) dossier.href = resolveInternal(node.dossier_path);
    if (atlas) atlas.href = resolveInternal(node.atlas_path);
    setExternal("[data-detail-github]", node.github_url);
    setExternal("[data-detail-paper]", node.paper_url);
    setExternal("[data-detail-website]", node.url);

    detail!.hidden = false;
    detail!.setAttribute("aria-hidden", "false");
    root!.classList.add("has-selection");
    if (live) live.textContent = node.name + " selected. Resource details opened.";
  }

  function closeDetail() {
    selected = null;
    detail!.hidden = true;
    detail!.setAttribute("aria-hidden", "true");
    root!.classList.remove("has-selection");
    if (live) live.textContent = "Resource details closed.";
  }

  function switchMode(nextMode: LayoutMode) {
    if (mode === nextMode) return;
    transitionFrom = new Map(nodes.map((node) => [node.id, { ...(currentPositions.get(node.id) ?? node.layouts[mode]) }]));
    mode = nextMode;
    const manual = manualPositions.get(mode);
    transitionTo = new Map(nodes.map((node) => [node.id, { ...(manual?.get(node.id) ?? node.layouts[mode]) }]));
    transitionStart = performance.now();
    root!.dataset.mode = mode;
    document.querySelectorAll<HTMLButtonElement>("[data-map-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mapMode === mode));
    });
    if (live) {
      const label = mode === "closedLoop" ? "Closed Loop" : mode === "timeline" ? "Timeline" : "Ecosystem";
      live.textContent = label + " layout selected.";
    }
  }

  function resetView() {
    zoom = 1;
    pan = { x: 0, y: 0 };
    manualPositions.delete(mode);
    for (const node of nodes) currentPositions.set(node.id, { ...node.layouts[mode] });
    hovered = null;
    hideTooltip();
    if (live) live.textContent = "Graph view reset.";
  }

  function setPauseButton() {
    const button = document.querySelector<HTMLButtonElement>("[data-map-pause]");
    if (!button) return;
    button.setAttribute("aria-pressed", String(paused));
    button.textContent = paused ? "Resume" : "Pause";
    button.setAttribute("aria-label", paused ? "Resume graph animation" : "Pause graph animation");
  }

  function matchingNodes(query: string) {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return nodes.filter((node) => [
      node.name,
      node.description,
      node.category_label,
      node.resource_type,
      ...node.resource_types,
      ...node.tags,
      ...node.biological_domains,
      ...node.closed_loop_stage
    ].join(" ").toLocaleLowerCase().includes(normalized));
  }

  function renderSearchResults() {
    if (!searchInput || !searchResults) return;
    const matches = matchingNodes(searchInput.value).slice(0, 8);
    searchInput.setAttribute("aria-expanded", String(Boolean(matches.length)));
    searchResults.hidden = !searchInput.value.trim();
    searchResults.replaceChildren();

    if (!matches.length && searchInput.value.trim()) {
      const empty = document.createElement("p");
      empty.textContent = "No exact match. Explore the full Atlas with this query.";
      searchResults.append(empty);
      return;
    }

    for (const node of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "option";
      const title = document.createElement("strong");
      title.textContent = node.name;
      const meta = document.createElement("span");
      meta.textContent = node.category_label + " · " + node.verification_status.replaceAll("_", " ");
      button.append(title, meta);
      button.addEventListener("click", () => {
        openDetail(node);
        searchResults.hidden = true;
        searchInput.setAttribute("aria-expanded", "false");
      });
      searchResults.append(button);
    }
  }

  canvas!.addEventListener("pointermove", (event) => {
    if (draggedNode) {
      const bounds = canvas!.getBoundingClientRect();
      const world = screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      currentPositions.set(draggedNode.id, world);
      const manual = manualPositions.get(mode) ?? new Map<string, Point>();
      manual.set(draggedNode.id, world);
      manualPositions.set(mode, manual);
      dragMoved = true;
      return;
    }
    if (draggingCanvas) {
      pan.x += event.clientX - pointerStart.x;
      pan.y += event.clientY - pointerStart.y;
      pointerStart = { x: event.clientX, y: event.clientY };
      dragMoved = true;
      return;
    }

    const node = hitTest(event.clientX, event.clientY);
    hovered = node;
    canvas!.style.cursor = node ? "pointer" : "grab";
    if (node) showTooltip(node, event.clientX, event.clientY);
    else hideTooltip();
  });

  canvas!.addEventListener("pointerdown", (event) => {
    dragMoved = false;
    pointerStart = { x: event.clientX, y: event.clientY };
    const node = hitTest(event.clientX, event.clientY);
    if (node) draggedNode = node;
    else draggingCanvas = true;
    canvas!.setPointerCapture(event.pointerId);
  });

  canvas!.addEventListener("pointerup", (event) => {
    const node = hitTest(event.clientX, event.clientY);
    if (!dragMoved) {
      if (node) openDetail(node);
      else closeDetail();
    }
    draggedNode = null;
    draggingCanvas = false;
    canvas!.releasePointerCapture(event.pointerId);
  });

  canvas!.addEventListener("pointerleave", () => {
    if (!draggingCanvas && !draggedNode) {
      hovered = null;
      hideTooltip();
    }
  });

  canvas!.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom = Math.max(0.62, Math.min(3.2, zoom * (event.deltaY < 0 ? 1.09 : 0.92)));
  }, { passive: false });

  canvas!.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetail();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      keyboardIndex = (keyboardIndex + 1) % nodes.length;
      hovered = nodes[keyboardIndex];
      if (live) live.textContent = hovered.name + ". Press Enter for details.";
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      keyboardIndex = (keyboardIndex - 1 + nodes.length) % nodes.length;
      hovered = nodes[keyboardIndex];
      if (live) live.textContent = hovered.name + ". Press Enter for details.";
    }
    if (event.key === "Enter" && hovered) openDetail(hovered);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-map-mode]").forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mapMode as LayoutMode));
  });
  document.querySelector("[data-map-detail-close]")?.addEventListener("click", closeDetail);
  document.querySelector("[data-map-reset]")?.addEventListener("click", resetView);
  document.querySelector("[data-map-pause]")?.addEventListener("click", () => {
    paused = !paused;
    setPauseButton();
  });
  document.querySelector("[data-map-fullscreen]")?.addEventListener("click", async () => {
    if (!document.fullscreenElement) await root!.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selected) closeDetail();
  });

  searchInput?.addEventListener("input", renderSearchResults);
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchResults!.hidden = true;
      searchInput.setAttribute("aria-expanded", "false");
    }
  });
  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const matches = matchingNodes(searchInput?.value ?? "");
    if (matches[0]) {
      openDetail(matches[0]);
      searchResults!.hidden = true;
    } else {
      const query = encodeURIComponent(searchInput?.value.trim() ?? "");
      window.location.href = resolveInternal("atlas/?status=all" + (query ? "&q=" + query : ""));
    }
  });

  new ResizeObserver(resize).observe(root!);
  resize();
  loading!.hidden = true;
  root!.classList.add("is-ready");
  frame = requestAnimationFrame(draw);
  window.addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
}
