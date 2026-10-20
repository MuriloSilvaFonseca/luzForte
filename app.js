require('dotenv').config()

const express = require('express')
const sessao = require('express-session')
const rotasLoja = require('./routes/loja')
const rotasAutenticacao = require('./routes/auth')
const rotasAdmin = require('./routes/admin-paineis')
//const produtosApi = require('./routes/api-produtos')
// Neon (futuro): exige DATABASE_URL no .env e migração das consultas.
// const produtosApi = require('./routes/api-produtos')
const app = express()
const porta = 3000

app.use(express.urlencoded({ extended: true }))

app.use( sessao({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 0.5 }
}))

app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null
  next()
})
const { userAdmin } = require('./middlewares/auth')
// ...

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.use('/api/carrinho', require('./routes/carrinho'))
app.use('/api/produtos', require('./routes/produtos'))


app.use(require('./middlewares/navbar'))

app.use('/', rotasLoja)
app.use('/', rotasAutenticacao)
//app.use('/', produtosApi)
app.use('/', require('./routes/avaliacao'))
// Neon (futuro): adaptar as respostas e substituir a API MySQL de /api/produtos.
// app.use('/', produtosApi)
app.use('/admin', rotasAdmin)



// Nenhuma rota respondeu: página não existe
app.use((req, res) => {
  res.status(404).send('Página não encontrada')
})

app.listen(porta, () => {
  console.log('Servidor rodando em http://localhost:' + porta)
})
