const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')

test('listagem administrativa de pedidos lê o banco com filtros e paginação', async t => {
  const consultas = []
  const estados = ['carrinho', 'solicitado', 'aprovado', 'finalizado', 'cancelado']
  let total
  let linhas
  let falharEm

  function reiniciar() {
    consultas.length = 0
    total = 21
    falharEm = ''
    linhas = [{
      id: 9876, data: '20/10/2026', cliente: 'Cliente <do banco>',
      email: 'cliente@example.com', pagamento: 'Pix <do banco>',
      status: 'solicitado', itens: 3, total: '37.90'
    }]
  }

  async function consultar(sql, parametros = []) {
    sql = sql.trim().replace(/\s+/g, ' ')
    consultas.push({ sql, parametros })
    assert.ok(sql.startsWith('SELECT'), 'A listagem deve fazer somente leituras')
    if (falharEm && sql.startsWith(falharEm)) throw new Error('Detalhe interno sigiloso do MySQL')
    if (sql.startsWith('SELECT COUNT(*) AS total')) return [[{ total }]]
    if (sql.startsWith('SELECT status, COUNT(*) AS total')) {
      return [total ? estados.map(status => ({ status, total: status === 'solicitado' ? 17 : 1 })) : []]
    }
    if (sql.startsWith('SELECT p.id_pedido AS id')) return [linhas]
    throw new Error('Consulta inesperada na lista de pedidos: ' + sql)
  }

  const caminhoBanco = require.resolve('../config/database')
  require.cache[caminhoBanco] = {
    id: caminhoBanco, filename: caminhoBanco, loaded: true,
    exports: { promise: () => ({ query: consultar }) }
  }
  delete require.cache[require.resolve('../routes/admin-paineis')]
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '../views'))
  app.use((req, res, next) => {
    const perfil = req.get('x-perfil-teste') || 'admin'
    req.session = perfil === 'visitante' ? {} : { usuario: { id_usuario: 1, acesso: perfil } }
    next()
  })
  app.use('/admin', require('../routes/admin-paineis'))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve)
    servidor.once('error', reject)
  })
  const base = 'http://127.0.0.1:' + servidor.address().port
  const pedir = (filtros, perfil = 'admin') => fetch(base + '/admin/pedidos' + (filtros ? '?' + filtros : ''), {
    headers: { 'x-perfil-teste': perfil }
  })
  const listagem = () => consultas.find(c => c.sql.startsWith('SELECT p.id_pedido AS id'))
  function links(html) {
    return Array.from(html.matchAll(/href="([^"]+)"/g), item => new URL(item[1].replace(/&amp;/g, '&'), base))
  }

  try {
    await t.test('listagem abre sem autenticação para visitantes e clientes', async () => {
      for (const perfil of ['visitante', 'cliente']) {
        reiniciar()
        const resposta = await pedir('', perfil)
        assert.equal(resposta.status, 200, perfil)
        assert.match(await resposta.text(), /#9876/)
        assert.equal(consultas.length, 3, perfil)
      }
    })

    await t.test('renderiza dados persistidos com escape de HTML e estados do esquema', async () => {
      reiniciar()
      const resposta = await pedir()
      const html = await resposta.text()
      assert.equal(resposta.status, 200)
      assert.match(html, /#9876/)
      assert.match(html, /Cliente &lt;do banco&gt;/)
      assert.match(html, /Pix &lt;do banco&gt;/)
      assert.match(html, /37,90/)
      assert.doesNotMatch(html, /Cliente <do banco>|Carlos Menezes|Ana Paula|Aguardando pagamento/)
      assert.doesNotMatch(html, /href="\/admin\/pedidos\/9876"/)
      for (const status of estados) {
        assert.ok(links(html).some(link => link.pathname === '/admin/pedidos' && link.searchParams.get('status') === status), status)
      }
      assert.match(listagem().sql, /LEFT JOIN usuario/)
      assert.match(listagem().sql, /LEFT JOIN forma_pagamento/)
      assert.match(listagem().sql, /SUM\(pp\.quantidade\)/)
      assert.equal(consultas.length, 3)
    })

    await t.test('mostra alternativas para pedido sem cliente ou pagamento', async () => {
      reiniciar()
      linhas[0].cliente = null
      linhas[0].email = null
      linhas[0].pagamento = null
      const resposta = await pedir()
      const html = await resposta.text()
      assert.equal(resposta.status, 200)
      assert.match(html, /Cliente visitante/)
      assert.match(html, /Não informado/)
      assert.doesNotMatch(html, />null</)
    })

    await t.test('combina filtros parametrizados e preserva-os ao trocar de página', async () => {
      reiniciar()
      const busca = "' OR 1=1 --"
      const filtros = new URLSearchParams({ status: 'solicitado', q: busca, de: '2026-10-01', ate: '2026-10-20', pagina: '2' })
      const resposta = await pedir(filtros)
      const html = await resposta.text()
      assert.equal(resposta.status, 200)
      assert.match(html, /Página 2 de 3/)
      const consulta = listagem()
      assert.ok(!consulta.sql.includes(busca))
      for (const valor of ['solicitado', busca, '2026-10-01', '2026-10-20']) assert.ok(consulta.parametros.includes(valor), valor)
      assert.deepEqual(consulta.parametros.slice(-2), [10, 10])
      assert.match(consulta.sql, /data_criacao < DATE_ADD\(\?, INTERVAL 1 DAY\)/)
      for (const pagina of ['1', '3']) {
        const link = links(html).find(item => item.searchParams.get('pagina') === pagina)
        assert.ok(link, 'Link para a página ' + pagina)
        for (const nome of ['status', 'q', 'de', 'ate']) assert.equal(link.searchParams.get(nome), filtros.get(nome))
      }
    })

    await t.test('busca por número retira o marcador # antes da consulta', async () => {
      reiniciar()
      const resposta = await pedir(new URLSearchParams({ q: '#9876' }))
      assert.equal(resposta.status, 200)
      assert.ok(listagem().parametros.includes('9876'))
      assert.ok(!listagem().sql.includes('9876'))
    })

    await t.test('aceita cada estado do pedido sem inventar pagamento ou envio', async () => {
      for (const status of estados) {
        reiniciar()
        linhas[0].status = status
        const resposta = await pedir(new URLSearchParams({ status }))
        const html = await resposta.text()
        assert.equal(resposta.status, 200, status)
        assert.ok(listagem().parametros.includes(status), status)
        assert.match(listagem().sql, /p\.status = \?/)
        assert.doesNotMatch(html, /Aguardando pagamento|>Pagos<|>Enviados<|>Entregues</)
      }
    })

    await t.test('banco vazio exibe estado vazio sem pedidos de demonstração', async () => {
      reiniciar()
      total = 0
      linhas = []
      const resposta = await pedir()
      const html = await resposta.text()
      assert.equal(resposta.status, 200)
      assert.match(html, /Nenhum pedido encontrado/)
      assert.match(html, /Página 1 de 1/)
      assert.doesNotMatch(html, /Carlos Menezes|Ana Paula|#9876|#2041/)
    })

    await t.test('página além do total usa a última página existente', async () => {
      reiniciar()
      const resposta = await pedir('pagina=999')
      const html = await resposta.text()
      assert.equal(resposta.status, 200)
      assert.match(html, /Página 3 de 3/)
      assert.deepEqual(listagem().parametros.slice(-2), [10, 20])
    })

    await t.test('falhas de consulta devolvem indisponibilidade sem dados falsos ou detalhes', async () => {
      for (const inicio of ['SELECT COUNT(*) AS total', 'SELECT status, COUNT(*) AS total', 'SELECT p.id_pedido AS id']) {
        reiniciar()
        falharEm = inicio
        const resposta = await pedir()
        const html = await resposta.text()
        assert.equal(resposta.status, 500, inicio)
        assert.equal(html, 'Não foi possível carregar os dados dos pedidos.')
        assert.doesNotMatch(html, /Detalhe interno|MySQL|Carlos Menezes|#9876|Nenhum pedido encontrado/)
      }
    })

    await t.test('rejeita filtros inválidos antes de consultar o banco', async () => {
      const invalidos = [
        'status=pago', 'status=solicitado&status=carrinho', 'status[x]=carrinho',
        'status=__proto__', 'status=constructor', 'status=toString',
        'q=a&q=b', 'q[x]=a', 'de=2026-02-30', 'de=20-10-2026',
        'de=2026-10-20&ate=2026-10-01', 'ate=2026-13-01',
        'de=2026-10-01&de=2026-10-02', 'ate[x]=2026-10-20',
        'pagina=0', 'pagina=-1', 'pagina=1.5', 'pagina=abc', 'pagina=1&pagina=2', 'pagina[x]=1',
        'pagina=9007199254740992'
      ]
      for (const filtros of invalidos) {
        reiniciar()
        const resposta = await pedir(filtros)
        assert.equal(resposta.status, 400, filtros)
        assert.equal(consultas.length, 0, filtros)
      }
    })
  } finally {
    servidor.closeAllConnections()
    await new Promise(resolve => servidor.close(resolve))
  }
})
