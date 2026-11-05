const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

// DOM e API simulados: nenhum acesso ao MySQL.
class Elemento {
  constructor() { this.children = []; this.dataset = {}; this.eventos = {}; this.textContent = ''; this.checked = false }
  addEventListener(nome, acao) { (this.eventos[nome] ||= []).push(acao) }
  setAttribute(nome, valor) { this[nome] = valor }
  appendChild(elemento) { this.children.push(elemento) }
  replaceChildren() { this.children = [] }
  async emitir(nome, evento = {}) { for (const acao of this.eventos[nome] || []) await acao(evento) }
}

test('página do carrinho: R$ 3,90, seleção, quantidade, remoção e contador', async () => {
  let itens = [{ produto_sku: 1004, titulo_produto: 'Cabo de teste', quantidade: 1, preco_unitario: '3.90', subtotal: '3.90', estoque_produto: 2, ativo: 'ativo' }]
  let confirmar = false
  let falhar = false
  let esperarDelete
  const modais = []
  const chamadas = []
  const ids = Object.fromEntries(['mensagemCarrinho', 'itensCarrinho', 'checkTodos', 'avisoSelecaoCarrinho', 'carrinhoVazio', 'esvaziarCarrinho'].map(id => [id, new Elemento()]))
  const seletores = Object.fromEntries(['.labelResumo', '.valorResumo', '.valorTotal', '.cart-badge', '.botaoCarrinhoFinalizar button'].map(seletor => [seletor, new Elemento()]))
  ids.modeloItemCarrinho = { content: { cloneNode() {
    const card = new Elemento()
    const partes = Object.fromEntries(['.nomeProduto', '.badgeCategoria', '.qtyValor', '.precoAtual', '.precoUn', '.precoOff', 'img', '.checkCarrinho input', '.btnDel', '.avisoEstoqueCarrinho', '.btnQty[onclick*="-1"]', '.btnQty[onclick="mudarQty(this, 1)"]'].map(seletor => [seletor, new Elemento()]))
    card.querySelector = seletor => partes[seletor]
    return { querySelector: () => card }
  } } }
  const documento = new Elemento()
  documento.getElementById = id => ids[id]
  documento.querySelector = seletor => seletores[seletor]
  documento.querySelectorAll = seletor => seletor === '.cart-badge' ? [seletores[seletor]] : []
  documento.createElement = () => new Elemento()
  const contexto = vm.createContext({
    window: { location: {}, Swal: { fire: async opcoes => { modais.push(opcoes); return { isConfirmed: confirmar } } } }, document: documento,
    fetch: async (url, opcoes) => {
      chamadas.push({ url, metodo: opcoes.method })
      if (falhar) return { ok: false, json: async () => ({ erro: 'Falha ao esvaziar. Tente novamente.' }) }
      if (opcoes.method === 'DELETE' && esperarDelete) await esperarDelete
      if (opcoes.method === 'PATCH') {
        itens[0].quantidade = JSON.parse(opcoes.body).quantidade
        itens[0].subtotal = (3.90 * itens[0].quantidade).toFixed(2)
      }
      if (opcoes.method === 'DELETE') itens = []
      return { ok: true, json: async () => ({ status: 'carrinho', itens: structuredClone(itens) }) }
    }
  })
  vm.runInContext(fs.readFileSync('public/js/modules/carrinho-api.js', 'utf8'), contexto)
  vm.runInContext(fs.readFileSync('public/js/pages/carrinho-integrado.js', 'utf8'), contexto)
  await documento.emitir('DOMContentLoaded')
  const cardAtual = () => ids.itensCarrinho.children[0].querySelector('.produtos')
  assert.ok(seletores['.valorTotal'].textContent.includes('3,90'))
  assert.equal(Number(seletores['.cart-badge'].textContent), 1)
  assert.equal(ids.esvaziarCarrinho.hidden, false)
  let checkbox = cardAtual().querySelector('.checkCarrinho input')
  checkbox.checked = false
  await checkbox.emitir('change')
  assert.ok(seletores['.valorTotal'].textContent.includes('0,00'))
  assert.ok(ids.avisoSelecaoCarrinho.textContent.includes('Nenhum produto selecionado'))
  assert.equal(Number(seletores['.cart-badge'].textContent), 1)
  ids.checkTodos.checked = true
  await ids.checkTodos.emitir('change', { target: ids.checkTodos })
  assert.ok(cardAtual().querySelector('.checkCarrinho input').checked)
  assert.ok(seletores['.valorTotal'].textContent.includes('3,90'))
  const botaoMais = { closest: () => cardAtual() }
  await contexto.mudarQty(botaoMais, 1)
  assert.ok(seletores['.valorTotal'].textContent.includes('7,80'))
  assert.equal(Number(seletores['.cart-badge'].textContent), 2)
  assert.equal(cardAtual().querySelector('.btnQty[onclick="mudarQty(this, 1)"]').disabled, true)
  assert.equal(cardAtual().querySelector('.avisoEstoqueCarrinho').textContent, 'Não há mais unidades disponíveis em estoque para este produto.')
  await contexto.mudarQty(botaoMais, 1)
  assert.equal(chamadas.filter(c => c.metodo === 'PATCH').length, 1)
  await cardAtual().querySelector('.btnDel').emitir('click')
  assert.equal(chamadas.filter(c => c.metodo === 'DELETE').length, 0)
  assert.equal(Number(seletores['.cart-badge'].textContent), 2)
  confirmar = true
  await cardAtual().querySelector('.btnDel').emitir('click')
  assert.ok(chamadas.some(chamada => chamada.metodo === 'DELETE' && chamada.url === '/api/carrinho/itens/1004'))
  assert.equal(ids.itensCarrinho.children.length, 0)
  assert.equal(Number(seletores['.cart-badge'].textContent), 0)
  assert.ok(seletores['.valorTotal'].textContent.includes('0,00'))
  assert.equal(ids.carrinhoVazio.hidden, false)
  assert.equal(ids.esvaziarCarrinho.hidden, true)
  const primeiroItem = { produto_sku: 1004, titulo_produto: 'Cabo', quantidade: 2, preco_unitario: '3.90', subtotal: '7.80', estoque_produto: 2, ativo: 'ativo' }
  itens = [primeiroItem, { ...primeiroItem, produto_sku: 1005, quantidade: 1, subtotal: '3.90', estoque_produto: 0 }]
  contexto.resultadoTeste = await contexto.window.carrinhoApi()
  vm.runInContext('selecionadosCarrinho.add(1004); exibirCarrinho(resultadoTeste)', contexto)
  const segundoCard = ids.itensCarrinho.children[2].querySelector('.produtos')
  assert.equal(segundoCard.querySelector('.checkCarrinho input').checked, false)
  assert.equal(segundoCard.querySelector('.avisoEstoqueCarrinho').textContent, 'Produto esgotado no momento.')
  assert.equal(segundoCard.querySelector('.btnQty[onclick*="-1"]').disabled, true)
  confirmar = false
  const deletesAntes = chamadas.filter(c => c.metodo === 'DELETE').length
  await ids.esvaziarCarrinho.emitir('click')
  assert.equal(chamadas.filter(c => c.metodo === 'DELETE').length, deletesAntes)
  assert.equal(itens.length, 2)
  assert.equal(modais.at(-1).text, 'Deseja realmente esvaziar seu carrinho? Todos os produtos serão removidos.')
  assert.equal(modais.at(-1).cancelButtonText, 'Cancelar')
  assert.equal(modais.at(-1).confirmButtonText, 'Sim, esvaziar')
  confirmar = true
  falhar = true
  await ids.esvaziarCarrinho.emitir('click')
  assert.equal(itens.length, 2)
  assert.equal(ids.itensCarrinho.children.length, 4)
  assert.equal(Number(seletores['.cart-badge'].textContent), 3)
  assert.equal(ids.esvaziarCarrinho.disabled, false)
  assert.equal(ids.mensagemCarrinho.textContent, 'Falha ao esvaziar. Tente novamente.')
  falhar = false
  let liberarDelete
  esperarDelete = new Promise(resolve => { liberarDelete = resolve })
  const esvaziando = ids.esvaziarCarrinho.emitir('click')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(ids.esvaziarCarrinho.disabled, true)
  const modaisAntes = modais.length
  await ids.esvaziarCarrinho.emitir('click')
  assert.equal(modais.length, modaisAntes)
  liberarDelete()
  await esvaziando
  assert.equal(itens.length, 0)
  assert.equal(ids.esvaziarCarrinho.hidden, true)
  assert.equal(ids.carrinhoVazio.hidden, false)
  assert.equal(Number(seletores['.cart-badge'].textContent), 0)
  assert.ok(seletores['.valorTotal'].textContent.includes('0,00'))
  assert.ok(chamadas.some(c => c.metodo === 'DELETE' && c.url === '/api/carrinho/itens'))
  vm.runInContext(`
    itensCarrinho = [
      { produto_sku: 1, quantidade: 2, preco_unitario: '3.90', subtotal: '7.80' },
      { produto_sku: 2, quantidade: 1, preco_unitario: '10.00', subtotal: '10.00' }
    ];
    selecionadosCarrinho.clear();
    selecionadosCarrinho.add(1);
    atualizarResumoCarrinho();
  `, contexto)
  assert.ok(seletores['.valorTotal'].textContent.includes('7,80'))
  assert.equal(seletores['.botaoCarrinhoFinalizar button'].disabled, false)
  await seletores['.botaoCarrinhoFinalizar button'].emitir('click')
  assert.equal(contexto.window.location.href, '/checkout?itens=1')
  contexto.window.location.href = ''
  vm.runInContext('selecionadosCarrinho.clear(); atualizarResumoCarrinho()', contexto)
  assert.equal(seletores['.botaoCarrinhoFinalizar button'].disabled, true)
  await seletores['.botaoCarrinhoFinalizar button'].emitir('click')
  assert.equal(contexto.window.location.href, '')
  const template = fs.readFileSync('views/loja/carrinho.ejs', 'utf8')
  assert.match(template, /class="btnDel">[\s\S]*?<span>Remover<\/span>/)
  assert.ok(template.includes('Desmarcar não remove'))
  assert.equal((template.match(/sweetalert2@11\.14\.5/g) || []).length, 1)
})
