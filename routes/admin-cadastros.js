const express = require('express')
const banco = require('../config/database').promise()
const router = express.Router()

router.get('/cadastros', async (req, res) => {
  const q = req.query.q === undefined ? '' : req.query.q
  const tipo = req.query.tipo === undefined ? 'textos' : req.query.tipo
  const textoTipo = req.query.texto_tipo === undefined ? '' : req.query.texto_tipo
  if (typeof q !== 'string' || q.length > 200) return res.status(400).send('Use uma busca de até 200 caracteres.')
  if (typeof tipo !== 'string' || !['textos', 'marcas', 'categorias', 'subcategorias'].includes(tipo) || typeof textoTipo !== 'string' || !['', 'descricao', 'especificacao', 'instalacao'].includes(textoTipo)) return res.status(400).send('Selecione um tipo de cadastro válido.')
  try {
    let marcas = [], categorias = [], subcategorias = [], textos = []
    if (tipo === 'marcas') [marcas] = await banco.query(`SELECT m.id_marca AS id, m.nome,
      (SELECT COUNT(*) FROM produto p WHERE p.marca_id = m.id_marca) AS produtos
      FROM marca m WHERE LOCATE(?, m.nome) > 0 ORDER BY m.nome, m.id_marca`, [q.trim()])
    if (tipo === 'categorias') [categorias] = await banco.query(`SELECT c.id_categoria AS id, c.nome,
      (SELECT COUNT(*) FROM subcategoria s WHERE s.categoria_id = c.id_categoria) AS subcategorias,
      (SELECT COUNT(*) FROM produto p WHERE p.categoria_id = c.id_categoria) AS produtos
      FROM categoria c WHERE LOCATE(?, c.nome) > 0 ORDER BY c.nome, c.id_categoria`, [q.trim()])
    if (tipo === 'subcategorias') [subcategorias] = await banco.query(`SELECT s.id_subcategoria AS id, s.nome, c.nome AS categoria,
      (SELECT COUNT(*) FROM produto p WHERE p.subcategoria_id = s.id_subcategoria) AS produtos
      FROM subcategoria s JOIN categoria c ON c.id_categoria = s.categoria_id
      WHERE LOCATE(?, CONCAT(c.nome, ' ', s.nome)) > 0 ORDER BY c.nome, s.nome, s.id_subcategoria`, [q.trim()])
    if (tipo === 'textos') [textos] = await banco.query(`SELECT m.id_modelo_texto AS id, m.tipo, m.nome, m.texto,
      (SELECT COUNT(*) FROM produto_modelo_texto v WHERE v.modelo_texto_id = m.id_modelo_texto) AS usos
      FROM modelo_texto m WHERE LOCATE(?, CONCAT(m.nome, ' ', m.texto)) > 0
      ${textoTipo ? 'AND m.tipo = ?' : ''}
      ORDER BY m.tipo, m.nome, m.id_modelo_texto`, textoTipo ? [q.trim(), textoTipo] : [q.trim()])
    res.render('admin/cadastros', { marcas, categorias, subcategorias, textos, q, tipo, textoTipo, salvo: req.query.salvo === '1', existente: req.query.salvo === 'existente' })
  } catch (erro) {
    console.error('Falha ao listar cadastros:', erro.code)
    res.status(500).send('Não foi possível carregar os cadastros. Confira a conexão e as migrações do banco.')
  }
})

module.exports = router
