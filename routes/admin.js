const express = require('express')
const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { Transform } = require('node:stream')
const banco = require('../config/database').promise()
const { userEstaLogado, userAdmin } = require('../middlewares/auth')
const router = express.Router()

router.use(userEstaLogado, userAdmin)
router.use(require('../middlewares/avaliacoes-pendentes'))
router.use(require('./admin-textos'))
router.use(require('./admin-cadastros'))

const POR_PAGINA = 10
const ESTOQUE_BAIXO = 5
const INT_MAXIMO = 2147483647
const MAX_IMAGENS_PRODUTO = 5
const MAX_BYTES_POR_IMAGEM = 5 * 1024 * 1024
const MAX_BYTES_UPLOAD = MAX_IMAGENS_PRODUTO * MAX_BYTES_POR_IMAGEM + 1024 * 1024
const DIRETORIO_IMAGENS = path.resolve(__dirname, '..', 'public', 'img', 'products')
const statusPermitidos = ['ativo', 'desativado', 'oculto']
const camposProduto = [
  'titulo_produto', 'sku', 'GTIN_EAN', 'ativo', 'marca_id', 'categoria_id', 'subcategoria_id',
  'custo_produto', 'preco_produto', 'estoque_produto', 'descricao',
  'especificacao', 'instalacao'
]

const tiposDetalhe = ['descricao', 'especificacao', 'instalacao']

router.get('/cadastros/categorias', async (req, res) => {
  try {
    const [categorias] = await banco.query('SELECT id_categoria AS id, nome FROM categoria ORDER BY nome')
    res.json(categorias)
  } catch (erro) {
    res.status(500).json({ erro: 'Não foi possível carregar as categorias. Tente novamente.' })
  }
})

router.post('/cadastros/:tipo', async (req, res) => {
  const tipo = req.params.tipo
  if (!['marca', 'categoria', 'subcategoria'].includes(tipo)) return res.status(404).json({ erro: 'Cadastro não encontrado.' })
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : ''
  const categoria = req.body?.categoria_id
  const limite = tipo === 'marca' ? 50 : 70
  if (!nome || Array.from(nome).length > limite) return res.status(400).json({ erro: `Informe um nome com até ${limite} caracteres.` })
  if (tipo === 'subcategoria' && (typeof categoria !== 'string' || !inteiroValido(categoria, 1))) {
    return res.status(400).json({ erro: 'Selecione a categoria da subcategoria.' })
  }
  try {
    let sql
    let parametros
    if (tipo === 'marca') {
      sql = 'INSERT INTO marca (nome) VALUES (?)'
      parametros = [nome]
    } else if (tipo === 'categoria') {
      sql = 'INSERT INTO categoria (nome) VALUES (?)'
      parametros = [nome]
    } else {
      sql = 'INSERT INTO subcategoria (nome, categoria_id) VALUES (?, ?)'
      parametros = [nome, Number(categoria)]
    }
    const [resultado] = await banco.query(sql, parametros)
    res.status(201).json({ id: resultado.insertId, nome })
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Esse nome já está cadastrado. Use a opção existente.' })
    if (erro.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ erro: 'A categoria não existe mais. Recarregue as categorias e tente novamente.' })
    res.status(500).json({ erro: 'Não foi possível salvar. Tente novamente.' })
  }
})

function analisarFormularioMultipart(req, res, next) {
  const tipoConteudo = String(req.headers['content-type'] || '').toLowerCase()
  req.files = []
  if (!tipoConteudo.startsWith('multipart/form-data;')) return next()

  let bytesRecebidos = 0
  const limite = new Transform({
    transform(chunk, encoding, callback) {
      bytesRecebidos += chunk.length
      if (bytesRecebidos > MAX_BYTES_UPLOAD) {
        const erro = new Error('O envio ultrapassa o limite total permitido.')
        erro.uploadStatus = 413
        return callback(erro)
      }
      callback(null, chunk)
    }
  })

  req.pipe(limite)
  new Request('http://localhost/upload', {
    method: 'POST',
    headers: req.headers,
    body: limite,
    duplex: 'half'
  }).formData().then(formulario => {
    const corpo = {}
    const arquivos = []
    for (const [chave, valor] of formulario.entries()) {
      if (typeof valor === 'string') {
        if (Object.hasOwn(corpo, chave)) {
          corpo[chave] = Array.isArray(corpo[chave]) ? [...corpo[chave], valor] : [corpo[chave], valor]
        } else {
          corpo[chave] = valor
        }
      } else if (chave === 'imagens' && valor.name && valor.size) {
        arquivos.push(valor)
      } else if (valor.name && valor.size) {
        req.uploadError = { status: 400, mensagem: 'Envie os arquivos no campo de imagens do produto.' }
      }
    }
    const detalhes = []
    for (const chave of Object.keys(corpo)) {
      const campo = chave.match(/^detalhes\[(\d+)\]\[(id|tipo|nome|texto)\]$/)
      if (!campo) continue
      const indice = Number(campo[1])
      if (indice > 100) {
        req.uploadError = { status: 400, mensagem: 'Há muitos detalhes no formulário.' }
        continue
      }
      if (!detalhes[indice]) detalhes[indice] = {}
      detalhes[indice][campo[2]] = corpo[chave]
    }
    if (detalhes.length) corpo.detalhes = detalhes.filter(Boolean)
    req.body = corpo
    req.files = arquivos
    if (arquivos.length > MAX_IMAGENS_PRODUTO) {
      req.uploadError = { status: 400, mensagem: `Selecione no máximo ${MAX_IMAGENS_PRODUTO} imagens.` }
    }
    next()
  }).catch(erro => {
    req.body = {}
    req.files = []
    req.uploadError = {
      status: erro.uploadStatus || 400,
      mensagem: erro.uploadStatus === 413
        ? 'O envio ficou muito grande. Cada imagem pode ter até 5 MB e o formulário aceita até 5 imagens.'
        : 'Não foi possível ler as imagens enviadas. Confira os arquivos e tente novamente.'
    }
    next()
  })
}

function tipoImagem(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

async function gravarImagemProduto(buffer, sku, ordem, extensao) {
  await fs.mkdir(DIRETORIO_IMAGENS, { recursive: true })
  const nomeArquivo = `produto-${sku}-${ordem}-${randomUUID()}.${extensao}`
  const caminhoArquivo = path.join(DIRETORIO_IMAGENS, nomeArquivo)
  await fs.writeFile(caminhoArquivo, buffer, { flag: 'wx' })
  return { caminhoArquivo, url: `/img/products/${nomeArquivo}` }
}

async function removerImagemLocalSeNaoUsada(url) {
  const prefixo = '/img/products/'
  if (typeof url !== 'string' || !url.startsWith(prefixo)) return
  const nomeArquivo = url.slice(prefixo.length)
  if (!nomeArquivo || path.basename(nomeArquivo) !== nomeArquivo) return

  try {
    const [usos] = await banco.query('SELECT COUNT(*) AS total FROM imagem_produto WHERE url = ?', [url])
    if (Number(usos[0].total) === 0) await fs.unlink(path.join(DIRETORIO_IMAGENS, nomeArquivo))
  } catch (erro) {
    if (erro.code !== 'ENOENT') console.error('Falha ao limpar imagem antiga:', erro.code)
  }
}

async function mostrarFormulario(res, { erro = '', valores = {}, status = 200, salvo = false, editando = false } = {}) {
  let marcas = []
  let subcategorias = []
  let categorias = []
  let modelosSelecionados = []
  try {
    const [listaMarcas] = await banco.query('SELECT id_marca AS id, nome FROM marca ORDER BY nome, id_marca')
    marcas = listaMarcas
    const [listaCategorias] = await banco.query('SELECT id_categoria AS id, nome FROM categoria ORDER BY nome')
    categorias = listaCategorias
    const [listaSubcategorias] = await banco.query(`
      SELECT s.id_subcategoria AS id, s.categoria_id, CONCAT(c.nome, ' > ', s.nome) AS nome
      FROM subcategoria s
      JOIN categoria c ON c.id_categoria = s.categoria_id
      ORDER BY c.nome, s.nome, s.id_subcategoria
    `)
    subcategorias = listaSubcategorias
    if (editando && valores.modelos === undefined) {
      const [vinculos] = await banco.query('SELECT modelo_texto_id FROM produto_modelo_texto WHERE produto_sku = ?', [Number(valores.sku)])
      valores.modelos = vinculos.map(v => String(v.modelo_texto_id))
    }
    if (valores.modelos?.length) {
      const [modelos] = await banco.query(`SELECT m.id_modelo_texto AS id, m.tipo, m.nome, m.texto,
        (SELECT COUNT(*) FROM produto_modelo_texto v WHERE v.modelo_texto_id = m.id_modelo_texto) AS usos
        FROM modelo_texto m WHERE m.id_modelo_texto IN (${valores.modelos.map(() => '?').join(',')}) ORDER BY m.id_modelo_texto`, valores.modelos)
      modelosSelecionados = modelos
    }
    if (editando && !Array.isArray(valores.imagens) && valores.sku) {
      const [imagens] = await banco.query(
        'SELECT ordem, url FROM imagem_produto WHERE produto_sku = ? ORDER BY ordem',
        [Number(valores.sku)]
      )
      valores.imagens = imagens
    }
  } catch (falha) {
    console.error('Falha ao carregar formulário de produto:', falha.code)
    status = 500
    salvo = false
    erro = 'Não foi possível carregar o formulário. Confira a conexão e a migração da biblioteca de textos e recarregue a página.'
  }
  res.status(status).render('admin/cadastro-produto', { marcas, categorias, subcategorias, erro, valores, salvo, editando, modelosSelecionados })
}

function inteiroValido(valor, minimo) {
  return /^\d+$/.test(valor) && Number(valor) >= minimo && Number(valor) <= INT_MAXIMO
}

function dinheiroValido(valor) {
  return /^\d+(\.\d{1,2})?$/.test(valor) && Number(valor) <= 99999999.99
}

function detalhesValidos(detalhes, editando) {
  for (const detalhe of detalhes) {
    if (!tiposDetalhe.includes(detalhe.tipo)) return false
    if (detalhe.id && (!editando || !inteiroValido(detalhe.id, 1))) return false
    if (!detalhe.nome || Array.from(detalhe.nome).length > 70) return false
    if (!detalhe.texto || Buffer.byteLength(detalhe.texto, 'utf8') > 65535) return false
  }
  return true
}

async function salvarTexto(conexaoBanco, tabela, nome, texto, sku, editando) {
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
  for (const campo of ['q', 'status', 'marca', 'estoque', 'categoria', 'subcategoria']) {
    if (req.query[campo] !== undefined && typeof req.query[campo] !== 'string') {
      return res.status(400).send('Confira os filtros e tente novamente.')
    }
    filtros[campo] = (req.query[campo] || '').trim()
  }
  if ((filtros.status && !statusPermitidos.includes(filtros.status)) ||
      (filtros.marca && !inteiroValido(filtros.marca, 1)) ||
      (filtros.categoria && !inteiroValido(filtros.categoria, 1)) ||
      (filtros.subcategoria && !inteiroValido(filtros.subcategoria, 1)) ||
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
  for (const campo of ['categoria', 'subcategoria']) {
    if (filtros[campo]) { condicoes.push('p.' + campo + '_id = ?'); parametros.push(Number(filtros[campo])) }
  }
  if (filtros.estoque === 'baixo') {
    condicoes.push('p.estoque_produto <= ?')
    parametros.push(ESTOQUE_BAIXO)
  }
  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : ''

  try {
    const [marcas] = await banco.query('SELECT id_marca AS id, nome FROM marca ORDER BY nome, id_marca')
    const [categorias] = await banco.query('SELECT id_categoria AS id, nome FROM categoria ORDER BY nome')
    const [subcategorias] = await banco.query('SELECT id_subcategoria AS id, nome, categoria_id FROM subcategoria ORDER BY nome')
    const [contagem] = await banco.query('SELECT COUNT(*) AS total FROM produto p ' + onde, parametros)
    const total = Number(contagem[0].total)
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
    const pagina = Math.min(Number(req.query.pagina) || 1, totalPaginas)
    const inicio = (pagina - 1) * POR_PAGINA
    const [produtos] = await banco.query(`
        SELECT p.sku, p.GTIN_EAN AS ean, p.titulo_produto AS titulo,
               CONCAT_WS(' > ', c.nome, s.nome) AS subcategoria,
               p.marca_id AS marcaId, m.nome AS marca, p.custo_produto AS custo,
               p.preco_produto AS preco, p.estoque_produto AS estoque, p.ativo, i.url AS imagem
        FROM produto p
        JOIN marca m ON m.id_marca = p.marca_id
        LEFT JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
        JOIN categoria c ON c.id_categoria = p.categoria_id
        LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
        ${onde}
        ORDER BY p.sku ASC
        LIMIT ? OFFSET ?
    `, [...parametros, POR_PAGINA, inicio])
    res.render('admin/produtos', { produtos, marcas, categorias, subcategorias, filtros, total, pagina, totalPaginas })
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
        (SELECT nome_instalacao FROM instalacao WHERE produto_sku = p.sku ORDER BY id_instalacao LIMIT 1) AS nome_instalacao
      FROM produto p WHERE p.sku = ?
    `, [Number(req.params.sku)])
    if (!produtos.length) return res.status(404).send('Produto não encontrado.')
    produtos[0].detalhes = []
    for (const tipo of tiposDetalhe) {
      const [detalhes] = await banco.query(`SELECT id_${tipo} AS id, nome_${tipo} AS nome, texto_${tipo} AS texto FROM ${tipo} WHERE produto_sku = ? ORDER BY id_${tipo}`, [Number(req.params.sku)])
      produtos[0].detalhes.push(...detalhes.slice(1).map(detalhe => ({ ...detalhe, tipo })))
    }
    return mostrarFormulario(res, { valores: produtos[0], editando: true, salvo: req.query.salvo === '1' })
  } catch (erro) {
    console.error('Falha ao carregar produto para edição:', erro.code)
    res.status(500).send('Não foi possível carregar o produto. Confira a conexão com o banco.')
  }
})

router.post(['/produtos/novo', '/produtos/:sku/editar'], analisarFormularioMultipart, async (req, res) => {
  const editando = req.params.sku !== undefined
  if (editando && !inteiroValido(req.params.sku, 1)) return res.status(400).send('SKU inválido.')
  const corpo = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  const valores = {}
  let formatoInvalido = corpo !== req.body
  for (const campo of camposProduto) {
    if (corpo[campo] !== undefined && typeof corpo[campo] !== 'string') formatoInvalido = true
    valores[campo] = typeof corpo[campo] === 'string' ? corpo[campo].trim() : ''
  }
  // Produto novo com estoque em branco começa com 0. Na edição, campo vazio é erro
  // (antes virava 0 e apagava o estoque sem o admin perceber).
  if (!valores.estoque_produto && !editando) valores.estoque_produto = '0'
  // Estoque que estava na tela quando o admin abriu a edição (campo escondido do formulário)
  valores.estoque_original = typeof corpo.estoque_original === 'string' ? corpo.estoque_original.trim() : ''
  const modelosEnviados = corpo.modelos === undefined ? [] : Array.isArray(corpo.modelos) ? corpo.modelos : [corpo.modelos]
  if (modelosEnviados.some(id => typeof id !== 'string' || !inteiroValido(id, 1))) formatoInvalido = true
  valores.modelos = [...new Set(modelosEnviados.filter(id => typeof id === 'string' && inteiroValido(id, 1)))]
  valores.detalhes = []
  if (corpo.detalhes !== undefined) {
    if (!Array.isArray(corpo.detalhes)) formatoInvalido = true
    else for (const detalhe of corpo.detalhes) {
      if (!detalhe || ['id', 'tipo', 'nome', 'texto'].some(campo => typeof detalhe[campo] !== 'string')) {
        formatoInvalido = true
        continue
      }
      valores.detalhes.push({
        id: detalhe.id.trim(),
        tipo: detalhe.tipo.trim(),
        nome: detalhe.nome.trim(),
        texto: detalhe.texto.trim()
      })
    }
  }

  if (req.uploadError) {
    if (editando) valores.sku = req.params.sku
    return mostrarFormulario(res, {
      erro: req.uploadError.mensagem,
      valores,
      editando,
      status: req.uploadError.status
    })
  }

  let mensagem = ''
  if (editando && valores.sku !== req.params.sku) mensagem = 'O SKU não pode ser alterado na edição.'
  else if (formatoInvalido) mensagem = 'Confira os campos enviados e tente novamente.'
  else if (!detalhesValidos(valores.detalhes, editando)) mensagem = 'Confira os detalhes adicionais: informe o tipo, um título de até 70 caracteres e o texto.'
  else if (!valores.titulo_produto || Array.from(valores.titulo_produto).length > 70) mensagem = 'Informe o nome do produto com até 70 caracteres.'
  else if (!inteiroValido(valores.sku, 1)) mensagem = 'Informe um SKU inteiro entre 1 e 2147483647.'
  else if (!inteiroValido(valores.marca_id, 1) || !inteiroValido(valores.categoria_id, 1)) mensagem = 'Selecione uma marca e uma categoria válidas.'
  else if (valores.subcategoria_id && !inteiroValido(valores.subcategoria_id, 1)) mensagem = 'Selecione uma subcategoria válida ou deixe sem subcategoria.'
  else if (!statusPermitidos.includes(valores.ativo)) mensagem = 'Selecione um status válido para o produto.'
  else if (!dinheiroValido(valores.custo_produto) || !dinheiroValido(valores.preco_produto)) mensagem = 'Informe custo e preço entre 0 e 99999999,99, com até duas casas decimais.'
  else if (!inteiroValido(valores.estoque_produto, 0)) mensagem = 'Informe um estoque inteiro entre 0 e 2147483647.'
  else if (Array.from(valores.GTIN_EAN).length > 14) mensagem = 'O código EAN deve ter até 14 caracteres.'
  else if (['descricao', 'especificacao', 'instalacao'].some(campo => Buffer.byteLength(valores[campo], 'utf8') > 65535)) mensagem = 'Descrição, especificações e instalação devem ter até 65535 bytes cada.'

  const arquivosCarregados = req.files || []
  const imagensEnviadas = []
  if (!mensagem && arquivosCarregados.length > MAX_IMAGENS_PRODUTO) {
    mensagem = `Selecione no máximo ${MAX_IMAGENS_PRODUTO} imagens.`
  }
  if (!mensagem) {
    for (const arquivo of arquivosCarregados) {
      if (arquivo.size > MAX_BYTES_POR_IMAGEM) {
        mensagem = 'Cada imagem pode ter no máximo 5 MB.'
        break
      }
      const buffer = Buffer.from(await arquivo.arrayBuffer())
      const extensao = tipoImagem(buffer)
      if (!extensao) {
        mensagem = 'Use imagens PNG, JPG ou WebP válidas.'
        break
      }
      imagensEnviadas.push({ buffer, extensao })
    }
  }

  if (mensagem) {
    if (editando) valores.sku = req.params.sku
    return mostrarFormulario(res, { erro: mensagem, valores, editando, status: 400 })
  }

  const skuNumero = Number(valores.sku)
  let conexaoBanco
  let falha
  const arquivosCriados = []
  let imagensAnteriores = []
  try {
    conexaoBanco = await banco.getConnection()
    await conexaoBanco.beginTransaction()
    if (valores.subcategoria_id) {
      const [subcategorias] = await conexaoBanco.query('SELECT id_subcategoria FROM subcategoria WHERE id_subcategoria = ? AND categoria_id = ? FOR SHARE', [Number(valores.subcategoria_id), Number(valores.categoria_id)])
      if (!subcategorias.length) {
        const erroCategoria = new Error('A subcategoria não pertence à categoria selecionada.')
        erroCategoria.status = 400
        throw erroCategoria
      }
    }
    const valoresProduto = [
      valores.titulo_produto, Number(valores.estoque_produto),
      valores.preco_produto, valores.custo_produto, valores.ativo,
      valores.GTIN_EAN || null, Number(valores.marca_id), Number(valores.categoria_id), valores.subcategoria_id ? Number(valores.subcategoria_id) : null
    ]
    if (editando) {
      const [produtos] = await conexaoBanco.query('SELECT sku, estoque_produto FROM produto WHERE sku = ? FOR UPDATE', [skuNumero])
      if (!produtos.length) {
        await conexaoBanco.rollback()
        return res.status(404).send('Produto não encontrado.')
      }
      // O estoque pode ter mudado enquanto o admin editava (ex.: um pedido foi aprovado).
      // Em vez de gravar o número da tela por cima, aplicamos só a DIFERENÇA que o admin fez.
      // Ex.: abriu com 10, digitou 12 (+2); nesse meio-tempo uma venda baixou para 6 -> fica 8.
      const estoqueAtual = Number(produtos[0].estoque_produto)
      if (inteiroValido(valores.estoque_original, 0) && Number.isSafeInteger(estoqueAtual)) {
        const novoEstoque = estoqueAtual + (Number(valores.estoque_produto) - Number(valores.estoque_original))
        if (novoEstoque < 0) {
          const erroEstoque = new Error('O estoque mudou enquanto você editava (agora são ' + estoqueAtual + ' unidades). Confira o valor e salve de novo.')
          erroEstoque.status = 409
          erroEstoque.estoqueAtual = estoqueAtual
          throw erroEstoque
        }
        valoresProduto[1] = novoEstoque
      }
      const [imagens] = await conexaoBanco.query(
        'SELECT ordem, url FROM imagem_produto WHERE produto_sku = ? ORDER BY ordem FOR UPDATE',
        [skuNumero]
      )
      imagensAnteriores = imagens
      await conexaoBanco.query(`
        UPDATE produto SET titulo_produto = ?, estoque_produto = ?, preco_produto = ?,
          custo_produto = ?, ativo = ?, GTIN_EAN = ?, marca_id = ?, categoria_id = ?, subcategoria_id = ?
        WHERE sku = ?
      `, [...valoresProduto, skuNumero])
    } else {
      await conexaoBanco.query(`INSERT INTO produto
          (sku, titulo_produto, estoque_produto, preco_produto, custo_produto, ativo, GTIN_EAN, marca_id, categoria_id, subcategoria_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [skuNumero, ...valoresProduto])
    }

    await salvarTexto(conexaoBanco, 'descricao', 'Descrição', valores.descricao, skuNumero, editando)
    await salvarTexto(conexaoBanco, 'especificacao', 'Especificações', valores.especificacao, skuNumero, editando)
    await salvarTexto(conexaoBanco, 'instalacao', 'Orientações de instalação', valores.instalacao, skuNumero, editando)
    if (valores.modelos.length) {
      const [modelos] = await conexaoBanco.query(`SELECT id_modelo_texto AS id FROM modelo_texto WHERE id_modelo_texto IN (${valores.modelos.map(() => '?').join(',')}) FOR SHARE`, valores.modelos)
      if (modelos.length !== valores.modelos.length) {
        const erroModelo = new Error('Um dos textos selecionados não existe mais. Recarregue a biblioteca.')
        erroModelo.status = 400
        throw erroModelo
      }
    }
    await conexaoBanco.query('DELETE FROM produto_modelo_texto WHERE produto_sku = ?', [skuNumero])
    for (const id of valores.modelos) {
      await conexaoBanco.query('INSERT INTO produto_modelo_texto (produto_sku, modelo_texto_id) VALUES (?, ?)', [skuNumero, Number(id)])
    }

    for (const detalhe of valores.detalhes) {
      const tipo = detalhe.tipo
      if (detalhe.id) {
        await conexaoBanco.query(`UPDATE ${tipo} SET nome_${tipo} = ?, texto_${tipo} = ? WHERE id_${tipo} = ? AND produto_sku = ?`, [detalhe.nome, detalhe.texto, Number(detalhe.id), skuNumero])
      } else {
        await conexaoBanco.query(`INSERT INTO ${tipo} (nome_${tipo}, texto_${tipo}, produto_sku) VALUES (?, ?, ?)`, [detalhe.nome, detalhe.texto, skuNumero])
      }
    }

    if (imagensEnviadas.length) {
      const novasImagens = []
      for (const [indice, imagem] of imagensEnviadas.entries()) {
        const gravada = await gravarImagemProduto(imagem.buffer, skuNumero, indice + 1, imagem.extensao)
        arquivosCriados.push(gravada.caminhoArquivo)
        novasImagens.push({ ordem: indice + 1, url: gravada.url })
      }

      await conexaoBanco.query('DELETE FROM imagem_produto WHERE produto_sku = ?', [skuNumero])
      for (const imagem of novasImagens) {
        await conexaoBanco.query(
          'INSERT INTO imagem_produto (ordem, url, produto_sku) VALUES (?, ?, ?)',
          [imagem.ordem, imagem.url, skuNumero]
        )
      }
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
    await Promise.all(arquivosCriados.map(caminho => fs.unlink(caminho).catch(() => {})))
  } else if (imagensEnviadas.length) {
    await Promise.all(imagensAnteriores.map(imagem => removerImagemLocalSeNaoUsada(imagem.url)))
  }

  if (falha) {
    let status = 500
    let erro = 'Não foi possível salvar o produto. Confira a conexão e os dados do banco.'
    if (falha.status === 400) {
      status = 400
      erro = falha.message
    } else if (falha.status === 409) {
      // Mostra o formulário de novo já com o estoque atual do banco
      status = 409
      erro = falha.message
      valores.estoque_produto = String(falha.estoqueAtual)
      valores.estoque_original = String(falha.estoqueAtual)
    } else if (falha.code === 'ER_DUP_ENTRY') {
      status = 400
      erro = 'Esse SKU ou código EAN já está cadastrado.'
    } else if (falha.code === 'ER_NO_REFERENCED_ROW_2') {
      status = 400
      erro = 'A marca, categoria ou subcategoria selecionada não existe mais. Selecione novamente.'
    } else {
      console.error('Falha ao salvar produto:', falha.code)
    }
    return mostrarFormulario(res, { erro, valores, editando, status })
  }
  res.redirect(editando ? '/admin/produtos/' + skuNumero + '/editar?salvo=1' : '/admin/produtos/novo?salvo=1')
})

module.exports = router
