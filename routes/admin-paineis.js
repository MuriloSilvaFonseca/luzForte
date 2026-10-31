const express = require('express')
const conexao = require('../config/database')
const { userEstaLogado, userAdmin } = require('../middlewares/auth')
const { statusInfo, transicoes, alterarStatusPedido } = require('../services/status-pedido')
const router = express.Router()

router.use(userEstaLogado, userAdmin)
router.use(require('./admin-gestao'))

const POR_PAGINA = 10
const motivosRecusa = [
  'Linguagem ofensiva ou discriminatória',
  'Spam ou propaganda',
  'Não se refere ao produto',
  'Contém dados pessoais',
  'Outro motivo'
]

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
  const condicoes = ["p.status <> 'carrinho'"]
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
    const [totaisStatus] = await banco.query("SELECT status, COUNT(*) AS total FROM pedido WHERE status <> 'carrinho' GROUP BY status")
    const contagens = { todos: 0 }
    totaisStatus.forEach(linha => {
      contagens[linha.status] = Number(linha.total)
      contagens.todos += Number(linha.total)
    })

    return res.render('admin/pedidos', { pedidos, filtros, pagina, totalPaginas, contagens, statusInfo, transicoes, salvo: req.query.salvo === '1' })
  } catch (erro) {
    console.error('Erro ao listar pedidos:', erro.code || erro.message)
    return res.status(500).send('Não foi possível carregar os dados dos pedidos.')
  }
})

router.get('/pedidos/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!/^\d+$/.test(req.params.id) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    return res.status(400).send('Número de pedido inválido.')
  }

  try {
    const banco = conexao.promise()
    const [pedidos] = await banco.query(`
      SELECT p.id_pedido AS id, DATE_FORMAT(p.data_criacao, '%d/%m/%Y %H:%i') AS data,
             p.status, p.valor_produtos, p.total, p.observacoes,
             u.nome_usuario AS cliente, u.email, u.telefone, f.nome_pagamento AS pagamento
      FROM pedido p
      LEFT JOIN usuario u ON u.id_usuario = p.usuario_id
      LEFT JOIN forma_pagamento f ON f.id_forma_pagamento = p.forma_pagamento_id
      WHERE p.id_pedido = ? AND p.status <> 'carrinho'`, [id])
    if (!pedidos.length) return res.status(404).send('Pedido não encontrado.')

    const [itens] = await banco.query(`
      SELECT pp.produto_sku AS sku, p.titulo_produto AS produto,
             pp.quantidade, pp.preco_unitario, pp.subtotal
      FROM produto_pedido pp
      LEFT JOIN produto p ON p.sku = pp.produto_sku
      WHERE pp.pedido_id = ?
      ORDER BY pp.produto_sku`, [id])

    res.render('admin/pedido', { pedido: pedidos[0], itens, statusInfo })
  } catch (erro) {
    console.error('Erro ao consultar pedido:', erro.code || erro.message)
    res.status(500).send('Não foi possível carregar os dados do pedido. Tente novamente.')
  }
})

router.post('/pedidos/:id/status', async (req, res) => {
  try {
    await alterarStatusPedido(req.params.id, req.body?.status_atual, req.body?.status)
    res.redirect('/admin/pedidos?salvo=1#pedido-' + req.params.id)
  } catch (erro) {
    if (!erro.status) console.error('Falha ao mudar status do pedido:', erro.code)
    res.status(erro.status || 500).send(erro.status ? erro.message : 'Não foi possível atualizar o pedido.')
  }
})

router.use(async (req, res, next) => {
  res.locals.avaliacoesPendentes = 0
  try {
    const [[linha]] = await conexao.promise().query(
      "SELECT COUNT(*) AS n FROM avaliacao_produto WHERE status = 'pendente'")
    res.locals.avaliacoesPendentes = Number(linha.n)
  } catch (erro) {
    console.error('Falha ao contar avaliações pendentes:', erro.code || erro.message)
  }
  next()
})

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
        titulo: '',
        texto: l.comentario || '',
        status: l.status,
        denuncias: 0,
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
