const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')

test('produtos e cadastros auxiliares usam banco simulado', async t => {
  const consultas = []
  let pendentes = []
  let gravados = []
  let falha = ''
  const eventos = []
  let estoqueBanco = 3
  async function query(sql, parametros = []) {
    sql = sql.trim().replace(/\s+/g, ' ')
    consultas.push({ sql, parametros })
    if (falha && sql.startsWith(falha)) throw Object.assign(new Error('Erro interno'), { code: 'ER_DUP_ENTRY' })
    if (sql.startsWith('SELECT modelo_texto_id FROM produto_modelo_texto')) return [[{ modelo_texto_id: 8 }]]
    if (sql.startsWith('SELECT m.id_modelo_texto AS id, m.tipo')) return [[{ id: 8, tipo: 'descricao', nome: 'Modelo compartilhado', texto: 'Texto reutilizado', usos: 2 }]]
    if (sql.startsWith('SELECT id_modelo_texto AS id FROM modelo_texto WHERE id_modelo_texto IN')) return [parametros.includes('999') ? [] : parametros.map(id => ({ id: Number(id) }))]
    if (sql.startsWith('SELECT p.*')) return [[{
      sku: 123, titulo_produto: 'Produto <teste>', ativo: 'ativo', marca_id: 1,
      categoria_id: 3, subcategoria_id: 2, custo_produto: '10.00', preco_produto: '15.00', estoque_produto: 3,
      descricao: 'Primeiro texto', especificacao: '', instalacao: ''
    }]]
    if (sql.startsWith('SELECT sku')) return [[{ sku: 123, estoque_produto: estoqueBanco }]]
    if (sql.startsWith('SELECT ordem')) return [[{ ordem: 1, url: '/img/products/existente.png' }]]
    if (/^SELECT id_(descricao|especificacao|instalacao) AS id,/.test(sql)) return [[
      { id: 10, nome: 'Principal', texto: 'Primeiro texto' },
      { id: 11, nome: 'Título <adicional>', texto: 'Outro texto' }
    ]]
    if (/^SELECT id_(descricao|especificacao|instalacao) AS id FROM/.test(sql)) return [[{ id: 10 }]]
    if (sql.includes('FROM marca')) return [[{ id: 1, nome: 'Marca' }]]
    if (sql.startsWith('SELECT id_subcategoria FROM subcategoria')) return [parametros[1] === 3 ? [{ id_subcategoria: 2 }] : []]
    if (sql.includes('FROM subcategoria')) return [[{ id: 2, nome: 'Iluminação > LED', categoria_id: 3 }]]
    if (sql.includes('FROM categoria')) return [[{ id: 3, nome: 'Iluminação' }]]
    if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: 1 }]]
    if (sql.includes('FROM produto p')) return [[{
      sku: 123, titulo: 'Produto <teste>', marca: 'Marca', preco: '15.00', custo: '10.00',
      estoque: 3, ativo: 'ativo', subcategoria: 'Iluminação > LED'
    }]]
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) {
      pendentes.push({ sql, parametros })
      return [{ insertId: 4, affectedRows: 1 }]
    }
    throw new Error('Consulta inesperada: ' + sql)
  }
  const conexao = {
    query,
    async beginTransaction() { eventos.push('begin'); pendentes = [] },
    async commit() { eventos.push('commit'); gravados = [...pendentes] },
    async rollback() { eventos.push('rollback'); pendentes = [] },
    release() { eventos.push('release') }
  }
  const arquivoBanco = require.resolve('../config/database')
  require.cache[arquivoBanco] = { id: arquivoBanco, filename: arquivoBanco, loaded: true,
    exports: { promise: () => ({ execute: async (sql, valores) => { if (!sql.startsWith('SELECT acesso FROM usuario')) throw new Error('Consulta de acesso inesperada'); return [[{ acesso: valores[0] === 1 ? 'admin' : 'cliente' }]] }, query, getConnection: async () => conexao }) } }
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '../views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    const acesso = req.get('x-perfil') || 'admin'
    req.session = acesso === 'visitante' ? {} : { usuario: { id_usuario: acesso === 'admin' ? 1 : 99, acesso } }
    next()
  })
  app.use('/admin', require('../routes/admin'))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise(resolve => servidor.once('listening', resolve))
  const base = 'http://127.0.0.1:' + servidor.address().port + '/admin'
  const produto = {
    titulo_produto: 'Lâmpada', sku: '123', GTIN_EAN: '', ativo: 'ativo', marca_id: '1',
    categoria_id: '3', subcategoria_id: '2', custo_produto: '10.00', preco_produto: '15.00', estoque_produto: '3',
    descricao: 'Descrição', especificacao: '', instalacao: ''
  }
  const detalhe = { id: '', tipo: 'descricao', nome: 'Benefícios', texto: 'Uso interno' }
  function dadosMultipart(dados, extra = detalhe) {
    const form = new FormData()
    Object.entries(dados).forEach(([campo, valor]) => form.append(campo, valor))
    Object.entries(extra).forEach(([campo, valor]) => form.append('detalhes[0][' + campo + ']', valor))
    return form
  }
  const postar = (rota, dados) => fetch(base + rota, { method: 'POST', body: dados, redirect: 'manual' })
  function reiniciar() { consultas.length = 0; eventos.length = 0; pendentes = []; gravados = []; falha = '' }
  try {
    await t.test('visitantes e clientes não acessam produtos nem cadastros auxiliares', async () => {
      for (const perfil of ['visitante', 'cliente']) {
        for (const rota of ['/produtos', '/produtos/novo', '/produtos/123/editar', '/cadastros/categorias', '/cadastros']) {
          const resposta = await fetch(base + rota, { headers: { 'x-perfil': perfil } })
          assert.equal(resposta.status, 403)
        }
        assert.equal((await fetch(base + '/cadastros/marca', { method: 'POST', headers: { 'x-perfil': perfil }, body: new URLSearchParams({ nome: 'Teste' }) })).status, 403)
      }
      assert.equal(consultas.length, 0)
    })
    await t.test('listagem mostra produto do banco e link de edição', async () => {
      reiniciar()
      const resposta = await fetch(base + '/produtos?q=LED&status=ativo&marca=1')
      assert.equal(resposta.status, 200)
      const html = await resposta.text()
      assert.match(html, /Produto &lt;teste&gt;/)
      assert.match(html, /href="\/admin\/produtos\/123\/editar"/)
      assert.ok(consultas.some(c => c.parametros.includes('LED') && c.sql.includes('LIMIT ? OFFSET ?')))
    })
    await t.test('edição carrega adicionais escapados e mantém galeria e multipart', async () => {
      const resposta = await fetch(base + '/produtos/123/editar')
      assert.equal(resposta.status, 200)
      const html = await resposta.text()
      assert.match(html, /Título &lt;adicional&gt;/)
      assert.match(html, /enctype="multipart\/form-data"/)
      assert.match(html, /existente\.png/)
      assert.match(html, /admin-produto-imagens\.js/)
      assert.match(html, /admin-produto-complementos\.js/)
      assert.match(html, /Modelo compartilhado/)
      assert.match(html, /name="modelos" value="8"/)
      assert.match(html, /admin-biblioteca-textos\.js/)
    })
    await t.test('categorias existentes são carregadas e novos cadastros usam parâmetros', async () => {
      assert.deepEqual(await (await fetch(base + '/cadastros/categorias')).json(), [{ id: 3, nome: 'Iluminação' }])
      for (const tipo of ['marca', 'categoria', 'subcategoria']) {
        reiniciar()
        const resposta = await postar('/cadastros/' + tipo, new URLSearchParams({ nome: '<Teste>', categoria_id: '3' }))
        assert.equal(resposta.status, 201)
        assert.deepEqual(await resposta.json(), { id: 4, nome: '<Teste>' })
        assert.deepEqual(consultas[0].parametros, tipo === 'subcategoria' ? ['<Teste>', 3] : ['<Teste>'])
        assert.ok(!consultas[0].sql.includes('<Teste>'))
      }
    })
    await t.test('nomes inválidos, tipos desconhecidos e categoria inválida não gravam', async () => {
      for (const [tipo, dados] of [['marca', { nome: 'a'.repeat(51) }], ['categoria', { nome: '' }], ['subcategoria', { nome: 'LED', categoria_id: '0' }]]) {
        reiniciar()
        assert.equal((await postar('/cadastros/' + tipo, new URLSearchParams(dados))).status, 400)
        assert.equal(consultas.length, 0)
      }
      assert.equal((await postar('/cadastros/produto', new URLSearchParams({ nome: 'Teste' }))).status, 404)
    })
    await t.test('duplicidade tem mensagem pública de recuperação', async () => {
      reiniciar(); falha = 'INSERT INTO marca'
      const resposta = await postar('/cadastros/marca', new URLSearchParams({ nome: 'Repetida' }))
      assert.equal(resposta.status, 400)
      assert.match((await resposta.json()).erro, /já está cadastrado/)
    })
    await t.test('cadastro multipart grava detalhe adicional na mesma transação', async () => {
      reiniciar()
      assert.equal((await postar('/produtos/novo', dadosMultipart(produto))).status, 302)
      assert.ok(gravados.some(c => c.sql.startsWith('INSERT INTO descricao') && c.parametros[0] === 'Benefícios'))
      assert.deepEqual(eventos, ['begin', 'commit', 'release'])
    })
    await t.test('edição multipart atualiza detalhe pelo id e produto sem remover imagens', async () => {
      reiniciar()
      assert.equal((await postar('/produtos/123/editar', dadosMultipart(produto, { ...detalhe, id: '11' }))).status, 302)
      assert.ok(gravados.some(c => c.sql.startsWith('UPDATE descricao SET nome_descricao') && c.parametros[2] === 11 && c.parametros[3] === 123))
      assert.ok(!gravados.some(c => c.sql.includes('imagem_produto')))
    })
    await t.test('edição aplica só a diferença do estoque e não apaga baixas feitas no meio', async () => {
      // Admin abriu com 10 e digitou 12 (+2); nesse meio-tempo uma venda baixou o banco para 6 -> grava 8
      reiniciar(); estoqueBanco = 6
      assert.equal((await postar('/produtos/123/editar', dadosMultipart({ ...produto, estoque_produto: '12', estoque_original: '10' }))).status, 302)
      const update = gravados.find(c => c.sql.startsWith('UPDATE produto SET titulo_produto'))
      assert.equal(update.parametros[1], 8)
      // Mudou só o preço (estoque igual ao original): mantém o 6 do banco, não volta para 10
      reiniciar(); estoqueBanco = 6
      assert.equal((await postar('/produtos/123/editar', dadosMultipart({ ...produto, preco_produto: '16.00', estoque_produto: '10', estoque_original: '10' }))).status, 302)
      assert.equal(gravados.find(c => c.sql.startsWith('UPDATE produto SET titulo_produto')).parametros[1], 6)
      // Tirar mais do que existe agora: não grava e mostra o estoque atual
      reiniciar(); estoqueBanco = 1
      const conflito = await postar('/produtos/123/editar', dadosMultipart({ ...produto, estoque_produto: '5', estoque_original: '10' }))
      assert.equal(conflito.status, 409)
      assert.match(await conflito.text(), /agora são 1 unidades/)
      assert.deepEqual(gravados, [])
      // Estoque em branco na edição é erro (antes virava 0)
      reiniciar(); estoqueBanco = 3
      assert.equal((await postar('/produtos/123/editar', dadosMultipart({ ...produto, estoque_produto: '' }))).status, 400)
      assert.deepEqual(eventos, [])
    })
    await t.test('falha no adicional desfaz o produto e preserva os campos', async () => {
      reiniciar(); falha = 'INSERT INTO descricao'
      const resposta = await postar('/produtos/novo', dadosMultipart({ ...produto, descricao: '' }))
      assert.equal(resposta.status, 400)
      assert.deepEqual(eventos, ['begin', 'rollback', 'release'])
      assert.deepEqual(gravados, [])
      assert.match(await resposta.text(), /value="Benefícios"/)
    })
    await t.test('tipo adulterado é rejeitado antes da transação', async () => {
      reiniciar()
      assert.equal((await postar('/produtos/novo', dadosMultipart(produto, { ...detalhe, tipo: 'produto' }))).status, 400)
      assert.deepEqual(eventos, [])
    })
    await t.test('formulário sem arquivo e sem detalhes novos continua salvando', async () => {
      reiniciar()
      assert.equal((await postar('/produtos/novo', new URLSearchParams(produto))).status, 302)
      assert.deepEqual(eventos, ['begin', 'commit', 'release'])
    })
    await t.test('vínculos compartilhados são salvos sem duplicar e removidos somente deste produto', async () => {
      reiniciar()
      const form = dadosMultipart(produto)
      form.append('modelos', '8'); form.append('modelos', '8')
      assert.equal((await postar('/produtos/123/editar', form)).status, 302)
      const vinculos = gravados.filter(c => c.sql.startsWith('INSERT INTO produto_modelo_texto'))
      assert.equal(vinculos.length, 1)
      assert.deepEqual(vinculos[0].parametros, [123, 8])
      assert.ok(!gravados.some(c => c.sql.startsWith('UPDATE modelo_texto') || c.sql.startsWith('DELETE FROM modelo_texto')))
      reiniciar()
      assert.equal((await postar('/produtos/123/editar', dadosMultipart(produto))).status, 302)
      assert.ok(gravados.some(c => c.sql === 'DELETE FROM produto_modelo_texto WHERE produto_sku = ?' && c.parametros[0] === 123))
      assert.ok(!gravados.some(c => c.sql.startsWith('INSERT INTO produto_modelo_texto')))
    })
    await t.test('modelo inexistente desfaz a transação e um id inválido não a inicia', async () => {
      reiniciar()
      const inexistente = dadosMultipart(produto)
      inexistente.append('modelos', '999')
      assert.equal((await postar('/produtos/novo', inexistente)).status, 400)
      assert.deepEqual(eventos, ['begin', 'rollback', 'release'])
      assert.deepEqual(gravados, [])
      reiniciar()
      const invalido = dadosMultipart(produto)
      invalido.append('modelos', '-1')
      assert.equal((await postar('/produtos/novo', invalido)).status, 400)
      assert.deepEqual(eventos, [])
    })
    await t.test('produto pode ficar na categoria sem subcategoria, mas não em uma subcategoria de outra categoria', async () => {
      reiniciar()
      assert.equal((await postar('/produtos/novo', new URLSearchParams({ ...produto, subcategoria_id: '' }))).status, 302)
      const gravado = gravados.find(c => c.sql.startsWith('INSERT INTO produto '))
      assert.equal(gravado.parametros.at(-1), null)
      assert.equal(gravado.parametros.at(-2), 3)
      reiniciar()
      const resposta = await postar('/produtos/novo', new URLSearchParams({ ...produto, categoria_id: '4' }))
      assert.equal(resposta.status, 400)
      assert.match(await resposta.text(), /não pertence/)
      assert.deepEqual(eventos, ['begin', 'rollback', 'release'])
    })
    await t.test('filtros de categoria e subcategoria são parametrizados', async () => {
      reiniciar()
      assert.equal((await fetch(base + '/produtos?categoria=3&subcategoria=2')).status, 200)
      const sql = consultas.find(c => c.sql.includes('LIMIT ? OFFSET ?'))
      assert.match(sql.sql, /p.categoria_id = \?/)
      assert.match(sql.sql, /p.subcategoria_id = \?/)
      assert.deepEqual(sql.parametros.slice(0, 2), [3, 2])
      assert.equal((await fetch(base + '/produtos?categoria=abc')).status, 400)
    })
    await t.test('consulta unificada lista marcas, categorias, subcategorias e textos', async () => {
      reiniciar()
      const resposta = await fetch(base + '/cadastros?q=LED')
      assert.equal(resposta.status, 200)
      const html = await resposta.text()
      assert.match(html, /Marcas, categorias e textos/)
      assert.match(html, /Modelo compartilhado/)
      assert.match(html, /Usar como base e editar/)
      assert.ok(consultas.filter(c => c.sql.includes('LOCATE')).every(c => c.parametros.includes('LED')))
      assert.equal((await fetch(base + '/cadastros?q[x]=a')).status, 400)
    })
  } finally {
    await new Promise(resolve => servidor.close(resolve))
  }
})
