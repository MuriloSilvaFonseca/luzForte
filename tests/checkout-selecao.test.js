const test = require('node:test')
const assert = require('node:assert/strict')

let pedidos, itens, snapshot, falhar
const produto = (sku, quantidade, preco) => ({ pedido_id: 1, produto_sku: sku, quantidade, preco_unitario: preco, subtotal: '999.00', estoque_produto: 3, ativo: 'ativo', titulo_produto: 'Produto ' + sku })
function reiniciar() {
  pedidos = [{ id_pedido: 1, usuario_id: 7, status: 'carrinho', total: '999.00' }]
  itens = [produto(1001, 2, '3.90'), produto(1002, 1, '10.00')]
  falhar = false
}
const conexao = {
  async beginTransaction() { snapshot = structuredClone({ pedidos, itens }) },
  async commit() {},
  async rollback() { pedidos = snapshot.pedidos; itens = snapshot.itens },
  release() {},
  async execute(sql, args = []) {
    sql = sql.trim().replace(/\s+/g, ' ')
    if (sql.includes('GET_LOCK')) return [[{ obtida: 1 }]]
    if (sql.includes('RELEASE_LOCK')) return [[{ liberada: 1 }]]
    if (sql.startsWith('SELECT id_usuario')) return [[{ id_usuario: 7 }]]
    if (sql.startsWith('SELECT id_pedido')) return [pedidos.filter(p => p.usuario_id === args[0] && p.status === 'carrinho')]
    if (sql.startsWith('SELECT id_forma_pagamento')) return [[{ id_forma_pagamento: 1, nome_pagamento: 'Pix' }]]
    if (sql.startsWith('SELECT pp.')) return [itens.filter(i => i.pedido_id === args[0]).map(i => ({ ...i, subtotal: (Number(i.preco_unitario) * i.quantidade).toFixed(2) }))]
    if (sql.startsWith('INSERT INTO pedido')) {
      assert.ok(!pedidos.some(p => p.usuario_id === args[0] && p.status === 'carrinho'), 'Uma conta não pode ter dois carrinhos ativos')
      pedidos.push({ id_pedido: 2, usuario_id: args[0], status: 'carrinho' })
      return [{ insertId: 2 }]
    }
    if (sql.startsWith('UPDATE produto_pedido SET pedido_id')) {
      itens.find(i => i.pedido_id === args[1] && i.produto_sku === args[2]).pedido_id = args[0]
      return [{}]
    }
    // Grava o preço atual do produto no pedido (no simulado, preco_unitario já é o preço atual)
    if (sql.startsWith('UPDATE produto_pedido pp JOIN produto')) {
      for (const item of itens.filter(i => i.pedido_id === args[0])) item.subtotal = (Number(item.preco_unitario) * item.quantidade).toFixed(2)
      return [{}]
    }
    if (sql.startsWith('UPDATE pedido SET valor_produtos = (')) {
      pedidos.find(p => p.id_pedido === args[1]).total = itens.filter(i => i.pedido_id === args[0]).reduce((n, i) => n + i.quantidade * Number(i.preco_unitario), 0).toFixed(2)
      return [{}]
    }
    if (sql.startsWith('UPDATE pedido SET valor_produtos = ?')) {
      if (falhar) throw new Error('Falha simulada')
      Object.assign(pedidos.find(p => p.id_pedido === args[3]), { total: args[0], status: 'solicitado' })
      return [{}]
    }
    throw new Error('SQL não previsto: ' + sql)
  }
}
const caminho = require.resolve('../config/database')
require.cache[caminho] = { id: caminho, filename: caminho, loaded: true, exports: { promise: () => ({ execute: (...args) => conexao.execute(...args), getConnection: async () => conexao }) } }
const { carregarCheckout, finalizarPedido } = require('../services/pedido')

test('checkout usa somente os selecionados e recalcula valores do banco', async () => {
  reiniciar()
  const checkout = await carregarCheckout(7, [1001])
  assert.deepEqual(checkout.itens.map(i => i.produto_sku), [1001])
  assert.equal(checkout.total, '7.80')
  const resultado = await finalizarPedido(7, 1, [1001])
  assert.equal(resultado.total, '7.80')
  assert.equal(pedidos[0].status, 'solicitado')
  assert.equal(pedidos[1].status, 'carrinho')
  assert.equal(pedidos[1].total, '10.00')
  assert.equal(itens.find(i => i.produto_sku === 1002).pedido_id, 2)
  assert.equal(itens.find(i => i.produto_sku === 1002).quantidade, 1)
  assert.equal(itens.find(i => i.produto_sku === 1001).subtotal, '7.80')
  await assert.rejects(finalizarPedido(7, 1, [1001]), { status: 409 })
})

test('checkout rejeita seleção vazia, inválida, repetida ou de outro carrinho', async () => {
  reiniciar()
  for (const selecao of [undefined, [], [0], [-1], [1.5], ['1001'], [1001, 1001], [9999]]) {
    await assert.rejects(carregarCheckout(7, selecao))
    await assert.rejects(finalizarPedido(7, 1, selecao))
  }
  await assert.rejects(finalizarPedido(8, 1, [1001]), { status: 404 })
  assert.equal(pedidos.length, 1)
  assert.ok(itens.every(i => i.pedido_id === 1))
})

test('checkout revalida estoque e disponibilidade na confirmação', async () => {
  for (const alteracao of [{ estoque_produto: 1 }, { estoque_produto: 0 }, { ativo: 'oculto' }]) {
    reiniciar()
    await carregarCheckout(7, [1001])
    Object.assign(itens[0], alteracao)
    await assert.rejects(finalizarPedido(7, 1, [1001]), { status: 409 })
    assert.equal(pedidos[0].status, 'carrinho')
  }
})

test('falha ao finalizar desfaz a separação; seleção completa não cria carrinho extra', async () => {
  reiniciar()
  falhar = true
  await assert.rejects(finalizarPedido(7, 1, [1001]), /Falha simulada/)
  assert.equal(pedidos.length, 1)
  assert.ok(itens.every(i => i.pedido_id === 1))
  falhar = false
  assert.equal((await finalizarPedido(7, 1, [1001, 1002])).total, '17.80')
  assert.equal(pedidos.length, 1)
})

test('rotas transportam a seleção do GET ao POST e ignoram valores enviados pelo cliente', async () => {
  reiniciar()
  const express = require('express')
  const app = express()
  app.use(express.urlencoded({ extended: false }))
  app.use((req, res, next) => {
    req.session = { usuario: { id_usuario: 7 } }
    res.render = (view, dados) => res.json({ view, ...dados })
    next()
  })
  app.use(require('../routes/loja'))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise(resolve => servidor.once('listening', resolve))
  const base = 'http://127.0.0.1:' + servidor.address().port
  try {
    assert.equal((await fetch(base + '/checkout')).status, 400)
    assert.equal((await fetch(base + '/checkout?itens=1001,1001')).status, 400)
    const resposta = await fetch(base + '/checkout?itens=1001')
    const dados = await resposta.json()
    assert.equal(dados.total, '7.80')
    assert.deepEqual(dados.itens.map(i => i.produto_sku), [1001])
    const finalizacao = await fetch(base + '/checkout', {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'itens=1001&forma_pagamento_id=1&total=0.01&quantidade=500&usuario_id=8'
    })
    assert.equal(finalizacao.status, 302)
    assert.equal(finalizacao.headers.get('location'), '/checkout?pedido=1')
    assert.equal(pedidos[0].total, '7.80')
    assert.equal(itens.find(i => i.produto_sku === 1002).pedido_id, 2)
  } finally {
    await new Promise(resolve => servidor.close(resolve))
  }
})
