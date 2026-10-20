const express = require('express')
const conexao = require('../config/database')
const router = express.Router()

async function consultar(sql, valores = []) {
  const [registros] = await conexao.promise().execute(sql, valores)
  return registros
}

router.get('/', async (req, res) => {
  const filtros = ["p.ativo = 'ativo'"]
  const valores = []

  const colunas = {
    categoria: 's.categoria_id',
    subcategoria: 'p.subcategoria_id',
    marca: 'p.marca_id'
  }

  for (const parametro in colunas) {
    const recebido = req.query[parametro]

    if (recebido !== undefined && recebido !== '') {
      const valor = Number(recebido)

      if (!Number.isSafeInteger(valor) || valor <= 0) {
        return res.status(400).json({ erro: 'Filtro inválido.' })
      }

      filtros.push(colunas[parametro] + ' = ?')
      valores.push(valor)
    }
  }

  const busca = req.query.q

  if (busca !== undefined && busca !== '') {
    if (typeof busca !== 'string' || busca.length > 200) {
      return res.status(400).json({ erro: 'Busca inválida.' })
    }

    filtros.push('p.titulo_produto LIKE ?')
    valores.push('%' + busca + '%')
  }

  let ordem = 'p.titulo_produto ASC, p.sku ASC'

  if (req.query.ordenar === 'menor') {
    ordem = 'p.preco_produto ASC, p.sku ASC'
  } else if (req.query.ordenar === 'maior') {
    ordem = 'p.preco_produto DESC, p.sku ASC'
  }

  try {
    const produtos = await consultar(`
      SELECT p.sku, p.titulo_produto, p.preco_produto, p.estoque_produto,
             m.nome AS marca, i.url AS imagem,
             s.nome AS subcategoria, c.nome AS categoria
      FROM produto p
      JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
      JOIN categoria c ON c.id_categoria = s.categoria_id
      JOIN marca m ON m.id_marca = p.marca_id
      LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
      WHERE ${filtros.join(' AND ')}
      ORDER BY ${ordem}
    `, valores)

    res.json({ produtos })
  } catch (erro) {
    console.log(erro)
    res.status(500).json({ erro: 'Não foi possível carregar os produtos.' })
  }
})

router.get('/:sku', async (req, res) => {
  const sku = Number(req.params.sku)

  if (!/^\d+$/.test(req.params.sku) || !Number.isSafeInteger(sku) || sku < 1 || sku > 2147483647) {
    return res.status(400).json({ erro: 'SKU inválido.' })
  }

  try {
    const produtos = await consultar(`
      SELECT p.sku, p.titulo_produto, p.preco_produto, p.estoque_produto,
             m.nome AS marca, s.nome AS subcategoria,
             c.nome AS categoria, c.id_categoria
      FROM produto p
      JOIN marca m ON m.id_marca = p.marca_id
      JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
      JOIN categoria c ON c.id_categoria = s.categoria_id
      WHERE p.sku = ? AND p.ativo = 'ativo'
    `, [sku])

    if (!produtos.length) {
      return res.status(404).json({ erro: 'Produto não encontrado.' })
    }

    const [
      imagens, descricoes, especificacoes, instalacoes,
      resumo, distribuicao, lista
    ] = await Promise.all([
      consultar(
        'SELECT url FROM imagem_produto WHERE produto_sku = ? ORDER BY ordem',
        [sku]
      ),
      consultar(
        'SELECT nome_descricao, texto_descricao FROM descricao WHERE produto_sku = ?',
        [sku]
      ),
      consultar(
        'SELECT nome_especificacao, texto_especificacao FROM especificacao WHERE produto_sku = ?',
        [sku]
      ),
      consultar(
        'SELECT nome_instalacao, texto_instalacao FROM instalacao WHERE produto_sku = ?',
        [sku]
      ),
      consultar(`
        SELECT COUNT(*) AS quantidade, COALESCE(AVG(nota), 0) AS media
        FROM avaliacao_produto
        WHERE produto_sku = ? AND status = 'aprovada'
      `, [sku]),
      consultar(`
        SELECT nota, COUNT(*) AS qtd
        FROM avaliacao_produto
        WHERE produto_sku = ? AND status = 'aprovada'
        GROUP BY nota
      `, [sku]),
      consultar(`
        SELECT a.nota, a.comentario, a.data_criacao, u.nome_usuario
        FROM avaliacao_produto a
        JOIN usuario u ON u.id_usuario = a.usuario_id
        WHERE a.produto_sku = ? AND a.status = 'aprovada'
        ORDER BY a.data_criacao DESC
        LIMIT 20
      `, [sku])
    ])

    res.json({
      produto: produtos[0],
      imagens,
      descricoes,
      especificacoes,
      instalacoes,
      avaliacao: {
        quantidade: resumo[0].quantidade,
        media: Number(resumo[0].media)
      },
      distribuicao,
      lista
    })
  } catch (erro) {
    console.error('Erro em /api/produtos/:sku:', erro)
    res.status(500).json({ erro: 'Não foi possível carregar o produto.' })
  }
})

module.exports = router