const express = require('express')
const banco = require('../config/database').promise()
const router = express.Router()

const POR_PAGINA = 10
const ESTOQUE_BAIXO = 5
const INT_MAXIMO = 2147483647
const statusPermitidos = ['ativo', 'desativado', 'oculto']
const camposProduto = [
  'titulo_produto', 'sku', 'GTIN_EAN', 'ativo', 'marca_id', 'subcategoria_id',
  'custo_produto', 'preco_produto', 'estoque_produto', 'descricao',
  'especificacao', 'instalacao', 'imagem_url'
]

async function mostrarFormulario(res, { erro = '', valores = {}, status = 200, salvo = false, editando = false } = {}) {
  let marcas = []
  let subcategorias = []
  try {
    const [listaMarcas] = await banco.query('SELECT id_marca AS id, nome FROM marca ORDER BY nome, id_marca')
    marcas = listaMarcas
    const [listaSubcategorias] = await banco.query(`
      SELECT s.id_subcategoria AS id, CONCAT(c.nome, ' > ', s.nome) AS nome
      FROM subcategoria s
      JOIN categoria c ON c.id_categoria = s.categoria_id
      ORDER BY c.nome, s.nome, s.id_subcategoria
    `)
    subcategorias = listaSubcategorias
  } catch (falha) {
    console.error('Falha ao carregar formulário de produto:', falha.code)
    status = 500
    salvo = false
    erro = 'Não foi possível carregar as marcas e subcategorias. Confira a conexão com o banco e recarregue a página.'
  }
  res.status(status).render('admin/cadastro-produto', { marcas, subcategorias, erro, valores, salvo, editando })
}

function inteiroValido(valor, minimo) {
  return /^\d+$/.test(valor) && Number(valor) >= minimo && Number(valor) <= INT_MAXIMO
}

function dinheiroValido(valor) {
  return /^\d+(\.\d{1,2})?$/.test(valor) && Number(valor) <= 99999999.99
}

function imagemValida(valor) {
  if (!valor) return true
  if (valor.startsWith('/') && !valor.startsWith('//') && !valor.includes('\\')) return true
  if (!/^https?:\/\//i.test(valor)) return false

  try {
    const endereco = new URL(valor)
    return ['http:', 'https:'].includes(endereco.protocol) && Boolean(endereco.hostname)
  } catch (_) {
    return false
  }
}

async function salvarTexto(conexaoBanco, tabela, nome, texto, sku, editando) {
  // Os nomes das tabelas vêm apenas das chamadas abaixo, nunca do formulário.
  if (editando) {
    const [registros] = await conexaoBanco.query(`SELECT id_${tabela} AS id FROM ${tabela} WHERE produto_sku = ? ORDER BY id_${tabela} LIMIT 1`, [sku])
    if (registros.length) {
      if (texto) {
        await conexaoBanco.query(`UPDATE ${tabela} SET texto_${tabela} = ? WHERE id_${tabela} = ? AND produto_sku = ?`, [texto, registros[0].id, sku])
      } else {
        await conexaoBanco.query(`DELETE FROM ${tabela} WHERE id_${tabela} = ? AND produto_sku = ?`, [registros[0].id, sku])
      }
      return
    }
  }
  if (texto) {
    await conexaoBanco.query(`INSERT INTO ${tabela} (nome_${tabela}, texto_${tabela}, produto_sku) VALUES (?, ?, ?)`, [nome, texto, sku])
  }
}

router.get('/produtos', async (req, res) => {
  const filtros = {}
  for (const campo of ['q', 'status', 'marca', 'estoque']) {
    if (req.query[campo] !== undefined && typeof req.query[campo] !== 'string') {
      return res.status(400).send('Confira os filtros e tente novamente.')
    }
    filtros[campo] = (req.query[campo] || '').trim()
  }
  if ((filtros.status && !statusPermitidos.includes(filtros.status)) ||
      (filtros.marca && !inteiroValido(filtros.marca, 1)) ||
      (filtros.estoque && filtros.estoque !== 'baixo') ||
      (req.query.pagina !== undefined && (typeof req.query.pagina !== 'string' || !inteiroValido(req.query.pagina, 1)))) {
    return res.status(400).send('Confira os filtros e tente novamente.')
  }

  const condicoes = []
  const parametros = []
  if (filtros.q) {
    condicoes.push("LOCATE(?, CONCAT_WS(' ', p.titulo_produto, p.sku, p.GTIN_EAN)) > 0")
    parametros.push(filtros.q)
  }
  if (filtros.status) {
    condicoes.push('p.ativo = ?')
    parametros.push(filtros.status)
  }
  if (filtros.marca) {
    condicoes.push('p.marca_id = ?')
    parametros.push(Number(filtros.marca))
  }
  if (filtros.estoque === 'baixo') {
    condicoes.push('p.estoque_produto <= ?')
    parametros.push(ESTOQUE_BAIXO)
  }
  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : ''

  try {
    const [marcas] = await banco.query('SELECT id_marca AS id, nome FROM marca ORDER BY nome, id_marca')
    const [contagem] = await banco.query('SELECT COUNT(*) AS total FROM produto p ' + onde, parametros)
    const total = Number(contagem[0].total)
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
    const pagina = Math.min(Number(req.query.pagina) || 1, totalPaginas)
    const inicio = (pagina - 1) * POR_PAGINA
    const [produtos] = await banco.query(`
        SELECT p.sku, p.GTIN_EAN AS ean, p.titulo_produto AS titulo,
               CONCAT(c.nome, ' > ', s.nome) AS subcategoria,
               p.marca_id AS marcaId, m.nome AS marca, p.custo_produto AS custo,
               p.preco_produto AS preco, p.estoque_produto AS estoque, p.ativo, i.url AS imagem
        FROM produto p
        JOIN marca m ON m.id_marca = p.marca_id
        JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
        JOIN categoria c ON c.id_categoria = s.categoria_id
        LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
        ${onde}
        ORDER BY p.sku ASC
        LIMIT ? OFFSET ?
    `, [...parametros, POR_PAGINA, inicio])
    res.render('admin/produtos', { produtos, marcas, filtros, total, pagina, totalPaginas })
  } catch (erro) {
    console.error('Falha ao carregar produtos:', erro.code)
    res.status(500).send('Não foi possível carregar os produtos. Confira a conexão com o banco.')
  }
})

router.get('/produtos/novo', (req, res) => {
  mostrarFormulario(res, {
    valores: { ativo: 'ativo', estoque_produto: '0' },
    salvo: req.query.salvo === '1'
  })
})

router.get('/produtos/:sku/editar', async (req, res) => {
  if (!inteiroValido(req.params.sku, 1)) return res.status(400).send('SKU inválido.')
  try {
    const [produtos] = await banco.query(`
      SELECT p.*,
        (SELECT texto_descricao FROM descricao WHERE produto_sku = p.sku ORDER BY id_descricao LIMIT 1) AS descricao,
        (SELECT nome_descricao FROM descricao WHERE produto_sku = p.sku ORDER BY id_descricao LIMIT 1) AS nome_descricao,
        (SELECT texto_especificacao FROM especificacao WHERE produto_sku = p.sku ORDER BY id_especificacao LIMIT 1) AS especificacao,
        (SELECT nome_especificacao FROM especificacao WHERE produto_sku = p.sku ORDER BY id_especificacao LIMIT 1) AS nome_especificacao,
        (SELECT texto_instalacao FROM instalacao WHERE produto_sku = p.sku ORDER BY id_instalacao LIMIT 1) AS instalacao,
        (SELECT nome_instalacao FROM instalacao WHERE produto_sku = p.sku ORDER BY id_instalacao LIMIT 1) AS nome_instalacao,
        (SELECT url FROM imagem_produto WHERE produto_sku = p.sku AND ordem = 1) AS imagem_url
      FROM produto p WHERE p.sku = ?
    `, [Number(req.params.sku)])
    if (!produtos.length) return res.status(404).send('Produto não encontrado.')
    return mostrarFormulario(res, { valores: produtos[0], editando: true, salvo: req.query.salvo === '1' })
  } catch (erro) {
    console.error('Falha ao carregar produto para edição:', erro.code)
    res.status(500).send('Não foi possível carregar o produto. Confira a conexão com o banco.')
  }
})

router.post(['/produtos/novo', '/produtos/:sku/editar'], async (req, res) => {
  const editando = req.params.sku !== undefined
  if (editando && !inteiroValido(req.params.sku, 1)) return res.status(400).send('SKU inválido.')
  const corpo = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  const valores = {}
  let formatoInvalido = corpo !== req.body
  for (const campo of camposProduto) {
    if (corpo[campo] !== undefined && typeof corpo[campo] !== 'string') formatoInvalido = true
    valores[campo] = typeof corpo[campo] === 'string' ? corpo[campo].trim() : ''
  }
  if (!valores.estoque_produto) valores.estoque_produto = '0'

  let mensagem = ''
  if (editando && valores.sku !== req.params.sku) mensagem = 'O SKU não pode ser alterado na edição.'
  else if (formatoInvalido) mensagem = 'Confira os campos enviados e tente novamente.'
  else if (!valores.titulo_produto || Array.from(valores.titulo_produto).length > 70) mensagem = 'Informe o nome do produto com até 70 caracteres.'
  else if (!inteiroValido(valores.sku, 1)) mensagem = 'Informe um SKU inteiro entre 1 e 2147483647.'
  else if (!inteiroValido(valores.marca_id, 1) || !inteiroValido(valores.subcategoria_id, 1)) mensagem = 'Selecione uma marca e uma subcategoria válidas.'
  else if (!statusPermitidos.includes(valores.ativo)) mensagem = 'Selecione um status válido para o produto.'
  else if (!dinheiroValido(valores.custo_produto) || !dinheiroValido(valores.preco_produto)) mensagem = 'Informe custo e preço entre 0 e 99999999,99, com até duas casas decimais.'
  else if (!inteiroValido(valores.estoque_produto, 0)) mensagem = 'Informe um estoque inteiro entre 0 e 2147483647.'
  else if (Array.from(valores.GTIN_EAN).length > 14) mensagem = 'O código EAN deve ter até 14 caracteres.'
  else if (Array.from(valores.imagem_url).length > 500 || !imagemValida(valores.imagem_url)) mensagem = 'Use uma imagem com endereço http://, https:// ou caminho iniciado por /, com até 500 caracteres.'
  else if (['descricao', 'especificacao', 'instalacao'].some(campo => Buffer.byteLength(valores[campo], 'utf8') > 65535)) mensagem = 'Descrição, especificações e instalação devem ter até 65535 bytes cada.'

  if (mensagem) {
    if (editando) valores.sku = req.params.sku
    return mostrarFormulario(res, { erro: mensagem, valores, editando, status: 400 })
  }

  const skuNumero = Number(valores.sku)
  let conexaoBanco
  let falha
  try {
    conexaoBanco = await banco.getConnection()
    await conexaoBanco.beginTransaction()
    const valoresProduto = [
      valores.titulo_produto, Number(valores.estoque_produto),
      valores.preco_produto, valores.custo_produto, valores.ativo,
      valores.GTIN_EAN || null, Number(valores.marca_id), Number(valores.subcategoria_id)
    ]
    if (editando) {
      const [produtos] = await conexaoBanco.query('SELECT sku FROM produto WHERE sku = ? FOR UPDATE', [skuNumero])
      if (!produtos.length) {
        await conexaoBanco.rollback()
        return res.status(404).send('Produto não encontrado.')
      }
      await conexaoBanco.query(`
        UPDATE produto SET titulo_produto = ?, estoque_produto = ?, preco_produto = ?,
          custo_produto = ?, ativo = ?, GTIN_EAN = ?, marca_id = ?, subcategoria_id = ?
        WHERE sku = ?
      `, [...valoresProduto, skuNumero])
    } else {
      await conexaoBanco.query(`INSERT INTO produto
          (sku, titulo_produto, estoque_produto, preco_produto, custo_produto, ativo, GTIN_EAN, marca_id, subcategoria_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [skuNumero, ...valoresProduto])
    }

    await salvarTexto(conexaoBanco, 'descricao', 'Descrição', valores.descricao, skuNumero, editando)
    await salvarTexto(conexaoBanco, 'especificacao', 'Especificações', valores.especificacao, skuNumero, editando)
    await salvarTexto(conexaoBanco, 'instalacao', 'Orientações de instalação', valores.instalacao, skuNumero, editando)

    let imagens = []
    if (editando) {
      const [listaImagens] = await conexaoBanco.query('SELECT id_imagem_produto AS id FROM imagem_produto WHERE produto_sku = ? AND ordem = 1', [skuNumero])
      imagens = listaImagens
    }
    if (imagens.length) {
      if (valores.imagem_url) {
        await conexaoBanco.query('UPDATE imagem_produto SET url = ? WHERE id_imagem_produto = ? AND produto_sku = ?', [valores.imagem_url, imagens[0].id, skuNumero])
      } else {
        await conexaoBanco.query('DELETE FROM imagem_produto WHERE id_imagem_produto = ? AND produto_sku = ?', [imagens[0].id, skuNumero])
      }
    } else if (valores.imagem_url) {
      await conexaoBanco.query('INSERT INTO imagem_produto (ordem, url, produto_sku) VALUES (?, ?, ?)', [1, valores.imagem_url, skuNumero])
    }
    await conexaoBanco.commit()
  } catch (erro) {
    falha = erro
    if (conexaoBanco) {
      try {
        await conexaoBanco.rollback()
      } catch (erroRollback) {
        console.error('Falha ao desfazer alteração de produto:', erroRollback.code)
      }
    }
  } finally {
    if (conexaoBanco) conexaoBanco.release()
  }

  if (falha) {
    let status = 500
    let erro = 'Não foi possível salvar o produto. Confira a conexão e os dados do banco.'
    if (falha.code === 'ER_DUP_ENTRY') {
      status = 400
      erro = 'Esse SKU ou código EAN já está cadastrado.'
    } else if (falha.code === 'ER_NO_REFERENCED_ROW_2') {
      status = 400
      erro = 'A marca ou subcategoria selecionada não existe mais. Selecione novamente.'
    } else {
      console.error('Falha ao salvar produto:', falha.code)
    }
    return mostrarFormulario(res, { erro, valores, editando, status })
  }
  res.redirect(editando ? '/admin/produtos/' + skuNumero + '/editar?salvo=1' : '/admin/produtos/novo?salvo=1')
})

module.exports = router
