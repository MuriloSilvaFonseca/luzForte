// Rotas das páginas do painel. Os dados abaixo são FICTÍCIOS (ficam em memória e
// voltam ao normal quando o servidor reinicia). Troque cada bloco por consultas
// ao banco (conexao.query) quando for ligar de verdade.
const express = require('express')
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

const avaliacoes = [
  { id: 1, cliente: 'Carlos Menezes', data: '16/10/2026', compraVerificada: true, produto: 'Lâmpada LED 9W branca', sku: 1001, nota: 1, titulo: 'Queimou em uma semana', texto: 'Comprei 4 e duas queimaram em menos de uma semana. Decepcionado.', status: 'pendente', denuncias: 0, resposta: '', motivoRecusa: '' },
  { id: 2, cliente: 'Ana Paula', data: '15/10/2026', compraVerificada: true, produto: 'Fita LED 5m RGB', sku: 1002, nota: 5, titulo: 'Excelente', texto: 'Cores lindas e instalação fácil. Recomendo!', status: 'pendente', denuncias: 0, resposta: '', motivoRecusa: '' },
  { id: 3, cliente: 'Usuário 4821', data: '14/10/2026', compraVerificada: false, produto: 'Refletor LED 50W', sku: 1003, nota: 1, titulo: '', texto: '(comentário com xingamentos)', status: 'pendente', denuncias: 3, resposta: '', motivoRecusa: '' },
  { id: 4, cliente: 'Marina Souza', data: '12/10/2026', compraVerificada: true, produto: 'Refletor LED 50W', sku: 1003, nota: 2, titulo: 'Chegou com a caixa amassada', texto: 'O produto funciona, mas a embalagem veio bem danificada.', status: 'aprovada', denuncias: 0, resposta: 'Olá, Marina! Pedimos desculpas pela embalagem. Já repassamos o caso à transportadora.', motivoRecusa: '' },
  { id: 5, cliente: 'Rafael Lima', data: '10/10/2026', compraVerificada: true, produto: 'Lâmpada LED 9W branca', sku: 1001, nota: 4, titulo: 'Bom custo-benefício', texto: 'Ilumina bem e gasta pouco.', status: 'aprovada', denuncias: 0, resposta: '', motivoRecusa: '' },
  { id: 6, cliente: 'Visitante', data: '08/10/2026', compraVerificada: false, produto: 'Fita LED 5m RGB', sku: 1002, nota: 1, titulo: 'Spam', texto: 'Compre em outro site: www.exemplo-spam.com', status: 'recusada', denuncias: 1, resposta: '', motivoRecusa: 'Spam ou propaganda' }
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
const contarPendentes = () => avaliacoes.filter(a => a.status === 'pendente').length

function paginar(lista, paginaPedida) {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pagina = Math.min(Math.max(parseInt(paginaPedida, 10) || 1, 1), totalPaginas)
  const inicio = (pagina - 1) * POR_PAGINA
  return { itens: lista.slice(inicio, inicio + POR_PAGINA), pagina, totalPaginas }
}

// Disponibiliza o número do menu "Avaliações" em todas as telas do admin
router.use((req, res, next) => {
  res.locals.avaliacoesPendentes = contarPendentes()
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
      avaliacoesPendentes: contarPendentes()
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

// ---------- Avaliações ----------
router.get('/avaliacoes', (req, res) => {
  const { status = '', nota = '', q = '', produto = '' } = req.query
  let lista = avaliacoes.slice()
  if (status === 'negativas') lista = lista.filter(a => a.nota <= 3 && !a.resposta)
  else if (status) lista = lista.filter(a => a.status === status)
  if (nota) lista = lista.filter(a => a.nota === Number(nota))
  if (produto) lista = lista.filter(a => String(a.sku) === produto)
  if (q) lista = lista.filter(a => minusculo(a.texto + ' ' + a.cliente + ' ' + a.produto).includes(minusculo(q)))

  const dist = {}
  avaliacoes.forEach(a => { dist[a.nota] = (dist[a.nota] || 0) + 1 })
  const media = avaliacoes.length ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length : 0

  res.render('admin/avaliacoes', {
    avaliacoes: lista,
    filtros: { status, nota, q, produto },
    resumo: { media, total: avaliacoes.length, distribuicao: dist },
    contagens: {
      todas: avaliacoes.length,
      pendente: contarPendentes(),
      aprovada: avaliacoes.filter(a => a.status === 'aprovada').length,
      recusada: avaliacoes.filter(a => a.status === 'recusada').length,
      negativasSemResposta: avaliacoes.filter(a => a.nota <= 3 && !a.resposta).length
    }
  })
})

// Ações de moderação (no projeto real: UPDATE avaliacao SET ... WHERE id = ?)
const acharAvaliacao = (id) => avaliacoes.find(a => a.id === Number(id))
const voltarPara = (a) => '/admin/avaliacoes' + (a ? '#avaliacao-' + a.id : '')

router.post('/avaliacoes/:id/aprovar', (req, res) => {
  const a = acharAvaliacao(req.params.id)
  if (a) { a.status = 'aprovada'; a.motivoRecusa = '' }
  res.redirect(voltarPara(a))
})

router.post('/avaliacoes/:id/recusar', (req, res) => {
  const a = acharAvaliacao(req.params.id)
  const motivo = (req.body || {}).motivo
  if (a && motivosRecusa.includes(motivo)) { a.status = 'recusada'; a.motivoRecusa = motivo }
  res.redirect(voltarPara(a))
})

router.post('/avaliacoes/:id/responder', (req, res) => {
  const a = acharAvaliacao(req.params.id)
  const resposta = String((req.body || {}).resposta || '').trim().slice(0, 500)
  if (a && resposta) a.resposta = resposta
  res.redirect(voltarPara(a))
})

module.exports = router