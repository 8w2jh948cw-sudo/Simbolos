(() => {
  const button = document.getElementById("pasteTitleButton");
  const input = document.getElementById("nameInput");
  if (!button || !input) return;

  button.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error("clipboard-unavailable");
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        showToast("A área de transferência está vazia");
        return;
      }
      input.value = text.slice(0, 80);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      showToast("Título colado");
    } catch {
      input.focus();
      showToast("Use Colar no campo de título");
    }
  });
})();