// Script do catálogo.
// Os produtos e os filtros agora vêm do servidor (rota /catalogo).
// Aqui fica só o comportamento visual: abrir/fechar os grupos de filtro.

function initAccordions() {
  document.querySelectorAll(".filter-title").forEach((title) => {
    title.addEventListener("click", () => {
      title.classList.toggle("open");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAccordions();
});
