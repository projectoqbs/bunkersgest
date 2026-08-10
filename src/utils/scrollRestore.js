/**
 * Sistema global de restauración de scroll.
 *
 * Cualquier div con data-scroll-key="clave-unica" guarda y restaura su
 * posición de scroll automáticamente cuando se monta/desmonta.
 *
 * Uso:
 *   <div data-scroll-key="mi-tabla" style={{overflow:"auto"}}>...</div>
 *
 * Para iniciar: llamar initScrollRestore() una vez al montar la app.
 */

const store = new Map();

function restoreEl(el) {
  const key = el.dataset?.scrollKey;
  if (!key) return;
  const saved = store.get(key);
  if (!saved) return;
  requestAnimationFrame(() => {
    el.scrollTop  = saved.top;
    el.scrollLeft = saved.left;
  });
}

export function initScrollRestore() {
  // Guardar posición al hacer scroll
  document.addEventListener("scroll", (e) => {
    const key = e.target?.dataset?.scrollKey;
    if (!key) return;
    store.set(key, { top: e.target.scrollTop, left: e.target.scrollLeft });
  }, { capture: true, passive: true });

  // Restaurar cuando un elemento con data-scroll-key aparece en el DOM
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.dataset?.scrollKey) restoreEl(node);
        node.querySelectorAll?.("[data-scroll-key]").forEach(restoreEl);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
