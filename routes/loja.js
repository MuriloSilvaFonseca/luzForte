const express = require('express')
const router = express.Router()

const conexao = require('../config/database')

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
  res.render('loja/produto')
})

router.get('/carrinho', (req, res) => {
  res.render('loja/carrinho')
})

router.get('/checkout', (req, res) => {
  res.render('loja/checkout')
})

router.get('/sobre-nos', (req, res) => {
  res.render('loja/sobre-nos')
})

router.get('/contato', (req, res) => {
  res.render('loja/contato')
})

module.exports = router
