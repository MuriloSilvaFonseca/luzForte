require('dotenv').config()

const express = require('express')
const session = require('express-session')
const lojaRouter = require('./routes/loja')
const authRouter = require('./routes/auth')
const app = express()
const port = 3000

app.use(express.urlencoded({ extended: true }))

app.use(session({
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

app.use('/', lojaRouter)
app.use('/', authRouter)

// Nenhuma rota respondeu: página não existe
app.use((req, res) => {
  res.status(404).send('Página não encontrada')
})

app.listen(port, () => {
  console.log('Servidor rodando em http://localhost:' + port)
})