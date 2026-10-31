const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')

test('detalhes do pedido leem o MySQL com acesso de administrador', async t => {
  const consultas = []
  let existe
  let semDados
  let semItens
  let semOpcionais
  let falharEm

  function reiniciar() {
    consultas.length = 0
    existe = true
    semDados = false
    semItens = false
    semOpcionais = false
    falharEm = ''
  }

  async function consultar(sql, valores = []) {
    sql = sql.trim().replace(/\s+/g, ' ')
    consultas.push({ sql, valores })
    assert.ok(sql.startsWith('SELECT'))
    if (falharEm && sql.includes(falharEm)) throw new Error('Detalhe interno sigiloso')
    if (sql.includes('AS pedidosHoje')) {
      return [[{ pedidosHoje: semDados ? 0 : 2, produtosAtivos: semDados ? 0 : 17,
        estoqueBaixo: semDados ? 0 : 1, avaliacoes: semDados ? 0 : 7 }]]
    }
    if (sql.includes('WHERE p.id_pedido = ?')) {
      return [existe ? [{
        id: 9876, data: '31/10/2026 14:30', status: 'solicitado',
        valor_produtos: '25.00', total: '25.00',
        cliente: semOpcionais ? null : 'Cliente <do banco>',
        email: semOpcionais ? null : 'cliente@example.com',
        telefone: semOpcionais ? null : '11999990000',
        pagamento: semOpcionais ? null : 'Pix <do banco>',
        observacoes: semOpcionais ? null : '<script>observação</script>'
      }] : []]
    }
    if (sql.includes('FROM produto_pedido pp')) {
      return [semItens ? [] : [{ sku: 123, produto: 'Produto <do banco>', quantidade: 2, preco_unitario: '12.50', subtotal: '25.00' }]]
    }
    if (sql.includes('FROM pedido p')) {
      return [semDados ? [] : [{ id: 9876, cliente: 'Cliente <do banco>', status: 'solicitado', total: '25.00' }]]
    }
    if (sql.startsWith('SELECT sku, titulo_produto')) {
      return [semDados ? [] : [{ sku: 123, titulo: 'Estoque <do banco>', estoque: 2 }]]
    }
    throw new Error('Consulta não prevista: ' + sql)
  }

  const caminhoBanco = require.resolve('../config/database')
  require.cache[caminhoBanco] = {
    id: caminhoBanco, filename: caminhoBanco, loaded: true,
    exports: { promise: () => ({ query: consultar }) }
  }
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '../views'))
  app.use((req, res, next) => {
    const perfil = req.get('x-perfil-teste') || 'admin'
    req.session = perfil === 'visitante' ? {} : { usuario: { acesso: perfil } }
    next()
  })
  app.use('/admin', require('../routes/admin-paineis'))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise(resolve => servidor.once('listening', resolve))
  const base = 'http://127.0.0.1:' + servidor.address().port
  const pedir = (rota, perfil = 'admin') => fetch(base + rota, { headers: { 'x-perfil-teste': perfil } })

  try {
    await t.test('visitantes e clientes não acessam pedidos individuais ou dashboard', async () => {
      for (const perfil of ['visitante', 'cliente']) {
        for (const rota of ['/admin/pedidos/9876']) {
          reiniciar()
          assert.equal((await pedir(rota, perfil)).status, 403)
          assert.equal(consultas.length, 0)
        }
      }
    })

    await t.test('pedido mostra cliente, itens, valores históricos e observações escapadas', async () => {
      reiniciar()
      const resposta = await pedir('/admin/pedidos/9876')
      const html = await resposta.text()
      assert.equal(resposta.status, 200)
      assert.match(html, /Pedido #9876/)
      assert.match(html, /Cliente &lt;do banco&gt;/)
      assert.match(html, /cliente@example.com/)
      assert.match(html, /11999990000/)
      assert.match(html, /Pix &lt;do banco&gt;/)
      assert.match(html, /Produto &lt;do banco&gt;/)
      assert.match(html, /&lt;script&gt;observação&lt;\/script&gt;/)
      assert.match(html, /12,50/)
      assert.match(html, /25,00/)
      assert.match(html, /Solicitado/)
      assert.match(html, /Voltar para pedidos/)
      assert.equal(consultas.length, 2)
      assert.ok(consultas.every(c => JSON.stringify(c.valores) === '[9876]' && !c.sql.includes('9876')))
      assert.match(consultas[1].sql, /pp.preco_unitario, pp.subtotal/)
      assert.doesNotMatch(consultas[1].sql, /p.preco_produto/)
    })

    await t.test('campos opcionais ausentes e pedido sem itens têm mensagens claras', async () => {
      reiniciar()
      semOpcionais = true
      semItens = true
      const resposta = await pedir('/admin/pedidos/9876')
      const html = await resposta.text()
      assert.equal(resposta.status, 200)
      assert.match(html, /Cliente visitante/)
      assert.match(html, /Não informado/)
      assert.match(html, /Nenhuma observação registrada/)
      assert.match(html, /Nenhum item registrado neste pedido/)
      assert.doesNotMatch(html, />null</)
    })

    await t.test('pedido inexistente retorna 404 sem consultar itens', async () => {
      reiniciar()
      existe = false
      const resposta = await pedir('/admin/pedidos/9876')
      assert.equal(resposta.status, 404)
      assert.equal(await resposta.text(), 'Pedido não encontrado.')
      assert.equal(consultas.length, 1)
    })

    await t.test('identificador inválido não chega ao banco', async () => {
      for (const id of ['0', '-1', '1.5', 'abc', '2147483648', '1%20OR%201=1']) {
        reiniciar()
        assert.equal((await pedir('/admin/pedidos/' + id)).status, 400, id)
        assert.equal(consultas.length, 0)
      }
    })

    await t.test('falhas nas consultas do pedido retornam 500 sem expor dados internos', async () => {
      for (const trecho of ['WHERE p.id_pedido', 'FROM produto_pedido']) {
        reiniciar()
        falharEm = trecho
        const resposta = await pedir('/admin/pedidos/9876')
        assert.equal(resposta.status, 500)
        assert.doesNotMatch(await resposta.text(), /Detalhe interno|Produto &lt;do banco&gt;/)
      }
    })

  } finally {
    servidor.closeAllConnections()
    await new Promise(resolve => servidor.close(resolve))
  }
})
