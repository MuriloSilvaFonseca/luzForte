const express = require('express')
const router = express.Router()
const conexao = require('../config/database')

function erroServidor(res, erro) {
  console.log(erro)
  res.status(500).send('Erro no servidor')
}

// HOME
router.get('/', (req, res) => {
  const sqlCategorias = 'SELECT id_categoria, nome FROM categoria ORDER BY nome'

  const sqlDestaques = `
    SELECT p.sku, p.titulo_produto, p.preco_produto, p.estoque_produto,
           m.nome AS marca,
           i.url AS imagem
    FROM produto p
    JOIN marca m ON m.id_marca = p.marca_id
    LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
    WHERE p.ativo = 'ativo'
    ORDER BY p.titulo_produto
    LIMIT 8
  `

  conexao.query(sqlCategorias, (erroSQLCategoria, categorias) => {
    if (erroSQLCategoria) {
      return erroServidor(res, erroSQLCategoria)
    }
      
    conexao.query(sqlDestaques, (erroSQLDestaque, produtos) => {
      if (erroSQLDestaque) {
        return erroServidor(res, erroSQLDestaque)
      } 

      res.render('loja/home', { categorias, produtos })
    })
  })
})


router.get('/catalogo', (req, res) => {
  const categoria = req.query.categoria
  const marca = req.query.marca
  const busca = req.query.q
  const ordenar = req.query.ordenar

  let sql = `
    SELECT p.sku, p.titulo_produto, p.preco_produto, p.estoque_produto,
           m.nome AS marca,
           i.url AS imagem
    FROM produto p
    JOIN marca m ON m.id_marca = p.marca_id
    JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
    LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
    WHERE p.ativo = 'ativo'
  `
  const valores = []

  if (categoria) {
    sql += ' AND s.categoria_id = ?'
    valores.push(categoria)
  }
  if (marca) {
    sql += ' AND p.marca_id = ?'
    valores.push(marca)
  }
  if (busca) {
    sql += ' AND p.titulo_produto LIKE ?'
    valores.push('%' + busca + '%')
  }

  if (ordenar === 'menor') {
    sql += ' ORDER BY p.preco_produto ASC'
  } else if (ordenar === 'maior') {
    sql += ' ORDER BY p.preco_produto DESC'
  } else {
    sql += ' ORDER BY p.titulo_produto ASC'
  }

  conexao.query(sql, valores, (erro, produtos) => {
    if (erro) return erroServidor(res, erro)

    conexao.query('SELECT id_categoria, nome FROM categoria ORDER BY nome', (erro2, categorias) => {
      if (erro2) return erroServidor(res, erro2)

      conexao.query('SELECT id_marca, nome FROM marca ORDER BY nome', (erro3, marcas) => {
        if (erro3) return erroServidor(res, erro3)

        res.render('loja/catalogo', {
          produtos,
          categorias,
          marcas,
          filtros: { categoria, marca, busca, ordenar }
        })
      })
    })
  })
})

// ========== PRODUTO ==========
// Exemplo: /produto/1001
router.get('/produto/:sku', (req, res) => {
  const sku = req.params.sku

  // Colunas listadas uma a uma de propósito: o custo_produto NÃO pode ir para a tela.
  const sqlProduto = `
    SELECT p.sku, p.titulo_produto, p.preco_produto, p.estoque_produto,
           m.nome AS marca,
           s.nome AS subcategoria,
           c.nome AS categoria, c.id_categoria
    FROM produto p
    JOIN marca m ON m.id_marca = p.marca_id
    JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
    JOIN categoria c ON c.id_categoria = s.categoria_id
    WHERE p.sku = ? AND p.ativo = 'ativo'
  `
  const sqlImagens = 'SELECT url FROM imagem_produto WHERE produto_sku = ? ORDER BY ordem'
  const sqlDescricoes = 'SELECT nome_descricao, texto_descricao FROM descricao WHERE produto_sku = ?'
  const sqlEspecificacoes = 'SELECT nome_especificacao, texto_especificacao FROM especificacao WHERE produto_sku = ?'
  const sqlInstalacoes = 'SELECT nome_instalacao, texto_instalacao FROM instalacao WHERE produto_sku = ?'
  const sqlAvaliacoes = `
    SELECT a.nota, a.comentario, a.data_criacao, u.nome_usuario
    FROM avaliacao_produto a
    JOIN usuario u ON u.id_usuario = a.usuario_id
    WHERE a.produto_sku = ?
    ORDER BY a.data_criacao DESC
  `

  conexao.query(sqlProduto, [sku], (erro, resultado) => {
    if (erro) return erroServidor(res, erro)

    // Erro do banco (acima) e produto inexistente (aqui) são situações diferentes
    if (resultado.length === 0) {
      return res.status(404).send('Produto não encontrado')
    }

    const produto = resultado[0]

    conexao.query(sqlImagens, [sku], (erro2, imagens) => {
      if (erro2) return erroServidor(res, erro2)

      conexao.query(sqlDescricoes, [sku], (erro3, descricoes) => {
        if (erro3) return erroServidor(res, erro3)

        conexao.query(sqlEspecificacoes, [sku], (erro4, especificacoes) => {
          if (erro4) return erroServidor(res, erro4)

          conexao.query(sqlInstalacoes, [sku], (erro5, instalacoes) => {
            if (erro5) return erroServidor(res, erro5)

            conexao.query(sqlAvaliacoes, [sku], (erro6, avaliacoes) => {
              if (erro6) return erroServidor(res, erro6)

              // Média das notas: soma tudo e divide pela quantidade
              let soma = 0
              for (let i = 0; i < avaliacoes.length; i++) {
                soma = soma + avaliacoes[i].nota
              }
              let mediaNota = 0
              if (avaliacoes.length > 0) {
                mediaNota = (soma / avaliacoes.length).toFixed(1)
              }

              res.render('loja/produto', {
                produto,
                imagens,
                descricoes,
                especificacoes,
                instalacoes,
                avaliacoes,
                mediaNota
              })
            })
          })
        })
      })
    })
  })
})

// Endereço antigo (/produto sem o SKU): manda para o catálogo em vez de dar 404
router.get('/produto', (req, res) => {
  res.redirect('/catalogo')
})

router.get('/carrinho', (req, res) => {
  res.render('loja/carrinho')
})

router.get('/checkout', (req, res) => {
  res.render('loja/checkout')
})

router.get('/sobre-nos', (req, res) => {
  res.render('loja/sobre-nos')
})

router.get('/contato', (req, res) => {
  res.render('loja/contato')
})

module.exports = router
