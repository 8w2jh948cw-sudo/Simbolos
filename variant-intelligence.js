(() => {
  const TYPE_LABELS = new Set(["padrão", "preenchido", "contorno", "misto", "preenchido em camadas", "svg"]);

  function styleValue(el, property) {
    const style = el.getAttribute("style") || "";
    const match = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
    return match ? match[1].trim() : null;
  }

  function inheritedPaint(el, property, fallback) {
    let current = el;
    while (current && current.nodeType === 1) {
      const styled = styleValue(current, property);
      if (styled != null) return styled;
      if (current.hasAttribute(property)) return current.getAttribute(property).trim();
      current = current.parentElement;
    }
    return fallback;
  }

  function isVisiblePaint(value) {
    const v = String(value || "").trim().toLowerCase();
    return !!v && !["none", "transparent", "initial", "unset"].includes(v);
  }

  function detectFromTitle(title) {
    const value = String(title || "").toLowerCase();
    if (/(^|[._\-\s])(fill|filled|solid)([._\-\s]|$)/.test(value)) return "Preenchido";
    if (/(^|[._\-\s])(outline|outlined|stroke|line)([._\-\s]|$)/.test(value)) return "Contorno";
    if (/(duotone|two[._\-\s]?tone|two[._\-\s]?color)/.test(value)) return "Preenchido em camadas";
    return null;
  }

  function detectVariantType(svgCode, title) {
    const parsed = parseSvg(svgCode);
    if (!parsed.ok) return { type: detectFromTitle(title) || "SVG", source: detectFromTitle(title) ? "nome" : "indefinido" };

    const root = parsed.root;
    const graphics = [...root.querySelectorAll("path,rect,circle,ellipse,polygon,polyline,line")];
    let hasFill = false;
    let hasStroke = false;
    let layeredFill = false;

    graphics.forEach(el => {
      const tag = el.localName.toLowerCase();
      const fill = inheritedPaint(el, "fill", "black");
      const stroke = inheritedPaint(el, "stroke", "none");
      if (tag !== "line" && isVisiblePaint(fill)) hasFill = true;
      if (isVisiblePaint(stroke)) hasStroke = true;

      const opacity = Number(el.getAttribute("fill-opacity") || styleValue(el, "fill-opacity"));
      if (Number.isFinite(opacity) && opacity > 0 && opacity < 1 && isVisiblePaint(fill)) layeredFill = true;
    });

    if (hasFill && hasStroke) return { type: "Misto", source: "código" };
    if (hasStroke) return { type: "Contorno", source: "código" };
    if (hasFill) {
      const titleHint = detectFromTitle(title);
      if (layeredFill || titleHint === "Preenchido em camadas") return { type: "Preenchido em camadas", source: layeredFill ? "código" : "nome" };
      return { type: "Preenchido", source: "código" };
    }

    const titleHint = detectFromTitle(title);
    return { type: titleHint || "SVG", source: titleHint ? "nome" : "indefinido" };
  }

  function isAutoLabel(label) {
    const value = String(label || "").trim().toLocaleLowerCase("pt-BR");
    return TYPE_LABELS.has(value) || /^versão\s+\d+$/i.test(value) || value === "sem nome" || value === "";
  }

  function ensureTypeHint() {
    if (document.getElementById("variantTypeHint")) return;
    const hint = document.createElement("div");
    hint.id = "variantTypeHint";
    hint.className = "variant-type-hint";
    hint.innerHTML = `<span>Tipo detectado</span><strong id="variantTypeValue">—</strong><small id="variantTypeSource"></small>`;
    els.variantLabel.insertAdjacentElement("afterend", hint);
  }

  function updateVariantType({ autoRename = true } = {}) {
    if (!draft || !currentVariant()) return;
    ensureTypeHint();
    const detection = detectVariantType(els.svg.value, els.name.value);
    document.getElementById("variantTypeValue").textContent = detection.type;
    document.getElementById("variantTypeSource").textContent = detection.source === "código" ? "identificado pelo SVG" : detection.source === "nome" ? "identificado pelo título" : "classificação genérica";

    if (autoRename && isAutoLabel(els.variantLabel.value) && detection.type !== "SVG") {
      els.variantLabel.value = detection.type;
      const variant = currentVariant();
      if (variant) {
        variant.label = detection.type;
        renderVariantTabs();
        els.previewVariantName.textContent = detection.type;
      }
    }
  }

  function matchingFamily() {
    if (!draft) return null;
    const name = String(els.name.value || "").trim().toLocaleLowerCase("pt-BR");
    if (!name) return null;
    return items.find(item => item.id !== draft.id && item.name.trim().toLocaleLowerCase("pt-BR") === name) || null;
  }

  function isNewDraft() {
    return !!draft && !items.some(item => item.id === draft.id);
  }

  function mergeIntoFamily() {
    const target = matchingFamily();
    if (!target || !draft) return;

    const validation = validateDraft();
    if (!validation.ok) {
      validation.focus?.focus();
      showToast(validation.error);
      return;
    }

    const existingCodes = new Set(target.variants.map(v => String(v.originalSvg || "").trim()));
    const incoming = draft.variants.filter(v => !existingCodes.has(String(v.originalSvg || "").trim()));
    if (!incoming.length) {
      showToast("Esse código SVG já existe nesta família");
      return;
    }

    incoming.forEach(variant => {
      const copy = clone(variant);
      copy.id = uid();
      if (isAutoLabel(copy.label)) copy.label = detectVariantType(copy.originalSvg, target.name).type;
      target.variants.push(copy);
    });
    target.updatedAt = new Date().toISOString();
    persist();
    render();
    document.getElementById("duplicateConfirmDialog")?.close();
    closeEditor();
    showToast(`${incoming.length} versão${incoming.length === 1 ? "" : "ões"} adicionada${incoming.length === 1 ? "" : "s"} a “${target.name}”`);
  }

  function ensureFamilyActions() {
    const warningCopy = document.querySelector(".duplicate-warning-copy");
    if (warningCopy && !document.getElementById("addToFamilyInline")) {
      const button = document.createElement("button");
      button.id = "addToFamilyInline";
      button.type = "button";
      button.className = "add-to-family-button";
      button.textContent = "Adicionar como nova versão";
      button.addEventListener("click", mergeIntoFamily);
      warningCopy.appendChild(button);
    }

    const actions = document.querySelector(".duplicate-dialog-actions");
    if (actions && !document.getElementById("addToFamilyDialog")) {
      const button = document.createElement("button");
      button.id = "addToFamilyDialog";
      button.type = "button";
      button.className = "add-to-family-button dialog-family-button";
      button.textContent = "Adicionar à família existente";
      button.addEventListener("click", mergeIntoFamily);
      actions.insertBefore(button, actions.lastElementChild);
    }
  }

  function updateFamilyActions() {
    ensureFamilyActions();
    const visible = isNewDraft() && !!matchingFamily();
    const inline = document.getElementById("addToFamilyInline");
    const dialog = document.getElementById("addToFamilyDialog");
    if (inline) inline.hidden = !visible;
    if (dialog) dialog.hidden = !visible;
  }

  function clarifyImportantActions() {
    els.paste.innerHTML = `<span aria-hidden="true">⤓</span> Colar código SVG`;
    els.copyOutput.textContent = "Copiar código SVG";
    document.querySelectorAll(".copy-button span").forEach(span => {
      span.textContent = span.textContent.includes("▾") ? "Copiar código SVG ▾" : "Copiar código SVG";
    });
  }

  ensureTypeHint();
  ensureFamilyActions();
  clarifyImportantActions();

  els.svg.addEventListener("input", () => { updateVariantType(); updateFamilyActions(); });
  els.name.addEventListener("input", () => { updateVariantType({ autoRename: false }); updateFamilyActions(); });
  els.paste.addEventListener("click", () => setTimeout(() => { updateVariantType(); updateFamilyActions(); }, 100));
  els.format.addEventListener("click", () => setTimeout(() => updateVariantType(), 0));
  els.variantTabs.addEventListener("click", () => setTimeout(() => updateVariantType({ autoRename: false }), 0));
  els.addVariant.addEventListener("click", () => setTimeout(() => updateVariantType(), 0));

  const dialogObserver = new MutationObserver(() => updateFamilyActions());
  const duplicateDialog = document.getElementById("duplicateConfirmDialog");
  if (duplicateDialog) dialogObserver.observe(duplicateDialog, { attributes: true, attributeFilter: ["open"] });

  const originalOpenEditorForTypes = openEditor;
  openEditor = function(id = null) {
    originalOpenEditorForTypes(id);
    setTimeout(() => {
      updateVariantType({ autoRename: false });
      updateFamilyActions();
      clarifyImportantActions();
    }, 0);
  };

  const actionObserver = new MutationObserver(clarifyImportantActions);
  actionObserver.observe(els.grid, { childList: true, subtree: true });
})();