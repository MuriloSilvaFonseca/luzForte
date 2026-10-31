const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const session = require('express-session')

// Banco simulado: nenhum teste deste arquivo conecta ao MySQL real.
let estoque = 100
let pedidos = []
let itens = []
let snapshot
let rollbackCount = 0
let released = 0
let failWrite = false
let falharTotais = false
let travaDisponivel = true
function pertenceAoProprietario(pedido, valor, sql) {
  return sql.includes('visitante_token_hash')
    ? pedido.usuario_id === null && pedido.visitante_token_hash === valor
    : pedido.usuario_id === valor
}
const connection = {
  async beginTransaction() { snapshot = structuredClone({ pedidos, itens }) },
  async commit() {},
  async rollback() { pedidos = snapshot.pedidos; itens = snapshot.itens; rollbackCount++ },
  release() { released++ },
  async execute(sql, args) {
    sql = sql.trim().replace(/\s+/g, ' ')
    if (sql.startsWith('SELECT GET_LOCK')) return [[{ obtida: travaDisponivel ? 1 : 0 }]]
    if (sql.startsWith('SELECT RELEASE_LOCK')) return [[{ liberada: 1 }]]
    if (failWrite && sql.startsWith('INSERT INTO produto_pedido')) throw new Error('informação sensível')
    if (sql.startsWith('SELECT id_usuario')) return [[{ id_usuario: args[0] }]]
    if (sql.startsWith('SELECT id_pedido')) return [pedidos.filter(p => pertenceAoProprietario(p, args[0], sql) && p.status === 'carrinho')]
    if (sql.startsWith('SELECT sku')) return [args[0] === 1001 ? [{ sku: 1001, preco_produto: '10.00', estoque_produto: estoque }] : []]
    if (sql.startsWith('INSERT INTO pedido')) {
      const id = pedidos.length + 1
      const visitante = sql.includes('visitante_token_hash')
      pedidos.push({ id_pedido: id, usuario_id: visitante ? null : args[0], visitante_token_hash: visitante ? args[0] : null, status: 'carrinho', total: '0.00', valor_produtos: '0.00' })
      return [{ insertId: id }]
    }
    if (sql.startsWith('SELECT quantidade')) return [itens.filter(i => i.pedido_id === args[0] && i.produto_sku === args[1])]
    if (sql.startsWith('INSERT INTO produto_pedido')) {
      itens.push({ pedido_id: args[0], produto_sku: args[1], quantidade: args[2], preco_unitario: args[3], subtotal: (args[4] * args[5]).toFixed(2) })
      return [{}]
    }
    if (sql.startsWith('UPDATE produto_pedido')) {
      const item = itens.find(i => i.pedido_id === args[2] && i.produto_sku === args[3])
      item.quantidade = args[0]; item.subtotal = (args[1] * item.preco_unitario).toFixed(2)
      return [{}]
    }
    if (sql.startsWith('DELETE FROM produto_pedido')) {
      itens = itens.filter(i => !(i.pedido_id === args[0] && (args.length === 1 || i.produto_sku === args[1])))
      return [{}]
    }
    if (sql.startsWith('UPDATE pedido')) {
      if (falharTotais) throw new Error('Falha simulada ao recalcular')
      const pedido = pedidos.find(p => p.id_pedido === args[1] && pertenceAoProprietario(p, args[2], sql) && p.status === 'carrinho')
      pedido.total = pedido.valor_produtos = itens.filter(i => i.pedido_id === args[0]).reduce((sum, i) => sum + Number(i.subtotal), 0).toFixed(2)
      return [{}]
    }
    if (sql.startsWith('SELECT pp.')) return [itens.filter(i => i.pedido_id === args[0]).map(i => ({ ...i, titulo_produto: 'Produto teste' }))]
    if (sql.startsWith('SELECT valor_produtos')) return [pedidos.filter(p => p.id_pedido === args[0] && pertenceAoProprietario(p, args[1], sql) && p.status === 'carrinho').map(p => ({ total: p.total, valor_produtos: p.valor_produtos }))]
    throw new Error('SQL inesperado no teste')
  }
}
const path = require.resolve('../config/database')
require.cache[path] = { id: path, filename: path, loaded: true, exports: { promise: () => ({ getConnection: async () => connection }) } }

test('API do carrinho: operações, isolamento, validação e rollback sem banco real', async () => {
  const app = express()
  app.use((req, res, next) => {
    // Identidade somente do ambiente de testes; a API real usa express-session.
    req.sessionID = 'sessao-unitaria'
    req.session = req.headers['x-test-user'] ? { usuario: { id_usuario: Number(req.headers['x-test-user']) } } : {
      reload(callback) { callback() }, save(callback) { callback() }
    }
    next()
  })
  app.use('/api/carrinho', require('../routes/carrinho'))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  async function request(method, suffix = '', body, user = 1) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/carrinho${suffix}`, {
      method, headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': String(user) } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    return { status: response.status, body: await response.json() }
  }
  try {
    assert.equal((await request('GET', '', undefined, null)).status, 200)
    assert.deepEqual((await request('GET')).body.itens, [])
    assert.equal(pedidos.length, 0)
    assert.equal((await request('POST', '/itens', { produto_sku: 1001, quantidade: 0 })).status, 400)
    assert.equal((await request('POST', '/itens', { produto_sku: 999, quantidade: 1 })).status, 404)
    estoque = 3
    for (const quantidade of [-1, 0, 1.5, '2', null]) {
      assert.equal((await request('POST', '/itens', { produto_sku: 1001, quantidade })).status, 400)
    }
    const acimaDoEstoque = await request('POST', '/itens', { produto_sku: 1001, quantidade: 4 })
    assert.equal(acimaDoEstoque.status, 409)
    assert.equal(acimaDoEstoque.body.erro, 'Não há mais unidades disponíveis em estoque para este produto.')
    estoque = 0
    const esgotado = await request('POST', '/itens', { produto_sku: 1001, quantidade: 1 })
    assert.equal(esgotado.status, 409)
    assert.equal(esgotado.body.erro, 'Produto esgotado no momento.')
    estoque = 3
    let result = await request('POST', '/itens', { produto_sku: 1001, quantidade: 2 })
    assert.equal(result.status, 200); assert.equal(result.body.total, '20.00')
    assert.equal((await request('POST', '/itens', { produto_sku: 1001, quantidade: 2 })).status, 409)
    assert.equal((await request('PATCH', '/itens/1001', { quantidade: 4 })).status, 409)
    result = await request('POST', '/itens', { produto_sku: 1001, quantidade: 1 })
    assert.equal(pedidos.length, 1); assert.equal(result.body.itens[0].quantidade, 3)
    assert.equal((await request('GET')).body.itens[0].quantidade, 3)
    assert.deepEqual((await request('GET', '', undefined, 2)).body.itens, [])
    assert.deepEqual((await request('GET', '?pedido_id=1&usuario_id=1', undefined, 2)).body.itens, [])
    assert.equal((await request('PATCH', '/itens/1001', { quantidade: 20 }, 2)).status, 404)
    assert.equal((await request('GET')).body.itens[0].quantidade, 3)
    assert.equal((await request('DELETE', '/itens/1001', undefined, 2)).status, 404)
    assert.equal((await request('PATCH', '/itens/1001', { quantidade: -2 })).status, 400)
    estoque = 100
    result = await request('PATCH', '/itens/1001', { quantidade: 5 })
    assert.equal(result.body.total, '50.00'); assert.equal(result.body.status, 'carrinho')
    assert.equal((await request('DELETE', '/itens/999')).status, 404)
    result = await request('DELETE', '/itens/1001')
    assert.deepEqual(result.body.itens, []); assert.equal(result.body.total, '0.00')
    failWrite = true
    const before = pedidos.length
    result = await request('POST', '/itens', { produto_sku: 1001, quantidade: 1 }, 3)
    assert.equal(result.status, 500); assert.ok(!JSON.stringify(result.body).includes('sensível'))
    assert.equal(pedidos.length, before); assert.ok(rollbackCount > 0); assert.ok(released > 0)
    assert.ok(pedidos.every(p => p.status === 'carrinho'))
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('sessões reais: visitantes isolados, reutilização, validações e timeout de trava sem MySQL', async () => {
  pedidos = []; itens = []; failWrite = false
  const app = express()
  app.use(session({ secret: 'apenas-teste-sem-banco', resave: false, saveUninitialized: false }))
  app.use('/api/carrinho', require('../routes/carrinho'))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const a = { cookie: '' }; const b = { cookie: '' }
  async function requisitar(cliente, metodo = 'GET', caminho = '', corpo, tipo = 'application/json') {
    const resposta = await fetch(`http://127.0.0.1:${server.address().port}/api/carrinho${caminho}`, {
      method: metodo, headers: { 'content-type': tipo, ...(cliente.cookie ? { cookie: cliente.cookie } : {}) },
      ...(corpo ? { body: JSON.stringify(corpo) } : {})
    })
    if (resposta.headers.get('set-cookie')) cliente.cookie = resposta.headers.get('set-cookie').split(';')[0]
    return { status: resposta.status, dados: await resposta.json() }
  }
  try {
    assert.equal((await requisitar(a)).status, 200)
    assert.equal((await requisitar(b)).status, 200)
    assert.notEqual(a.cookie, b.cookie)
    let resultado = await requisitar(a, 'POST', '/itens', { produto_sku: 1001, quantidade: 2, usuario_id: 99 })
    assert.equal(resultado.status, 200)
    const pedidoA = resultado.dados.pedido_id
    assert.equal(pedidos[0].usuario_id, null)
    assert.match(pedidos[0].visitante_token_hash, /^[a-f0-9]{64}$/)
    assert.ok(!JSON.stringify(resultado.dados).includes('visitante_token_hash'))
    assert.equal((await requisitar(a, 'POST', '/itens', { produto_sku: 1001, quantidade: 1 })).dados.pedido_id, pedidoA)
    assert.equal((await requisitar(a)).dados.itens[0].quantidade, 3)
    assert.deepEqual((await requisitar(b, 'GET', '?pedido_id=' + pedidoA)).dados.itens, [])
    assert.equal((await requisitar(b, 'PATCH', '/itens/1001', { quantidade: 9 })).status, 404)
    assert.equal((await requisitar(b, 'DELETE', '/itens/1001')).status, 404)
    resultado = await requisitar(b, 'POST', '/itens', { produto_sku: 1001, quantidade: 1 })
    assert.notEqual(resultado.dados.pedido_id, pedidoA)
    assert.notEqual(pedidos[0].visitante_token_hash, pedidos[1].visitante_token_hash)
    resultado = await requisitar(a, 'PATCH', '/itens/1001', { quantidade: 4, produto_sku: 999 })
    assert.equal(resultado.status, 200); assert.equal(resultado.dados.total, '40.00')
    assert.equal((await requisitar(b)).dados.itens[0].quantidade, 1)
    assert.equal((await requisitar(a, 'POST', '/itens', { produto_sku: 1001, quantidade: 1 }, 'text/plain')).status, 415)
    assert.equal((await requisitar(a, 'PATCH', '/itens/1001', { quantidade: 1.5 })).status, 400)
    travaDisponivel = false
    assert.equal((await requisitar(a)).status, 409)
    travaDisponivel = true
    resultado = await requisitar(a, 'DELETE', '/itens/1001')
    assert.equal(resultado.status, 200); assert.equal(resultado.dados.total, '0.00')
    assert.deepEqual(resultado.dados.itens, []); assert.equal(resultado.dados.status, 'carrinho')
    await requisitar(a, 'POST', '/itens', { produto_sku: 1001, quantidade: 2 })
    const carrinhoB = await requisitar(b)
    assert.equal((await requisitar(a, 'DELETE', '/itens')).dados.total, '0.00')
    assert.deepEqual((await requisitar(a)).dados.itens, [])
    assert.deepEqual((await requisitar(b)).dados, carrinhoB.dados)
  } finally {
    travaDisponivel = true
    await new Promise(resolve => server.close(resolve))
  }
})

test('esvaziar pela sessão preserva outros usuários e pedidos confirmados e desfaz falha', async () => {
  failWrite = false
  pedidos = [
    { id_pedido: 1, usuario_id: 1, status: 'carrinho', valor_produtos: '30.00', total: '30.00' },
    { id_pedido: 2, usuario_id: 2, status: 'carrinho', valor_produtos: '10.00', total: '10.00' },
    { id_pedido: 3, usuario_id: 1, status: 'solicitado', valor_produtos: '10.00', total: '10.00' }
  ]
  itens = [
    { pedido_id: 1, produto_sku: 1001, quantidade: 2, subtotal: '20.00' },
    { pedido_id: 1, produto_sku: 1002, quantidade: 1, subtotal: '10.00' },
    { pedido_id: 2, produto_sku: 1001, quantidade: 1, subtotal: '10.00' },
    { pedido_id: 3, produto_sku: 1001, quantidade: 1, subtotal: '10.00' }
  ]
  const antes = structuredClone({ pedidos, itens })
  const app = express()
  app.use((req, res, next) => {
    req.session = { usuario: { id_usuario: 1 } }
    next()
  })
  app.use('/api/carrinho', require('../routes/carrinho'))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  async function esvaziar() {
    const resposta = await fetch(`http://127.0.0.1:${server.address().port}/api/carrinho/itens?pedido_id=2&usuario_id=2`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pedido_id: 3, usuario_id: 2, selecionados: [1001] })
    })
    return { status: resposta.status, dados: await resposta.json() }
  }
  try {
    falharTotais = true
    const falha = await esvaziar()
    assert.equal(falha.status, 500)
    assert.equal(falha.dados.erro, 'Não foi possível atualizar ou consultar o carrinho.')
    assert.deepEqual({ pedidos, itens }, antes)
    falharTotais = false
    const sucesso = await esvaziar()
    assert.equal(sucesso.status, 200)
    assert.equal(sucesso.dados.pedido_id, 1)
    assert.deepEqual(sucesso.dados.itens, [])
    assert.equal(sucesso.dados.total, '0.00')
    assert.equal(sucesso.dados.valor_produtos, '0.00')
    assert.equal(pedidos[0].status, 'carrinho')
    assert.deepEqual(pedidos.slice(1), antes.pedidos.slice(1))
    assert.deepEqual(itens, antes.itens.filter(i => i.pedido_id !== 1))
    assert.equal((await esvaziar()).status, 200)
    pedidos = pedidos.filter(p => p.id_pedido !== 1)
    assert.equal((await esvaziar()).status, 200)
    assert.equal(pedidos.length, 2)
  } finally {
    falharTotais = false
    await new Promise(resolve => server.close(resolve))
  }
})
