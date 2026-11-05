const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')

test('dashboard, usuários e mudanças de status usam banco simulado', async t => {
  const consultas = []
  const eventos = []
  let statusPedido = 'solicitado'
  let clienteAtivo = 1
  let falharUpdate = false
  let estoque = 10
  let snapshot
  const custosGravados = []
  async function query(sql, valores = []) {
    sql = sql.trim().replace(/\s+/g, ' ')
    consultas.push({ sql, valores })
    if (sql.startsWith('SELECT produto_sku, quantidade')) return [[{ produto_sku: 1001, quantidade: 2 }]]
    if (sql.startsWith('SELECT estoque_produto')) return [[{ estoque_produto: estoque, custo_produto: '7.00' }]]
    if (sql.startsWith('UPDATE produto SET estoque_produto = estoque_produto +')) { estoque += valores[0]; return [{ affectedRows: 1 }] }
    if (sql.startsWith('UPDATE produto SET estoque_produto')) { estoque -= valores[0]; return [{ affectedRows: 1 }] }
    if (sql.startsWith('UPDATE produto_pedido SET custo_unitario')) { custosGravados.push(valores); return [{ affectedRows: 1 }] }
    if (sql.startsWith('SELECT status, observacoes FROM pedido')) return [[{ status: statusPedido, observacoes: '' }]]
    if (sql.startsWith('SELECT status FROM pedido')) return [[{ status: statusPedido }]]
    if (sql.startsWith('UPDATE pedido')) {
      if (falharUpdate) throw new Error('Erro interno')
      statusPedido = valores[0]
      return [{ affectedRows: 1 }]
    }
    if (sql.startsWith('UPDATE usuario')) {
      if (valores[1] === 2) { clienteAtivo = valores[0]; return [{ affectedRows: 1 }] }
      return [{ affectedRows: 0 }]
    }
    if (sql.startsWith('SELECT COUNT(*) AS total FROM pedido')) return [[{ total: 9 }]]
    if (sql.startsWith('SELECT COALESCE(SUM(ativo')) return [[{ ativos: 20, baixo: 3 }]]
    if (sql.startsWith('SELECT COUNT(*) AS total FROM usuario')) return [[{ total: 2 }]]
    if (sql.startsWith('SELECT COUNT(*) AS quantidade, COALESCE(SUM(total), 0) AS faturamento')) return [[{ quantidade: 5, faturamento: '870.00' }]]
    if (sql.startsWith('SELECT COALESCE(SUM(pp.quantidade')) return [[{ total: '500.00' }]]
    if (sql.startsWith('SELECT status, COUNT(*) AS quantidade')) return [[{ status: 'solicitado', quantidade: 6, total: '312.50' }, { status: 'finalizado', quantidade: 4, total: '800.00' }, { status: 'aprovado', quantidade: 1, total: '70.00' }, { status: 'cancelado', quantidade: 1, total: '50.00' }, { status: 'carrinho', quantidade: 1, total: '15.40' }]]
    if (sql.startsWith('SELECT p.id_pedido AS id')) return [[{ id: 42, cliente: '<Cliente real>', data: '27/10/2026', total: '50.00' }]]
    if (sql.startsWith('SELECT sku, titulo_produto')) return [[{ sku: 1001, titulo: '<Produto do banco>', estoque: 2 }]]
    if (sql.startsWith('SELECT u.id_usuario AS id')) return [[
      { id: 1, nome: 'Admin', email: 'admin@example.com', perfil: 'admin', situacao: 'ativo', cadastro: '01/01/2026', pedidos: 0, avaliacoes: 0 },
      { id: 2, nome: '<Cliente>', email: 'cliente@example.com', perfil: 'cliente', situacao: clienteAtivo ? 'ativo' : 'desativado', cadastro: '02/01/2026', pedidos: 3, avaliacoes: 1 }
    ]]
    throw new Error('Consulta não prevista: ' + sql)
  }
  const conexao = { query, execute: query, async beginTransaction() { snapshot = { statusPedido, estoque }; eventos.push('begin') }, async commit() { eventos.push('commit') }, async rollback() { statusPedido = snapshot.statusPedido; estoque = snapshot.estoque; eventos.push('rollback') }, release() { eventos.push('release') } }
  const arquivo = require.resolve('../config/database')
  require.cache[arquivo] = { id: arquivo, filename: arquivo, loaded: true, exports: { promise: () => ({ execute: async (sql, valores) => { if (!sql.startsWith('SELECT acesso FROM usuario')) throw new Error('Consulta de acesso inesperada'); return [[{ acesso: valores[0] === 1 ? 'admin' : 'cliente' }]] }, query, getConnection: async () => conexao }) } }
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '../views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    const perfil = req.get('x-perfil') || 'admin'
    req.session = perfil === 'visitante' ? {} : { usuario: { id_usuario: perfil === 'admin' ? 1 : 99, acesso: perfil } }
    next()
  })
  app.use('/admin', require('../routes/admin-paineis'))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise(resolve => servidor.once('listening', resolve))
  const base = 'http://127.0.0.1:' + servidor.address().port + '/admin'
  const postar = (rota, dados, perfil = 'admin') => fetch(base + rota, { method: 'POST', redirect: 'manual', headers: { 'x-perfil': perfil }, body: new URLSearchParams(dados) })
  try {
    await t.test('dashboard mostra os totais corretos de solicitados e finalizados', async () => {
      const resposta = await fetch(base)
      assert.equal(resposta.status, 200)
      const html = await resposta.text()
      assert.match(html, /Pedidos solicitados/)
      assert.match(html, /Pedidos finalizados/)
      // Faturamento = só aprovados + finalizados; lucro = faturamento - custo
      assert.match(html, /870,00/)
      assert.match(html, /500,00/)
      assert.match(html, /370,00/)
      assert.match(html, /42,5%/)
      assert.match(html, /Solicitados, cancelados e carrinhos não entram no faturamento/)
      assert.match(html, /312,50/)
      assert.match(html, /50,00/)
      assert.match(html, /&lt;Cliente real&gt;/)
      assert.ok(!html.includes('18.452,90') && !html.includes('aguardando envio'))
      assert.ok(consultas.some(c => c.sql.includes("status <> 'carrinho'")))
      assert.ok(consultas.some(c => c.sql.includes("FROM pedido WHERE status IN ('aprovado', 'finalizado')")))
      assert.ok(!consultas.some(c => c.sql === 'SELECT COALESCE(SUM(total), 0) AS total FROM pedido'))
      assert.ok(html.indexOf('dashboard-faturamento') < html.indexOf('Pedidos solicitados'))
      assert.ok(html.indexOf('Pedidos finalizados') < html.indexOf('aria-label="Indicadores"'))
    })
    await t.test('usuários persistidos podem ser desativados e reativados', async () => {
      assert.equal((await postar('/usuarios/2/ativo', { ativo: '0' })).status, 302)
      let html = await (await fetch(base + '/usuarios')).text()
      assert.match(html, /&lt;Cliente&gt;/)
      assert.match(html, /Reativar conta/)
      assert.equal(clienteAtivo, 0)
      assert.equal((await postar('/usuarios/2/ativo', { ativo: '1' })).status, 302)
      html = await (await fetch(base + '/usuarios?q=Cliente&perfil=cliente&situacao=ativo')).text()
      assert.match(html, /Desativar conta/)
      assert.match(html, /Conta protegida/)
      assert.ok(consultas.some(c => c.valores.includes('Cliente') && c.valores.includes('cliente') && c.valores.includes(1)))
      assert.equal((await postar('/usuarios/1/ativo', { ativo: '0' })).status, 403)
      assert.equal((await postar('/usuarios/3/ativo', { ativo: '0' })).status, 403)
      assert.equal((await postar('/usuarios/2/ativo', { ativo: 'inventado' })).status, 400)
    })
    await t.test('transições permitidas gravam e estados encerrados não são reabertos', async () => {
      for (const [atual, novo] of [['solicitado', 'aprovado'], ['aprovado', 'finalizado'], ['solicitado', 'cancelado'], ['aprovado', 'cancelado']]) {
        statusPedido = atual; estoque = 10; eventos.length = 0
        assert.equal((await postar('/pedidos/42/status', { status_atual: atual, status: novo, motivo_cancelamento: 'Cancelamento solicitado no teste' })).status, 302)
        assert.equal(statusPedido, novo)
        // Aprovar baixa 2 unidades; cancelar um pedido JÁ aprovado devolve as 2 unidades
        const esperado = novo === 'aprovado' ? 8 : (atual === 'aprovado' && novo === 'cancelado' ? 12 : 10)
        assert.equal(estoque, esperado, atual + ' -> ' + novo)
        assert.deepEqual(eventos, ['begin', 'commit', 'release'])
      }
      for (const [atual, novo] of [['finalizado', 'aprovado'], ['cancelado', 'solicitado'], ['solicitado', 'finalizado']]) {
        statusPedido = atual; estoque = 10; eventos.length = 0
        assert.equal((await postar('/pedidos/42/status', { status_atual: atual, status: novo, motivo_cancelamento: 'Cancelamento solicitado no teste' })).status, 400)
        assert.equal(statusPedido, atual)
        assert.deepEqual(eventos, novo === 'solicitado' ? [] : ['begin', 'rollback', 'release'])
      }
      assert.equal((await postar('/pedidos/42/status', { status_atual: 'solicitado', status: 'carrinho' })).status, 400)
    })
    await t.test('aprovação grava o custo do item para o cálculo de lucro', async () => {
      statusPedido = 'solicitado'; estoque = 10; custosGravados.length = 0
      assert.equal((await postar('/pedidos/42/aprovar', {})).status, 302)
      assert.deepEqual(custosGravados, [['7.00', 42, 1001]])
    })
    await t.test('status desatualizado e falha de SQL não geram sucesso falso', async () => {
      statusPedido = 'aprovado'; eventos.length = 0
      assert.equal((await postar('/pedidos/42/status', { status_atual: 'solicitado', status: 'aprovado' })).status, 409)
      assert.deepEqual(eventos, ['begin', 'rollback', 'release'])
      statusPedido = 'solicitado'; estoque = 10; falharUpdate = true; eventos.length = 0
      const resposta = await postar('/pedidos/42/status', { status_atual: 'solicitado', status: 'aprovado' })
      assert.equal(resposta.status, 500)
      assert.ok(!(await resposta.text()).includes('Erro interno'))
      assert.equal(estoque, 10)
      assert.deepEqual(eventos, ['begin', 'rollback', 'release'])
    })
    await t.test('visitantes e clientes não consultam nem alteram a gestão', async () => {
      for (const perfil of ['visitante', 'cliente']) {
        assert.equal((await fetch(base, { headers: { 'x-perfil': perfil } })).status, 403)
        assert.equal((await fetch(base + '/usuarios', { headers: { 'x-perfil': perfil } })).status, 403)
        assert.equal((await postar('/usuarios/2/ativo', { ativo: '0' }, perfil)).status, 403)
        assert.equal((await postar('/pedidos/42/status', { status_atual: 'solicitado', status: 'aprovado' }, perfil)).status, 403)
      }
    })
  } finally { await new Promise(resolve => servidor.close(resolve)) }
})
