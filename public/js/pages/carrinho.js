// =============================================
// PRODUTOS — edite aqui para testar
// =============================================
// Quando integrar o JSON, substitua esse array
// pelo retorno da sua requisição fetch/axios

const produtos = [
  {
    id:         'prod1',
    nome:       'Disjuntor Tripolar WEG 30a Curva C',
    precoUn:    3.45,    // preço unitário — vem do JSON
    quantidade: 1,      // quantidade — vem do JSON
    desconto:   25,      // percentual de desconto (0 = sem desconto) — vem do JSON
  },
  {
    id:         'prod2',
    nome:       'Disjuntor Tripolar WEG 30a Curva C',
    precoUn:    66.92,
    quantidade: 5,
    desconto:   0,
  },
  {
    id:         'prod3',
    nome:       'Disjuntor Tripolar WEG 30a Curva C',
    precoUn:    1.45,
    quantidade: 3,
    desconto:   2,
  },
];

// =============================================
// CUPONS VÁLIDOS — edite para adicionar/remover
// =============================================

const cuponsValidos = {
  'LUZFORTE10': 10,
  'DESCONTO20': 20,
  'PROMO5':      5,
};

// =============================================
// ESTADO INTERNO — não mexa aqui
// =============================================

let cupomAtivo = null;

// =============================================
// UTILITÁRIO
// =============================================

function formatarReais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Retorna só os produtos cujo checkbox está marcado
function produtosSelecionados() {
  return produtos.filter(p => {
    const checkbox = document.getElementById(p.id);
    return checkbox?.checked;
  });
}

// =============================================
// RESUMO — calcula apenas os produtos selecionados
// =============================================

function atualizarResumo() {
  const selecionados = produtosSelecionados();

  const subtotal   = selecionados.reduce((acc, p) => acc + p.precoUn * p.quantidade, 0);
  const totalItens = selecionados.reduce((acc, p) => acc + p.quantidade, 0);

  const descontoCupom = cupomAtivo
    ? subtotal * (cupomAtivo.percentual / 100)
    : 0;

  const total = subtotal - descontoCupom;

  const labelsResumo  = document.querySelectorAll('.labelResumo');
  const valoresResumo = document.querySelectorAll('.valorResumo');

  if (labelsResumo[0])  labelsResumo[0].textContent  = `Subtotal (${totalItens} itens):`;
  if (valoresResumo[0]) valoresResumo[0].textContent  = formatarReais(subtotal);

  const elDesconto = document.querySelector('.descontoValor');
  if (elDesconto) elDesconto.textContent = descontoCupom > 0
    ? `- ${formatarReais(descontoCupom)}`
    : 'R$ 0,00';

  const elTotal = document.querySelector('.valorTotal');
  if (elTotal) elTotal.textContent = formatarReais(total);
}

// =============================================
// BADGES DE DESCONTO POR PRODUTO
// =============================================

function atualizarBadgesProduto() {
  document.querySelectorAll('.produtos').forEach(card => {
    const id      = card.querySelector('.checkCarrinho input')?.id;
    const produto = produtos.find(p => p.id === id);
    const badge   = card.querySelector('.precoOff');
    if (!badge || !produto) return;

    if (produto.desconto > 0) {
      badge.textContent   = `-${produto.desconto}% OFF`;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  });
}

// =============================================
// CHECKBOXES
// =============================================

function bindCheckboxes() {
  const checkTodos = document.getElementById('checkTodos');

  // "Todos os produtos" — marca/desmarca todos os individuais
  checkTodos.addEventListener('change', function () {
    document.querySelectorAll('.checkCarrinho input[type="checkbox"]')
      .forEach(cb => cb.checked = this.checked);
    atualizarResumo();
  });

  // Checkboxes individuais — atualiza o "Todos" e o resumo
  document.querySelectorAll('.checkCarrinho input[type="checkbox"]')
    .forEach(cb => {
      cb.addEventListener('change', function () {
        const todos  = document.querySelectorAll('.checkCarrinho input[type="checkbox"]');
        const marcados = [...todos].filter(c => c.checked);

        // "checkTodos" fica marcado só se todos estiverem marcados
        checkTodos.checked = marcados.length === todos.length;

        // indeterminate quando alguns estão marcados mas não todos
        checkTodos.indeterminate = marcados.length > 0 && marcados.length < todos.length;

        atualizarResumo();
      });
    });
}

// =============================================
// QUANTIDADE
// =============================================

function mudarQty(btn, delta) {
  const card    = btn.closest('.produtos');
  const id      = card.querySelector('.checkCarrinho input').id;
  const produto = produtos.find(p => p.id === id);
  if (!produto) return;

  produto.quantidade = Math.max(1, produto.quantidade + delta);
  const precoTotal = produto.precoUn * produto.quantidade;
  card.querySelector('.qtyValor').textContent   = produto.quantidade;
  card.querySelector('.precoAtual').textContent = formatarReais(precoTotal);
  atualizarResumo();
}

// =============================================
// FAVORITO
// =============================================

function toggleFav(btn) {
  const ativo = btn.dataset.ativo === 'true';
  btn.dataset.ativo = String(!ativo);
  btn.innerHTML = !ativo
    ? '<i class="ti ti-heart-filled" style="color:#1a6be8"></i>'
    : '<i class="ti ti-heart" style="color:#aaa"></i>';
}

// =============================================
// REMOVER PRODUTO
// =============================================

function bindRemoverProduto() {
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btnDel');
    if (!btn) return;

    const card = btn.closest('.produtos');
    const id   = card.querySelector('.checkCarrinho input').id;

    const idx = produtos.findIndex(p => p.id === id);
    if (idx !== -1) produtos.splice(idx, 1);

    const hrDepois = card.nextElementSibling;
    if (hrDepois?.classList.contains('linhaSeparadora')) hrDepois.remove();
    card.remove();

    // Atualiza o checkTodos após remoção
    const todos    = document.querySelectorAll('.checkCarrinho input[type="checkbox"]');
    const marcados = [...todos].filter(c => c.checked);
    const checkTodos = document.getElementById('checkTodos');
    checkTodos.checked       = todos.length > 0 && marcados.length === todos.length;
    checkTodos.indeterminate = marcados.length > 0 && marcados.length < todos.length;

    atualizarResumo();
  });
}

// =============================================
// CUPOM
// =============================================

function limparCupom() {
  const input = document.querySelector('.cupomDesconto input[type="text"]');
  if (input) input.style.borderColor = '';
  document.querySelector('.mensagemCupom')?.remove();
}

function mostrarMensagemCupom(texto, sucesso) {
  const input = document.querySelector('.cupomDesconto input[type="text"]');
  if (!input) return;

  const msg = document.createElement('p');
  msg.className   = `mensagemCupom ${sucesso ? 'sucessoCupom' : 'erroCupom'}`;
  msg.textContent = texto;
  input.insertAdjacentElement('afterend', msg);
}

function bindCupom() {
  const btnCupom = document.querySelector('.cupomDesconto .botaoCarrinho');
  if (!btnCupom) return;

  btnCupom.addEventListener('click', function () {
    const input  = document.querySelector('.cupomDesconto input[type="text"]');
    const codigo = input.value.trim().toUpperCase();

    limparCupom();

    if (!codigo) {
      mostrarMensagemCupom('Digite um cupom antes de aplicar.', false);
      input.style.borderColor = '#e24b4a';
      return;
    }

    if (cuponsValidos[codigo]) {
      cupomAtivo = { codigo, percentual: cuponsValidos[codigo] };
      input.style.borderColor = '#0fa050';
      mostrarMensagemCupom(`Cupom "${codigo}" aplicado! ${cupomAtivo.percentual}% de desconto.`, true);
    } else {
      cupomAtivo = null;
      input.style.borderColor = '#e24b4a';
      mostrarMensagemCupom('Cupom inválido.', false);
    }

    atualizarBadgesProduto();
    atualizarResumo();
  });
}

// =============================================
// INICIALIZAÇÃO
// =============================================

window.addEventListener('load', function () {
  inicializarCards();       // preenche qtd, preço total e preço unitário de cada card
  atualizarBadgesProduto(); // mostra/esconde badges de desconto
  atualizarResumo();        // resumo começa zerado pois nenhum checkbox está marcado
  bindCheckboxes();         // conecta checkboxes individuais e o "todos"
  bindCupom();              // conecta botão de cupom
  bindRemoverProduto();     // conecta botões de remover
});

function inicializarCards() {
  document.querySelectorAll('.produtos').forEach(card => {
    const id      = card.querySelector('.checkCarrinho input')?.id;
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    const precoTotal = produto.precoUn * produto.quantidade;
    card.querySelector('.qtyValor').textContent   = produto.quantidade;
    card.querySelector('.precoAtual').textContent = formatarReais(precoTotal);
    card.querySelector('.precoUn').textContent    = formatarReais(produto.precoUn) + ' /un';
  });
}