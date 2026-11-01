// Produtos reais e botões do catálogo.
const escaparTexto = valor => String(valor).replace(/[&<>"']/g, caractere => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[caractere]));

// ── Filtros ativos ──────────────────────────────────────────────
const ROTULOS_FILTROS = { q: 'Busca', categoria: 'Categoria', marca: 'Marca' };

// Lê os filtros da URL. Categoria e marca chegam como id; o nome vem do radio marcado no EJS.
function obterFiltrosAtivos() {
  const params = new URLSearchParams(window.location.search);
  return Object.keys(ROTULOS_FILTROS).flatMap(chave => {
    const valor = (params.get(chave) || '').trim();
    if (!valor) return [];
    const marcado = chave === 'q' ? null : document.querySelector(`input[name="${chave}"]:checked`);
    const nome = marcado && marcado.value ? marcado.closest('label').textContent.trim() : valor;
    return [{ chave, rotulo: ROTULOS_FILTROS[chave], nome }];
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
    remover.href = urlSemFiltros([filtro.chave]);
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
    card.innerHTML = `
      <a href="/produto?id=${produto.sku}"><img src="${escaparTexto(window.imagemProdutoSegura(produto.imagem))}" alt="${nome}" loading="lazy"></a>
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
  if (!produtos.length) lista.appendChild(criarMensagemSemResultado());
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
  exibirFiltrosAtivos();
});