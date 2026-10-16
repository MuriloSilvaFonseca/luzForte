const express = require('express')
const conexao = require('../config/database')
const router = express.Router()

function mostrarErro(res, mensagem) {
  res.redirect('/admin/produtos/novo?erro=' + encodeURIComponent(mensagem))
}

function salvarDetalhes(conexaoBanco, detalhes, indice, callback) {
  if (indice >= detalhes.length) {
    return callback(null)
  }

  const detalhe = detalhes[indice]

  conexaoBanco.query(detalhe.sql, detalhe.valores, (erro) => {
    if (erro) {
      return callback(erro)
    }

    salvarDetalhes(conexaoBanco, detalhes, indice + 1, callback)
  })
}

function cancelarCadastro(conexaoBanco, res, erro) {
  conexaoBanco.rollback(() => {
    conexaoBanco.release()

    if (erro.code === 'ER_DUP_ENTRY') {
      return mostrarErro(res, 'Esse SKU ou código EAN já está cadastrado.')
    }

    console.log(erro)
    res.status(500).send('Não foi possível salvar o produto. Confira a conexão e os dados do banco.')
  })
}

router.get('/produtos/novo', (req, res) => {
  res.render('admin/cadastro-produto', {
    erro: req.query.erro || null,
    salvo: req.query.salvo === '1'
  })
})

router.post('/produtos/novo', (req, res) => {
  const {
    titulo_produto,
    sku,
    GTIN_EAN,
    ativo,
    marca_id,
    subcategoria_id,
    custo_produto,
    preco_produto,
    estoque_produto,
    descricao,
    especificacao,
    instalacao,
    imagem_url
  } = req.body

  const skuNumero = Number(sku)
  const marcaNumero = Number(marca_id)
  const subcategoriaNumero = Number(subcategoria_id)
  const custoNumero = Number(custo_produto)
  const precoNumero = Number(preco_produto)
  const estoqueNumero = Number(estoque_produto || 0)
  const statusPermitidos = ['ativo', 'desativado', 'oculto']

  if (!titulo_produto || !titulo_produto.trim() || titulo_produto.length > 70 ||
      !Number.isInteger(skuNumero) || skuNumero < 1 ||
      !Number.isInteger(marcaNumero) || marcaNumero < 1 ||
      !Number.isInteger(subcategoriaNumero) || subcategoriaNumero < 1 ||
      !custo_produto || !preco_produto ||
      !Number.isFinite(custoNumero) || custoNumero < 0 ||
      !Number.isFinite(precoNumero) || precoNumero < 0 ||
      !Number.isInteger(estoqueNumero) || estoqueNumero < 0 ||
      !statusPermitidos.includes(ativo)) {
    return mostrarErro(res, 'Confira os campos obrigatórios e tente novamente.')
  }

  if (GTIN_EAN && GTIN_EAN.length > 14) {
    return mostrarErro(res, 'O código EAN deve ter até 14 caracteres.')
  }

  if (imagem_url && imagem_url.length > 500) {
    return mostrarErro(res, 'O endereço da imagem deve ter até 500 caracteres.')
  }

  conexao.getConnection((erro, conexaoBanco) => {
    if (erro) {
      console.log(erro)
      return res.status(500).send('Não foi possível conectar ao banco de dados.')
    }

    conexaoBanco.beginTransaction((erro) => {
      if (erro) {
        conexaoBanco.release()
        console.log(erro)
        return res.status(500).send('Não foi possível iniciar o cadastro do produto.')
      }

      const sqlProduto = `
        INSERT INTO produto
          (sku, titulo_produto, estoque_produto, preco_produto, custo_produto, ativo, GTIN_EAN, marca_id, subcategoria_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const valoresProduto = [
        skuNumero,
        titulo_produto.trim(),
        estoqueNumero,
        precoNumero,
        custoNumero,
        ativo,
        GTIN_EAN || null,
        marcaNumero,
        subcategoriaNumero
      ]

      conexaoBanco.query(sqlProduto, valoresProduto, (erro) => {
        if (erro) {
          return cancelarCadastro(conexaoBanco, res, erro)
        }

        const detalhes = []

        if (descricao && descricao.trim()) {
          detalhes.push({
            sql: 'INSERT INTO descricao (nome_descricao, texto_descricao, produto_sku) VALUES (?, ?, ?)',
            valores: ['Descrição', descricao.trim(), skuNumero]
          })
        }

        if (especificacao && especificacao.trim()) {
          detalhes.push({
            sql: 'INSERT INTO especificacao (nome_especificacao, texto_especificacao, produto_sku) VALUES (?, ?, ?)',
            valores: ['Especificações', especificacao.trim(), skuNumero]
          })
        }

        if (instalacao && instalacao.trim()) {
          detalhes.push({
            sql: 'INSERT INTO instalacao (nome_instalacao, texto_instalacao, produto_sku) VALUES (?, ?, ?)',
            valores: ['Orientações de instalação', instalacao.trim(), skuNumero]
          })
        }

        if (imagem_url && imagem_url.trim()) {
          detalhes.push({
            sql: 'INSERT INTO imagem_produto (ordem, url, produto_sku) VALUES (?, ?, ?)',
            valores: [1, imagem_url.trim(), skuNumero]
          })
        }

        salvarDetalhes(conexaoBanco, detalhes, 0, (erro) => {
          if (erro) {
            return cancelarCadastro(conexaoBanco, res, erro)
          }

          conexaoBanco.commit((erro) => {
            if (erro) {
              return cancelarCadastro(conexaoBanco, res, erro)
            }

            conexaoBanco.release()
            res.redirect('/admin/produtos/novo?salvo=1')
          })
        })
      })
    })
  })
})

module.exports = router
