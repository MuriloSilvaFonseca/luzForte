const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

test('catálogo mantém filtros parametrizados, ordenação segura e detalhes reais', async () => {
  const consultas = []
  const caminho = require.resolve('../config/database')
  require.cache[caminho] = { id: caminho, filename: caminho, loaded: true, exports: {
    promise: () => ({ execute: async (sql, valores) => {
      sql = sql.trim().replace(/\s+/g, ' ')
      assert.ok(sql.startsWith('SELECT'))
      consultas.push({ sql, valores })
      if (sql.includes('FROM produto p')) return [valores[0] === 999 ? [] : [{ sku: 1001, titulo_produto: 'Produto de teste', preco_produto: '12.90' }]]
      if (sql.includes('FROM imagem_produto')) return [[{ url: '/img/teste.png' }]]
      if (sql.includes('FROM produto_modelo_texto')) return [[{ tipo: 'descricao', nome: 'Compartilhado', texto: 'Texto da biblioteca' }]]
      if (sql.includes('FROM descricao')) return [[{ nome_descricao: 'Descrição', texto_descricao: '<texto>' }]]
      if (sql.includes('FROM especificacao')) return [[{ nome_especificacao: 'Potência', texto_especificacao: '9W' }]]
      if (sql.includes('FROM instalacao')) return [[{ nome_instalacao: 'Instalação', texto_instalacao: 'Instrução' }]]
      if (sql.includes('FROM avaliacao_produto')) return [[{ quantidade: 2, media: '4.5' }]]
      throw new Error('Consulta inesperada')
    } })
  } }
  const app = express()
  app.use('/api/produtos', require('../routes/produtos'))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise(resolve => servidor.once('listening', resolve))
  const base = 'http://127.0.0.1:' + servidor.address().port + '/api/produtos'
  try {
    let resposta = await fetch(base + '?categoria=1&subcategoria=2&marca=3&q=' + encodeURIComponent("' OR 1=1 --") + '&ordenar=menor')
    assert.equal(resposta.status, 200)
    assert.deepEqual(consultas[0].valores, [1, 2, 3, "%' OR 1=1 --%"])
    assert.ok(!consultas[0].sql.includes('OR 1=1'))
    assert.ok(consultas[0].sql.includes('ORDER BY p.preco_produto ASC'))
    assert.ok(consultas[0].sql.includes('LEFT JOIN imagem_produto'))
    assert.equal((await fetch(base + '?categoria=invalida')).status, 400)
    await fetch(base + '?ordenar=toString')
    assert.ok(consultas.at(-1).sql.includes('ORDER BY p.titulo_produto ASC'))
    resposta = await fetch(base + '/1001')
    assert.equal(resposta.status, 200)
    const detalhe = await resposta.json()
    assert.equal(detalhe.produto.sku, 1001)
    assert.equal(detalhe.imagens[0].url, '/img/teste.png')
    assert.equal(detalhe.descricoes[0].texto_descricao, '<texto>')
    assert.equal(detalhe.descricoes[1].texto_descricao, 'Texto da biblioteca')
    assert.equal(detalhe.especificacoes.length, 1)
    assert.equal(detalhe.instalacoes.length, 1)
    assert.equal(detalhe.avaliacao.quantidade, 2)
    assert.equal((await fetch(base + '/999')).status, 404)
    assert.equal((await fetch(base + '/abc')).status, 400)
    assert.ok(consultas.every(consulta => !consulta.sql.includes('custo_produto')))
  } finally { await new Promise(resolve => servidor.close(resolve)) }
})
