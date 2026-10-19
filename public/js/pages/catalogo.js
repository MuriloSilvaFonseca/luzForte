// Produtos reais e botões do catálogo.
const escaparTexto = valor => String(valor).replace(/[&<>"']/g, caractere => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[caractere]));

function exibirProdutos(produtos) {
  const lista = document.getElementById('productsGrid');
  lista.replaceChildren();
  produtos.forEach(produto => {
    const card = document.createElement('div');
    card.className = 'product-card';
    const [reais, centavos] = Number(produto.preco_produto).toFixed(2).split('.');
    const nome = escaparTexto(produto.titulo_produto);
    card.innerHTML = `
      <a href="/produto?id=${produto.sku}"><img src="${escaparTexto(window.imagemProdutoSegura(produto.imagem))}" alt="${nome}"></a>
      <div class="product-info">
        <p class="product-name"><a href="/produto?id=${produto.sku}">${nome}</a></p>
        <h3>R$ ${reais}<span>,${centavos}</span></h3>
        <button type="button" class="btn-cart" data-id="${produto.sku}">Adicionar ao carrinho</button>
      </div>
    `;
    card.querySelector('img').addEventListener('error', evento => {
      evento.target.src = '/img/icons/icons8-caixa-128.png';
    }, { once: true });
    lista.appendChild(card);
  });
  if (!produtos.length) lista.textContent = 'Nenhum produto encontrado.';
}

async function adicionarPeloCatalogo(evento) {
  const botao = evento.target.closest('.btn-cart');
  if (botao) await window.adicionarPeloBotao(botao, botao.dataset.id);
}

async function carregarProdutosReais() {
  const lista = document.getElementById('productsGrid');
  lista.textContent = 'Carregando produtos...';
  try {
    const resposta = await fetch('/api/produtos' + window.location.search);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro);
    exibirProdutos(dados.produtos);
    document.querySelector('.prod-count').textContent = 'Produtos encontrados (' + dados.produtos.length + ')';
    document.querySelector('.title-bar h1').textContent = 'Produtos';
  } catch (erro) {
    lista.textContent = erro.message || 'Erro ao carregar produtos.';
  }
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

// ── Init ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  carregarProdutosReais();

  document
    .getElementById("productsGrid")
    .addEventListener("click", adicionarPeloCatalogo);

  initAccordions();
});
