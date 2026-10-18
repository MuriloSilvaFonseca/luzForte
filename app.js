require('dotenv').config()

const express = require('express')
const sessao = require('express-session')
const rotasLoja = require('./routes/loja')
const rotasAutenticacao = require('./routes/auth')
const session = require('express-session')
const lojaRouter = require('./routes/loja')
const authRouter = require('./routes/auth')
const produtosApi = require('./routes/api-produtos')   // NOVO
const app = express()
const porta = 3000

app.use(express.urlencoded({ extended: true }))

app.use(sessao({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {maxAge: 1000 * 60 * 60 * 0.5}
}))

app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null
  next()
})

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.use('/api/carrinho', require('./routes/carrinho'))
app.use('/api/produtos', require('./routes/produtos'))

app.use(require('./middlewares/navbar'))

app.use('/', rotasLoja)
app.use('/', rotasAutenticacao)
app.use('/', lojaRouter)
app.use('/', authRouter)
app.use('/', produtosApi)                              // NOVO (antes do 404)

// Nenhuma rota respondeu: página não existe
app.use((req, res) => {
  res.status(404).send('Página não encontrada')
})

app.listen(porta, () => {
  console.log('Servidor rodando em http://localhost:' + porta)
})
