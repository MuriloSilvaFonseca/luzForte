const banco = require('../config/database').promise()

const statusInfo = {
  solicitado: { rotulo: 'Solicitado', cor: 'yellow' },
  aprovado: { rotulo: 'Aprovado', cor: 'blue' },
  finalizado: { rotulo: 'Finalizado', cor: 'green' },
  cancelado: { rotulo: 'Cancelado', cor: 'red' }
}
const transicoes = {
  solicitado: ['aprovado', 'cancelado'],
  aprovado: ['finalizado', 'cancelado'],
  finalizado: [],
  cancelado: []
}

async function alterarStatusPedido(id, anterior, novo) {
  if (typeof id !== 'string' || !/^\d+$/.test(id) || Number(id) < 1 || Number(id) > 2147483647 ||
      typeof anterior !== 'string' || typeof novo !== 'string' || !Object.hasOwn(transicoes, anterior) || !Object.hasOwn(statusInfo, novo)) {
    throw Object.assign(new Error('Status ou pedido inválido.'), { status: 400 })
  }
  const conexao = await banco.getConnection()
  try {
    await conexao.beginTransaction()
    const [pedidos] = await conexao.query('SELECT status FROM pedido WHERE id_pedido = ? FOR UPDATE', [Number(id)])
    if (!pedidos.length) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 })
    const atual = pedidos[0].status
    if (atual !== anterior) throw Object.assign(new Error('O status mudou desde que a página foi aberta. Recarregue os pedidos.'), { status: 409 })
    if (!transicoes[atual]?.includes(novo)) throw Object.assign(new Error('Essa mudança de status não é permitida.'), { status: 400 })
    await conexao.query('UPDATE pedido SET status = ? WHERE id_pedido = ? AND status = ?', [novo, Number(id), atual])
    await conexao.commit()
  } catch (erro) {
    try { await conexao.rollback() } catch (falha) { console.error('Falha no rollback de status:', falha.code) }
    throw erro
  } finally { conexao.release() }
}

module.exports = { statusInfo, transicoes, alterarStatusPedido }
