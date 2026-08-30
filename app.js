const STORAGE_KEY = "simbolos.library.v1";
const $ = (selector) => document.querySelector(selector);

const els = {
  grid: $("#symbolGrid"), empty: $("#emptyState"), noResults: $("#noResultsState"), count: $("#symbolCount"),
  search: $("#searchInput"), clearSearch: $("#clearSearchButton"), add: $("#addButton"), emptyAdd: $("#emptyAddButton"),
  libraryButton: $("#libraryButton"), libraryMenu: $("#libraryMenu"), exportButton: $("#exportButton"), importButton: $("#importButton"), importFile: $("#importFileInput"), aboutStorage: $("#aboutStorageButton"),
  editor: $("#editorDialog"), editorTitle: $("#editorTitle"), cancel: $("#cancelEditorButton"), save: $("#saveSymbolButton"), name: $("#nameInput"), svg: $("#svgInput"), paste: $("#pasteButton"), format: $("#formatButton"), preview: $("#svgPreview"), previewColor: $("#previewColorInput"), previewStatus: $("#previewStatus"), fixedColor: $("#fixedColorInput"), cleanup: $("#cleanupInput"), strokeControls: $("#strokeControls"), strokeInput: $("#strokeWidthInput"), strokeOutput: $("#strokeWidthOutput"), restoreStroke: $("#restoreStrokeButton"), analysisChips: $("#analysisChips"), analysisText: $("#analysisText"), output: $("#outputCode code"), copyOutput: $("#copyOutputButton"), deleteSymbol: $("#deleteSymbolButton"),
  info: $("#infoDialog"), closeInfo: $("#closeInfoButton"), toast: $("#toast"), template: $("#symbolCardTemplate")
};

let items = loadItems();
let editingId = null;
let strokeOverride = null;
let originalStrokeWidth = 1.5;
let toastTimer = null;

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter(x => x && typeof x.name === "string" && typeof x.originalSvg === "string") : [];
  } catch { return []; }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 1800);
}

function copyText(text) {
  if (!text) return Promise.reject(new Error("empty"));
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy") ? resolve() : reject(new Error("copy")); }
    catch (e) { reject(e); }
    finally { ta.remove(); }
  });
}

function parseSvg(code) {
  const source = String(code || "").trim();
  if (!source) return { ok: false, error: "Cole um código SVG." };
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (doc.querySelector("parsererror")) return { ok: false, error: "O código não é um SVG válido." };
  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== "svg") return { ok: false, error: "O código precisa começar com um elemento <svg>." };
  return { ok: true, doc, root };
}

function sanitize(root, technicalCleanup = true) {
  const clone = root.cloneNode(true);
  const blocked = "script,foreignObject,iframe,object,embed,audio,video";
  clone.querySelectorAll(blocked).forEach(el => el.remove());
  if (technicalCleanup) clone.querySelectorAll("style,metadata,title,desc").forEach(el => el.remove());
  [clone, ...clone.querySelectorAll("*")].forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      if ((name === "href" || name.endsWith(":href")) && (value.startsWith("javascript:") || value.startsWith("data:text/html"))) el.removeAttribute(attr.name);
      if (technicalCleanup && (name === "class" || name === "id" || name === "xmlns:xlink" || name.startsWith("data-"))) el.removeAttribute(attr.name);
    });
  });
  return clone;
}

function isSolidPaint(value) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return !["none", "transparent", "currentcolor", "inherit", "initial", "unset"].includes(v) && !v.startsWith("url(");
}

function applyPaint(root, mode, fixedColor) {
  if (mode === "original") return;
  const target = mode === "currentColor" ? "currentColor" : fixedColor;
  [root, ...root.querySelectorAll("*")].forEach(el => {
    for (const attr of ["fill", "stroke"]) {
      const value = el.getAttribute(attr);
      if (isSolidPaint(value)) el.setAttribute(attr, target);
    }
    const style = el.getAttribute("style");
    if (style) {
      let next = style;
      next = next.replace(/(fill\s*:\s*)(?!none\b|transparent\b|currentColor\b|url\()[^;]+/gi, `$1${target}`);
      next = next.replace(/(stroke\s*:\s*)(?!none\b|transparent\b|currentColor\b|url\()[^;]+/gi, `$1${target}`);
      el.setAttribute("style", next);
    }
  });
  const hasFill = [root, ...root.querySelectorAll("*")].some(el => el.hasAttribute("fill"));
  const hasStroke = [root, ...root.querySelectorAll("*")].some(el => el.hasAttribute("stroke"));
  if (!hasFill && !hasStroke) root.setAttribute("fill", target);
}

function applySize(root, mode) {
  if (mode === "original") return;
  if (mode === "1em") { root.setAttribute("width", "1em"); root.setAttribute("height", "1em"); }
  else { root.setAttribute("width", "24"); root.setAttribute("height", "24"); }
}

function applyStroke(root, width) {
  if (width == null) return;
  let touched = false;
  [root, ...root.querySelectorAll("*")].forEach(el => {
    const stroke = el.getAttribute("stroke");
    if (stroke && stroke.trim().toLowerCase() !== "none") {
      el.setAttribute("stroke-width", String(width)); touched = true;
    }
  });
  if (!touched && root.getAttribute("stroke") && root.getAttribute("stroke") !== "none") root.setAttribute("stroke-width", String(width));
}

function serializeSvg(root) {
  if (!root.hasAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(root).replace(/></g, ">\n<");
}

function analyzeSvg(root) {
  const nodes = [root, ...root.querySelectorAll("*")];
  const fills = nodes.map(el => el.getAttribute("fill")).filter(Boolean);
  const strokes = nodes.map(el => el.getAttribute("stroke")).filter(v => v && v.toLowerCase() !== "none");
  const widths = nodes.map(el => el.getAttribute("stroke-width")).filter(Boolean).map(Number).filter(Number.isFinite);
  const paths = root.querySelectorAll("path").length;
  const viewBox = root.getAttribute("viewBox") || "sem viewBox";
  const usesCurrent = [...fills, ...strokes].some(v => v.toLowerCase() === "currentcolor");
  const hasMultiColor = new Set([...fills, ...strokes].filter(isSolidPaint).map(v => v.toLowerCase())).size > 1;
  return { fills, strokes, widths, paths, viewBox, usesCurrent, hasMultiColor, hasStroke: strokes.length > 0 };
}

function getRadio(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value; }
function setRadio(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function buildFinal() {
  const parsed = parseSvg(els.svg.value);
  if (!parsed.ok) return { ok: false, error: parsed.error, output: "", analysis: null };
  const analysis = analyzeSvg(parsed.root);
  const root = sanitize(parsed.root, els.cleanup.checked);
  applyPaint(root, getRadio("colorMode"), els.fixedColor.value);
  applySize(root, getRadio("sizeMode"));
  applyStroke(root, strokeOverride);
  return { ok: true, output: serializeSvg(root), analysis, root };
}

function updateEditor() {
  const result = buildFinal();
  els.preview.style.color = els.previewColor.value;
  if (!result.ok) {
    els.preview.innerHTML = "";
    els.previewStatus.textContent = result.error;
    els.output.textContent = "";
    els.analysisChips.innerHTML = "";
    els.analysisText.textContent = "Cole um SVG válido para ver a análise.";
    els.strokeControls.hidden = true;
    return;
  }
  els.preview.innerHTML = result.output;
  els.previewStatus.textContent = "Pré-visualização da versão final que será copiada.";
  els.output.textContent = result.output;
  const a = result.analysis;
  els.analysisChips.innerHTML = [
    `${a.paths} path${a.paths === 1 ? "" : "s"}`,
    a.hasStroke ? "Com stroke" : "Preenchido",
    a.usesCurrent ? "Já usa currentColor" : "Cor própria",
    a.hasMultiColor ? "Multicor" : "Monocor"
  ].map(x => `<span>${x}</span>`).join("");
  els.analysisText.textContent = `viewBox: ${a.viewBox}. ${a.hasStroke ? "O peso do traço pode ser ajustado." : "Este SVG não usa stroke; alterar “peso” automaticamente poderia deformar o desenho, então esse controle fica desativado."}`;
  els.strokeControls.hidden = !a.hasStroke;
  if (a.hasStroke && strokeOverride == null) {
    originalStrokeWidth = a.widths[0] || 1.5;
    els.strokeInput.value = String(Math.min(4, Math.max(.5, originalStrokeWidth)));
    els.strokeOutput.value = String(originalStrokeWidth);
  }
}

function previewMarkup(svg) {
  const parsed = parseSvg(svg);
  if (!parsed.ok) return "";
  const root = sanitize(parsed.root, true);
  root.setAttribute("width", "62"); root.setAttribute("height", "62");
  return serializeSvg(root);
}

function render() {
  const q = els.search.value.trim().toLocaleLowerCase("pt-BR");
  const filtered = items.filter(item => item.name.toLocaleLowerCase("pt-BR").includes(q));
  els.grid.innerHTML = "";
  filtered.forEach(item => {
    const node = els.template.content.cloneNode(true);
    const article = node.querySelector(".symbol-card");
    const main = node.querySelector(".symbol-main");
    const copy = node.querySelector(".copy-button");
    node.querySelector(".card-preview").innerHTML = previewMarkup(item.finalSvg || item.originalSvg);
    node.querySelector("h2").textContent = item.name;
    node.querySelector(".card-meta").textContent = item.options?.colorMode === "currentColor" ? "currentColor" : "SVG";
    main.addEventListener("click", () => openEditor(item.id));
    copy.addEventListener("click", async (e) => {
      e.stopPropagation();
      try { await copyText(item.finalSvg || item.originalSvg); copy.querySelector("span").textContent = "Copiado"; showToast(`“${item.name}” copiado`); setTimeout(() => copy.querySelector("span").textContent = "Copiar", 1200); }
      catch { showToast("Não foi possível copiar"); }
    });
    article.dataset.id = item.id;
    els.grid.appendChild(node);
  });
  els.count.textContent = `${items.length} ${items.length === 1 ? "símbolo" : "símbolos"}`;
  els.empty.hidden = items.length !== 0;
  els.noResults.hidden = !(items.length > 0 && filtered.length === 0);
  els.grid.hidden = filtered.length === 0;
  els.clearSearch.style.display = q ? "grid" : "none";
}

function resetEditor() {
  editingId = null; strokeOverride = null; originalStrokeWidth = 1.5;
  els.editorTitle.textContent = "Novo símbolo";
  els.name.value = ""; els.svg.value = ""; els.fixedColor.value = "#111111"; els.previewColor.value = "#111111"; els.cleanup.checked = true;
  setRadio("colorMode", "currentColor"); setRadio("sizeMode", "24");
  els.deleteSymbol.hidden = true; els.strokeControls.hidden = true; els.output.textContent = ""; els.preview.innerHTML = "";
  updateEditor();
}

function openEditor(id = null) {
  resetEditor();
  if (id) {
    const item = items.find(x => x.id === id); if (!item) return;
    editingId = id; els.editorTitle.textContent = item.name; els.name.value = item.name; els.svg.value = item.originalSvg;
    setRadio("colorMode", item.options?.colorMode || "currentColor"); setRadio("sizeMode", item.options?.sizeMode || "24");
    els.fixedColor.value = item.options?.fixedColor || "#111111"; els.cleanup.checked = item.options?.cleanup !== false;
    strokeOverride = item.options?.strokeOverride ?? null; els.deleteSymbol.hidden = false;
  }
  updateEditor();
  els.editor.showModal(); document.body.classList.add("dialog-open");
}

function closeEditor() { els.editor.close(); document.body.classList.remove("dialog-open"); }

function saveCurrent() {
  const name = els.name.value.trim();
  if (!name) { els.name.focus(); showToast("Dê um título ao símbolo"); return; }
  const result = buildFinal();
  if (!result.ok) { els.svg.focus(); showToast(result.error); return; }
  const now = new Date().toISOString();
  const data = {
    id: editingId || uid(), name, originalSvg: els.svg.value.trim(), finalSvg: result.output,
    options: { colorMode: getRadio("colorMode"), sizeMode: getRadio("sizeMode"), fixedColor: els.fixedColor.value, cleanup: els.cleanup.checked, strokeOverride },
    createdAt: editingId ? (items.find(x => x.id === editingId)?.createdAt || now) : now, updatedAt: now
  };
  if (editingId) items = items.map(x => x.id === editingId ? data : x); else items.unshift(data);
  persist(); render(); closeEditor(); showToast(editingId ? "Símbolo atualizado" : "Símbolo adicionado");
}

async function pasteSvg() {
  try {
    if (!navigator.clipboard?.readText) throw new Error("unsupported");
    const text = await navigator.clipboard.readText();
    els.svg.value = text; updateEditor();
  } catch { showToast("Cole o SVG manualmente neste campo"); els.svg.focus(); }
}

function exportLibrary() {
  const data = JSON.stringify({ app: "Simbolos", version: 1, exportedAt: new Date().toISOString(), symbols: items }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `simbolos-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); els.libraryMenu.hidden = true;
}

function importLibrary(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result)); const incoming = Array.isArray(data) ? data : data.symbols;
      if (!Array.isArray(incoming)) throw new Error();
      const valid = incoming.filter(x => x && typeof x.name === "string" && typeof x.originalSvg === "string");
      const byId = new Map(items.map(x => [x.id, x])); valid.forEach(x => byId.set(x.id || uid(), { ...x, id: x.id || uid() }));
      items = [...byId.values()]; persist(); render(); showToast(`${valid.length} símbolo${valid.length === 1 ? "" : "s"} importado${valid.length === 1 ? "" : "s"}`);
    } catch { showToast("Backup inválido"); }
    els.importFile.value = "";
  };
  reader.readAsText(file);
}

els.add.addEventListener("click", () => openEditor());
els.emptyAdd.addEventListener("click", () => openEditor());
els.cancel.addEventListener("click", closeEditor);
els.save.addEventListener("click", saveCurrent);
els.svg.addEventListener("input", updateEditor);
els.previewColor.addEventListener("input", updateEditor);
els.fixedColor.addEventListener("input", updateEditor);
els.cleanup.addEventListener("change", updateEditor);
document.querySelectorAll('input[name="colorMode"],input[name="sizeMode"]').forEach(x => x.addEventListener("change", updateEditor));
els.strokeInput.addEventListener("input", () => { strokeOverride = Number(els.strokeInput.value); els.strokeOutput.value = String(strokeOverride); updateEditor(); });
els.restoreStroke.addEventListener("click", () => { strokeOverride = null; els.strokeInput.value = String(Math.min(4, Math.max(.5, originalStrokeWidth))); els.strokeOutput.value = String(originalStrokeWidth); updateEditor(); });
els.paste.addEventListener("click", pasteSvg);
els.format.addEventListener("click", () => { const parsed = parseSvg(els.svg.value); if (!parsed.ok) return showToast(parsed.error); els.svg.value = serializeSvg(parsed.root); updateEditor(); });
els.copyOutput.addEventListener("click", async () => { const result = buildFinal(); if (!result.ok) return showToast(result.error); try { await copyText(result.output); showToast("Código SVG copiado"); } catch { showToast("Não foi possível copiar"); } });
els.deleteSymbol.addEventListener("click", () => { if (!editingId) return; const item = items.find(x => x.id === editingId); if (!confirm(`Excluir “${item?.name || "este símbolo"}”?`)) return; items = items.filter(x => x.id !== editingId); persist(); render(); closeEditor(); showToast("Símbolo excluído"); });
els.search.addEventListener("input", render);
els.clearSearch.addEventListener("click", () => { els.search.value = ""; els.search.focus(); render(); });
els.libraryButton.addEventListener("click", e => { e.stopPropagation(); els.libraryMenu.hidden = !els.libraryMenu.hidden; });
document.addEventListener("click", e => { if (!els.libraryMenu.hidden && !els.libraryMenu.contains(e.target)) els.libraryMenu.hidden = true; });
els.exportButton.addEventListener("click", exportLibrary);
els.importButton.addEventListener("click", () => { els.libraryMenu.hidden = true; els.importFile.click(); });
els.importFile.addEventListener("change", () => { const file = els.importFile.files?.[0]; if (file) importLibrary(file); });
els.aboutStorage.addEventListener("click", () => { els.libraryMenu.hidden = true; els.info.showModal(); });
els.closeInfo.addEventListener("click", () => els.info.close());
els.editor.addEventListener("cancel", e => { e.preventDefault(); closeEditor(); });

render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
