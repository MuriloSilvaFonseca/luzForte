// Rotas das páginas do painel.
// Visão geral, pedidos e avaliações usam o banco (PostgreSQL).
// Produtos ficam em routes/admin-produtos.js.
// Usuários ainda usam dados FICTÍCIOS (em memória).
const express = require('express')
const conexao = require('../config/database')
const router = express.Router()

const POR_PAGINA = 10
const ESTOQUE_BAIXO = 5
const LIMITE_AVALIACOES = 100
const INT_MAXIMO = 2147483647

const STATUS_PEDIDO = ['carrinho', 'solicitado', 'aprovado', 'finalizado', 'cancelado']
const STATUS_AVALIACAO = ['pendente', 'aprovada', 'rejeitada']

const motivosRecusa = [
  'Linguagem ofensiva ou discriminatória',
  'Spam ou propaganda',
  'Não se refere ao produto',
  'Contém dados pessoais',
  'Outro motivo'
]

const statusInfo = {
  carrinho: { rotulo: 'Carrinho', cor: 'gray' },
  solicitado: { rotulo: 'Solicitado', cor: 'yellow' },
  aprovado: { rotulo: 'Aprovado', cor: 'blue' },
  finalizado: { rotulo: 'Finalizado', cor: 'green' },
  cancelado: { rotulo: 'Cancelado', cor: 'red' }
}

const corStatus = status => (statusInfo[status] ? statusInfo[status].cor : 'gray')

const usuarios = [
  { id: 1, nome: 'Administrador', email: 'admin@luzforte.com', perfil: 'admin', situacao: 'ativo', cadastro: '01/08/2026', pedidos: 0, avaliacoes: 0 },
  { id: 2, nome: 'Carlos Menezes', email: 'carlos@email.com', perfil: 'cliente', situacao: 'ativo', cadastro: '03/09/2026', pedidos: 4, avaliacoes: 2 },
  { id: 3, nome: 'Usuário 4821', email: 'u4821@email.com', perfil: 'cliente', situacao: 'bloqueado', cadastro: '12/10/2026', pedidos: 0, avaliacoes: 1 }
]

// ---------- Auxiliares ----------
const minusculo = v => String(v || '').trim().toLowerCase()

const comoTexto = v => (typeof v === 'string' ? v.trim() : '')

// Retorna inteiro dentro do intervalo ou null
function comoInteiro(v, minimo = 1, maximo = INT_MAXIMO) {
  const texto = typeof v === 'number' ? String(v) : comoTexto(v)
  if (!/^\d+$/.test(texto)) return null
  const n = Number(texto)
  return Number.isSafeInteger(n) && n >= minimo && n <= maximo ? n : null
}

const paginacao = v => comoInteiro(v, 1) || 1

const escaparLike = v => String(v).replace(/[\\%_]/g, '\\$&')

const montarWhere = condicoes => (condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '')

function dataValida(valor) {
  if (!valor) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const data = new Date(valor + 'T00:00:00Z')
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor
}

function erroServidor(res, mensagem, erro) {
  console.error('[admin]', mensagem, erro && (erro.code || erro.message))
  return res.status(500).send(mensagem)
}

function paginar(lista, paginaPedida) {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pagina = Math.min(Math.max(parseInt(paginaPedida, 10) || 1, 1), totalPaginas)
  const inicio = (pagina - 1) * POR_PAGINA
  return { itens: lista.slice(inicio, inicio + POR_PAGINA), pagina, totalPaginas }
}

// Disponibiliza o número do menu "Avaliações" em todas as telas do admin
router.use(async (req, res, next) => {
  res.locals.avaliacoesPendentes = 0

  try {
    const resultado = await conexao.query(`
      SELECT COUNT(*)::int AS total
      FROM avaliacao_produto
      WHERE status = 'pendente'
    `)
    res.locals.avaliacoesPendentes = resultado.rows[0].total
  } catch (erro) {
    console.error('Falha ao contar avaliações pendentes:', erro.code || erro.message)
  }

  next()
})

/* =========================================================
   VISÃO GERAL
========================================================= */

router.get('/', async (req, res) => {
  try {
    const [
      resultadoPedidos,
      resultadoProdutos,
      resultadoEstoque,
      resultadoAvaliacoes,
      resultadoUltimosPedidos,
      resultadoEstoqueBaixo
    ] = await Promise.all([
      conexao.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE data_criacao >= CURRENT_DATE
              AND data_criacao < CURRENT_DATE + INTERVAL '1 day'
              AND status <> 'carrinho'
          )::int AS pedidos_hoje,
          COUNT(*) FILTER (WHERE status = 'solicitado')::int AS pedidos_aguardando,
          COALESCE(
            SUM(total) FILTER (
              WHERE status IN ('aprovado', 'finalizado')
                AND data_criacao >= DATE_TRUNC('month', CURRENT_DATE)
                AND data_criacao < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            ),
            0
          ) AS faturamento_mes
        FROM pedido
      `),

      conexao.query(`SELECT COUNT(*)::int AS total FROM produto WHERE ativo = 'ativo'`),

      conexao.query(`
        SELECT COUNT(*)::int AS total
        FROM produto
        WHERE estoque_produto <= $1 AND ativo = 'ativo'
      `, [ESTOQUE_BAIXO]),

      conexao.query(`
        SELECT COUNT(*)::int AS total
        FROM avaliacao_produto
        WHERE status = 'pendente'
      `),

      conexao.query(`
        SELECT
          p.id_pedido AS id,
          TO_CHAR(p.data_criacao, 'DD/MM/YYYY') AS data,
          COALESCE(u.nome_usuario, 'Visitante') AS cliente,
          u.email,
          f.nome_pagamento AS pagamento,
          p.status AS chave,
          p.status,
          p.total,
          COALESCE(itens.quantidade, 0)::int AS itens
        FROM pedido p
        LEFT JOIN usuario u ON u.id_usuario = p.usuario_id
        LEFT JOIN forma_pagamento f ON f.id_forma_pagamento = p.forma_pagamento_id
        LEFT JOIN (
          SELECT pedido_id, SUM(quantidade) AS quantidade
          FROM produto_pedido
          GROUP BY pedido_id
        ) itens ON itens.pedido_id = p.id_pedido
        WHERE p.status <> 'carrinho'
        ORDER BY p.data_criacao DESC, p.id_pedido DESC
        LIMIT 5
      `),

      conexao.query(`
        SELECT p.sku, p.titulo_produto AS titulo, p.estoque_produto AS estoque
        FROM produto p
        WHERE p.estoque_produto <= $1 AND p.ativo = 'ativo'
        ORDER BY p.estoque_produto ASC, p.titulo_produto ASC
        LIMIT 10
      `, [ESTOQUE_BAIXO])
    ])

    const pedidos = resultadoPedidos.rows[0]

    res.render('admin/visao-geral', {
      resumo: {
        pedidosHoje: Number(pedidos.pedidos_hoje),
        pedidosAguardando: Number(pedidos.pedidos_aguardando),
        faturamentoMes: Number(pedidos.faturamento_mes),
        produtosAtivos: resultadoProdutos.rows[0].total,
        estoqueBaixo: resultadoEstoque.rows[0].total,
        avaliacoesPendentes: resultadoAvaliacoes.rows[0].total
      },
      ultimosPedidos: resultadoUltimosPedidos.rows.map(p => ({
        ...p,
        total: Number(p.total),
        statusCor: corStatus(p.status)
      })),
      estoqueBaixoLista: resultadoEstoqueBaixo.rows
    })
  } catch (erro) {
    return erroServidor(res, 'Não foi possível carregar a visão geral.', erro)
  }
})

/* =========================================================
   USUÁRIOS (dados fictícios)
========================================================= */

router.get('/usuarios', (req, res) => {
  const { q = '', perfil = '', situacao = '' } = req.query
  let lista = usuarios.slice()
  if (q) lista = lista.filter(u => minusculo(u.nome + ' ' + u.email).includes(minusculo(q)))
  if (perfil) lista = lista.filter(u => u.perfil === perfil)
  if (situacao) lista = lista.filter(u => u.situacao === situacao)

  const { itens, pagina, totalPaginas } = paginar(lista, req.query.pagina)
  res.render('admin/usuarios', {
    total: lista.length, pagina, totalPaginas,
    filtros: { q, perfil, situacao },
    usuarios: itens
  })
})

function alterarSituacao(situacao) {
  return (req, res) => {
    const u = usuarios.find(x => x.id === Number(req.params.id))
    if (u && u.perfil !== 'admin') u.situacao = situacao // admin nunca é bloqueado
    res.redirect('/admin/usuarios')
  }
}
router.post('/usuarios/:id/bloquear', alterarSituacao('bloqueado'))
router.post('/usuarios/:id/desbloquear', alterarSituacao('ativo'))

/* =========================================================
   PEDIDOS
========================================================= */

router.get('/pedidos', async (req, res) => {
  const status = comoTexto(req.query.status)
  const q = comoTexto(req.query.q).slice(0, 200)
  const de = comoTexto(req.query.de)
  const ate = comoTexto(req.query.ate)
  const paginaPedida = comoTexto(req.query.pagina || '1')

  if (
    (status && !STATUS_PEDIDO.includes(status)) ||
    !dataValida(de) ||
    !dataValida(ate) ||
    (de && ate && de > ate) ||
    !/^\d+$/.test(paginaPedida) ||
    !Number.isSafeInteger(Number(paginaPedida)) ||
    Number(paginaPedida) < 1
  ) {
    return res.status(400).send('Filtros de pedidos inválidos.')
  }

  const filtros = { status, q, de, ate }
  // Carrinhos não são pedidos concluídos nem solicitações.
  const condicoes = ["p.status <> 'carrinho'"]
  const valores = []

  if (status) {
    valores.push(status)
    condicoes.push(`p.status = $${valores.length}`)
  }

  if (q) {
    valores.push(`%${escaparLike(q.replace(/^#/, ''))}%`)
    const indiceId = valores.length

    valores.push(`%${escaparLike(q)}%`)
    const indiceNome = valores.length

    condicoes.push(`(
      CAST(p.id_pedido AS TEXT) ILIKE $${indiceId} ESCAPE '\\'
      OR COALESCE(u.nome_usuario, '') ILIKE $${indiceNome} ESCAPE '\\'
    )`)
  }

  if (de) {
    valores.push(de)
    condicoes.push(`p.data_criacao >= $${valores.length}::date`)
  }

  if (ate) {
    valores.push(ate)
    condicoes.push(`p.data_criacao < ($${valores.length}::date + INTERVAL '1 day')`)
  }

  const where = montarWhere(condicoes)

  try {
    const resultadoTotal = await conexao.query(`
      SELECT COUNT(*)::int AS total
      FROM pedido p
      LEFT JOIN usuario u ON u.id_usuario = p.usuario_id
      ${where}
    `, valores)

    const total = resultadoTotal.rows[0].total
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
    const pagina = Math.min(Number(paginaPedida), totalPaginas)

    const resultadoPedidos = await conexao.query(`
      SELECT
        p.id_pedido AS id,
        TO_CHAR(p.data_criacao, 'DD/MM/YYYY') AS data,
        COALESCE(u.nome_usuario, 'Visitante') AS cliente,
        u.email,
        f.nome_pagamento AS pagamento,
        p.status AS chave,
        p.status,
        p.total,
        COALESCE(itens.quantidade, 0)::int AS itens
      FROM pedido p
      LEFT JOIN usuario u ON u.id_usuario = p.usuario_id
      LEFT JOIN forma_pagamento f ON f.id_forma_pagamento = p.forma_pagamento_id
      LEFT JOIN (
        SELECT pedido_id, SUM(quantidade) AS quantidade
        FROM produto_pedido
        GROUP BY pedido_id
      ) itens ON itens.pedido_id = p.id_pedido
      ${where}
      ORDER BY p.data_criacao DESC, p.id_pedido DESC
      LIMIT $${valores.length + 1}
      OFFSET $${valores.length + 2}
    `, [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA])

    const resultadoStatus = await conexao.query(`
      SELECT status, COUNT(*)::int AS total
      FROM pedido
      WHERE status <> 'carrinho'
      GROUP BY status
    `)

    const contagens = { todos: 0 }

    for (const linha of resultadoStatus.rows) {
      contagens[linha.status] = linha.total
      contagens.todos += linha.total
    }

    res.render('admin/pedidos', {
      pedidos: resultadoPedidos.rows.map(p => ({
        ...p,
        id: Number(p.id),
        total: Number(p.total),
        statusCor: corStatus(p.status)
      })),
      filtros,
      pagina,
      totalPaginas,
      contagens,
      statusInfo
    })
  } catch (erro) {
    return erroServidor(res, 'Não foi possível carregar os pedidos.', erro)
  }
})

/* =========================================================
   AVALIAÇÕES
========================================================= */

const idAvaliacao = valor => comoInteiro(valor, 1, INT_MAXIMO)

router.get('/avaliacoes', async (req, res) => {
  const statusRecebido = comoTexto(req.query.status)

  const filtros = {
    status: [...STATUS_AVALIACAO, 'negativas'].includes(statusRecebido) ? statusRecebido : '',
    nota: comoInteiro(req.query.nota, 1, 5),
    produto: comoInteiro(req.query.produto),
    q: comoTexto(req.query.q).slice(0, 200)
  }

  const condicoes = []
  const valores = []

  if (filtros.status === 'negativas') {
    condicoes.push(`a.nota <= 3 AND (a.resposta IS NULL OR a.resposta = '')`)
  } else if (filtros.status) {
    valores.push(filtros.status)
    condicoes.push(`a.status = $${valores.length}`)
  }

  if (filtros.nota) {
    valores.push(filtros.nota)
    condicoes.push(`a.nota = $${valores.length}`)
  }

  if (filtros.produto) {
    valores.push(filtros.produto)
    condicoes.push(`a.produto_sku = $${valores.length}`)
  }

  if (filtros.q) {
    valores.push(`%${escaparLike(filtros.q)}%`)
    const i = valores.length

    condicoes.push(`(
      COALESCE(a.comentario, '') ILIKE $${i} ESCAPE '\\'
      OR u.nome_usuario ILIKE $${i} ESCAPE '\\'
      OR p.titulo_produto ILIKE $${i} ESCAPE '\\'
    )`)
  }

  const where = montarWhere(condicoes)

  try {
    const [resultadoAvaliacoes, resultadoTotais, resultadoDistribuicao] = await Promise.all([
      conexao.query(`
        SELECT
          a.id_avaliacao_produto AS id,
          a.nota,
          a.comentario,
          a.data_criacao,
          a.status,
          a.resposta,
          a.motivo_rejeicao,
          a.produto_sku AS sku,
          p.titulo_produto AS produto,
          u.nome_usuario AS cliente,
          EXISTS (
            SELECT 1
            FROM produto_pedido pp
            JOIN pedido pe ON pe.id_pedido = pp.pedido_id
            WHERE pe.usuario_id = a.usuario_id
              AND pp.produto_sku = a.produto_sku
              AND pe.status IN ('aprovado', 'finalizado')
          ) AS compra_verificada
        FROM avaliacao_produto a
        JOIN usuario u ON u.id_usuario = a.usuario_id
        JOIN produto p ON p.sku = a.produto_sku
        ${where}
        ORDER BY a.data_criacao DESC, a.id_avaliacao_produto DESC
        LIMIT ${LIMITE_AVALIACOES}
      `, valores),

      conexao.query(`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(AVG(nota), 0) AS media,
          COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendente,
          COUNT(*) FILTER (WHERE status = 'aprovada')::int AS aprovada,
          COUNT(*) FILTER (WHERE status = 'rejeitada')::int AS rejeitada,
          COUNT(*) FILTER (
            WHERE nota <= 3 AND (resposta IS NULL OR resposta = '')
          )::int AS negativas_sem_resposta
        FROM avaliacao_produto
      `),

      conexao.query(`
        SELECT nota, COUNT(*)::int AS qtd
        FROM avaliacao_produto
        GROUP BY nota
      `)
    ])

    const totais = resultadoTotais.rows[0]
    const distribuicao = {}

    for (const linha of resultadoDistribuicao.rows) {
      distribuicao[linha.nota] = Number(linha.qtd)
    }

    res.render('admin/avaliacoes', {
      avaliacoes: resultadoAvaliacoes.rows.map(a => ({
        id: Number(a.id),
        cliente: a.cliente,
        data: new Date(a.data_criacao).toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        }),
        compraVerificada: a.compra_verificada,
        produto: a.produto,
        sku: Number(a.sku),
        nota: Number(a.nota),
        titulo: '',
        texto: a.comentario || '',
        status: a.status,
        denuncias: 0,
        resposta: a.resposta || '',
        motivoRecusa: a.motivo_rejeicao || ''
      })),

      filtros,

      resumo: {
        media: Number(totais.media),
        total: Number(totais.total),
        distribuicao
      },

      contagens: {
        todas: Number(totais.total),
        pendente: Number(totais.pendente),
        aprovada: Number(totais.aprovada),
        rejeitada: Number(totais.rejeitada),
        negativasSemResposta: Number(totais.negativas_sem_resposta)
      }
    })
  } catch (erro) {
    return erroServidor(res, 'Não foi possível carregar as avaliações.', erro)
  }
})

async function atualizarAvaliacao(req, res, montar) {
  const id = idAvaliacao(req.params.id)

  if (!id) return res.redirect('/admin/avaliacoes')

  const alteracao = montar(req.body || {})

  if (!alteracao) return res.redirect(`/admin/avaliacoes#avaliacao-${id}`)

  try {
    await conexao.query(
      `UPDATE avaliacao_produto
       SET ${alteracao.set}
       WHERE id_avaliacao_produto = $${alteracao.valores.length + 1}`,
      [...alteracao.valores, id]
    )

    return res.redirect(`/admin/avaliacoes#avaliacao-${id}`)
  } catch (erro) {
    return erroServidor(res, 'Não foi possível atualizar a avaliação.', erro)
  }
}

router.post('/avaliacoes/:id/aprovar', (req, res) =>
  atualizarAvaliacao(req, res, () => ({
    set: "status = 'aprovada', motivo_rejeicao = NULL",
    valores: []
  }))
)

router.post('/avaliacoes/:id/recusar', (req, res) =>
  atualizarAvaliacao(req, res, corpo => {
    if (!motivosRecusa.includes(corpo.motivo)) return null

    return {
      set: "status = 'rejeitada', motivo_rejeicao = $1",
      valores: [corpo.motivo]
    }
  })
)

router.post('/avaliacoes/:id/responder', (req, res) =>
  atualizarAvaliacao(req, res, corpo => {
    const resposta = comoTexto(corpo.resposta).slice(0, 500)

    if (!resposta) return null

    return {
      set: 'resposta = $1, data_resposta = NOW()',
      valores: [resposta]
    }
  })
)

module.exports = router