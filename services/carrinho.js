const banco = require('../config/database')
const LIMITE_INTEIRO_MYSQL = 2147483647 // Maior valor positivo do tipo INT.

function erroCarrinho(status, mensagem) {
  return Object.assign(new Error(mensagem), { status })
}

function inteiroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0 && valor <= LIMITE_INTEIRO_MYSQL
}

async function buscarPedido(conexao, proprietario) {
  if (proprietario.usuarioId) {
    const [usuarios] = await conexao.execute('SELECT id_usuario FROM usuario WHERE id_usuario = ? FOR UPDATE', [proprietario.usuarioId])
    if (!usuarios.length) throw erroCarrinho(401, 'Sessão inválida. Entre novamente na conta.')
  }
  const [pedidos] = await conexao.execute(`SELECT id_pedido FROM pedido WHERE ${proprietario.filtro} AND status = 'carrinho' ORDER BY id_pedido DESC FOR UPDATE`, [proprietario.valor])
  if (pedidos.length > 1) throw erroCarrinho(409, 'Há mais de um carrinho ativo. É necessário revisar os pedidos existentes.')
  return pedidos.length ? pedidos[0].id_pedido : null
}

async function definirQuantidade(conexao, pedidoId, sku, quantidade) {
  if (!inteiroPositivo(quantidade)) throw erroCarrinho(400, 'Quantidade excede o limite permitido.')
  await conexao.execute('UPDATE produto_pedido SET quantidade = ?, subtotal = ? * preco_unitario WHERE pedido_id = ? AND produto_sku = ?', [quantidade, quantidade, pedidoId, sku])
}

async function adicionarItem(conexao, proprietario, pedidoId, sku, quantidade) {
  const [produtos] = await conexao.execute("SELECT sku, preco_produto FROM produto WHERE sku = ? AND ativo = 'ativo'", [sku])
  if (!produtos.length) throw erroCarrinho(404, 'Produto não encontrado ou indisponível.')
  if (!pedidoId) {
    const sql = proprietario.usuarioId
      ? "INSERT INTO pedido (usuario_id, status) VALUES (?, 'carrinho')"
      : "INSERT INTO pedido (usuario_id, visitante_token_hash, status) VALUES (NULL, ?, 'carrinho')"
    const [pedido] = await conexao.execute(sql, [proprietario.valor])
    pedidoId = pedido.insertId
  }
  const [itens] = await conexao.execute('SELECT quantidade FROM produto_pedido WHERE pedido_id = ? AND produto_sku = ?', [pedidoId, sku])
  if (itens.length) {
    await definirQuantidade(conexao, pedidoId, sku, itens[0].quantidade + quantidade)
  } else {
    const preco = produtos[0].preco_produto
    await conexao.execute('INSERT INTO produto_pedido (pedido_id, produto_sku, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ? * ?)', [pedidoId, sku, quantidade, preco, quantidade, preco])
  }
  return pedidoId
}

async function modificarItem(conexao, pedidoId, operacao, sku, quantidade) {
  if (!pedidoId) throw erroCarrinho(404, 'Carrinho não encontrado.')
  const [itens] = await conexao.execute('SELECT quantidade FROM produto_pedido WHERE pedido_id = ? AND produto_sku = ?', [pedidoId, sku])
  if (!itens.length) throw erroCarrinho(404, 'Produto não encontrado no carrinho.')
  if (operacao === 'remover') {
    await conexao.execute('DELETE FROM produto_pedido WHERE pedido_id = ? AND produto_sku = ?', [pedidoId, sku])
  } else {
    await definirQuantidade(conexao, pedidoId, sku, quantidade)
  }
}

async function consultarCarrinho(conexao, proprietario, pedidoId) {
  const vazio = { pedido_id: null, status: 'carrinho', itens: [], valor_produtos: '0.00', total: '0.00' }
  if (!pedidoId) return vazio
  const [itens] = await conexao.execute(`
    SELECT pp.produto_sku, p.titulo_produto, s.nome AS subcategoria, i.url AS imagem,
           pp.quantidade, pp.preco_unitario, pp.subtotal
    FROM produto_pedido pp JOIN produto p ON p.sku = pp.produto_sku
    JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
    LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
    WHERE pp.pedido_id = ? ORDER BY pp.produto_sku`, [pedidoId])
  const [totais] = await conexao.execute(`SELECT valor_produtos, total FROM pedido WHERE id_pedido = ? AND ${proprietario.filtro} AND status = 'carrinho'`, [pedidoId, proprietario.valor])
  return { ...vazio, ...totais[0], pedido_id: pedidoId, itens }
}

async function executarCarrinho(identidade, operacao, dados = {}) {
  const proprietario = {
    usuarioId: identidade.usuarioId,
    valor: identidade.usuarioId || identidade.visitanteHash,
    filtro: identidade.usuarioId ? 'usuario_id = ?' : 'usuario_id IS NULL AND visitante_token_hash = ?'
  }
  const conexao = await banco.promise().getConnection()
  let transacao = false
  let travaVisitante
  try {
    // A trava protege também a criação do primeiro pedido do visitante.
    if (!proprietario.usuarioId) {
      const nome = 'lfc:' + proprietario.valor.slice(0, 60)
      const [[trava]] = await conexao.execute('SELECT GET_LOCK(?, 5) AS obtida', [nome])
      if (Number(trava.obtida) !== 1) throw erroCarrinho(409, 'Carrinho ocupado. Tente novamente.')
      travaVisitante = nome
    }
    await conexao.beginTransaction()
    transacao = true
    let pedidoId = await buscarPedido(conexao, proprietario)
    if (operacao === 'adicionar') {
      pedidoId = await adicionarItem(conexao, proprietario, pedidoId, dados.sku, dados.quantidade)
    } else if (operacao !== 'listar') {
      await modificarItem(conexao, pedidoId, operacao, dados.sku, dados.quantidade)
    }
    if (pedidoId && operacao !== 'listar') {
      await conexao.execute(`UPDATE pedido SET valor_produtos = (SELECT COALESCE(SUM(subtotal), 0) FROM produto_pedido WHERE pedido_id = ?), total = valor_produtos WHERE id_pedido = ? AND ${proprietario.filtro} AND status = 'carrinho'`, [pedidoId, pedidoId, proprietario.valor])
    }
    const resultado = await consultarCarrinho(conexao, proprietario, pedidoId)
    await conexao.commit()
    transacao = false
    return resultado
  } catch (erro) {
    if (transacao) {
      try { await conexao.rollback() } catch (_) { /* A conexão será liberada abaixo. */ }
    }
    throw erro
  } finally {
    let conexaoDestruida = false
    if (travaVisitante) {
      try { await conexao.execute('SELECT RELEASE_LOCK(?) AS liberada', [travaVisitante]) }
      catch (_) { conexao.destroy(); conexaoDestruida = true }
    }
    if (!conexaoDestruida) conexao.release()
  }
}

module.exports = { executarCarrinho, inteiroPositivo }
