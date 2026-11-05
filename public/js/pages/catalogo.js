// Produtos reais e botões do catálogo.
const escaparTexto = valor => String(valor).replace(/[&<>"']/g, caractere => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[caractere]));

// ── Filtros ativos ──────────────────────────────────────────────
const ROTULOS_FILTROS = { q: 'Busca', categoria: 'Categoria', subcategoria: 'Subcategoria', marca: 'Marca' };

// Nome que aparece na etiqueta. Categoria e subcategoria são <select>; marca é radio.
function nomeDoFiltro(chave, valor) {
  if (chave === 'q') return valor;
  const opcao = document.querySelector(`select[name="${chave}"] option[value="${CSS.escape(valor)}"]`);
  if (opcao) return opcao.textContent.trim();
  const marcado = document.querySelector(`input[name="${chave}"]:checked`);
  if (marcado && marcado.value) return marcado.closest('label').textContent.trim();
  return valor;
}

// Lê os filtros da URL (categoria, subcategoria e marca chegam como id)
function obterFiltrosAtivos() {
  const params = new URLSearchParams(window.location.search);
  return Object.keys(ROTULOS_FILTROS).flatMap(chave => {
    const valor = (params.get(chave) || '').trim();
    if (!valor) return [];
    return [{ chave, rotulo: ROTULOS_FILTROS[chave], nome: nomeDoFiltro(chave, valor) }];
  });
}

// Mesma URL sem os filtros pedidos (a ordenação é mantida).
function urlSemFiltros(chaves) {
  const params = new URLSearchParams(window.location.search);
  chaves.forEach(chave => params.delete(chave));
  const consulta = params.toString();
  return window.location.pathname + (consulta ? '?' + consulta : '');
}

function exibirFiltrosAtivos() {
  const area = document.getElementById('filtrosAtivos');
  if (!area) return;
  const ativos = obterFiltrosAtivos();
  area.replaceChildren();
  area.hidden = !ativos.length;
  ativos.forEach(filtro => {
    const etiqueta = document.createElement('span');
    etiqueta.className = 'filtro-chip';

    const texto = document.createElement('span');
    texto.textContent = `${filtro.rotulo}: ${filtro.nome}`;

    const remover = document.createElement('a');
    remover.className = 'filtro-chip-remover';
    remover.href = urlSemFiltros(filtro.chave === 'categoria' ? ['categoria', 'subcategoria'] : [filtro.chave]);
    remover.textContent = '✕';
    remover.setAttribute('aria-label', `Remover filtro ${filtro.rotulo}: ${filtro.nome}`);

    etiqueta.append(texto, remover);
    area.appendChild(etiqueta);
  });
  if (ativos.length > 1) {
    const limpar = document.createElement('a');
    limpar.className = 'filtros-limpar-tudo';
    limpar.href = urlSemFiltros(Object.keys(ROTULOS_FILTROS));
    limpar.textContent = 'Limpar tudo';
    area.appendChild(limpar);
  }
}

function criarMensagemSemResultado() {
  const busca = (new URLSearchParams(window.location.search).get('q') || '').trim();
  const temFiltro = obterFiltrosAtivos().length > 0;

  const caixa = document.createElement('div');
  caixa.className = 'sem-resultados';

  const mensagem = document.createElement('p');
  mensagem.textContent = busca
    ? `Nenhum produto encontrado para '${busca}'`
    : temFiltro
      ? 'Nenhum produto encontrado com os filtros selecionados.'
      : 'Nenhum produto encontrado.';
  caixa.appendChild(mensagem);

  if (temFiltro) {
    const limpar = document.createElement('a');
    limpar.className = 'btn-limpar-filtros';
    limpar.href = urlSemFiltros(Object.keys(ROTULOS_FILTROS));
    limpar.textContent = 'Limpar filtros';
    caixa.appendChild(limpar);
  }
  return caixa;
}

function exibirProdutos(produtos) {
  const lista = document.getElementById('productsGrid');
  lista.replaceChildren();
  produtos.forEach(produto => {
    const card = document.createElement('div');
    card.className = 'product-card';
    const [reais, centavos] = Number(produto.preco_produto).toFixed(2).split('.');
    const nome = escaparTexto(produto.titulo_produto);
    // Produto sem estoque: botão desabilitado, igual à home
    const esgotado = Number(produto.estoque_produto) <= 0;
    const botao = esgotado
      ? '<button type="button" class="btn-cart" disabled>Esgotado</button>'
      : `<button type="button" class="btn-cart" data-id="${produto.sku}">Adicionar ao carrinho</button>`;
    card.innerHTML = `
      <a href="/produto?id=${produto.sku}"><img src="${escaparTexto(window.imagemProdutoSegura(produto.imagem))}" alt="${nome}" loading="lazy"></a>
      <div class="product-info">
        <p class="product-name"><a href="/produto?id=${produto.sku}">${nome}</a></p>
        <h3>R$ ${reais}<span>,${centavos}</span></h3>
        ${botao}
      </div>
    `;
    card.querySelector('img').addEventListener('error', evento => {
      evento.target.src = '/img/icons/icons8-caixa-128.png';
    }, { once: true });
    lista.appendChild(card);
  });
  if (!produtos.length) lista.appendChild(criarMensagemSemResultado());
}

async function adicionarPeloCatalogo(evento) {
  const botao = evento.target.closest('.btn-cart');
  if (botao && !botao.disabled) await window.adicionarPeloBotao(botao, botao.dataset.id);
}

async function carregarProdutosReais() {
  const lista = document.getElementById('productsGrid');
  lista.textContent = 'Carregando produtos...';
  try {
    const resposta = await fetch('/api/produtos' + window.location.search);
    const dados = await resposta.json().catch(() => ({ erro: 'Não foi possível carregar os produtos. Tente novamente.' }));
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
}

// ── Init ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  carregarProdutosReais();

  document
    .getElementById("productsGrid")
    .addEventListener("click", adicionarPeloCatalogo);

  initAccordions();
  exibirFiltrosAtivos();
});