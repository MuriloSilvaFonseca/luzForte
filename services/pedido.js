const banco = require('../config/database')

function erroPedido(status, mensagem) {
  return Object.assign(new Error(mensagem), { status })
}

async function carregarCheckout(usuarioId) {
  const conexao = banco.promise()
  const [pedidos] = await conexao.execute(
    "SELECT id_pedido, valor_produtos FROM pedido WHERE usuario_id = ? AND status = 'carrinho' ORDER BY id_pedido DESC LIMIT 2",
    [usuarioId]
  )

  if (pedidos.length > 1) throw erroPedido(409, 'Existe mais de um carrinho ativo para esta conta.')

  const [formasPagamento] = await conexao.execute(
    "SELECT id_forma_pagamento, nome_pagamento FROM forma_pagamento WHERE ativo = 'sim' ORDER BY nome_pagamento"
  )

  if (!pedidos.length) return { itens: [], total: '0.00', formasPagamento }

  const [itens] = await conexao.execute(
    `SELECT pp.produto_sku, p.titulo_produto, pp.quantidade, pp.preco_unitario, pp.subtotal
     FROM produto_pedido pp
     JOIN produto p ON p.sku = pp.produto_sku
     WHERE pp.pedido_id = ?
     ORDER BY p.titulo_produto`,
    [pedidos[0].id_pedido]
  )

  return { itens, total: pedidos[0].valor_produtos, formasPagamento }
}

async function finalizarPedido(usuarioId, formaPagamentoId) {
  if (!Number.isInteger(formaPagamentoId) || formaPagamentoId <= 0) {
    throw erroPedido(400, 'Selecione uma forma de pagamento.')
  }

  const conexao = await banco.promise().getConnection()
  let transacao = false

  try {
    await conexao.beginTransaction()
    transacao = true

    const [pedidos] = await conexao.execute(
      "SELECT id_pedido FROM pedido WHERE usuario_id = ? AND status = 'carrinho' ORDER BY id_pedido DESC LIMIT 2 FOR UPDATE",
      [usuarioId]
    )

    if (!pedidos.length) throw erroPedido(404, 'Não há produtos no carrinho para finalizar.')
    if (pedidos.length > 1) throw erroPedido(409, 'Existe mais de um carrinho ativo para esta conta.')

    const pedidoId = pedidos[0].id_pedido
    const [itens] = await conexao.execute(
      'SELECT produto_sku FROM produto_pedido WHERE pedido_id = ? FOR UPDATE',
      [pedidoId]
    )
    if (!itens.length) throw erroPedido(400, 'Adicione pelo menos um produto antes de finalizar o pedido.')

    const [formasPagamento] = await conexao.execute(
      "SELECT id_forma_pagamento FROM forma_pagamento WHERE id_forma_pagamento = ? AND ativo = 'sim'",
      [formaPagamentoId]
    )
    if (!formasPagamento.length) throw erroPedido(400, 'A forma de pagamento selecionada não está disponível.')

    const [totais] = await conexao.execute(
      'SELECT COALESCE(SUM(subtotal), 0) AS total FROM produto_pedido WHERE pedido_id = ?',
      [pedidoId]
    )

    await conexao.execute(
      "UPDATE pedido SET valor_produtos = ?, total = ?, forma_pagamento_id = ?, status = 'solicitado' WHERE id_pedido = ? AND usuario_id = ? AND status = 'carrinho'",
      [totais[0].total, totais[0].total, formaPagamentoId, pedidoId, usuarioId]
    )

    await conexao.commit()
    transacao = false
    return { pedidoId, total: totais[0].total }
  } catch (erro) {
    if (transacao) await conexao.rollback()
    throw erro
  } finally {
    conexao.release()
  }
}

async function buscarPedidoFinalizado(usuarioId, pedidoId) {
  const conexao = banco.promise()
  const [pedidos] = await conexao.execute(
    `SELECT p.id_pedido, p.total, p.status, fp.nome_pagamento, u.nome_usuario AS nome_cliente
     FROM pedido p
     JOIN usuario u ON u.id_usuario = p.usuario_id
     LEFT JOIN forma_pagamento fp ON fp.id_forma_pagamento = p.forma_pagamento_id
     WHERE p.id_pedido = ? AND p.usuario_id = ? AND p.status = 'solicitado'`,
    [pedidoId, usuarioId]
  )
  if (!pedidos.length) return null

  // Itens do pedido, usados na mensagem do WhatsApp
  const [itens] = await conexao.execute(
    `SELECT p.titulo_produto, pp.quantidade, pp.subtotal
     FROM produto_pedido pp
     JOIN produto p ON p.sku = pp.produto_sku
     WHERE pp.pedido_id = ?
     ORDER BY p.titulo_produto`,
    [pedidoId]
  )

  return { ...pedidos[0], itens }
}

module.exports = { carregarCheckout, finalizarPedido, buscarPedidoFinalizado }
