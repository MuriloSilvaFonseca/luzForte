const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

test('produto limita quantidade ao estoque e desabilita controles sem estoque', async () => {
  const input = { value: '1' }
  const aviso = { textContent: '' }
  const menos = {}, mais = {}, comprar = {}, adicionar = {}
  let chamadas = 0
  const contexto = vm.createContext({
    window: { adicionarProdutoCarrinho: async () => { chamadas++ } },
    document: {
      getElementById: id => id === 'quantity' ? input : id === 'mensagemEstoqueProduto' ? aviso : null,
      querySelector: seletor => seletor.includes('decrement') ? menos : mais,
      querySelectorAll: () => [comprar, adicionar], addEventListener() {}
    }
  })
  vm.runInContext(fs.readFileSync('public/js/pages/produto.js', 'utf8'), contexto)
  vm.runInContext('produtoAtual = { sku: 1, estoqueDisponivel: 3 }; atualizarControlesQuantidade()', contexto)
  assert.equal(input.max, 3)
  assert.equal(menos.disabled, true)
  contexto.incrementQuantity()
  contexto.incrementQuantity()
  contexto.incrementQuantity()
  assert.equal(Number(input.value), 3)
  assert.equal(mais.disabled, true)
  assert.equal(aviso.textContent, 'Não há mais unidades disponíveis em estoque para este produto.')
  input.value = '4'
  contexto.atualizarControlesQuantidade()
  assert.equal(Number(input.value), 3)
  contexto.decrementQuantity()
  assert.equal(mais.disabled, false)
  assert.equal(aviso.textContent, '')
  contexto.window.adicionarProdutoCarrinho = async () => { throw new Error('Não há mais unidades disponíveis em estoque para este produto.') }
  assert.equal(await contexto.addToCart(), false)
  assert.equal(aviso.textContent, 'Não há mais unidades disponíveis em estoque para este produto.')
  assert.equal(Number(input.value), 2)
  vm.runInContext('produtoAtual.estoqueDisponivel = 0; atualizarControlesQuantidade()', contexto)
  assert.equal(input.disabled, true)
  assert.equal(comprar.disabled, true)
  assert.equal(adicionar.disabled, true)
  assert.equal(aviso.textContent, 'Produto esgotado no momento.')
  assert.equal(await contexto.addToCart(), false)
  assert.equal(chamadas, 0)
})
