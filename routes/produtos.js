const express = require('express')
const conexao = require('../config/database')
const router = express.Router()

// Os botões sempre recebem o SKU e o preço do mesmo registro real.
router.get('/', async (req, res) => {
  const filtros = ["p.ativo = 'ativo'"]
  const valores = []
  for (const [parametro, coluna] of [['categoria', 's.categoria_id'], ['subcategoria', 'p.subcategoria_id'], ['marca', 'p.marca_id']]) {
    if (req.query[parametro] !== undefined) {
      const valor = Number(req.query[parametro])
      if (!Number.isSafeInteger(valor) || valor <= 0) return res.status(400).json({ erro: 'Filtro inválido.' })
      filtros.push(coluna + ' = ?')
      valores.push(valor)
    }
  }
  if (req.query.q !== undefined) {
    if (typeof req.query.q !== 'string' || req.query.q.length > 200) return res.status(400).json({ erro: 'Busca inválida.' })
    filtros.push('p.titulo_produto LIKE ?')
    valores.push('%' + req.query.q + '%')
  }
  // Consultas adaptadas de origin/catalogo-banco: marca, imagem e preços reais.
  const ordenacoes = { menor: 'p.preco_produto ASC, p.sku ASC', maior: 'p.preco_produto DESC, p.sku ASC' }
  const ordenar = typeof req.query.ordenar === 'string' ? req.query.ordenar : ''
  const ordem = Object.hasOwn(ordenacoes, ordenar) ? ordenacoes[ordenar] : 'p.titulo_produto ASC, p.sku ASC'
  try {
    const [produtos] = await conexao.promise().execute(`
      SELECT p.sku, p.titulo_produto, p.preco_produto, p.estoque_produto,
             m.nome AS marca, i.url AS imagem, s.nome AS subcategoria, c.nome AS categoria
      FROM produto p JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
      JOIN categoria c ON c.id_categoria = s.categoria_id
      JOIN marca m ON m.id_marca = p.marca_id
      LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
      WHERE ${filtros.join(' AND ')} ORDER BY ${ordem}`, valores)
    res.json({ produtos })
  } catch (_) {
    res.status(500).json({ erro: 'Não foi possível carregar os produtos.' })
  }
})

router.get('/:sku', async (req, res) => {
  const sku = Number(req.params.sku)
  if (!/^\d+$/.test(req.params.sku) || !Number.isSafeInteger(sku) || sku < 1 || sku > 2147483647) {
    return res.status(400).json({ erro: 'SKU inválido.' })
  }
  try {
    const banco = conexao.promise()
    const [produtos] = await banco.execute(`
      SELECT p.sku, p.titulo_produto, p.preco_produto, p.estoque_produto,
             m.nome AS marca, s.nome AS subcategoria, c.nome AS categoria, c.id_categoria
      FROM produto p JOIN marca m ON m.id_marca = p.marca_id
      JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
      JOIN categoria c ON c.id_categoria = s.categoria_id
      WHERE p.sku = ? AND p.ativo = 'ativo'`, [sku])
    if (!produtos.length) return res.status(404).json({ erro: 'Produto não encontrado.' })
        const [[imagens], [descricoes], [especificacoes], [instalacoes], [resumo], [distribuicao], [lista]] = await Promise.all([
      banco.execute('SELECT url FROM imagem_produto WHERE produto_sku = ? ORDER BY ordem', [sku]),
      banco.execute('SELECT nome_descricao, texto_descricao FROM descricao WHERE produto_sku = ?', [sku]),
      banco.execute('SELECT nome_especificacao, texto_especificacao FROM especificacao WHERE produto_sku = ?', [sku]),
      banco.execute('SELECT nome_instalacao, texto_instalacao FROM instalacao WHERE produto_sku = ?', [sku]),
      banco.execute("SELECT COUNT(*) AS quantidade, COALESCE(AVG(nota), 0) AS media FROM avaliacao_produto WHERE produto_sku = ? AND status = 'aprovada'", [sku]),
      banco.execute("SELECT nota, COUNT(*) AS qtd FROM avaliacao_produto WHERE produto_sku = ? AND status = 'aprovada' GROUP BY nota", [sku]),
      banco.execute(`SELECT a.nota, a.comentario, a.data_criacao, u.nome_usuario
                     FROM avaliacao_produto a
                     JOIN usuario u ON u.id_usuario = a.usuario_id
                     WHERE a.produto_sku = ? AND a.status = 'aprovada'
                     ORDER BY a.data_criacao DESC LIMIT 20`, [sku])
    ])
    res.json({
      produto: produtos[0], imagens, descricoes, especificacoes, instalacoes,
      avaliacao: { quantidade: resumo[0].quantidade, media: Number(resumo[0].media) },
      distribuicao, lista
    })
    
  } catch (erro) {
    console.error('Erro em /api/produtos/:sku:', erro)
    res.status(500).json({ erro: 'Não foi possível carregar o produto.' })
    }
    })
  
    
  

module.exports = router
