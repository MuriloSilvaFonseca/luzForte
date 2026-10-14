const express = require('express')
const lojaRouter = require('./routes/loja')
const authRouter = require('./routes/auth')
const produtosApi = require('./routes/api-produtos')   // NOVO
const app = express()
const port = 4000

app.use(express.urlencoded({ extended: true }))

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.use('/', lojaRouter)
app.use('/', authRouter)
app.use('/', produtosApi)                              // NOVO (antes do 404)

// Nenhuma rota respondeu: página não existe
app.use((req, res) => {
  res.status(404).send('Página não encontrada')
})

app.listen(port, () => {
  console.log('Servidor rodando em http://localhost:' + port)
})