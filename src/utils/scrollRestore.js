/**
 * Restauración automática de scroll para todos los contenedores scrolleables.
 * No requiere atributos ni configuración en los componentes.
 *
 * Genera una clave estable por elemento usando su ruta en el DOM
 * (índices de nodos desde la raíz). Funciona para divs con overflow auto/scroll.
 */

const store = new Map();

function domKey(el) {
  // Usa data-scroll-key si existe (clave explícita, más estable)
  if (el.dataset?.scrollKey) return el.dataset.scrollKey;
  // Genera clave automática desde la ruta de índices en el DOM
  const path = [];
  let node = el;
  while (node && node !== document.body) {
    const parent = node.parentElement;
    if (!parent) break;
    const idx = Array.prototype.indexOf.call(parent.children, node);
    path.unshift(idx);
    node = parent;
  }
  return "auto:" + path.join("-");
}

function isScrollable(el) {
  if (el.nodeType !== 1) return false;
  const s = window.getComputedStyle(el);
  const ox = s.overflowX, oy = s.overflowY;
  return (ox === "auto" || ox === "scroll" || oy === "auto" || oy === "scroll");
}

function restoreEl(el) {
  if (!isScrollable(el)) return;
  const key = domKey(el);
  const saved = store.get(key);
  if (!saved) return;
  requestAnimationFrame(() => {
    el.scrollTop  = saved.top;
    el.scrollLeft = saved.left;
  });
}

export function initScrollRestore() {
  // Guardar posición en cualquier scroll de la página
  document.addEventListener("scroll", (e) => {
    const el = e.target;
    if (!isScrollable(el)) return;
    const key = domKey(el);
    store.set(key, { top: el.scrollTop, left: el.scrollLeft });
  }, { capture: true, passive: true });

  // Restaurar cuando cualquier elemento aparece en el DOM
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        restoreEl(node);
        node.querySelectorAll?.("*").forEach(child => restoreEl(child));
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
