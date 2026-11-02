const criptografia = require('node:crypto')
const banco = require('../config/database')
const { adquirirLock, liberarLock } = require('./lock-mysql')
const LIMITE_INTEIRO_MYSQL = 2147483647 // Maior valor positivo do tipo INT.

function erroCarrinho(status, mensagem) {
  return Object.assign(new Error(mensagem), { status })
}

function inteiroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0 && valor <= LIMITE_INTEIRO_MYSQL
}

async function buscarPedido(conexao, proprietario) {
  if (proprietario.usuarioId) {
    // Esta consulta só verifica a existência da conta; bloquear a linha do
    // usuário fazia qualquer chamada simultânea do carrinho disputar o mesmo lock.
    const [usuarios] = await conexao.execute('SELECT id_usuario FROM usuario WHERE id_usuario = ?', [proprietario.usuarioId])
    if (!usuarios.length) throw erroCarrinho(401, 'Sessão inválida. Entre novamente na conta.')
  }
  const [pedidos] = await conexao.execute(`SELECT id_pedido FROM pedido WHERE ${proprietario.filtro} AND status = 'carrinho' ORDER BY id_pedido DESC FOR UPDATE`, [proprietario.valor])
  if (pedidos.length > 1) throw erroCarrinho(409, 'Há mais de um carrinho ativo. É necessário revisar os pedidos existentes.')
  return pedidos.length ? pedidos[0].id_pedido : null
}

async function validarEstoque(conexao, sku, quantidade) {
  if (!inteiroPositivo(sku) || !inteiroPositivo(quantidade)) throw erroCarrinho(400, 'Informe produto e quantidade como inteiros positivos.')
  const [produtos] = await conexao.execute("SELECT sku, preco_produto, estoque_produto FROM produto WHERE sku = ? AND ativo = 'ativo' FOR UPDATE", [sku])
  if (!produtos.length) throw erroCarrinho(404, 'Produto não encontrado ou indisponível.')
  const estoque = Number(produtos[0].estoque_produto)
  if (estoque === 0) throw erroCarrinho(409, 'Produto esgotado no momento.')
  if (!Number.isInteger(estoque) || quantidade > estoque) throw erroCarrinho(409, 'Não há mais unidades disponíveis em estoque para este produto.')
  return produtos[0]
}

async function definirQuantidade(conexao, pedidoId, sku, quantidade) {
  if (!inteiroPositivo(quantidade)) throw erroCarrinho(400, 'Quantidade excede o limite permitido.')
  await validarEstoque(conexao, sku, quantidade)
  await conexao.execute('UPDATE produto_pedido SET quantidade = ?, subtotal = ? * preco_unitario WHERE pedido_id = ? AND produto_sku = ?', [quantidade, quantidade, pedidoId, sku])
}

async function adicionarItem(conexao, proprietario, pedidoId, sku, quantidade) {
  const produto = await validarEstoque(conexao, sku, quantidade)
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
    const preco = produto.preco_produto
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
           pp.quantidade, pp.preco_unitario, pp.subtotal, p.estoque_produto, p.ativo
    FROM produto_pedido pp JOIN produto p ON p.sku = pp.produto_sku
    LEFT JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
    LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
    WHERE pp.pedido_id = ? ORDER BY pp.produto_sku`, [pedidoId])
  const [totais] = await conexao.execute(`SELECT valor_produtos, total FROM pedido WHERE id_pedido = ? AND ${proprietario.filtro} AND status = 'carrinho'`, [pedidoId, proprietario.valor])
  return { ...vazio, ...totais[0], pedido_id: pedidoId, itens }
}

async function executarCarrinho(identidade, operacao, dados = {}) {
  if (!['listar', 'adicionar', 'quantidade', 'remover', 'esvaziar'].includes(operacao)) throw erroCarrinho(400, 'Operação inválida.')
  if (!['listar', 'esvaziar'].includes(operacao) && (!inteiroPositivo(dados.sku) || (operacao !== 'remover' && !inteiroPositivo(dados.quantidade)))) throw erroCarrinho(400, 'Produto ou quantidade inválidos.')
  const proprietario = {
    usuarioId: identidade.usuarioId,
    valor: identidade.usuarioId || identidade.visitanteHash,
    filtro: identidade.usuarioId ? 'usuario_id = ?' : 'usuario_id IS NULL AND visitante_token_hash = ?'
  }
  const conexao = await banco.promise().getConnection()
  let transacao = false
  let travaCarrinho
  let conexaoDestruida = false
  try {
    // Serializa chamadas da mesma conta/sessão, inclusive ao criar o primeiro carrinho.
    const nome = proprietario.usuarioId
      ? 'lfu:' + proprietario.usuarioId
      : 'lfc:' + proprietario.valor.slice(0, 60)
    travaCarrinho = await adquirirLock(conexao, nome)
    await conexao.beginTransaction()
    transacao = true
    let pedidoId = await buscarPedido(conexao, proprietario)
    if (operacao === 'adicionar') {
      pedidoId = await adicionarItem(conexao, proprietario, pedidoId, dados.sku, dados.quantidade)
    } else if (operacao === 'esvaziar') {
      // O pedido foi localizado pela sessão e bloqueado por buscarPedido.
      if (pedidoId) await conexao.execute('DELETE FROM produto_pedido WHERE pedido_id = ?', [pedidoId])
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
      try { await conexao.rollback() }
      catch (_) { conexaoDestruida = true }
    }
    throw erro
  } finally {
    if (travaCarrinho) {
      try { await liberarLock(conexao, travaCarrinho) }
      catch (_) { conexao.destroy(); conexaoDestruida = true }
    }
    if (!conexaoDestruida) conexao.release()
  }
}

// ---------------------------------------------------------------------------
// Transferência do carrinho do visitante para a conta, no momento do login.
//
// Por que existe: o carrinho do visitante fica ligado ao token da sessão.
// No login a sessão é recriada (req.session.regenerate), o token se perde e o
// carrinho "sumiria". Por isso o login chama esta função ANTES de perder o token.
//
// Regras:
// - Visitante sem carrinho: não faz nada.
// - Usuário sem carrinho aberto: o carrinho do visitante passa a ser do usuário.
// - Usuário com carrinho aberto: os itens são juntados no carrinho do usuário.
//   Produto que já existe nos dois tem as quantidades SOMADAS (mantém o preço
//   já registrado no carrinho do usuário). O carrinho do visitante é apagado.
// Tudo acontece numa transação: ou a transferência inteira dá certo, ou nada muda.
// ---------------------------------------------------------------------------
async function transferirCarrinhoVisitante(usuarioId, tokenVisitante) {
  // Sem token válido não existe carrinho de visitante para transferir
  if (typeof tokenVisitante !== 'string' || !/^[a-f0-9]{64}$/.test(tokenVisitante)) return
  if (!inteiroPositivo(usuarioId)) throw erroCarrinho(400, 'Usuário inválido.')

  // No banco fica só o hash do token (mesma regra do middleware identificar-carrinho)
  const visitanteHash = criptografia.createHash('sha256').update(tokenVisitante).digest('hex')
  const donoUsuario = { usuarioId, valor: usuarioId, filtro: 'usuario_id = ?' }

  const conexao = await banco.promise().getConnection()
  let transacao = false
  let travaUsuario
  let destruirConexao = false
  try {
    travaUsuario = await adquirirLock(conexao, 'lfu:' + usuarioId)
    await conexao.beginTransaction()
    transacao = true

    // 1. Procura o carrinho do visitante
    const [visitante] = await conexao.execute(
      "SELECT id_pedido FROM pedido WHERE usuario_id IS NULL AND visitante_token_hash = ? AND status = 'carrinho' FOR UPDATE",
      [visitanteHash])

    if (visitante.length > 0) {
      const pedidoVisitante = visitante[0].id_pedido

      // 2. Procura o carrinho aberto do usuário (também confere se o usuário existe)
      const pedidoUsuario = await buscarPedido(conexao, donoUsuario)

      if (!pedidoUsuario) {
        // 3a. Usuário sem carrinho: o carrinho do visitante passa a ser dele
        await conexao.execute(
          'UPDATE pedido SET usuario_id = ?, visitante_token_hash = NULL WHERE id_pedido = ?',
          [usuarioId, pedidoVisitante])
      } else {
        // 3b. Usuário já tem carrinho: junta os itens
        const [itensVisitante] = await conexao.execute(
          'SELECT produto_sku, quantidade FROM produto_pedido WHERE pedido_id = ?', [pedidoVisitante])

        for (const item of itensVisitante) {
          const [jaExiste] = await conexao.execute(
            'SELECT quantidade FROM produto_pedido WHERE pedido_id = ? AND produto_sku = ?',
            [pedidoUsuario, item.produto_sku])

          if (jaExiste.length > 0) {
            // Mesmo produto nos dois carrinhos: soma as quantidades
            await definirQuantidade(conexao, pedidoUsuario, item.produto_sku, jaExiste[0].quantidade + item.quantidade)
          } else {
            // Produto só no carrinho do visitante: move a linha para o carrinho do usuário
            await conexao.execute(
              'UPDATE produto_pedido SET pedido_id = ? WHERE pedido_id = ? AND produto_sku = ?',
              [pedidoUsuario, pedidoVisitante, item.produto_sku])
          }
        }

        // O carrinho do visitante não é mais usado (os itens restantes saem junto: ON DELETE CASCADE)
        await conexao.execute('DELETE FROM pedido WHERE id_pedido = ?', [pedidoVisitante])

        // Recalcula o valor do carrinho do usuário
        await conexao.execute(
          "UPDATE pedido SET valor_produtos = (SELECT COALESCE(SUM(subtotal), 0) FROM produto_pedido WHERE pedido_id = ?), total = valor_produtos WHERE id_pedido = ? AND usuario_id = ? AND status = 'carrinho'",
          [pedidoUsuario, pedidoUsuario, usuarioId])
      }
    }

    await conexao.commit()
    transacao = false
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

module.exports = { executarCarrinho, inteiroPositivo, transferirCarrinhoVisitante }
