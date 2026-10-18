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
  let itens = [{ produto_sku: 1004, titulo_produto: 'Cabo de teste', quantidade: 1, preco_unitario: '3.90', subtotal: '3.90' }]
  const chamadas = []
  const ids = Object.fromEntries(['mensagemCarrinho', 'itensCarrinho', 'checkTodos', 'avisoSelecaoCarrinho'].map(id => [id, new Elemento()]))
  const seletores = Object.fromEntries(['.labelResumo', '.valorResumo', '.descontoValor', '.valorTotal', '.cupomDesconto .botaoCarrinho', '.cart-badge'].map(seletor => [seletor, new Elemento()]))
  ids.modeloItemCarrinho = { content: { cloneNode() {
    const card = new Elemento()
    const partes = Object.fromEntries(['.nomeProduto', '.badgeCategoria', '.qtyValor', '.precoAtual', '.precoUn', '.precoOff', 'img', '.checkCarrinho input', '.btnDel'].map(seletor => [seletor, new Elemento()]))
    card.querySelector = seletor => partes[seletor]
    return { querySelector: () => card }
  } } }
  const documento = new Elemento()
  documento.getElementById = id => ids[id]
  documento.querySelector = seletor => seletores[seletor]
  documento.querySelectorAll = seletor => seletor === '.cart-badge' ? [seletores[seletor]] : []
  documento.createElement = () => new Elemento()
  const contexto = vm.createContext({
    window: {}, document: documento,
    fetch: async (url, opcoes) => {
      chamadas.push({ url, metodo: opcoes.method })
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
  await cardAtual().querySelector('.btnDel').emitir('click')
  assert.ok(chamadas.some(chamada => chamada.metodo === 'DELETE' && chamada.url === '/api/carrinho/itens/1004'))
  assert.equal(ids.itensCarrinho.children.length, 0)
  assert.equal(Number(seletores['.cart-badge'].textContent), 0)
  assert.ok(seletores['.valorTotal'].textContent.includes('0,00'))
  assert.equal(ids.mensagemCarrinho.textContent, 'Seu carrinho está vazio.')
  const template = fs.readFileSync('views/loja/carrinho.ejs', 'utf8')
  assert.match(template, /class="btnDel">[\s\S]*?<span>Remover<\/span>/)
  assert.ok(template.includes('Desmarcar não remove'))
})
