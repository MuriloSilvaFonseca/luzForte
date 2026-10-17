let itensCarrinho = []
let carrinhoOcupado = false
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
  document.querySelector('.descontoValor').textContent = reaisCarrinho(0)
  document.querySelector('.valorTotal').textContent = reaisCarrinho(centavos / 100)
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
  card.querySelector('.btnDel').addEventListener('click', () => modificarCarrinho('/itens/' + item.produto_sku, 'DELETE'))
  return fragmento
}

function exibirCarrinho(resultado) {
  itensCarrinho = resultado.itens
  const container = document.getElementById('itensCarrinho')
  container.replaceChildren()
  const modelo = document.getElementById('modeloItemCarrinho')
  itensCarrinho.forEach(item => {
    container.appendChild(criarItemCarrinho(item, modelo))
    const linha = document.createElement('hr')
    linha.className = 'linhaSeparadora'
    container.appendChild(linha)
  })
  mensagemCarrinho(itensCarrinho.length ? '' : 'Seu carrinho está vazio.')
  atualizarResumoCarrinho()
}
async function modificarCarrinho(caminho, metodo, dados) {
  if (carrinhoOcupado) return
  carrinhoOcupado = true
  try {
    exibirCarrinho(await window.carrinhoApi(caminho, metodo, dados))
  } catch (erro) { mensagemCarrinho(erro.message) }
  finally { carrinhoOcupado = false }
}
function mudarQty(botao, delta) {
  const sku = Number(botao.closest('.produtos').dataset.sku)
  const item = itensCarrinho.find(item => item.produto_sku === sku)
  if (!item || item.quantidade + delta < 1) return
  return modificarCarrinho('/itens/' + sku, 'PATCH', { quantidade: item.quantidade + delta })
}
function toggleFav(botao) {
  const ativo = botao.dataset.ativo === 'true'
  botao.dataset.ativo = String(!ativo)
  botao.querySelector('i').className = ativo ? 'ti ti-heart' : 'ti ti-heart-filled'
}
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('checkTodos').addEventListener('change', evento => {
    itensCarrinho.forEach(item => {
      if (evento.target.checked) selecionadosCarrinho.add(item.produto_sku)
      else selecionadosCarrinho.delete(item.produto_sku)
    })
    exibirCarrinho({ itens: itensCarrinho })
  })
  document.querySelector('.cupomDesconto .botaoCarrinho').addEventListener('click', () => {
    mensagemCarrinho('Cupons ainda não estão disponíveis. Os valores exibidos são os registrados no carrinho.')
  })
  try {
    const resultado = await window.carrinhoApi()
    resultado.itens.forEach(item => selecionadosCarrinho.add(item.produto_sku))
    exibirCarrinho(resultado)
  } catch (erro) { mensagemCarrinho(erro.message) }
})
