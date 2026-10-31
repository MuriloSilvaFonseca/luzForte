const express = require('express')
const banco = require('../config/database').promise()
const router = express.Router()
const tipos = ['descricao', 'especificacao', 'instalacao']

router.get('/textos/:tipo', async (req, res) => {
  if (!tipos.includes(req.params.tipo)) return res.status(404).json({ erro: 'Tipo de texto não encontrado.' })
  if (req.query.q !== undefined && (typeof req.query.q !== 'string' || req.query.q.length > 200)) {
    return res.status(400).json({ erro: 'Use uma busca de até 200 caracteres.' })
  }
  try {
    const [modelos] = await banco.query(`
      SELECT m.id_modelo_texto AS id, m.tipo, m.nome, m.texto,
        (SELECT COUNT(*) FROM produto_modelo_texto v WHERE v.modelo_texto_id = m.id_modelo_texto) AS usos
      FROM modelo_texto m
      WHERE m.tipo = ? AND LOCATE(?, CONCAT(m.nome, ' ', m.texto)) > 0
      ORDER BY m.nome, m.id_modelo_texto LIMIT 100
    `, [req.params.tipo, (req.query.q || '').trim()])
    res.json(modelos)
  } catch (erro) {
    console.error('Falha ao carregar biblioteca de textos:', erro.code)
    res.status(500).json({ erro: 'Não foi possível carregar os textos. Confira a migração da biblioteca e tente novamente.' })
  }
})

router.post(['/textos/:tipo', '/textos/:tipo/:id'], async (req, res) => {
  const { tipo, id } = req.params
  if (!tipos.includes(tipo)) return res.status(404).json({ erro: 'Tipo de texto não encontrado.' })
  if (id !== undefined && (!/^\d+$/.test(id) || Number(id) < 1 || Number(id) > 2147483647)) {
    return res.status(400).json({ erro: 'Texto inválido.' })
  }
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : ''
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.replace(/\r\n?/g, '\n').trim() : ''
  if (!nome || Array.from(nome).length > 70 || !texto || Buffer.byteLength(texto, 'utf8') > 65535) {
    return res.status(400).json({ erro: 'Informe um título de até 70 caracteres e um texto de até 65535 bytes.' })
  }
  try {
    const [iguais] = await banco.query(`SELECT id_modelo_texto AS id, nome, texto FROM modelo_texto
      WHERE tipo = ? AND assinatura = UNHEX(SHA2(CONCAT(?, CHAR(0), ?), 256)) LIMIT 1`, [tipo, nome, texto])
    if (iguais.length && (!id || iguais[0].id !== Number(id))) {
      if (id) return res.status(409).json({ erro: 'Já existe outro texto com esse conteúdo. Use o texto existente ou altere o conteúdo.' })
      const [contagem] = await banco.query('SELECT COUNT(*) AS usos FROM produto_modelo_texto WHERE modelo_texto_id = ?', [iguais[0].id])
      return res.json({ ...iguais[0], tipo, usos: Number(contagem[0].usos), existente: true })
    }
    let modeloId = Number(id)
    if (id) {
      const [modelos] = await banco.query('SELECT id_modelo_texto AS id FROM modelo_texto WHERE id_modelo_texto = ? AND tipo = ?', [modeloId, tipo])
      if (!modelos.length) return res.status(404).json({ erro: 'Texto não encontrado. Recarregue a biblioteca.' })
      await banco.query('UPDATE modelo_texto SET nome = ?, texto = ? WHERE id_modelo_texto = ? AND tipo = ?', [nome, texto, modeloId, tipo])
    } else {
      const [resultado] = await banco.query('INSERT INTO modelo_texto (tipo, nome, texto) VALUES (?, ?, ?)', [tipo, nome, texto])
      modeloId = resultado.insertId
    }
    const [contagem] = await banco.query('SELECT COUNT(*) AS usos FROM produto_modelo_texto WHERE modelo_texto_id = ?', [modeloId])
    res.status(id ? 200 : 201).json({ id: modeloId, tipo, nome, texto, usos: Number(contagem[0].usos) })
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') {
      if (id) return res.status(409).json({ erro: 'Já existe outro texto com esse conteúdo. Use o existente.' })
      try {
        const [iguais] = await banco.query(`SELECT id_modelo_texto AS id, nome, texto FROM modelo_texto
          WHERE tipo = ? AND assinatura = UNHEX(SHA2(CONCAT(?, CHAR(0), ?), 256)) LIMIT 1`, [tipo, nome, texto])
        if (iguais.length) {
          const [contagem] = await banco.query('SELECT COUNT(*) AS usos FROM produto_modelo_texto WHERE modelo_texto_id = ?', [iguais[0].id])
          return res.json({ ...iguais[0], tipo, usos: Number(contagem[0].usos), existente: true })
        }
      } catch (falha) { console.error('Falha ao consultar texto existente:', falha.code) }
    }
    console.error('Falha ao salvar texto da biblioteca:', erro.code)
    res.status(500).json({ erro: 'Não foi possível salvar o texto. Tente novamente.' })
  }
})

module.exports = router
