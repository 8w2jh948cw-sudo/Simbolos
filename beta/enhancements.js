(() => {
  let allowDuplicateSave = false;

  const normalizeTitle = value => String(value || "").trim().toLocaleLowerCase("pt-BR");
  const normalizeSvg = value => String(value || "").trim();
  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);

  function collectDuplicates() {
    if (!draft) return { title: [], svg: [] };
    const titleValue = normalizeTitle(els.name.value);
    const svgValue = normalizeSvg(els.svg.value);
    const title = [];
    const svg = [];

    if (titleValue) {
      items.forEach(item => {
        if (item.id !== draft.id && normalizeTitle(item.name) === titleValue) title.push(item.name);
      });
    }

    if (svgValue) {
      items.forEach(item => {
        if (item.id === draft.id) return;
        item.variants.forEach(variant => {
          if (normalizeSvg(variant.originalSvg) === svgValue) svg.push(`${item.name} · ${variant.label}`);
        });
      });

      draft.variants.forEach(variant => {
        if (variant.id === activeVariantId) return;
        if (normalizeSvg(variant.originalSvg) === svgValue) {
          svg.push(`${els.name.value.trim() || draft.name || "Este símbolo"} · ${variant.label}`);
        }
      });
    }

    return { title: [...new Set(title)], svg: [...new Set(svg)] };
  }

  function messagesFor(duplicates) {
    const parts = [];
    if (duplicates.title.length) {
      parts.push(`<p><strong>Título já existente.</strong> Encontrado em ${duplicates.title.map(name => `“${escapeHtml(name)}”`).join(", ")}.</p>`);
    }
    if (duplicates.svg.length) {
      parts.push(`<p><strong>Código SVG já existente.</strong> Este mesmo código está salvo em ${duplicates.svg.map(name => `“${escapeHtml(name)}”`).join(", ")}.</p>`);
    }
    return parts;
  }

  function ensureDuplicateUI() {
    if (!document.getElementById("duplicateWarning")) {
      const warning = document.createElement("section");
      warning.id = "duplicateWarning";
      warning.className = "duplicate-warning";
      warning.hidden = true;
      warning.innerHTML = `<div class="duplicate-warning-icon" aria-hidden="true">!</div><div class="duplicate-warning-copy"><strong>Possível duplicata</strong><div id="duplicateWarningText"></div></div>`;
      document.querySelector(".sheet-scroll .form-card")?.after(warning);
    }

    if (!document.getElementById("duplicateConfirmDialog")) {
      const dialog = document.createElement("dialog");
      dialog.id = "duplicateConfirmDialog";
      dialog.className = "duplicate-dialog";
      dialog.innerHTML = `<div class="duplicate-dialog-card"><div class="duplicate-dialog-badge"><span aria-hidden="true">!</span> Duplicata encontrada</div><h2>Quer salvar mesmo assim?</h2><div id="duplicateConfirmText" class="duplicate-dialog-text"></div><div class="duplicate-dialog-actions"><button id="duplicateReviewButton" type="button" class="duplicate-review-button">Voltar e revisar</button><button id="duplicateSaveAnywayButton" type="button" class="duplicate-save-button">Salvar mesmo assim</button></div></div>`;
      document.body.appendChild(dialog);
      document.getElementById("duplicateReviewButton").addEventListener("click", () => dialog.close());
      document.getElementById("duplicateSaveAnywayButton").addEventListener("click", () => {
        dialog.close();
        allowDuplicateSave = true;
        saveDraft();
        allowDuplicateSave = false;
      });
      dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close(); });
    }
  }

  function updateDuplicateWarning() {
    ensureDuplicateUI();
    const warning = document.getElementById("duplicateWarning");
    const text = document.getElementById("duplicateWarningText");
    if (!warning || !text || !draft) return;
    const messages = messagesFor(collectDuplicates());
    warning.hidden = messages.length === 0;
    text.innerHTML = messages.join("") + (messages.length ? "<small>Você pode continuar, mas o app pedirá confirmação antes de salvar.</small>" : "");
  }

  function interceptDuplicateSave(event) {
    if (allowDuplicateSave || !draft) return;
    const duplicates = collectDuplicates();
    const messages = messagesFor(duplicates);
    if (!messages.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureDuplicateUI();
    document.getElementById("duplicateConfirmText").innerHTML = messages.join("") + "<p>Se for intencional, você pode manter a duplicata.</p>";
    document.getElementById("duplicateConfirmDialog").showModal();
  }

  function setEditorHeading() {
    if (!draft) return;
    els.editorTitle.textContent = items.some(item => item.id === draft.id) ? "Editar símbolo" : "Novo símbolo";
  }

  function clarifyCopyButtons() {
    document.querySelectorAll(".copy-button span").forEach(span => {
      const label = span.textContent.includes("▾") ? "Copiar código SVG ▾" : "Copiar código SVG";
      if (span.textContent !== label) span.textContent = label;
    });
    document.querySelectorAll("#copyVariantsList button > span:last-child").forEach(span => {
      if (span.textContent !== "Copiar código") span.textContent = "Copiar código";
    });
  }

  function loadVariantIntelligence() {
    if (!document.querySelector('link[data-symbol-intelligence="true"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "./intelligence.css";
      link.dataset.symbolIntelligence = "true";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-symbol-intelligence="true"]')) {
      const script = document.createElement("script");
      script.src = "./variant-intelligence.js";
      script.dataset.symbolIntelligence = "true";
      document.body.appendChild(script);
    }
  }

  ensureDuplicateUI();
  els.save.addEventListener("click", interceptDuplicateSave, true);
  els.name.addEventListener("input", updateDuplicateWarning);
  els.name.addEventListener("input", setEditorHeading);
  els.svg.addEventListener("input", updateDuplicateWarning);
  els.variantLabel.addEventListener("input", updateDuplicateWarning);
  els.variantTabs.addEventListener("click", () => setTimeout(updateDuplicateWarning, 0));
  els.addVariant.addEventListener("click", () => setTimeout(updateDuplicateWarning, 0));
  els.paste.addEventListener("click", () => setTimeout(updateDuplicateWarning, 80));
  els.format.addEventListener("click", () => setTimeout(updateDuplicateWarning, 0));
  els.copyDialog.addEventListener("click", () => setTimeout(clarifyCopyButtons, 0));

  const originalOpenEditor = openEditor;
  openEditor = function(id = null) {
    originalOpenEditor(id);
    setEditorHeading();
    setTimeout(updateDuplicateWarning, 0);
  };

  const gridObserver = new MutationObserver(clarifyCopyButtons);
  gridObserver.observe(els.grid, { childList: true, subtree: true });
  clarifyCopyButtons();
  loadVariantIntelligence();
})();
