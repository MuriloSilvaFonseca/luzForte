let itensCarrinho = []
let carrinhoOcupado = false
let confirmandoRemocao = false
const selecionadosCarrinho = new Set()
const reaisCarrinho = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function mensagemCarrinho(texto) {
  document.getElementById('mensagemCarrinho').textContent = texto
}
function atualizarResumoCarrinho() {
  const itens = itensCarrinho.filter(item => selecionadosCarrinho.has(item.produto_sku))
  const centavos = itens.reduce((total, item) => total + Math.round(Number(item.subtotal) * 100), 0)
  document.querySelector('.labelResumo').textContent = `Subtotal (${itens.reduce((n, item) => n + item.quantidade, 0)} itens):`
  document.querySelector('.valorResumo').textContent = reaisCarrinho(centavos / 100)
  document.querySelector('.valorTotal').textContent = reaisCarrinho(centavos / 100)
  document.getElementById('avisoSelecaoCarrinho').textContent = itensCarrinho.length && !itens.length
    ? 'Nenhum produto selecionado. Selecione ao menos um produto para continuar.'
    : ''
  document.querySelector('.botaoCarrinhoFinalizar button').disabled = !itens.length || carrinhoOcupado || confirmandoRemocao
  const esvaziar = document.getElementById('esvaziarCarrinho')
  esvaziar.hidden = itensCarrinho.length === 0
  esvaziar.disabled = carrinhoOcupado || confirmandoRemocao
  const todos = document.getElementById('checkTodos')
  todos.checked = itensCarrinho.length > 0 && itens.length === itensCarrinho.length
  todos.indeterminate = itens.length > 0 && itens.length < itensCarrinho.length
}
function criarItemCarrinho(item, modelo) {
  const fragmento = modelo.content.cloneNode(true)
  const card = fragmento.querySelector('.produtos')
  card.dataset.sku = item.produto_sku
  card.querySelector('.nomeProduto').textContent = item.titulo_produto
  card.querySelector('.badgeCategoria').textContent = item.subcategoria || ''
  card.querySelector('.qtyValor').textContent = item.quantidade
  card.querySelector('.precoAtual').textContent = reaisCarrinho(item.subtotal)
  card.querySelector('.precoUn').textContent = reaisCarrinho(item.preco_unitario) + ' /un'
  card.querySelector('.precoOff').hidden = true
  const imagem = card.querySelector('img')
  imagem.alt = item.titulo_produto
  imagem.src = window.imagemProdutoSegura(item.imagem)
  imagem.addEventListener('error', () => { imagem.src = '/img/icons/icons8-caixa-128.png' }, { once: true })
  const checkbox = card.querySelector('.checkCarrinho input')
  checkbox.id = 'produto-' + item.produto_sku
  checkbox.checked = selecionadosCarrinho.has(item.produto_sku)
  checkbox.setAttribute('aria-label', 'Selecionar ' + item.titulo_produto)
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selecionadosCarrinho.add(item.produto_sku)
    else selecionadosCarrinho.delete(item.produto_sku)
    atualizarResumoCarrinho()
  })
  card.querySelector('.btnDel').setAttribute('aria-label', 'Remover ' + item.titulo_produto)
  card.querySelector('.btnDel').addEventListener('click', () => removerItemCarrinho(item.produto_sku))
  const menos = card.querySelector('.btnQty[onclick*="-1"]')
  const mais = card.querySelector('.btnQty[onclick="mudarQty(this, 1)"]')
  if (menos) menos.disabled = item.quantidade <= 1
  if (mais) mais.disabled = item.ativo !== 'ativo' || item.quantidade >= Number(item.estoque_produto)
  if (menos && Number(item.estoque_produto) === 0) menos.disabled = true
  const aviso = card.querySelector('.avisoEstoqueCarrinho')
  if (Number(item.estoque_produto) === 0) aviso.textContent = 'Produto esgotado no momento.'
  else if (item.quantidade >= Number(item.estoque_produto)) aviso.textContent = 'Não há mais unidades disponíveis em estoque para este produto.'
  return fragmento
}

function exibirCarrinho(resultado) {
  itensCarrinho = resultado.itens
  for (const sku of selecionadosCarrinho) {
    if (!itensCarrinho.some(item => item.produto_sku === sku)) selecionadosCarrinho.delete(sku)
  }
  const container = document.getElementById('itensCarrinho')
  container.replaceChildren()
  const modelo = document.getElementById('modeloItemCarrinho')
  itensCarrinho.forEach(item => {
    container.appendChild(criarItemCarrinho(item, modelo))
    const linha = document.createElement('hr')
    linha.className = 'linhaSeparadora'
    container.appendChild(linha)
  })
  // Carrinho vazio: mostra o bloco com o botão "Ver produtos" em vez da frase solta
  mensagemCarrinho('')
  document.getElementById('carrinhoVazio').hidden = itensCarrinho.length > 0
  atualizarResumoCarrinho()
}
async function confirmarRemocao(texto, confirmButtonText) {
  if (carrinhoOcupado || confirmandoRemocao) return false
  confirmandoRemocao = true
  atualizarResumoCarrinho()
  try {
    if (window.Swal) {
      const resposta = await window.Swal.fire({ icon: 'question', text: texto, showCancelButton: true, cancelButtonText: 'Cancelar', confirmButtonText })
      return resposta.isConfirmed
    }
    return window.confirm(texto)
  } catch (_) {
    mensagemCarrinho('Não foi possível abrir a confirmação. Tente novamente.')
    return false
  } finally {
    confirmandoRemocao = false
    atualizarResumoCarrinho()
  }
}
async function removerItemCarrinho(sku) {
  const confirmado = await confirmarRemocao('Deseja realmente remover este produto do carrinho?', 'Sim, remover')
  if (confirmado) return modificarCarrinho('/itens/' + sku, 'DELETE')
}
async function esvaziarCarrinho() {
  if (!itensCarrinho.length) return
  const confirmado = await confirmarRemocao('Deseja realmente esvaziar seu carrinho? Todos os produtos serão removidos.', 'Sim, esvaziar')
  if (confirmado) return modificarCarrinho('/itens', 'DELETE')
}
async function modificarCarrinho(caminho, metodo, dados) {
  if (carrinhoOcupado || confirmandoRemocao) return
  carrinhoOcupado = true
  atualizarResumoCarrinho()
  try {
    exibirCarrinho(await window.carrinhoApi(caminho, metodo, dados))
  } catch (erro) { mensagemCarrinho(erro.message) }
  finally { carrinhoOcupado = false; atualizarResumoCarrinho() }
}
function mudarQty(botao, delta) {
  const sku = Number(botao.closest('.produtos').dataset.sku)
  const item = itensCarrinho.find(item => item.produto_sku === sku)
  if (!item || item.quantidade + delta < 1 || (delta > 0 && (item.ativo !== 'ativo' || item.quantidade + delta > Number(item.estoque_produto)))) return
  return modificarCarrinho('/itens/' + sku, 'PATCH', { quantidade: item.quantidade + delta })
}
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('esvaziarCarrinho').addEventListener('click', esvaziarCarrinho)
  document.getElementById('checkTodos').addEventListener('change', evento => {
    itensCarrinho.forEach(item => {
      if (evento.target.checked) selecionadosCarrinho.add(item.produto_sku)
      else selecionadosCarrinho.delete(item.produto_sku)
    })
    exibirCarrinho({ itens: itensCarrinho })
  })
  document.querySelector('.botaoCarrinhoFinalizar button').addEventListener('click', () => {
    if (carrinhoOcupado || confirmandoRemocao) return
    const skus = itensCarrinho.filter(item => selecionadosCarrinho.has(item.produto_sku)).map(item => item.produto_sku)
    if (!skus.length) return mensagemCarrinho('Nenhum produto selecionado.')
    window.location.href = '/checkout?itens=' + encodeURIComponent(skus.join(','))
  })
  try {
    const resultado = await window.carrinhoApi()
    resultado.itens.forEach(item => selecionadosCarrinho.add(item.produto_sku))
    exibirCarrinho(resultado)
  } catch (erro) { mensagemCarrinho(erro.message) }
})
