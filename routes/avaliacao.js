const express = require('express')
const conexao = require('../config/database')
const router = express.Router()

router.post('/avaliacoes', async (req, res) => {
  if (!req.session.usuario) return res.redirect('/login')

  const sku = Number(req.body.sku)
  const nota = Number(req.body.nota)
  const comentario = (req.body.texto || '').trim()

  if (!Number.isInteger(sku) || sku < 1 || !Number.isInteger(nota) || nota < 1 || nota > 5 || comentario.length < 10) {
    return res.status(400).send('Dados inválidos.')
  }

  try {
    await conexao.promise().execute(
      'INSERT INTO avaliacao_produto (nota, comentario, produto_sku, usuario_id) VALUES (?, ?, ?, ?)',
      [nota, comentario, sku, req.session.usuario.id_usuario]
    )
    res.redirect('/produto?id=' + sku + '&avaliado=1')
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') return res.send('Você já avaliou este produto.')
    console.error('Erro ao salvar avaliação:', erro)
    res.status(500).send('Erro ao salvar avaliação.')
  }
})

module.exports = router