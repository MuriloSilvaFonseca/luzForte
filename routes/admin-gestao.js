const express = require('express')
const banco = require('../config/database').promise()
const { statusInfo } = require('../services/status-pedido')
const router = express.Router()
const POR_PAGINA = 10

router.get('/', async (req, res) => {
  try {
    const [[hoje]] = await banco.query("SELECT COUNT(*) AS total FROM pedido WHERE status <> 'carrinho' AND data_criacao >= CURDATE() AND data_criacao < DATE_ADD(CURDATE(), INTERVAL 1 DAY)")
    const [[produtos]] = await banco.query("SELECT COALESCE(SUM(ativo = 'ativo'), 0) AS ativos, COALESCE(SUM(ativo = 'ativo' AND estoque_produto <= 5), 0) AS baixo FROM produto")
    const [[usuarios]] = await banco.query('SELECT COUNT(*) AS total FROM usuario WHERE ativo = 1')
    // Regra do projeto: só é venda o pedido APROVADO ou FINALIZADO (retirado).
    // Solicitados, cancelados e carrinhos não entram no faturamento nem no lucro.
    const [[vendas]] = await banco.query(`SELECT COUNT(*) AS quantidade, COALESCE(SUM(total), 0) AS faturamento
      FROM pedido WHERE status IN ('aprovado', 'finalizado')`)
    // Custo = quantidade x custo do produto no momento da aprovação (custo_unitario).
    // Pedidos aprovados antes dessa coluna ser preenchida usam o custo atual do produto.
    const [[custo]] = await banco.query(`SELECT COALESCE(SUM(pp.quantidade * COALESCE(pp.custo_unitario, pr.custo_produto, 0)), 0) AS total
      FROM produto_pedido pp
      JOIN pedido pe ON pe.id_pedido = pp.pedido_id
      LEFT JOIN produto pr ON pr.sku = pp.produto_sku
      WHERE pe.status IN ('aprovado', 'finalizado')`)
    const [totais] = await banco.query('SELECT status, COUNT(*) AS quantidade, COALESCE(SUM(total), 0) AS total FROM pedido GROUP BY status')
    const valorStatus = status => (totais.find(total => total.status === status) || { total: 0 }).total
    const faturamento = Number(vendas.faturamento)
    const lucro = faturamento - Number(custo.total)
    const financeiro = {
      faturamento,
      vendas: Number(vendas.quantidade),
      indicadores: [
        { nome: 'Custo dos produtos', valor: Number(custo.total), tipo: 'moeda' },
        { nome: 'Lucro bruto', valor: lucro, tipo: 'moeda' },
        { nome: 'Margem', valor: faturamento ? (lucro / faturamento) * 100 : 0, tipo: 'porcentagem' },
        { nome: 'Aguardando aprovação', valor: valorStatus('solicitado'), tipo: 'moeda' },
        { nome: 'Cancelados', valor: valorStatus('cancelado'), tipo: 'moeda' },
        { nome: 'Pedidos vendidos', valor: Number(vendas.quantidade), tipo: 'numero' }
      ]
    }
    const grupos = []
    for (const status of ['solicitado', 'finalizado']) {
      const [pedidos] = await banco.query(`SELECT p.id_pedido AS id, u.nome_usuario AS cliente,
        DATE_FORMAT(p.data_criacao, '%d/%m/%Y') AS data, p.total
        FROM pedido p LEFT JOIN usuario u ON u.id_usuario = p.usuario_id
        WHERE p.status = ? ORDER BY p.data_criacao DESC, p.id_pedido DESC LIMIT 5`, [status])
      const resumo = totais.find(t => t.status === status) || { quantidade: 0, total: 0 }
      grupos.push({ status, titulo: status === 'solicitado' ? 'Pedidos solicitados' : 'Pedidos finalizados', ...resumo, pedidos })
    }
    const [estoqueBaixoLista] = await banco.query("SELECT sku, titulo_produto AS titulo, estoque_produto AS estoque FROM produto WHERE ativo = 'ativo' AND estoque_produto <= 5 ORDER BY estoque_produto, sku LIMIT 5")
    res.render('admin/visao-geral', { resumo: { pedidosHoje: hoje.total, produtosAtivos: produtos.ativos, estoqueBaixo: produtos.baixo, usuariosAtivos: usuarios.total }, grupos, estoqueBaixoLista, statusInfo, financeiro })
  } catch (erro) {
    console.error('Falha na visão geral:', erro.code)
    res.status(500).send('Não foi possível carregar o painel. Confira a conexão e a migração de usuários.')
  }
})

router.get('/usuarios', async (req, res) => {
  const { q = '', perfil = '', situacao = '', pagina: paginaPedida = '1' } = req.query
  if (![q, perfil, situacao, paginaPedida].every(v => typeof v === 'string') ||
      (perfil && !['admin', 'cliente'].includes(perfil)) ||
      (situacao && !['ativo', 'desativado'].includes(situacao)) ||
      !/^\d+$/.test(paginaPedida) || Number(paginaPedida) < 1 || !Number.isSafeInteger(Number(paginaPedida))) {
    return res.status(400).send('Confira os filtros de usuários.')
  }
  const filtros = { q: q.trim(), perfil, situacao }
  const condicoes = []
  const valores = []
  if (filtros.q) { condicoes.push("LOCATE(?, CONCAT(u.nome_usuario, ' ', u.email)) > 0"); valores.push(filtros.q) }
  if (perfil) { condicoes.push('u.acesso = ?'); valores.push(perfil) }
  if (situacao) { condicoes.push('u.ativo = ?'); valores.push(situacao === 'ativo' ? 1 : 0) }
  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : ''
  try {
    const [[contagem]] = await banco.query('SELECT COUNT(*) AS total FROM usuario u ' + onde, valores)
    const totalPaginas = Math.max(1, Math.ceil(Number(contagem.total) / POR_PAGINA))
    const pagina = Math.min(Number(paginaPedida), totalPaginas)
    const [usuarios] = await banco.query(`SELECT u.id_usuario AS id, u.nome_usuario AS nome, u.email,
      u.acesso AS perfil, IF(u.ativo = 1, 'ativo', 'desativado') AS situacao,
      DATE_FORMAT(u.data_criacao, '%d/%m/%Y') AS cadastro,
      (SELECT COUNT(*) FROM pedido p WHERE p.usuario_id = u.id_usuario AND p.status <> 'carrinho') AS pedidos,
      (SELECT COUNT(*) FROM avaliacao_produto a WHERE a.usuario_id = u.id_usuario) AS avaliacoes
      FROM usuario u ${onde} ORDER BY u.id_usuario DESC LIMIT ? OFFSET ?`, [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA])
    res.render('admin/usuarios', { usuarios, filtros, pagina, totalPaginas, total: contagem.total, salvo: req.query.salvo === '1' })
  } catch (erro) {
    console.error('Falha ao listar usuários:', erro.code)
    res.status(500).send('Não foi possível carregar os usuários.')
  }
})

router.post('/usuarios/:id/ativo', async (req, res) => {
  const id = req.params.id
  if (!/^\d+$/.test(id) || Number(id) < 1 || Number(id) > 2147483647 || !['0', '1'].includes(req.body?.ativo)) return res.status(400).send('Usuário ou situação inválida.')
  if (Number(id) === Number(req.session.usuario.id_usuario)) return res.status(403).send('Você não pode desativar a própria conta.')
  try {
    const [resultado] = await banco.query("UPDATE usuario SET ativo = ? WHERE id_usuario = ? AND acesso = 'cliente'", [Number(req.body.ativo), Number(id)])
    if (!resultado.affectedRows) return res.status(403).send('Conta não encontrada ou protegida. Contas de administrador não podem ser desativadas por esta tela.')
    res.redirect('/admin/usuarios?salvo=1')
  } catch (erro) {
    console.error('Falha ao alterar conta:', erro.code)
    res.status(500).send('Não foi possível alterar a situação da conta.')
  }
})

module.exports = router
