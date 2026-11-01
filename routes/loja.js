const express = require('express')
const router = express.Router()

const conexao = require('../config/database')
const { userEstaLogado } = require('../middlewares/auth')
const { carregarCheckout, finalizarPedido, buscarPedidoFinalizado } = require('../services/pedido')
const { montarLinkWhatsApp } = require('../services/whatsapp')

function renderizarErroInterno(res) {
  return res.status(500).render('loja/erro', {
    tituloPagina: 'Erro no servidor',
    codigo: '500',
    titulo: 'Tivemos um problema por aqui',
    mensagem: 'Não foi possível concluir sua solicitação agora. Tente novamente em instantes.'
  })
}

// ========== HOME ==========
// "Mais vendidos" de verdade: soma a quantidade vendida de cada produto.
// Só contam pedidos APROVADOS ou FINALIZADOS (regra do projeto: venda só vale depois da aprovação).
// O LEFT JOIN faz produto sem venda aparecer com 0, então a home sempre tem 4 produtos,
// mesmo numa loja nova sem pedidos (nesse caso, a ordem é alfabética).
router.get('/', (req, res) => {
  const sqlMaisVendidos = `
    SELECT p.sku, p.titulo_produto, p.preco_produto, p.estoque_produto,
           i.url AS imagem,
           COALESCE(v.vendidos, 0) AS vendidos
    FROM produto p
    LEFT JOIN (
      SELECT pp.produto_sku, SUM(pp.quantidade) AS vendidos
      FROM produto_pedido pp
      JOIN pedido pe ON pe.id_pedido = pp.pedido_id
      WHERE pe.status IN ('aprovado', 'finalizado')
      GROUP BY pp.produto_sku
    ) v ON v.produto_sku = p.sku
    LEFT JOIN imagem_produto i ON i.produto_sku = p.sku AND i.ordem = 1
    WHERE p.ativo = 'ativo'
    ORDER BY vendidos DESC, p.titulo_produto ASC
    LIMIT 4
  `

  conexao.query(sqlMaisVendidos, (erro, maisVendidos) => {
    if (erro) {
      // Se o banco falhar, a home abre mesmo assim, só sem os produtos
      console.log(erro)
      return res.render('loja/home', { maisVendidos: [], erroProdutos: true })
    }
    res.render('loja/home', { maisVendidos, erroProdutos: false })
  })
})

router.get('/catalogo', (req, res) => {
  conexao.query('SELECT id_marca, nome FROM marca ORDER BY nome', (erro, marcas) => {
    if (erro) {
      console.log(erro)
      return renderizarErroInterno(res)
    }

    res.render('loja/catalogo', {
      marcas,
      filtros: {
        categoria: req.query.categoria,
        marca: req.query.marca,
        busca: req.query.q,
        ordenar: req.query.ordenar
      }
    })
  })
})

router.get('/produto', (req, res) => {
  if (!req.query.id) return res.redirect('/catalogo')
  res.render('loja/produto')
})

// Compatibilidade com os links usados em origin/catalogo-banco.
router.get('/produto/:sku', (req, res) => {
  if (!/^\d+$/.test(req.params.sku)) return res.status(404).send('Produto não encontrado')
  res.redirect('/produto?id=' + encodeURIComponent(req.params.sku))
})

router.get('/carrinho', (req, res) => {
  res.render('loja/carrinho')
})

router.get('/como-comprar', (req, res) => {
  res.render('loja/como-comprar')
})

router.get('/checkout', userEstaLogado, async (req, res) => {
  try {
    if (req.query.pedido) {
      const pedidoId = Number(req.query.pedido)
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) return res.status(404).send('Pedido não encontrado.')

      const pedidoFinalizado = await buscarPedidoFinalizado(req.session.usuario.id_usuario, pedidoId)
      if (!pedidoFinalizado) return res.status(404).send('Pedido não encontrado.')

      // Link do WhatsApp com a mensagem do pedido pronta (null se WHATSAPP_LOJA não estiver no .env)
      const linkWhatsApp = montarLinkWhatsApp(pedidoFinalizado)

      return res.render('loja/checkout', { pedidoFinalizado, linkWhatsApp })
    }

    const checkout = await carregarCheckout(req.session.usuario.id_usuario)
    // whatsappAtivo: muda o texto do modal de confirmação (só avisa do WhatsApp se o número estiver no .env)
    return res.render('loja/checkout', { ...checkout, pedidoFinalizado: null, erro: null, whatsappAtivo: Boolean(process.env.WHATSAPP_LOJA) })
  } catch (erro) {
    console.log(erro)
    return renderizarErroInterno(res)
  }
})

router.post('/checkout', userEstaLogado, async (req, res) => {
  try {
    const formaPagamentoId = Number(req.body.forma_pagamento_id)
    const pedido = await finalizarPedido(req.session.usuario.id_usuario, formaPagamentoId)
    return res.redirect('/checkout?pedido=' + pedido.pedidoId)
  } catch (erro) {
    console.log(erro)
    try {
      const checkout = await carregarCheckout(req.session.usuario.id_usuario)
      return res.status(erro.status || 500).render('loja/checkout', {
        ...checkout,
        pedidoFinalizado: null,
        erro: erro.status ? erro.message : 'Não foi possível finalizar o pedido. Tente novamente.',
        whatsappAtivo: Boolean(process.env.WHATSAPP_LOJA)
      })
    } catch (_) {
      return renderizarErroInterno(res)
    }
  }
})

router.get('/sobre-nos', (req, res) => {
  res.render('loja/sobre-nos')
})

router.get('/contato', (req, res) => {
  res.render('loja/contato')
})

router.get('/politica-de-privacidade', (req, res) => {
  res.render('loja/privacidade')
})


module.exports = router
