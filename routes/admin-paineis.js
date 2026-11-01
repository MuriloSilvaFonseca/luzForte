// Rotas das páginas do painel.
// Pedidos e avaliações já usam o banco de dados. Produtos, usuários e a visão geral
// ainda usam dados FICTÍCIOS (em memória; voltam ao normal quando o servidor reinicia).
const express = require('express')
const conexao = require('../config/database')
const { userEstaLogado, userAdmin } = require('../middlewares/auth')
const router = express.Router()

router.use(userEstaLogado, userAdmin)

const POR_PAGINA = 10
const ESTOQUE_BAIXO = 5

const conexaoBanco = () => conexao.promise()

// ---------- Dados fictícios ----------
const marcas = [{ id: 1, nome: 'Philips' }, { id: 2, nome: 'Osram' }]
const subcategorias = [
  { id: 1, nome: 'Lâmpadas > LED' },
  { id: 2, nome: 'Fitas' },
  { id: 3, nome: 'Refletores' }
]

const motivosRecusa = [
  'Linguagem ofensiva ou discriminatória',
  'Spam ou propaganda',
  'Não se refere ao produto',
  'Contém dados pessoais',
  'Outro motivo'
]

const produtos = [
  { sku: 1001, ean: '7891000100103', titulo: 'Lâmpada LED 9W branca', subcategoria: 'Lâmpadas > LED', marcaId: 1, marca: 'Philips', custo: 6.5, preco: 14.9, estoque: 120, ativo: 'ativo', imagem: '' },
  { sku: 1002, ean: '7891000100202', titulo: 'Fita LED 5m RGB', subcategoria: 'Fitas', marcaId: 2, marca: 'Osram', custo: 32, preco: 79.9, estoque: 4, ativo: 'ativo', imagem: '' },
  { sku: 1003, ean: '7891000100301', titulo: 'Refletor LED 50W', subcategoria: 'Refletores', marcaId: 1, marca: 'Philips', custo: 48, preco: 119.9, estoque: 2, ativo: 'oculto', imagem: '' }
]

// "chave" é o id do status usado nos chips; "status" é o texto mostrado na tela
const pedidos = [
  { id: 2041, data: '17/10/2026', cliente: 'Carlos Menezes', email: 'carlos@email.com', pagamento: 'Pix', chave: 'pago', status: 'Pago', statusCor: 'green', itens: 3, total: 289.9 },
  { id: 2040, data: '17/10/2026', cliente: 'Ana Paula', email: 'ana@email.com', pagamento: 'Boleto', chave: 'aguardando', status: 'Aguardando pagamento', statusCor: 'yellow', itens: 1, total: 89.5 },
  { id: 2039, data: '16/10/2026', cliente: 'Marina Souza', email: 'marina@email.com', pagamento: 'Cartão', chave: 'enviado', status: 'Enviado', statusCor: 'blue', itens: 5, total: 412 }
]

// ---------- Auxiliares ----------
const minusculo = (v) => String(v || '').trim().toLowerCase()

function paginar(lista, paginaPedida) {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pagina = Math.min(Math.max(parseInt(paginaPedida, 10) || 1, 1), totalPaginas)
  const inicio = (pagina - 1) * POR_PAGINA
  return { itens: lista.slice(inicio, inicio + POR_PAGINA), pagina, totalPaginas }
}

// ---------- Pedidos ----------
const statusInfo = {
  carrinho: { rotulo: 'Carrinho', cor: 'gray' },
  solicitado: { rotulo: 'Solicitado', cor: 'yellow' },
  aprovado: { rotulo: 'Aprovado', cor: 'blue' },
  finalizado: { rotulo: 'Finalizado', cor: 'green' },
  cancelado: { rotulo: 'Cancelado', cor: 'red' }
}

function dataPedidoValida(valor) {
  if (!valor) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const data = new Date(valor + 'T00:00:00Z')
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor
}

router.get('/pedidos', async (req, res) => {
  const { status = '', q = '', de = '', ate = '', pagina: paginaPedida = '1' } = req.query
  if (![status, q, de, ate, paginaPedida].every(valor => typeof valor === 'string')) {
    return res.status(400).send('Filtros de pedidos inválidos.')
  }
  if ((status && !Object.hasOwn(statusInfo, status)) || !dataPedidoValida(de) || !dataPedidoValida(ate) ||
      (de && ate && de > ate) || !/^\d+$/.test(paginaPedida) ||
      !Number.isSafeInteger(Number(paginaPedida)) || Number(paginaPedida) < 1) {
    return res.status(400).send('Filtros de pedidos inválidos.')
  }

  const filtros = { status, q: q.trim(), de, ate }
  const condicoes = []
  const valores = []
  if (status) { condicoes.push('p.status = ?'); valores.push(status) }
  if (filtros.q) {
    condicoes.push("(CAST(p.id_pedido AS CHAR) LIKE CONCAT('%', ?, '%') OR u.nome_usuario LIKE CONCAT('%', ?, '%'))")
    valores.push(filtros.q.replace(/^#/, ''), filtros.q)
  }
  if (de) { condicoes.push('p.data_criacao >= ?'); valores.push(de) }
  if (ate) { condicoes.push('p.data_criacao < DATE_ADD(?, INTERVAL 1 DAY)'); valores.push(ate) }
  const where = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : ''

  try {
    const banco = conexao.promise()
    const [[contagem]] = await banco.query(`
      SELECT COUNT(*) AS total FROM pedido p
      LEFT JOIN usuario u ON u.id_usuario = p.usuario_id
      ${where}`, valores)
    const totalPaginas = Math.max(1, Math.ceil(Number(contagem.total) / POR_PAGINA))
    const pagina = Math.min(Number(paginaPedida), totalPaginas)
    const [pedidos] = await banco.query(`
      SELECT p.id_pedido AS id, DATE_FORMAT(p.data_criacao, '%d/%m/%Y') AS data,
             u.nome_usuario AS cliente, u.email, f.nome_pagamento AS pagamento, p.status, p.total,
             COALESCE((SELECT SUM(pp.quantidade) FROM produto_pedido pp WHERE pp.pedido_id = p.id_pedido), 0) AS itens
      FROM pedido p
      LEFT JOIN usuario u ON u.id_usuario = p.usuario_id
      LEFT JOIN forma_pagamento f ON f.id_forma_pagamento = p.forma_pagamento_id
      ${where}
      ORDER BY p.data_criacao DESC, p.id_pedido DESC
      LIMIT ? OFFSET ?`, [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA])
    const [totaisStatus] = await banco.query('SELECT status, COUNT(*) AS total FROM pedido GROUP BY status')
    const contagens = { todos: 0 }
    totaisStatus.forEach(linha => {
      contagens[linha.status] = Number(linha.total)
      contagens.todos += Number(linha.total)
    })

    return res.render('admin/pedidos', { pedidos, filtros, pagina, totalPaginas, contagens, statusInfo })
  } catch (erro) {
    console.error('Erro ao listar pedidos:', erro.code || erro.message)
    return res.status(500).send('Não foi possível carregar os dados dos pedidos.')
  }
})

// Troca o status de um pedido sem aceitar status enviado pelo cliente.
router.post('/pedidos/:id/aprovar', async (req, res) => {
  await mudarStatusPedido(req, res, 'aprovado')
})

router.post('/pedidos/:id/cancelar', async (req, res) => {
  await mudarStatusPedido(req, res, 'cancelado')
})

router.post('/pedidos/:id/finalizar', async (req, res) => {
  await mudarStatusPedido(req, res, 'finalizado')
})

router.post('/pedidos/:id/retirar', async (req, res) => {
  await mudarStatusPedido(req, res, 'finalizado')
})

async function mudarStatusPedido(req, res, novoStatus) {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.redirect('/admin/pedidos')
  }

  const conexao = await conexaoBanco().getConnection()
  let transacaoAberta = false

  try {
    await conexao.beginTransaction()
    transacaoAberta = true

    const [[pedido]] = await conexao.execute(
      'SELECT status FROM pedido WHERE id_pedido = ? FOR UPDATE',
      [id]
    )
    if (!pedido) {
      await conexao.rollback()
      transacaoAberta = false
      return res.redirect('/admin/pedidos')
    }

    const statusAtual = pedido.status
    const mudancaPermitida =
      (statusAtual === 'solicitado' && ['aprovado', 'cancelado'].includes(novoStatus)) ||
      (statusAtual === 'aprovado' && ['finalizado', 'cancelado'].includes(novoStatus))
    if (!mudancaPermitida) {
      await conexao.rollback()
      transacaoAberta = false
      return res.redirect('/admin/pedidos')
    }

    // Aprovar baixa o estoque uma vez. Uma aprovação repetida não é permitida.
    if (novoStatus === 'aprovado') {
      const [itens] = await conexao.execute(
        'SELECT produto_sku, quantidade FROM produto_pedido WHERE pedido_id = ? FOR UPDATE',
        [id]
      )

      for (const item of itens) {
        const [[produto]] = await conexao.execute(
          'SELECT estoque_produto FROM produto WHERE sku = ? FOR UPDATE',
          [item.produto_sku]
        )
        if (!produto || Number(produto.estoque_produto) < Number(item.quantidade)) {
          await conexao.rollback()
          transacaoAberta = false
          return res.status(409).send('Não há estoque suficiente para aprovar este pedido.')
        }
      }

      for (const item of itens) {
        await conexao.execute(
          'UPDATE produto SET estoque_produto = estoque_produto - ? WHERE sku = ?',
          [item.quantidade, item.produto_sku]
        )
      }
    }

    await conexao.execute('UPDATE pedido SET status = ? WHERE id_pedido = ?', [novoStatus, id])
    await conexao.commit()
    transacaoAberta = false
    res.redirect('/admin/pedidos?status=' + novoStatus)
  } catch (erro) {
    if (transacaoAberta) await conexao.rollback()
    console.error('Erro ao mudar status do pedido:', erro.code || erro.message)
    res.status(500).send('Não foi possível alterar o pedido.')
  } finally {
    conexao.release()
  }
}

// Disponibiliza o número do menu "Avaliações" em todas as telas do admin
router.use(async (req, res, next) => {
  res.locals.avaliacoesPendentes = 0
  try {
    const [[linha]] = await conexao.promise().query(
      "SELECT COUNT(*) AS n FROM avaliacao_produto WHERE status = 'pendente'")
    res.locals.avaliacoesPendentes = Number(linha.n)
  } catch (erro) {
    // O menu não deve derrubar as outras telas se o banco falhar.
    console.error('Falha ao contar avaliações pendentes:', erro.code || erro.message)
  }
  next()
})

// ---------- Visão geral ----------
router.get('/', (req, res) => {
  const baixo = produtos.filter(p => p.estoque <= ESTOQUE_BAIXO)
  res.render('admin/visao-geral', {
    resumo: {
      pedidosHoje: 7,
      pedidosAguardando: 3,
      faturamentoMes: 18452.9,
      produtosAtivos: 124,
      estoqueBaixo: baixo.length,
      avaliacoesPendentes: res.locals.avaliacoesPendentes
    },
    ultimosPedidos: pedidos.slice(0, 3),
    estoqueBaixoLista: baixo.map(p => ({ titulo: p.titulo, sku: p.sku, estoque: p.estoque }))
  })
})

// ---------- Produtos ----------
router.get('/produtos', (req, res) => {
  const { q = '', status = '', marca = '', estoque = '' } = req.query
  let lista = produtos.slice()
  if (q) lista = lista.filter(p => minusculo(p.titulo + ' ' + p.sku + ' ' + p.ean).includes(minusculo(q)))
  if (status) lista = lista.filter(p => p.ativo === status)
  if (marca) lista = lista.filter(p => p.marcaId === Number(marca))
  if (estoque === 'baixo') lista = lista.filter(p => p.estoque <= ESTOQUE_BAIXO)

  const { itens, pagina, totalPaginas } = paginar(lista, req.query.pagina)
  res.render('admin/produtos', {
    total: lista.length, pagina, totalPaginas,
    filtros: { q, status, marca, estoque },
    marcas,
    produtos: itens
  })
})

router.get('/produtos/novo', (req, res) => {
  res.render('admin/cadastro-produto', {
    marcas, subcategorias,
    erro: '',
    salvo: req.query.salvo === '1'
  })
})

router.post('/produtos/novo', (req, res) => {
  const b = req.body || {}
  const sku = Number(b.sku)
  const marca = marcas.find(m => m.id === Number(b.marca_id))
  const subcategoria = subcategorias.find(s => s.id === Number(b.subcategoria_id))

  let erro = ''
  if (!minusculo(b.titulo_produto)) erro = 'Informe o nome do produto.'
  else if (!Number.isInteger(sku) || sku < 1) erro = 'Informe um SKU válido.'
  else if (produtos.some(p => p.sku === sku)) erro = 'Já existe um produto com esse SKU.'
  else if (!marca || !subcategoria) erro = 'Selecione a marca e a subcategoria.'
  else if (!(Number(b.custo_produto) >= 0) || !(Number(b.preco_produto) >= 0)) erro = 'Informe custo e preço válidos.'

  if (erro) {
    return res.status(400).render('admin/cadastro-produto', { marcas, subcategorias, erro, salvo: false })
  }

  // No projeto real: INSERT INTO produto ...
  produtos.unshift({
    sku,
    ean: String(b.GTIN_EAN || ''),
    titulo: String(b.titulo_produto).trim(),
    subcategoria: subcategoria.nome,
    marcaId: marca.id,
    marca: marca.nome,
    custo: Number(b.custo_produto),
    preco: Number(b.preco_produto),
    estoque: Number(b.estoque_produto) || 0,
    ativo: ['ativo', 'desativado', 'oculto'].includes(b.ativo) ? b.ativo : 'ativo',
    imagem: String(b.imagem_url || '')
  })
  res.redirect('/admin/produtos/novo?salvo=1')
})

// ---------- Usuários ----------
router.get('/usuarios', async (req, res, next) => {
  const q = String(req.query.q || '').trim()
  const perfil = String(req.query.perfil || '').trim()
  const situacao = String(req.query.situacao || '').trim()
  const paginaPedida = Math.max(parseInt(req.query.pagina, 10) || 1, 1)
  const condicoes = []
  const valores = []

  if (q) {
    condicoes.push('(u.nome_usuario LIKE ? OR u.email LIKE ?)')
    const busca = `%${q}%`
    valores.push(busca, busca)
  }
  if (perfil === 'admin' || perfil === 'cliente') {
    condicoes.push('u.acesso = ?')
    valores.push(perfil)
  }
  // A tabela usuario não possui situação de bloqueio. Todos os usuários reais estão ativos.
  if (situacao === 'bloqueado') {
    condicoes.push('1 = 0')
  }

  const where = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : ''

  try {
    const banco = conexao.promise()
    const [[resultado]] = await banco.execute(
      `SELECT COUNT(*) AS total FROM usuario u ${where}`,
      valores
    )
    const total = Number(resultado.total)
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
    const pagina = Math.min(paginaPedida, totalPaginas)

    // Busca os usuários reais do banco e calcula pedidos e avaliações de cada um.
    const [usuariosBanco] = await banco.execute(`
      SELECT u.id_usuario AS id,
             u.nome_usuario AS nome,
             u.email,
             u.acesso AS perfil,
             'ativo' AS situacao,
             DATE_FORMAT(u.data_criacao, '%d/%m/%Y') AS cadastro,
             (SELECT COUNT(*) FROM pedido p WHERE p.usuario_id = u.id_usuario) AS pedidos,
             (SELECT COUNT(*) FROM avaliacao_produto a WHERE a.usuario_id = u.id_usuario) AS avaliacoes
      FROM usuario u
      ${where}
      ORDER BY u.data_criacao DESC, u.id_usuario DESC
      LIMIT ? OFFSET ?`,
      [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA]
    )

    res.render('admin/usuarios', {
      total,
      pagina,
      totalPaginas,
      filtros: { q, perfil, situacao },
      usuarios: usuariosBanco
    })
  } catch (erro) {
    next(erro)
  }
})

// Altera entre cliente e administrador pelo campo acesso da tabela usuario.
router.post('/usuarios/:id/perfil', async (req, res, next) => {
  const id = Number(req.params.id)
  const novoPerfil = String(req.body.perfil || '').trim()

  if (!Number.isInteger(id) || id < 1 || !['cliente', 'admin'].includes(novoPerfil)) {
    return res.redirect('/admin/usuarios')
  }

  try {
    await conexao.promise().execute(
      'UPDATE usuario SET acesso = ? WHERE id_usuario = ?',
      [novoPerfil, id]
    )
    res.redirect('/admin/usuarios')
  } catch (erro) {
    next(erro)
  }
})

// ---------- Avaliações (lidas e moderadas direto no banco) ----------
// Requer a migração database/migracao_avaliacoes_moderacao.sql
const STATUS_AVALIACAO = ['pendente', 'aprovada', 'rejeitada']
const SEM_RESPOSTA = "(a.resposta IS NULL OR a.resposta = '')"
const LIMITE_AVALIACOES = 100

const comoTexto = (v) => (typeof v === 'string' ? v.trim() : '')
const comoInteiro = (v, min, max) => {
  const n = Number(v)
  return /^\d+$/.test(String(v)) && n >= min && n <= max ? String(n) : ''
}
const dataBR = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

router.get('/avaliacoes', async (req, res) => {
  const status = comoTexto(req.query.status)
  const filtros = {
    status: [...STATUS_AVALIACAO, 'negativas'].includes(status) ? status : '',
    nota: comoInteiro(req.query.nota, 1, 5),
    produto: comoInteiro(req.query.produto, 1, 2147483647),
    q: comoTexto(req.query.q).slice(0, 200)
  }

  const where = []
  const valores = []
  if (filtros.status === 'negativas') where.push('a.nota <= 3 AND ' + SEM_RESPOSTA)
  else if (filtros.status) { where.push('a.status = ?'); valores.push(filtros.status) }
  if (filtros.nota) { where.push('a.nota = ?'); valores.push(Number(filtros.nota)) }
  if (filtros.produto) { where.push('a.produto_sku = ?'); valores.push(Number(filtros.produto)) }
  if (filtros.q) {
    const termo = '%' + filtros.q.replace(/[\\%_]/g, '\\$&') + '%'
    where.push('(a.comentario LIKE ? OR u.nome_usuario LIKE ? OR p.titulo_produto LIKE ?)')
    valores.push(termo, termo, termo)
  }

  try {
    const banco = conexao.promise()
    const [linhas] = await banco.execute(`
      SELECT a.id_avaliacao_produto AS id, a.nota, a.comentario, a.data_criacao, a.status,
             a.resposta, a.motivo_rejeicao, a.produto_sku AS sku,
             p.titulo_produto AS produto, u.nome_usuario AS cliente,
             EXISTS (SELECT 1 FROM produto_pedido pp
                     JOIN pedido pe ON pe.id_pedido = pp.pedido_id
                     WHERE pe.usuario_id = a.usuario_id AND pp.produto_sku = a.produto_sku
                       AND pe.status IN ('aprovado', 'finalizado')) AS compra_verificada
      FROM avaliacao_produto a
      JOIN usuario u ON u.id_usuario = a.usuario_id
      JOIN produto p ON p.sku = a.produto_sku
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY a.data_criacao DESC, a.id_avaliacao_produto DESC
      LIMIT ${LIMITE_AVALIACOES}`, valores)

    // Resumo e contagens olham TODAS as avaliações, independente do filtro aplicado.
    const [[totais]] = await banco.query(`
      SELECT COUNT(*) AS total,
             COALESCE(AVG(nota), 0) AS media,
             COALESCE(SUM(status = 'pendente'), 0) AS pendente,
             COALESCE(SUM(status = 'aprovada'), 0) AS aprovada,
             COALESCE(SUM(status = 'rejeitada'), 0) AS rejeitada,
             COALESCE(SUM(nota <= 3 AND (resposta IS NULL OR resposta = '')), 0) AS negativasSemResposta
      FROM avaliacao_produto`)
    const [linhasDistribuicao] = await banco.query(
      'SELECT nota, COUNT(*) AS qtd FROM avaliacao_produto GROUP BY nota')

    const distribuicao = {}
    linhasDistribuicao.forEach(l => { distribuicao[l.nota] = Number(l.qtd) })

    res.render('admin/avaliacoes', {
      avaliacoes: linhas.map(l => ({
        id: l.id,
        cliente: l.cliente,
        data: dataBR(l.data_criacao),
        compraVerificada: Boolean(l.compra_verificada),
        produto: l.produto,
        sku: l.sku,
        nota: l.nota,
        titulo: '',      // a tabela não tem título; o formulário da loja só envia nota e comentário
        texto: l.comentario || '',
        status: l.status,
        denuncias: 0,    // ainda não existe denúncia no banco
        resposta: l.resposta || '',
        motivoRecusa: l.motivo_rejeicao || ''
      })),
      filtros,
      resumo: { media: Number(totais.media), total: Number(totais.total), distribuicao },
      contagens: {
        todas: Number(totais.total),
        pendente: Number(totais.pendente),
        aprovada: Number(totais.aprovada),
        rejeitada: Number(totais.rejeitada),
        negativasSemResposta: Number(totais.negativasSemResposta)
      }
    })
  } catch (erro) {
    console.error('Erro ao listar avaliações:', erro)
    res.status(500).send('Não foi possível carregar as avaliações.')
  }
})

// Ações de moderação: cada uma monta um UPDATE com SET fixo (nunca vindo do cliente).
const idAvaliacao = (valor) => {
  const n = Number(valor)
  return /^\d+$/.test(String(valor)) && n > 0 && n <= 2147483647 ? n : null
}
const voltarPara = (id) => '/admin/avaliacoes' + (id ? '#avaliacao-' + id : '')

async function atualizarAvaliacao(req, res, montar) {
  const id = idAvaliacao(req.params.id)
  if (!id) return res.redirect(voltarPara())
  const alteracao = montar(req.body || {})
  if (alteracao) {
    try {
      await conexao.promise().execute(
        `UPDATE avaliacao_produto SET ${alteracao.set} WHERE id_avaliacao_produto = ?`,
        [...alteracao.valores, id])
    } catch (erro) {
      console.error('Erro ao atualizar avaliação:', erro)
      return res.status(500).send('Não foi possível atualizar a avaliação.')
    }
  }
  res.redirect(voltarPara(id))
}

router.post('/avaliacoes/:id/aprovar', (req, res) =>
  atualizarAvaliacao(req, res, () => ({ set: "status = 'aprovada', motivo_rejeicao = NULL", valores: [] })))

router.post('/avaliacoes/:id/recusar', (req, res) =>
  atualizarAvaliacao(req, res, (corpo) => motivosRecusa.includes(corpo.motivo)
    ? { set: "status = 'rejeitada', motivo_rejeicao = ?", valores: [corpo.motivo] }
    : null))

router.post('/avaliacoes/:id/responder', (req, res) =>
  atualizarAvaliacao(req, res, (corpo) => {
    const resposta = String(corpo.resposta || '').trim().slice(0, 500)
    return resposta ? { set: 'resposta = ?, data_resposta = NOW()', valores: [resposta] } : null
  }))

module.exports = router
