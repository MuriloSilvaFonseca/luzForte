const express = require('express')
const sql = require('../database/conexao')

const router = express.Router()

// GET /api/produtos?ordem=padrao|menor|maior|novidades
router.get('/api/produtos', async (req, res) => {
  const { ordem } = req.query

  try {
    const produtos = await sql`
      SELECT p.sku AS id,
             p.titulo_produto AS nome,
             p.preco_produto AS preco,
             NULL AS preco_antigo,
             (SELECT i.url FROM imagem_produto i
              WHERE i.produto_sku = p.sku
              ORDER BY i.ordem LIMIT 1) AS imagem
      FROM produto p
      WHERE p.ativo = 'ativo'
      ORDER BY p.sku ASC`

    if (ordem === 'menor') produtos.sort((a, b) => a.preco - b.preco)
    else if (ordem === 'maior') produtos.sort((a, b) => b.preco - a.preco)
    else if (ordem === 'novidades') produtos.reverse()

    res.json(produtos)
  } catch (erro) {
    console.error('Erro ao buscar produtos:', erro)
    res.status(500).json({ erro: 'Erro ao buscar produtos' })
  }
})

module.exports = router