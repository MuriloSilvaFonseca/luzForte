const express = require('express')
const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { Transform } = require('node:stream')

const banco = require('../config/database')

const router = express.Router()

const POR_PAGINA = 10
const ESTOQUE_BAIXO = 5
const INT_MAXIMO = 2147483647
const MAX_IMAGENS_PRODUTO = 5
const MAX_BYTES_POR_IMAGEM = 5 * 1024 * 1024
const MAX_BYTES_UPLOAD = MAX_IMAGENS_PRODUTO * MAX_BYTES_POR_IMAGEM + 1024 * 1024

const DIRETORIO_IMAGENS = path.resolve(__dirname, '..', 'public', 'img', 'products')

const statusPermitidos = ['ativo', 'desativado', 'oculto']

const camposProduto = [
  'titulo_produto', 'sku', 'GTIN_EAN', 'ativo', 'marca_id', 'subcategoria_id',
  'custo_produto', 'preco_produto', 'estoque_produto',
  'descricao', 'especificacao', 'instalacao'
]

// ============================================================
// UTILITÁRIOS
// ============================================================

function inteiroValido(valor, minimo = 0) {
  return (
    typeof valor === 'string' &&
    /^\d+$/.test(valor) &&
    Number(valor) >= minimo &&
    Number(valor) <= INT_MAXIMO
  )
}

function dinheiroValido(valor) {
  return (
    typeof valor === 'string' &&
    /^\d+(\.\d{1,2})?$/.test(valor) &&
    Number(valor) <= 99999999.99
  )
}

function mensagemErroBanco(erro) {
  switch (erro.code) {
    case '23505':
      return { status: 400, mensagem: 'Esse SKU ou código EAN já está cadastrado.' }
    case '23503':
      return { status: 400, mensagem: 'A marca ou subcategoria selecionada não existe mais. Selecione novamente.' }
    case '23514':
      return { status: 400, mensagem: 'Um dos valores informados não atende às regras do banco.' }
    case '22P02':
      return { status: 400, mensagem: 'Um dos campos possui um formato inválido.' }
    default:
      return { status: 500, mensagem: 'Não foi possível concluir a operação. Confira a conexão e os dados do banco.' }
  }
}

function registrarErro(contexto, erro) {
  console.error(`[admin] ${contexto}:`, { code: erro.code, message: erro.message })
}

// ============================================================
// LEITURA DO FORMULÁRIO MULTIPART
// ============================================================

function analisarFormularioMultipart(req, res, next) {
  const tipoConteudo = String(req.headers['content-type'] || '').toLowerCase()

  req.files = []

  if (!tipoConteudo.startsWith('multipart/form-data;')) {
    return next()
  }

  let bytesRecebidos = 0

  const limite = new Transform({
    transform(chunk, encoding, callback) {
      bytesRecebidos += chunk.length

      if (bytesRecebidos > MAX_BYTES_UPLOAD) {
        const erro = new Error('O envio ultrapassa o limite permitido.')
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
  })
    .formData()
    .then(formulario => {
      const corpo = {}
      const arquivos = []

      for (const [chave, valor] of formulario.entries()) {
        if (typeof valor === 'string') {
          if (Object.hasOwn(corpo, chave)) {
            corpo[chave] = Array.isArray(corpo[chave])
              ? [...corpo[chave], valor]
              : [corpo[chave], valor]
          } else {
            corpo[chave] = valor
          }
          continue
        }

        if (chave === 'imagens' && valor.name && valor.size) {
          arquivos.push(valor)
        } else if (valor.name && valor.size) {
          req.uploadError = {
            status: 400,
            mensagem: 'Envie os arquivos no campo de imagens do produto.'
          }
        }
      }

      req.body = corpo
      req.files = arquivos

      if (arquivos.length > MAX_IMAGENS_PRODUTO) {
        req.uploadError = {
          status: 400,
          mensagem: `Selecione no máximo ${MAX_IMAGENS_PRODUTO} imagens.`
        }
      }

      next()
    })
    .catch(erro => {
      req.body = {}
      req.files = []

      req.uploadError = {
        status: erro.uploadStatus || 400,
        mensagem:
          erro.uploadStatus === 413
            ? 'O envio ficou muito grande. Cada imagem pode ter até 5 MB.'
            : 'Não foi possível ler as imagens enviadas. Confira os arquivos.'
      }

      next()
    })
}

// ============================================================
// VALIDAÇÃO E ARMAZENAMENTO LOCAL DE IMAGENS
// ============================================================

function tipoImagem(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { extensao: 'png', mime: 'image/png' }
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extensao: 'jpg', mime: 'image/jpeg' }
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { extensao: 'webp', mime: 'image/webp' }
  }

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
    const resultado = await banco.query(
      'SELECT COUNT(*)::int AS total FROM imagem_produto WHERE url = $1',
      [url]
    )

    if (Number(resultado.rows[0].total) === 0) {
      await fs.unlink(path.join(DIRETORIO_IMAGENS, nomeArquivo))
    }
  } catch (erro) {
    registrarErro('Remoção de imagem antiga', erro)
  }
}

// ============================================================
// FORMULÁRIO
// ============================================================

async function mostrarFormulario(
  res,
  { erro = '', valores = {}, status = 200, salvo = false, editando = false } = {}
) {
  let marcas = []
  let subcategorias = []

  try {
    const resultadoMarcas = await banco.query(`
      SELECT id_marca AS id, nome
      FROM marca
      ORDER BY nome, id_marca
    `)
    marcas = resultadoMarcas.rows

    const resultadoSubcategorias = await banco.query(`
      SELECT s.id_subcategoria AS id, CONCAT(c.nome, ' > ', s.nome) AS nome
      FROM subcategoria s
      JOIN categoria c ON c.id_categoria = s.categoria_id
      ORDER BY c.nome, s.nome, s.id_subcategoria
    `)
    subcategorias = resultadoSubcategorias.rows

    if (editando && !Array.isArray(valores.imagens) && valores.sku) {
      const resultadoImagens = await banco.query(
        `SELECT ordem, url FROM imagem_produto WHERE produto_sku = $1 ORDER BY ordem`,
        [Number(valores.sku)]
      )
      valores.imagens = resultadoImagens.rows
    }
  } catch (erroBanco) {
    registrarErro('Carregamento do formulário', erroBanco)

    status = 500
    salvo = false
    erro = 'Não foi possível carregar as marcas e subcategorias. Confira a conexão com o banco.'
  }

  return res.status(status).render('admin/cadastro-produto', {
    marcas, subcategorias, erro, valores, salvo, editando
  })
}

// ============================================================
// DESCRIÇÃO, ESPECIFICAÇÃO E INSTALAÇÃO
// ============================================================

const configuracoesTexto = {
  descricao: { id: 'id_descricao', nome: 'nome_descricao', texto: 'texto_descricao' },
  especificacao: { id: 'id_especificacao', nome: 'nome_especificacao', texto: 'texto_especificacao' },
  instalacao: { id: 'id_instalacao', nome: 'nome_instalacao', texto: 'texto_instalacao' }
}

async function salvarTexto(conexao, tabela, nome, texto, sku, editando) {
  // As tabelas são definidas internamente, nunca pelo formulário.
  const config = configuracoesTexto[tabela]

  if (!config) throw new Error('Tabela de texto não permitida.')

  if (editando) {
    const resultado = await conexao.query(
      `SELECT ${config.id} AS id FROM ${tabela}
       WHERE produto_sku = $1 ORDER BY ${config.id} LIMIT 1`,
      [sku]
    )

    if (resultado.rows.length > 0) {
      const id = resultado.rows[0].id

      if (texto) {
        await conexao.query(
          `UPDATE ${tabela} SET ${config.texto} = $1
           WHERE ${config.id} = $2 AND produto_sku = $3`,
          [texto, id, sku]
        )
      } else {
        await conexao.query(
          `DELETE FROM ${tabela} WHERE ${config.id} = $1 AND produto_sku = $2`,
          [id, sku]
        )
      }

      return
    }
  }

  if (texto) {
    await conexao.query(
      `INSERT INTO ${tabela} (${config.nome}, ${config.texto}, produto_sku)
       VALUES ($1, $2, $3)`,
      [nome, texto, sku]
    )
  }
}

// ============================================================
// LISTAGEM DE PRODUTOS
// ============================================================

router.get('/produtos', async (req, res) => {
  const filtros = {}

  for (const campo of ['q', 'status', 'marca', 'estoque']) {
    if (req.query[campo] !== undefined && typeof req.query[campo] !== 'string') {
      return res.status(400).send('Confira os filtros e tente novamente.')
    }

    filtros[campo] = (req.query[campo] || '').trim()
  }

  if (
    (filtros.status && !statusPermitidos.includes(filtros.status)) ||
    (filtros.marca && !inteiroValido(filtros.marca, 1)) ||
    (filtros.estoque && filtros.estoque !== 'baixo') ||
    (req.query.pagina !== undefined &&
      (typeof req.query.pagina !== 'string' || !inteiroValido(req.query.pagina, 1)))
  ) {
    return res.status(400).send('Confira os filtros e tente novamente.')
  }

  const condicoes = []
  const parametros = []

  if (filtros.q) {
    parametros.push(`%${filtros.q.replace(/[\\%_]/g, '\\$&')}%`)
    const i = parametros.length

    condicoes.push(`(
      p.titulo_produto ILIKE $${i}
      OR CAST(p.sku AS TEXT) ILIKE $${i}
      OR COALESCE(p."GTIN_EAN"::TEXT, '') ILIKE $${i}
    )`)
  }

  if (filtros.status) {
    parametros.push(filtros.status)
    condicoes.push(`p.ativo = $${parametros.length}`)
  }

  if (filtros.marca) {
    parametros.push(Number(filtros.marca))
    condicoes.push(`p.marca_id = $${parametros.length}`)
  }

  if (filtros.estoque === 'baixo') {
    parametros.push(ESTOQUE_BAIXO)
    condicoes.push(`p.estoque_produto <= $${parametros.length}`)
  }

  const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''

  try {
    const resultadoMarcas = await banco.query(`
      SELECT id_marca AS id, nome FROM marca ORDER BY nome, id_marca
    `)

    const resultadoContagem = await banco.query(
      `SELECT COUNT(*)::int AS total FROM produto p ${onde}`,
      parametros
    )

    const total = Number(resultadoContagem.rows[0].total)
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
    const pagina = Math.min(Number(req.query.pagina) || 1, totalPaginas)
    const inicio = (pagina - 1) * POR_PAGINA

    const resultadoProdutos = await banco.query(
      `
        SELECT
          p.sku,
          p."GTIN_EAN" AS ean,
          p.titulo_produto AS titulo,
          CONCAT(c.nome, ' > ', s.nome) AS subcategoria,
          p.marca_id AS "marcaId",
          m.nome AS marca,
          p.custo_produto AS custo,
          p.preco_produto AS preco,
          p.estoque_produto AS estoque,
          p.ativo,
          i.url AS imagem
        FROM produto p
        JOIN marca m ON m.id_marca = p.marca_id
        JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
        JOIN categoria c ON c.id_categoria = s.categoria_id
        LEFT JOIN imagem_produto i
          ON i.produto_sku = p.sku AND i.ordem = 1
        ${onde}
        ORDER BY p.sku ASC
        LIMIT $${parametros.length + 1}
        OFFSET $${parametros.length + 2}
      `,
      [...parametros, POR_PAGINA, inicio]
    )

    return res.render('admin/produtos', {
      produtos: resultadoProdutos.rows.map(p => ({
        ...p,
        sku: Number(p.sku),
        custo: Number(p.custo),
        preco: Number(p.preco),
        estoque: Number(p.estoque)
      })),
      marcas: resultadoMarcas.rows,
      filtros,
      total,
      pagina,
      totalPaginas
    })
  } catch (erro) {
    registrarErro('Listagem de produtos', erro)

    return res.status(500).send(
      'Não foi possível carregar os produtos. Confira a conexão e as tabelas do banco.'
    )
  }
})

// ============================================================
// NOVO PRODUTO (formulário)
// ============================================================

router.get('/produtos/novo', (req, res) => {
  return mostrarFormulario(res, {
    valores: { ativo: 'ativo', estoque_produto: '0' },
    salvo: req.query.salvo === '1'
  })
})

// ============================================================
// EDITAR PRODUTO (formulário)
// ============================================================

router.get('/produtos/:sku/editar', async (req, res) => {
  if (!inteiroValido(req.params.sku, 1)) {
    return res.status(400).send('SKU inválido.')
  }

  try {
    const resultado = await banco.query(
      `
        SELECT
          p.*,
          (SELECT texto_descricao FROM descricao WHERE produto_sku = p.sku ORDER BY id_descricao LIMIT 1) AS descricao,
          (SELECT nome_descricao FROM descricao WHERE produto_sku = p.sku ORDER BY id_descricao LIMIT 1) AS nome_descricao,
          (SELECT texto_especificacao FROM especificacao WHERE produto_sku = p.sku ORDER BY id_especificacao LIMIT 1) AS especificacao,
          (SELECT nome_especificacao FROM especificacao WHERE produto_sku = p.sku ORDER BY id_especificacao LIMIT 1) AS nome_especificacao,
          (SELECT texto_instalacao FROM instalacao WHERE produto_sku = p.sku ORDER BY id_instalacao LIMIT 1) AS instalacao,
          (SELECT nome_instalacao FROM instalacao WHERE produto_sku = p.sku ORDER BY id_instalacao LIMIT 1) AS nome_instalacao
        FROM produto p
        WHERE p.sku = $1
      `,
      [Number(req.params.sku)]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).send('Produto não encontrado.')
    }

    return mostrarFormulario(res, {
      valores: resultado.rows[0],
      editando: true,
      salvo: req.query.salvo === '1'
    })
  } catch (erro) {
    registrarErro('Carregamento do produto para edição', erro)

    return res.status(500).send(
      'Não foi possível carregar o produto. Confira a conexão e as tabelas do banco.'
    )
  }
})

// ============================================================
// CADASTRAR E ATUALIZAR PRODUTO
// ============================================================

router.post(
  ['/produtos/novo', '/produtos/:sku/editar'],
  analisarFormularioMultipart,
  async (req, res) => {
    const editando = req.params.sku !== undefined

    if (editando && !inteiroValido(req.params.sku, 1)) {
      return res.status(400).send('SKU inválido.')
    }

    const corpo =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}

    const valores = {}
    let formatoInvalido = corpo !== req.body

    for (const campo of camposProduto) {
      if (corpo[campo] !== undefined && typeof corpo[campo] !== 'string') {
        formatoInvalido = true
      }

      valores[campo] = typeof corpo[campo] === 'string' ? corpo[campo].trim() : ''
    }

    if (!valores.estoque_produto) valores.estoque_produto = '0'

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

    if (editando && valores.sku !== req.params.sku) {
      mensagem = 'O SKU não pode ser alterado na edição.'
    } else if (formatoInvalido) {
      mensagem = 'Confira os campos enviados e tente novamente.'
    } else if (!valores.titulo_produto || Array.from(valores.titulo_produto).length > 70) {
      mensagem = 'Informe o nome do produto com até 70 caracteres.'
    } else if (!inteiroValido(valores.sku, 1)) {
      mensagem = 'Informe um SKU inteiro entre 1 e 2147483647.'
    } else if (!inteiroValido(valores.marca_id, 1) || !inteiroValido(valores.subcategoria_id, 1)) {
      mensagem = 'Selecione uma marca e uma subcategoria válidas.'
    } else if (!statusPermitidos.includes(valores.ativo)) {
      mensagem = 'Selecione um status válido para o produto.'
    } else if (!dinheiroValido(valores.custo_produto) || !dinheiroValido(valores.preco_produto)) {
      mensagem = 'Informe custo e preço com até duas casas decimais.'
    } else if (!inteiroValido(valores.estoque_produto, 0)) {
      mensagem = 'Informe um estoque inteiro válido.'
    } else if (Array.from(valores.GTIN_EAN).length > 14) {
      mensagem = 'O código EAN deve ter até 14 caracteres.'
    } else if (
      ['descricao', 'especificacao', 'instalacao'].some(
        campo => Buffer.byteLength(valores[campo], 'utf8') > 65535
      )
    ) {
      mensagem = 'Descrição, especificações e instalação devem ter até 65535 bytes cada.'
    }

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
        const tipo = tipoImagem(buffer)

        if (!tipo) {
          mensagem = 'Use imagens PNG, JPG ou WebP válidas.'
          break
        }

        imagensEnviadas.push({ buffer, extensao: tipo.extensao, mime: tipo.mime })
      }
    }

    if (mensagem) {
      if (editando) valores.sku = req.params.sku

      return mostrarFormulario(res, { erro: mensagem, valores, editando, status: 400 })
    }

    const skuNumero = Number(valores.sku)

    let conexao
    let falha = null
    let imagensAnteriores = []
    const arquivosCriados = []

    try {
      // Toda a transação usa o mesmo cliente PostgreSQL.
      conexao = await banco.connect()

      await conexao.query('BEGIN')

      const valoresProduto = [
        valores.titulo_produto,
        Number(valores.estoque_produto),
        valores.preco_produto,
        valores.custo_produto,
        valores.ativo,
        valores.GTIN_EAN || null,
        Number(valores.marca_id),
        Number(valores.subcategoria_id)
      ]

      if (editando) {
        const resultadoProduto = await conexao.query(
          'SELECT sku FROM produto WHERE sku = $1 FOR UPDATE',
          [skuNumero]
        )

        if (resultadoProduto.rows.length === 0) {
          await conexao.query('ROLLBACK')
          return res.status(404).send('Produto não encontrado.')
        }

        const resultadoImagens = await conexao.query(
          `SELECT ordem, url FROM imagem_produto
           WHERE produto_sku = $1 ORDER BY ordem FOR UPDATE`,
          [skuNumero]
        )

        imagensAnteriores = resultadoImagens.rows

        await conexao.query(
          `
            UPDATE produto
            SET titulo_produto = $1,
                estoque_produto = $2,
                preco_produto = $3,
                custo_produto = $4,
                ativo = $5,
                "GTIN_EAN" = $6,
                marca_id = $7,
                subcategoria_id = $8
            WHERE sku = $9
          `,
          [...valoresProduto, skuNumero]
        )
      } else {
        await conexao.query(
          `
            INSERT INTO produto (
              sku, titulo_produto, estoque_produto, preco_produto,
              custo_produto, ativo, "GTIN_EAN", marca_id, subcategoria_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [skuNumero, ...valoresProduto]
        )
      }

      await salvarTexto(conexao, 'descricao', 'Descrição', valores.descricao, skuNumero, editando)
      await salvarTexto(conexao, 'especificacao', 'Especificações', valores.especificacao, skuNumero, editando)
      await salvarTexto(conexao, 'instalacao', 'Orientações de instalação', valores.instalacao, skuNumero, editando)

      // Sem novas imagens na edição, as já cadastradas são mantidas.
      if (imagensEnviadas.length > 0) {
        const novasImagens = []

        for (const [indice, imagem] of imagensEnviadas.entries()) {
          const gravada = await gravarImagemProduto(
            imagem.buffer, skuNumero, indice + 1, imagem.extensao
          )

          arquivosCriados.push(gravada.caminhoArquivo)
          novasImagens.push({ ordem: indice + 1, url: gravada.url })
        }

        await conexao.query('DELETE FROM imagem_produto WHERE produto_sku = $1', [skuNumero])

        for (const imagem of novasImagens) {
          await conexao.query(
            'INSERT INTO imagem_produto (ordem, url, produto_sku) VALUES ($1, $2, $3)',
            [imagem.ordem, imagem.url, skuNumero]
          )
        }
      }

      await conexao.query('COMMIT')
    } catch (erro) {
      falha = erro

      if (conexao) {
        try {
          await conexao.query('ROLLBACK')
        } catch (erroRollback) {
          registrarErro('Rollback do produto', erroRollback)
        }
      }
    } finally {
      if (conexao) conexao.release()
    }

    if (falha) {
      await Promise.all(arquivosCriados.map(caminho => fs.unlink(caminho).catch(() => {})))

      registrarErro('Salvamento do produto', falha)

      const resposta = mensagemErroBanco(falha)

      if (editando) valores.sku = req.params.sku

      return mostrarFormulario(res, {
        erro: resposta.mensagem,
        valores,
        editando,
        status: resposta.status
      })
    }

    if (imagensEnviadas.length > 0) {
      await Promise.all(
        imagensAnteriores.map(imagem => removerImagemLocalSeNaoUsada(imagem.url))
      )
    }

    return res.redirect(
      editando
        ? `/admin/produtos/${skuNumero}/editar?salvo=1`
        : '/admin/produtos/novo?salvo=1'
    )
  }
)

module.exports = router