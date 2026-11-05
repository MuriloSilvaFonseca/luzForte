const express = require('express')
const conexao = require('../config/database')
const { userEstaLogado, userAdmin } = require('../middlewares/auth')
const { statusInfo, transicoes } = require('../services/status-pedido')
const router = express.Router()

router.use(userEstaLogado, userAdmin)
router.use(require('../middlewares/avaliacoes-pendentes'))
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

const conexaoBanco = () => conexao.promise()

router.get('/pedidos', async (req, res) => {
  const { status = '', q = '', usuario = '', de = '', ate = '', pagina: paginaPedida = '1' } = req.query
  if (![status, q, usuario, de, ate, paginaPedida].every(valor => typeof valor === 'string')) {
    return res.status(400).send('Filtros de pedidos inválidos.')
  }
  if ((status && !Object.hasOwn(statusInfo, status)) || !dataPedidoValida(de) || !dataPedidoValida(ate) ||
      (usuario && (!/^\d+$/.test(usuario) || Number(usuario) < 1)) ||
      (de && ate && de > ate) || !/^\d+$/.test(paginaPedida) ||
      !Number.isSafeInteger(Number(paginaPedida)) || Number(paginaPedida) < 1) {
    return res.status(400).send('Filtros de pedidos inválidos.')
  }

  const filtros = { status, q: q.trim(), usuario, de, ate }
  const condicoes = ["p.status <> 'carrinho'"]
  const valores = []
  if (status) { condicoes.push('p.status = ?'); valores.push(status) }
  if (filtros.q) {
    condicoes.push("(CAST(p.id_pedido AS CHAR) LIKE CONCAT('%', ?, '%') OR u.nome_usuario LIKE CONCAT('%', ?, '%'))")
    valores.push(filtros.q.replace(/^#/, ''), filtros.q)
  }
  if (usuario) { condicoes.push('p.usuario_id = ?'); valores.push(Number(usuario)) }
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
             u.nome_usuario AS cliente, u.email, f.nome_pagamento AS pagamento, p.status, p.total, p.observacoes,
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

    return res.render('admin/pedidos', { pedidos, filtros, pagina, totalPaginas, contagens, statusInfo, salvo: req.query.salvo === '1' })
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

router.get('/pedidos/:id/detalhes', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ erro: 'Pedido inválido.' })
  }

  try {
    const banco = conexaoBanco()
    const [[pedido]] = await banco.execute(`
      SELECT p.id_pedido AS id, DATE_FORMAT(p.data_criacao, '%d/%m/%Y %H:%i') AS data,
             p.status, p.total, p.observacoes, u.nome_usuario AS cliente, u.email,
             f.nome_pagamento AS pagamento
      FROM pedido p
      LEFT JOIN usuario u ON u.id_usuario = p.usuario_id
      LEFT JOIN forma_pagamento f ON f.id_forma_pagamento = p.forma_pagamento_id
      WHERE p.id_pedido = ?`, [id])

    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' })

    const [itens] = await banco.execute(`
      SELECT pp.produto_sku AS sku, p.titulo_produto AS produto, pp.quantidade,
             pp.preco_unitario, pp.subtotal
      FROM produto_pedido pp
      JOIN produto p ON p.sku = pp.produto_sku
      WHERE pp.pedido_id = ?
      ORDER BY p.titulo_produto`, [id])

    return res.json({ pedido, itens })
  } catch (erro) {
    console.error('Erro ao carregar detalhes do pedido:', erro.code || erro.message)
    return res.status(500).json({ erro: 'Não foi possível carregar os detalhes do pedido.' })
  }
})

router.post('/pedidos/:id/status', async (req, res) => {
  const anterior = req.body?.status_atual
  const novo = req.body?.status
  if (!Object.hasOwn(statusInfo, anterior || '') || !['aprovado', 'finalizado', 'cancelado'].includes(novo)) {
    return res.status(400).send('Status ou pedido inválido.')
  }
  await mudarStatusPedido(req, res, novo, req.body?.motivo_cancelamento, anterior)
})

router.post('/pedidos/:id/aprovar', async (req, res) => {
  await mudarStatusPedido(req, res, 'aprovado')
})

router.post('/pedidos/:id/cancelar', async (req, res) => {
  await mudarStatusPedido(req, res, 'cancelado', req.body && req.body.motivo_cancelamento)
})

router.post('/pedidos/:id/retirar', async (req, res) => {
  await mudarStatusPedido(req, res, 'finalizado')
})

async function mudarStatusPedido(req, res, novoStatus, motivoCancelamento, statusEsperado) {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.redirect('/admin/pedidos')
  }

  const motivo = novoStatus === 'cancelado' && typeof motivoCancelamento === 'string'
    ? motivoCancelamento.trim()
    : ''
  if (novoStatus === 'cancelado' && (motivo.length < 3 || motivo.length > 1000)) {
    return res.status(400).send('Informe um motivo de cancelamento entre 3 e 1000 caracteres.')
  }

  let conexao
  let transacaoAberta = false

  try {
    conexao = await conexaoBanco().getConnection()
    await conexao.beginTransaction()
    transacaoAberta = true

    const [[pedido]] = await conexao.execute(
      'SELECT status, observacoes FROM pedido WHERE id_pedido = ? FOR UPDATE',
      [id]
    )
    if (!pedido) {
      await conexao.rollback()
      transacaoAberta = false
      return res.redirect('/admin/pedidos')
    }

    const statusAtual = pedido.status
    if (statusEsperado && statusAtual !== statusEsperado) {
      await conexao.rollback()
      transacaoAberta = false
      return res.status(409).send('O status mudou. Recarregue os pedidos.')
    }
    // Mudanças permitidas ficam em services/status-pedido.js (solicitado -> aprovado/cancelado; aprovado -> finalizado/cancelado)
    const mudancaPermitida = (transicoes[statusAtual] || []).includes(novoStatus)
    if (!mudancaPermitida) {
      await conexao.rollback()
      transacaoAberta = false
      return res.status(400).send('Essa mudança de status não é permitida.')
    }

    if (novoStatus === 'aprovado') {
      const [itens] = await conexao.execute(
        'SELECT produto_sku, quantidade FROM produto_pedido WHERE pedido_id = ? FOR UPDATE',
        [id]
      )

      for (const item of itens) {
        const [[produto]] = await conexao.execute(
          'SELECT estoque_produto, custo_produto FROM produto WHERE sku = ? FOR UPDATE',
          [item.produto_sku]
        )
        if (!produto || Number(produto.estoque_produto) < Number(item.quantidade)) {
          await conexao.rollback()
          transacaoAberta = false
          return res.status(409).send('Não há estoque suficiente para aprovar este pedido.')
        }
        item.custo = produto.custo_produto
      }

      for (const item of itens) {
        await conexao.execute(
          'UPDATE produto SET estoque_produto = estoque_produto - ? WHERE sku = ?',
          [item.quantidade, item.produto_sku]
        )
        // Guarda o custo do momento da venda: o lucro não muda se o custo do produto mudar depois
        await conexao.execute(
          'UPDATE produto_pedido SET custo_unitario = ? WHERE pedido_id = ? AND produto_sku = ?',
          [item.custo, id, item.produto_sku]
        )
      }
    }

    // Pedido aprovado já tinha baixado o estoque: ao cancelar, as unidades voltam para a loja
    if (novoStatus === 'cancelado' && statusAtual === 'aprovado') {
      const [itens] = await conexao.execute(
        'SELECT produto_sku, quantidade FROM produto_pedido WHERE pedido_id = ? FOR UPDATE',
        [id]
      )
      for (const item of itens) {
        await conexao.execute(
          'UPDATE produto SET estoque_produto = estoque_produto + ? WHERE sku = ?',
          [item.quantidade, item.produto_sku]
        )
      }
    }

    if (novoStatus === 'cancelado') {
      const observacoesAnteriores = String(pedido.observacoes || '').trim()
      const observacoes = observacoesAnteriores
        ? observacoesAnteriores + '\nMotivo do cancelamento: ' + motivo
        : 'Motivo do cancelamento: ' + motivo
      await conexao.execute('UPDATE pedido SET status = ?, observacoes = ? WHERE id_pedido = ?', [novoStatus, observacoes, id])
    } else {
      await conexao.execute('UPDATE pedido SET status = ? WHERE id_pedido = ?', [novoStatus, id])
    }
    await conexao.commit()
    transacaoAberta = false
    res.redirect('/admin/pedidos?status=' + novoStatus)
  } catch (erro) {
    if (transacaoAberta) {
      try { await conexao.rollback() }
      catch (falha) { console.error('Falha ao desfazer status:', falha.code) }
    }
    console.error('Erro ao mudar status do pedido:', erro.code || erro.message)
    res.status(500).send('Não foi possível alterar o pedido.')
  } finally {
    if (conexao) conexao.release()
  }
}

router.post('/usuarios/:id/perfil', async (req, res, next) => {
  const id = Number(req.params.id)
  const novoPerfil = String(req.body.perfil || '').trim()

  if (!Number.isInteger(id) || id < 1 || !['cliente', 'admin'].includes(novoPerfil)) {
    return res.redirect('/admin/usuarios')
  }

  // O admin não muda o próprio perfil (evita se rebaixar sem querer e perder o acesso)
  if (id === Number(req.session.usuario.id_usuario)) {
    return res.status(403).send('Você não pode alterar o próprio perfil.')
  }

  let banco
  let transacaoAberta = false
  try {
    banco = await conexao.promise().getConnection()
    await banco.beginTransaction()
    transacaoAberta = true
    // Trava as contas de admin ativas: duas mudanças ao mesmo tempo não conseguem
    // deixar a loja sem nenhum administrador
    const [admins] = await banco.execute(
      "SELECT id_usuario FROM usuario WHERE acesso = 'admin' AND ativo = 1 FOR UPDATE")
    const rebaixandoAdmin = novoPerfil === 'cliente' && admins.some(a => Number(a.id_usuario) === id)
    if (rebaixandoAdmin && admins.length <= 1) {
      await banco.rollback()
      transacaoAberta = false
      return res.status(409).send('A loja precisa ter pelo menos um administrador ativo.')
    }
    await banco.execute('UPDATE usuario SET acesso = ? WHERE id_usuario = ?', [novoPerfil, id])
    await banco.commit()
    transacaoAberta = false
    res.redirect('/admin/usuarios')
  } catch (erro) {
    if (transacaoAberta) {
      try { await banco.rollback() } catch (_) {}
    }
    next(erro)
  } finally {
    if (banco) banco.release()
  }
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
