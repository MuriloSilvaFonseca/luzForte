const express = require('express')
const router = express.Router()

const conexao = require('../config/database')
const { userEstaLogado } = require('../middlewares/auth')
const { carregarCheckout, finalizarPedido, buscarPedidoFinalizado } = require('../services/pedido')

router.get('/teste-banco', (req, res) => {
  conexao.query('SELECT COUNT(*) AS total FROM produto', (erro, resultado) => {
    if (erro) {
      console.log(erro)
      return res.send('Erro ao conectar: ' + erro.message)
    }
    res.send('Conectou! Produtos no banco: ' + resultado[0].total)
  })
})

router.get('/', (req, res) => {
  res.render('loja/home')
})

router.get('/catalogo', (req, res) => {
  res.render('loja/catalogo')
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

      return res.render('loja/checkout', { pedidoFinalizado })
    }

    const checkout = await carregarCheckout(req.session.usuario.id_usuario)
    return res.render('loja/checkout', { ...checkout, pedidoFinalizado: null, erro: null })
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
        erro: erro.status ? erro.message : 'Não foi possível finalizar o pedido. Tente novamente.'
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
