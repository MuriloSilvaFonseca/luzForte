// Catálogo — busca os produtos do banco (Neon) via /api/produtos

const grid = document.getElementById("productsGrid");
const statusEl = document.getElementById("gridStatus");
const countEl = document.getElementById("prodCount");

// ── Helpers ─────────────────────────────────────────────────────
function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function formatarPreco(valor) {
  const n = Number(valor);
  if (Number.isNaN(n)) return null;
  const [reais, centavos] = n.toFixed(2).split(".");
  return { reais, centavos };
}

function formatarPrecoAntigo(valor) {
  const n = Number(valor);
  if (!valor || Number.isNaN(n)) return "";
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

// ── Renderiza os cards (mesmas classes do CSS atual) ────────────
function renderProducts(produtos) {
  grid.innerHTML = "";

  produtos.forEach((p) => {
    const preco = formatarPreco(p.preco);
    const antigo = formatarPrecoAntigo(p.preco_antigo);

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${escapeHtml(p.imagem || "/img/products/fios.png")}" alt="${escapeHtml(p.nome)}">
      <div class="product-info">
        <p class="product-name">${escapeHtml(p.nome)}</p>
        <span class="old-price">${antigo}</span>
        <h3>R$ ${preco ? preco.reais : "--"}<span>,${preco ? preco.centavos : "--"}</span></h3>
        <button data-id="${p.id}">Adicionar ao carrinho</button>
      </div>
    `;
    grid.appendChild(card);
  });

  countEl.textContent = `Produtos encontrados (${produtos.length})`;
}

// ── Busca no backend ────────────────────────────────────────────
async function carregarProdutos(ordem = "padrao") {
  statusEl.style.display = "block";
  statusEl.textContent = "Carregando...";
  statusEl.classList.remove("erro");

  try {
    const resp = await fetch(`/api/produtos?ordem=${encodeURIComponent(ordem)}`);
    if (!resp.ok) throw new Error(`Erro ${resp.status}`);

    const produtos = await resp.json();

    if (!produtos.length) {
      grid.innerHTML = "";
      countEl.textContent = "Produtos encontrados (0)";
      statusEl.textContent = "Nenhum produto cadastrado ainda.";
      return;
    }

    renderProducts(produtos);
    statusEl.style.display = "none";
  } catch (err) {
    console.error(err);
    grid.innerHTML = "";
    countEl.textContent = "Produtos encontrados (0)";
    statusEl.textContent = "Não foi possível carregar os produtos. Veja o terminal do servidor.";
    statusEl.classList.add("erro");
  }
}

// ── Carrinho (contador) ─────────────────────────────────────────
let cartCount = 0;

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = cartCount;
}

function handleAddToCart(e) {
  const btn = e.target.closest(".product-info button");
  if (!btn) return;
  cartCount++;
  updateCartBadge();

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
    title.addEventListener("click", () => title.classList.toggle("open"));
  });

  document.querySelectorAll(".marca-parent").forEach((parent) => {
    parent.addEventListener("click", () => parent.classList.toggle("open"));
  });
}

// ── Ordenação (agora refaz a busca no banco) ────────────────────
function initSort() {
  const sel = document.getElementById("sortSelect");
  if (!sel) return;
  sel.addEventListener("change", () => carregarProdutos(sel.value));
}

// ── Paginação (visual) ──────────────────────────────────────────
function initPagination() {
  document.querySelectorAll(".pg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.querySelector("svg")) return;
      document.querySelectorAll(".pg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

// ── Init ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  grid.addEventListener("click", handleAddToCart);
  initAccordions();
  initSort();
  initPagination();
  carregarProdutos(document.getElementById("sortSelect")?.value);
});