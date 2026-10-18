const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const express = require('express')
const session = require('express-session')

test('MySQL real: visitantes, usuário, isolamento e operações com rollback final', {
  skip: process.env.LUZ_FORTE_TESTE_MYSQL !== '1'
}, async () => {
  require('dotenv').config({ quiet: true })
  const pool = require('../config/database')
  const fingerprint = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  let connection; let server; let originalExport; let transaction = false
  const modulePath = require.resolve('../config/database')
  async function snapshot() {
    const [pedidos] = await pool.promise().query('SELECT * FROM pedido ORDER BY id_pedido')
    const [itens] = await pool.promise().query('SELECT * FROM produto_pedido ORDER BY pedido_id, produto_sku')
    return { pedidos: fingerprint(pedidos), itens: fingerprint(itens) }
  }
  try {
    assert.equal(pool.config.connectionConfig.database, 'luz_forte')
    const before = await snapshot()
    const [[produto]] = await pool.promise().query("SELECT sku, preco_produto FROM produto WHERE ativo = 'ativo' ORDER BY sku LIMIT 1")
    const [[usuario]] = await pool.promise().query("SELECT u.id_usuario FROM usuario u WHERE NOT EXISTS (SELECT 1 FROM pedido p WHERE p.usuario_id = u.id_usuario AND p.status = 'carrinho') ORDER BY u.id_usuario LIMIT 1")
    assert.ok(produto && usuario, 'Precisa de produto ativo e usuário sem carrinho preexistente')
    connection = await pool.promise().getConnection()
    await connection.beginTransaction(); transaction = true
    // Executa SQL real, mas substitui COMMIT por savepoint para desfazer tudo ao final.
    const proxy = {
      execute: (...args) => connection.execute(...args),
      beginTransaction: () => connection.query('SAVEPOINT carrinho_api_teste'),
      commit: () => connection.query('RELEASE SAVEPOINT carrinho_api_teste'),
      rollback: async () => { await connection.query('ROLLBACK TO SAVEPOINT carrinho_api_teste'); await connection.query('RELEASE SAVEPOINT carrinho_api_teste') },
      release() {}, destroy() { connection.destroy() }
    }
    originalExport = require.cache[modulePath].exports
    require.cache[modulePath].exports = { promise: () => ({ getConnection: async () => proxy }) }
    delete require.cache[require.resolve('../routes/carrinho')]
    const router = require('../routes/carrinho')
    require.cache[modulePath].exports = originalExport
    const app = express()
    app.use(express.json())
    app.use(session({ secret: crypto.randomBytes(32).toString('hex'), resave: false, saveUninitialized: false }))
    // Apenas neste servidor de teste, nunca na aplicação.
    app.post('/sessao-teste', (req, res) => { req.session.usuario = { id_usuario: usuario.id_usuario }; res.json({ ok: true }) })
    app.use('/api/carrinho', router)
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    const base = 'http://127.0.0.1:' + server.address().port
    const criarCliente = () => ({ cookie: '' })
    const a = criarCliente(); const b = criarCliente(); const logado = criarCliente()
    async function request(cliente, method = 'GET', suffix = '', body, path = '/api/carrinho') {
      const response = await fetch(base + path + suffix, {
        method, headers: { 'content-type': 'application/json', ...(cliente.cookie ? { cookie: cliente.cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
      if (response.headers.get('set-cookie')) cliente.cookie = response.headers.get('set-cookie').split(';')[0]
      return { status: response.status, body: await response.json() }
    }
    assert.equal((await request(a)).status, 200)
    assert.equal((await request(b)).status, 200)
    assert.notEqual(a.cookie, b.cookie)
    const sku = produto.sku
    let result = await request(a, 'POST', '/itens', { produto_sku: sku, quantidade: 2, usuario_id: usuario.id_usuario, preco_unitario: 0 })
    assert.equal(result.status, 200); assert.equal(result.body.itens[0].quantidade, 2)
    const pedidoA = result.body.pedido_id
    assert.equal(result.body.total, (Number(produto.preco_produto) * 2).toFixed(2))
    assert.ok(!JSON.stringify(result.body).includes('visitante_token_hash'))
    assert.equal((await request(a, 'POST', '/itens', { produto_sku: sku, quantidade: 1 })).body.pedido_id, pedidoA)
    assert.equal((await request(a)).body.itens[0].quantidade, 3)
    assert.deepEqual((await request(b, 'GET', '?pedido_id=' + pedidoA)).body.itens, [])
    assert.equal((await request(b, 'PATCH', '/itens/' + sku, { quantidade: 9 })).status, 404)
    assert.equal((await request(b, 'DELETE', '/itens/' + sku)).status, 404)
    result = await request(b, 'POST', '/itens', { produto_sku: sku, quantidade: 1 })
    assert.equal(result.status, 200); assert.notEqual(result.body.pedido_id, pedidoA)
    result = await request(a, 'PATCH', '/itens/' + sku, { quantidade: 4 })
    assert.equal(result.status, 200); assert.equal(result.body.total, (Number(produto.preco_produto) * 4).toFixed(2))
    assert.equal((await request(b)).body.itens[0].quantidade, 1)
    assert.equal((await request(a, 'PATCH', '/itens/' + sku, { quantidade: 0 })).status, 400)
    await request(logado, 'POST', '', {}, '/sessao-teste')
    assert.deepEqual((await request(logado)).body.itens, [])
    result = await request(logado, 'POST', '/itens', { produto_sku: sku, quantidade: 2 })
    assert.equal(result.status, 200); assert.notEqual(result.body.pedido_id, pedidoA)
    assert.equal((await request(a)).body.itens[0].quantidade, 4)
    assert.equal((await request(logado, 'PATCH', '/itens/' + sku, { quantidade: 3 })).status, 200)
    assert.equal((await request(logado, 'DELETE', '/itens/' + sku)).status, 200)
    result = await request(a, 'DELETE', '/itens/' + sku)
    assert.equal(result.status, 200); assert.deepEqual(result.body.itens, []); assert.equal(result.body.total, '0.00'); assert.equal(result.body.status, 'carrinho')
    const [owners] = await connection.query('SELECT usuario_id, visitante_token_hash, status FROM pedido WHERE id_pedido = ?', [pedidoA])
    assert.equal(owners[0].usuario_id, null); assert.match(owners[0].visitante_token_hash, /^[a-f0-9]{64}$/)
    assert.equal(owners[0].status, 'carrinho')
    await new Promise(resolve => server.close(resolve)); server = null
    await connection.rollback(); transaction = false
    assert.deepEqual(await snapshot(), before, 'Pedidos e itens existentes devem permanecer idênticos')
  } finally {
    if (originalExport) require.cache[modulePath].exports = originalExport
    if (server) await new Promise(resolve => server.close(resolve))
    if (connection) { if (transaction) await connection.rollback(); connection.release() }
    await pool.promise().end()
  }
})
