const express = require('express')
const router = express.Router()

// Por enquanto as rotas só mostram as páginas.
// O login e o cadastro com MySQL entram aqui depois (router.post).

router.get('/login', (req, res) => {
  res.render('auth/login')
})

router.get('/esqueci-senha', (req, res) => {
  res.render('auth/esqueci-senha')
})

router.get('/registro', (req, res) => {
  res.render('auth/registro')
})

module.exports = router
