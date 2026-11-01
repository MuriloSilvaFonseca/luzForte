require('dotenv').config()

const express = require('express')
const sessao = require('express-session')
const rotasLoja = require('./routes/loja')
const rotasAutenticacao = require('./routes/auth')
const rotasProdutosAdmin = require('./routes/admin')
const rotasAdmin = require('./routes/admin-paineis')
// Neon (futuro): exige DATABASE_URL no .env.
// const produtosApi = require('./routes/api-produtos')
const app = express()
const porta = 3000

app.use(express.urlencoded({ extended: true }))

app.use( sessao({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { maxAge: 1000 * 60 * 60 * 0.5 }
}))

app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null
  next()
})

app.use((req, res, next) => {
  const numero = (process.env.WHATSAPP_LOJA || '').replace(/\D/g, '')
  res.locals.whatsappLoja = numero || null
  next()
})
app.set('view engine', 'ejs')
app.use(express.static('public'))

app.use('/api/carrinho', require('./routes/carrinho'))
app.use('/api/produtos', require('./routes/produtos'))


app.use(require('./middlewares/navbar'))

app.use('/', rotasLoja)
app.use('/', rotasAutenticacao)
app.use('/', require('./routes/conta'))
// app.use('/', produtosApi)
app.use('/', require('./routes/avaliacao'))
app.use('/admin', rotasProdutosAdmin)
app.use('/admin', rotasAdmin)


// Nenhuma rota respondeu: página não existe
app.use((req, res) => {
  res.status(404).render('loja/erro', {
    tituloPagina: 'Página não encontrada',
    codigo: '404',
    titulo: 'Não encontramos essa página',
    mensagem: 'O endereço pode estar incorreto ou a página pode ter sido removida.'
  })
})

// Erros inesperados: apresenta uma página amigável sem expor detalhes internos.
app.use((erro, req, res, next) => {
  console.error('Erro inesperado:', erro)
  if (res.headersSent) return next(erro)
  res.status(500).render('loja/erro', {
    tituloPagina: 'Erro no servidor',
    codigo: '500',
    titulo: 'Tivemos um problema por aqui',
    mensagem: 'Não foi possível concluir sua solicitação agora. Tente novamente em instantes.'
  })
})

app.listen(porta, () => {
  console.log('Servidor rodando em http://localhost:' + porta)
})
