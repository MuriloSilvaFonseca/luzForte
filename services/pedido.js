const banco = require('../config/database')
const { adquirirLock, liberarLock } = require('./lock-mysql')

function erroPedido(status, mensagem) {
  return Object.assign(new Error(mensagem), { status })
}

function validarSelecao(selecao) {
  if (!Array.isArray(selecao) || !selecao.length || selecao.length > 500 || selecao.some(sku => !Number.isInteger(sku) || sku <= 0 || sku > 2147483647) || new Set(selecao).size !== selecao.length) {
    throw erroPedido(400, 'Selecione ao menos um produto válido no carrinho.')
  }
  return selecao
}

function selecionarItens(itens, selecao) {
  validarSelecao(selecao)
  const selecionados = itens.filter(item => selecao.includes(item.produto_sku))
  if (selecionados.length !== selecao.length) throw erroPedido(409, 'A seleção mudou. Volte ao carrinho e selecione os produtos novamente.')
  for (const item of selecionados) {
    if (item.ativo !== 'ativo' || !Number.isInteger(item.quantidade) || item.quantidade <= 0 || item.quantidade > Number(item.estoque_produto)) {
      throw erroPedido(409, 'Estoque insuficiente para ' + item.titulo_produto + '. Revise o carrinho.')
    }
  }
  return selecionados
}

function totalItens(itens) {
  return (itens.reduce((soma, item) => soma + Math.round(Number(item.preco_unitario) * 100) * item.quantidade, 0) / 100).toFixed(2)
}

async function carregarCheckout(usuarioId, selecao) {
  validarSelecao(selecao)
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
    `SELECT pp.produto_sku, p.titulo_produto, pp.quantidade, pp.preco_unitario, pp.quantidade * pp.preco_unitario AS subtotal, p.estoque_produto, p.ativo
     FROM produto_pedido pp
     JOIN produto p ON p.sku = pp.produto_sku
     WHERE pp.pedido_id = ?
     ORDER BY p.titulo_produto`,
    [pedidos[0].id_pedido]
  )

  const selecionados = selecionarItens(itens, selecao)
  return { itens: selecionados, total: totalItens(selecionados), formasPagamento }
}

async function finalizarPedido(usuarioId, formaPagamentoId, selecao) {
  if (!Number.isInteger(formaPagamentoId) || formaPagamentoId <= 0) {
    throw erroPedido(400, 'Selecione uma forma de pagamento.')
  }

  validarSelecao(selecao)
  const conexao = await banco.promise().getConnection()
  let transacao = false
  let travaUsuario
  let destruirConexao = false

  try {
    travaUsuario = await adquirirLock(conexao, 'lfu:' + usuarioId)
    await conexao.beginTransaction()
    transacao = true

    const [usuarios] = await conexao.execute('SELECT id_usuario FROM usuario WHERE id_usuario = ?', [usuarioId])
    if (!usuarios.length) throw erroPedido(401, 'Sessão inválida. Entre novamente na conta.')

    const [pedidos] = await conexao.execute(
      "SELECT id_pedido FROM pedido WHERE usuario_id = ? AND status = 'carrinho' ORDER BY id_pedido DESC LIMIT 2 FOR UPDATE",
      [usuarioId]
    )

    if (!pedidos.length) throw erroPedido(404, 'Não há produtos no carrinho para finalizar.')
    if (pedidos.length > 1) throw erroPedido(409, 'Existe mais de um carrinho ativo para esta conta.')

    const pedidoId = pedidos[0].id_pedido
    const [itens] = await conexao.execute(
      `SELECT pp.produto_sku, pp.quantidade, pp.preco_unitario, p.titulo_produto, p.estoque_produto, p.ativo
       FROM produto_pedido pp JOIN produto p ON p.sku = pp.produto_sku WHERE pp.pedido_id = ? ORDER BY pp.produto_sku FOR UPDATE`,
      [pedidoId]
    )
    const selecionados = selecionarItens(itens, selecao)

    const [formasPagamento] = await conexao.execute(
      "SELECT id_forma_pagamento FROM forma_pagamento WHERE id_forma_pagamento = ? AND ativo = 'sim'",
      [formaPagamentoId]
    )
    if (!formasPagamento.length) throw erroPedido(400, 'A forma de pagamento selecionada não está disponível.')

    const total = totalItens(selecionados)
    // Finaliza o pedido existente e move somente os desmarcados para outro carrinho.
    // Tudo fica na mesma transação, preservando preços e quantidades do banco.
    await conexao.execute(
      "UPDATE pedido SET valor_produtos = ?, total = ?, forma_pagamento_id = ?, status = 'solicitado' WHERE id_pedido = ? AND usuario_id = ? AND status = 'carrinho'",
      [total, total, formaPagamentoId, pedidoId, usuarioId]
    )
    if (selecionados.length < itens.length) {
      const [novo] = await conexao.execute("INSERT INTO pedido (usuario_id, status) VALUES (?, 'carrinho')", [usuarioId])
      for (const item of itens.filter(item => !selecao.includes(item.produto_sku))) {
        await conexao.execute('UPDATE produto_pedido SET pedido_id = ? WHERE pedido_id = ? AND produto_sku = ?', [novo.insertId, pedidoId, item.produto_sku])
      }
      await conexao.execute('UPDATE pedido SET valor_produtos = (SELECT COALESCE(SUM(quantidade * preco_unitario), 0) FROM produto_pedido WHERE pedido_id = ?), total = valor_produtos WHERE id_pedido = ?', [novo.insertId, novo.insertId])
    }
    await conexao.execute('UPDATE produto_pedido SET subtotal = quantidade * preco_unitario WHERE pedido_id = ?', [pedidoId])


    await conexao.commit()
    transacao = false
    return { pedidoId, total }
  } catch (erro) {
    if (transacao) {
      try { await conexao.rollback() }
      catch (_) { destruirConexao = true }
    }
    throw erro
  } finally {
    if (travaUsuario) {
      try { await liberarLock(conexao, travaUsuario) }
      catch (_) { destruirConexao = true }
    }
    if (destruirConexao) conexao.destroy()
    else conexao.release()
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
