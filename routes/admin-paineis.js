// Rotas das páginas do painel.
// AVALIAÇÕES já usam o banco de dados. Produtos, pedidos, usuários e a visão geral
// ainda usam dados FICTÍCIOS (em memória; voltam ao normal quando o servidor reinicia).
const express = require('express')
const conexao = require('../config/database')
const router = express.Router()

const POR_PAGINA = 10
const ESTOQUE_BAIXO = 5

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

const usuarios = [
  { id: 1, nome: 'Administrador', email: 'admin@luzforte.com', perfil: 'admin', situacao: 'ativo', cadastro: '01/08/2026', pedidos: 0, avaliacoes: 0 },
  { id: 2, nome: 'Carlos Menezes', email: 'carlos@email.com', perfil: 'cliente', situacao: 'ativo', cadastro: '03/09/2026', pedidos: 4, avaliacoes: 2 },
  { id: 3, nome: 'Usuário 4821', email: 'u4821@email.com', perfil: 'cliente', situacao: 'bloqueado', cadastro: '12/10/2026', pedidos: 0, avaliacoes: 1 }
]

// ---------- Auxiliares ----------
const minusculo = (v) => String(v || '').trim().toLowerCase()
const paraISO = (br) => br.split('/').reverse().join('-') // 17/10/2026 -> 2026-10-17

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

// ---------- Pedidos ----------
router.get('/pedidos', (req, res) => {
  const { status = '', q = '', de = '', ate = '' } = req.query
  let lista = pedidos.slice()
  if (status) lista = lista.filter(p => p.chave === status)
  if (q) lista = lista.filter(p => minusculo(p.id + ' ' + p.cliente).includes(minusculo(q).replace('#', '')))
  if (de) lista = lista.filter(p => paraISO(p.data) >= de)
  if (ate) lista = lista.filter(p => paraISO(p.data) <= ate)

  const contagens = { todos: pedidos.length }
  ;['aguardando', 'pago', 'enviado', 'entregue', 'cancelado'].forEach(s => {
    contagens[s] = pedidos.filter(p => p.chave === s).length
  })

  const { itens, pagina, totalPaginas } = paginar(lista, req.query.pagina)
  res.render('admin/pedidos', {
    pagina, totalPaginas,
    filtros: { status, q, de, ate },
    contagens,
    pedidos: itens
  })
})

// ---------- Usuários ----------
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