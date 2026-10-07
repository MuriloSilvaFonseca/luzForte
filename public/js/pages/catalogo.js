// Catalogo Script
/* ══════════════════════════════════════
   LUZ FORTE — main.js
   ══════════════════════════════════════ */

// ── Dados dos produtos ──────────────────────────────────────────
const products = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: "Fio Elétrico Cabo Flexível 1 via 1,50mm Azul",
  oldPrice: "R$ 99,99",
  price: "49",
  cents: "99",
  stars: 0,
}));

// ── Gera SVG do cabo azul (coil) ────────────────────────────────
function buildCableSVG() {
  return `
  <svg width="130" height="115" viewBox="0 0 130 115" xmlns="http://www.w3.org/2000/svg">
    <!-- sombra base -->
    <ellipse cx="65" cy="100" rx="44" ry="8" fill="#00000022"/>

    <!-- anéis do carretel — de baixo para cima -->
    <ellipse cx="65" cy="92" rx="46" ry="12" fill="#0d3d8a"/>
    <ellipse cx="65" cy="84" rx="46" ry="12" fill="#1048a2"/>
    <ellipse cx="65" cy="76" rx="46" ry="12" fill="#1250b0"/>
    <ellipse cx="65" cy="68" rx="46" ry="12" fill="#1558bc"/>
    <ellipse cx="65" cy="60" rx="46" ry="12" fill="#1760c8"/>
    <ellipse cx="65" cy="52" rx="46" ry="12" fill="#1a68d0"/>
    <ellipse cx="65" cy="44" rx="46" ry="12" fill="#1c70d8"/>
    <ellipse cx="65" cy="36" rx="46" ry="12" fill="#1e78e0"/>
    <ellipse cx="65" cy="28" rx="46" ry="12" fill="#2080e8"/>

    <!-- divisórias / ranhuras entre anéis -->
    <ellipse cx="65" cy="92" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>
    <ellipse cx="65" cy="84" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>
    <ellipse cx="65" cy="76" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>
    <ellipse cx="65" cy="68" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>
    <ellipse cx="65" cy="60" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>
    <ellipse cx="65" cy="52" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>
    <ellipse cx="65" cy="44" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>
    <ellipse cx="65" cy="36" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>
    <ellipse cx="65" cy="28" rx="46" ry="12" fill="none" stroke="#0a2f70" stroke-width="1"/>

    <!-- buraco do centro (topo) -->
    <ellipse cx="65" cy="28" rx="18" ry="5" fill="#0a2560"/>
    <ellipse cx="65" cy="28" rx="14" ry="4" fill="#071840"/>

    <!-- reflexo lateral esquerdo -->
    <ellipse cx="30" cy="55" rx="6" ry="28" fill="#ffffff18"/>

    <!-- ponta de cobre (conector) -->
    <rect x="107" y="50" width="16" height="9" rx="2.5" fill="#b8730a"/>
    <rect x="109" y="52" width="11" height="5" rx="1.5" fill="#e8a020"/>
    <rect x="108" y="51" width="1.5" height="7" rx="1" fill="#c8860d"/>

    <!-- reflexo brilho no topo -->
    <ellipse cx="50" cy="24" rx="12" ry="3.5" fill="#ffffff22"/>
  </svg>`.trim();
}

// ── Renderiza os cards de produto ───────────────────────────────
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.innerHTML = "";

  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const starsHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="s${i < p.stars ? " on" : ""}">★</span>`
    ).join("");

    card.innerHTML = `
      <div class="cable-svg">${buildCableSVG()}</div>
      <p class="prod-name">${p.name}</p>
      <div class="prod-stars">${starsHTML}</div>
      <div class="prod-old">${p.oldPrice}</div>
      <div class="prod-price">
        <sup>R$</sup>${p.price}<sub>,${p.cents}</sub>
      </div>
      <button class="btn-cart" data-id="${p.id}">Adicionar ao carrinho</button>
    `;

    grid.appendChild(card);
  });
}

// ── Carrinho (contador) ─────────────────────────────────────────
let cartCount = 3;

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = cartCount;
}

function handleAddToCart(e) {
  const btn = e.target.closest(".btn-cart, .product-info button");
  if (!btn) return;
  cartCount++;
  updateCartBadge();

  // Feedback visual no botão
  const original = btn.textContent;
  btn.textContent = "✓ Adicionado!";
  btn.style.background = "#1a7a3a";
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = "";
  }, 1200);
}

// ── Filtros (accordions) ────────────────────────────────────────
function initAccordions() {
  document.querySelectorAll(".filter-title").forEach((title) => {
    title.addEventListener("click", () => {
      title.classList.toggle("open");
    });
  });

  document.querySelectorAll(".marca-parent").forEach((parent) => {
    parent.addEventListener("click", () => {
      parent.classList.toggle("open");
    });
  });
}

// ── Ordenação (UI apenas) ───────────────────────────────────────
function initSort() {
  const sel = document.getElementById("sortSelect");
  if (!sel) return;
  sel.addEventListener("change", () => {
    // Aqui você conectaria ao backend para reordenar
    console.log("Ordenar por:", sel.value);
  });
}

// ── Paginação ───────────────────────────────────────────────────
function initPagination() {
  document.querySelectorAll(".pg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pg-btn").forEach((b) => b.classList.remove("active"));
      if (!btn.querySelector("svg")) btn.classList.add("active");
    });
  });
}

// ── Init ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();

  document
    .getElementById("productsGrid")
    .addEventListener("click", handleAddToCart);

  initAccordions();
  initSort();
  initPagination();
});