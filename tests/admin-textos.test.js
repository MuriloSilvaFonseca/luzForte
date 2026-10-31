const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

test('biblioteca mantém textos compartilhados e acesso administrativo', async t => {
  const consultas = []
  const modelos = [{ id: 8, tipo: 'descricao', nome: 'Modelo original', texto: '<Texto original>', usos: 2 }]
  async function query(sql, valores = []) {
    sql = sql.trim().replace(/\s+/g, ' ')
    consultas.push({ sql, valores })
    if (sql.startsWith('SELECT id_modelo_texto AS id, nome, texto')) return [modelos.filter(m => m.tipo === valores[0] && m.nome === valores[1] && m.texto === valores[2])]
    if (sql.startsWith('SELECT m.id')) return [modelos.filter(m => m.tipo === valores[0] && (m.nome + ' ' + m.texto).includes(valores[1]))]
    if (sql.startsWith('SELECT id_modelo_texto AS id FROM modelo_texto')) return [modelos.filter(m => m.id === valores[0] && m.tipo === valores[1])]
    if (sql.startsWith('UPDATE modelo_texto')) {
      Object.assign(modelos.find(m => m.id === valores[2]), { nome: valores[0], texto: valores[1] })
      return [{ affectedRows: 1 }]
    }
    if (sql.startsWith('INSERT INTO modelo_texto')) {
      const id = modelos.length + 8
      modelos.push({ id, tipo: valores[0], nome: valores[1], texto: valores[2], usos: 0 })
      return [{ insertId: id }]
    }
    if (sql.startsWith('SELECT COUNT(*) AS usos')) return [[{ usos: modelos.find(m => m.id === valores[0]).usos }]]
    throw new Error('Consulta inesperada: ' + sql)
  }
  async function execute(sql, valores) {
    if (sql.includes('FROM produto p')) return [[{ sku: valores[0], titulo_produto: 'Produto' }]]
    if (sql.includes('FROM produto_modelo_texto')) return [[modelos[0]]]
    if (sql.includes('COUNT(*) AS quantidade')) return [[{ quantidade: 0, media: 0 }]]
    return [[]]
  }
  const caminho = require.resolve('../config/database')
  require.cache[caminho] = { id: caminho, filename: caminho, loaded: true, exports: { promise: () => ({ query, execute }) } }
  const app = express()
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  const { userEstaLogado, userAdmin } = require('../middlewares/auth')
  app.use('/admin', (req, res, next) => {
    const perfil = req.get('x-perfil') || 'admin'
    req.session = perfil === 'visitante' ? {} : { usuario: { acesso: perfil } }
    next()
  }, userEstaLogado, userAdmin, require('../routes/admin-textos'))
  app.use('/api/produtos', require('../routes/produtos'))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise(resolve => servidor.once('listening', resolve))
  const base = 'http://127.0.0.1:' + servidor.address().port
  const salvar = (caminho, dados, perfil = 'admin') => fetch(base + '/admin/textos/' + caminho, {
    method: 'POST', body: new URLSearchParams(dados), headers: { 'x-perfil': perfil }
  })
  try {
    await t.test('visitantes e clientes não podem consultar, criar ou editar', async () => {
      for (const perfil of ['visitante', 'cliente']) {
        assert.equal((await fetch(base + '/admin/textos/descricao', { headers: { 'x-perfil': perfil } })).status, 403)
        assert.equal((await salvar('descricao', { nome: 'Teste', texto: 'Teste' }, perfil)).status, 403)
        assert.equal((await salvar('descricao/8', { nome: 'Teste', texto: 'Teste' }, perfil)).status, 403)
      }
      assert.equal(consultas.length, 0)
    })
    await t.test('busca parametrizada retorna conteúdo e número de vínculos', async () => {
      const resposta = await fetch(base + '/admin/textos/descricao?q=original')
      assert.equal(resposta.status, 200)
      assert.equal((await resposta.json())[0].usos, 2)
      assert.deepEqual(consultas.at(-1).valores, ['descricao', 'original'])
      assert.ok(!consultas.at(-1).sql.includes('original'))
    })
    await t.test('cria texto independente do produto e valida tipo, título e tamanho', async () => {
      const resposta = await salvar('instalacao', { nome: 'Manual', texto: 'Consulte o fabricante.' })
      assert.equal(resposta.status, 201)
      assert.equal((await resposta.json()).tipo, 'instalacao')
      assert.equal((await salvar('invalido', { nome: 'Teste', texto: 'Teste' })).status, 404)
      assert.equal((await salvar('descricao', { nome: '', texto: 'Teste' })).status, 400)
      assert.equal((await salvar('descricao', { nome: 'a'.repeat(71), texto: 'Teste' })).status, 400)
      assert.equal((await salvar('descricao', { nome: 'Teste', texto: 'á'.repeat(32768) })).status, 400)
      assert.equal((await salvar('descricao/0', { nome: 'Teste', texto: 'Teste' })).status, 400)
    })
    await t.test('editar atualiza o texto mostrado em dois produtos vinculados', async () => {
      const resposta = await salvar('descricao/8', { nome: 'Novo título', texto: 'Texto atualizado para todos' })
      assert.equal(resposta.status, 200)
      for (const sku of [123, 456]) {
        const produto = await (await fetch(base + '/api/produtos/' + sku)).json()
        assert.equal(produto.descricoes[0].nome_descricao, 'Novo título')
        assert.equal(produto.descricoes[0].texto_descricao, 'Texto atualizado para todos')
      }
      assert.equal((await salvar('instalacao/8', { nome: 'Errado', texto: 'Errado' })).status, 404)
    })
    await t.test('textos idênticos são reutilizados, mas versões com voltagem diferente são preservadas', async () => {
      const antes = modelos.length
      const original = await (await salvar('especificacao', { nome: 'Tensão', texto: 'Tensão: 127 V' })).json()
      const copia = await salvar('especificacao', { nome: 'Tensão nova', texto: 'Tensão: 220 V' })
      assert.equal(copia.status, 201)
      const nova = await copia.json()
      assert.notEqual(original.id, nova.id)
      assert.equal(modelos.find(m => m.id === original.id).texto, 'Tensão: 127 V')
      const repetida = await salvar('especificacao', { nome: 'Tensão nova', texto: '  Tensão: 220 V  ' })
      assert.equal(repetida.status, 200)
      const reutilizada = await repetida.json()
      assert.equal(reutilizada.id, nova.id)
      assert.equal(reutilizada.existente, true)
      assert.equal(modelos.length, antes + 2)
      assert.equal((await salvar('especificacao/' + original.id, { nome: 'Tensão nova', texto: 'Tensão: 220 V' })).status, 409)
    })
  } finally { await new Promise(resolve => servidor.close(resolve)) }
})
