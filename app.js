require('dotenv').config()

const criptografia = require('node:crypto')
const express = require('express')
const sessao = require('express-session')
const rotasLoja = require('./routes/loja')
const rotasAutenticacao = require('./routes/auth')
const rotasProdutosAdmin = require('./routes/admin')
const rotasAdmin = require('./routes/admin-paineis')
const app = express()
const porta = Number(process.env.PORT || 3000)

app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// O SESSION_SECRET assina o cookie de login. Se o .env não tiver um, sorteamos um aleatório
// a cada vez que o servidor sobe: tudo funciona, mas quem estiver logado sai ao reiniciar.
// Não usamos um valor fixo aqui porque ele ficaria público no GitHub.
let segredoSessao = process.env.SESSION_SECRET
if (!segredoSessao) {
  segredoSessao = criptografia.randomBytes(32).toString('hex')
  console.warn('SESSION_SECRET não definido no .env: usando um segredo temporário (os logins caem ao reiniciar).')
}

app.use( sessao({
  secret: segredoSessao,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  // sameSite 'lax': o navegador não envia o cookie de login em formulários vindos de OUTROS sites.
  // Protege contra CSRF (um site malicioso enviando um POST para o painel com o admin logado).
  cookie: { maxAge: 1000 * 60 * 60 * 0.5, httpOnly: true, sameSite: 'lax' }
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
app.use(require('./middlewares/usuario-ativo'))

app.use('/api/carrinho', require('./routes/carrinho'))
app.use('/api/produtos', require('./routes/produtos'))


app.use(require('./middlewares/navbar'))

app.use('/', rotasLoja)
app.use('/', rotasAutenticacao)
app.use('/', require('./routes/conta'))
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

  // Erros de requisição inválida (ex.: formulário grande demais) mantêm o código 4xx
  const status = erro.status >= 400 && erro.status < 500 ? erro.status : 500

  // Alguns erros acontecem antes dos middlewares que preparam o header;
  // sem estes valores padrão, a própria página de erro quebraria.
  res.locals.usuario = res.locals.usuario || null
  res.locals.whatsappLoja = res.locals.whatsappLoja || null
  res.locals.navbarCategorias = res.locals.navbarCategorias || []
  res.locals.navbarPrincipais = res.locals.navbarPrincipais || []
  res.locals.navbarIndisponivel = res.locals.navbarIndisponivel || false

  res.status(status).render('loja/erro', {
    tituloPagina: 'Erro no servidor',
    codigo: String(status),
    titulo: status === 500 ? 'Tivemos um problema por aqui' : 'Não foi possível processar o pedido',
    mensagem: 'Não foi possível concluir sua solicitação agora. Tente novamente em instantes.'
  }, (erroPagina, html) => {
    // Se até a página de erro falhar, responde em texto simples (nunca mostra o stack trace)
    if (erroPagina) {
      console.error('Falha ao montar a página de erro:', erroPagina)
      return res.type('text').send('Erro no servidor. Tente novamente em instantes.')
    }
    res.send(html)
  })
})

if (require.main === module) {
  app.listen(porta, () => {
    console.log('Servidor rodando em http://localhost:' + porta)
  })
}

module.exports = app
