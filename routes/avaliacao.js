const express = require('express')
const conexao = require('../config/database')
const router = express.Router()

router.post('/avaliacoes', async (req, res) => {
  if (!req.session.usuario) return res.redirect('/login')

  const sku = Number(req.body.sku)
  const nota = Number(req.body.nota)
  // Confere o tipo antes do trim: um formulário adulterado pode mandar texto[]=x (array),
  // e o erro dentro de uma rota async derrubaria o servidor inteiro.
  const comentario = typeof req.body.texto === 'string' ? req.body.texto.trim() : ''

  if (!Number.isInteger(sku) || sku < 1 || sku > 2147483647) return res.redirect('/catalogo')

  // Volta para a página do produto com o resultado (a página mostra a mensagem certa)
  const voltar = resultado => res.redirect('/produto?id=' + sku + '&avaliado=' + resultado + '#avaliar')

  // Mesmos limites do formulário: nota de 1 a 5 e comentário de 10 a 500 caracteres
  if (!Number.isInteger(nota) || nota < 1 || nota > 5 || comentario.length < 10 || comentario.length > 500) {
    return voltar('invalida')
  }

  try {
    const banco = conexao.promise()
    const [produtos] = await banco.execute("SELECT sku FROM produto WHERE sku = ? AND ativo = 'ativo'", [sku])
    if (!produtos.length) return res.redirect('/catalogo')

    await banco.execute(
      'INSERT INTO avaliacao_produto (nota, comentario, produto_sku, usuario_id) VALUES (?, ?, ?, ?)',
      [nota, comentario, sku, req.session.usuario.id_usuario]
    )
    voltar('1')
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') return voltar('repetida')
    console.error('Erro ao salvar avaliação:', erro)
    voltar('erro')
  }
})

module.exports = router
