const express = require('express')
const router = express.Router()

const conexao = require('../config/database')
const { userEstaLogado } = require('../middlewares/auth')
const { carregarCheckout, finalizarPedido, buscarPedidoFinalizado } = require('../services/pedido')
const { montarLinkWhatsApp } = require('../services/whatsapp')

router.get('/', (req, res) => {
  res.render('loja/home')
})

router.get('/catalogo', (req, res) => {
  conexao.query('SELECT id_marca, nome FROM marca ORDER BY nome', (erro, marcas) => {
    if (erro) {
      console.log(erro)
      return res.status(500).send('Erro no servidor')
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
    return res.status(500).send('Não foi possível abrir o checkout.')
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
      return res.status(500).send('Não foi possível finalizar o pedido.')
    }
  }
})

router.get('/sobre-nos', (req, res) => {
  res.render('loja/sobre-nos')
})

router.get('/contato', (req, res) => {
  res.render('loja/contato')
})


module.exports = router
