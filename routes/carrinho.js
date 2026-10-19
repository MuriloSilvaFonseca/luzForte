const express = require('express')
const identificarCarrinho = require('../middlewares/identificar-carrinho')
const { executarCarrinho, inteiroPositivo } = require('../services/carrinho')
const router = express.Router()

router.use((req, res, next) => {
  const tipo = (req.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && tipo !== 'application/json') {
    return res.status(415).json({ erro: 'Utilize Content-Type application/json.' })
  }
  next()
})
router.use(express.json({ limit: '16kb' }))
router.use(identificarCarrinho)

async function responderCarrinho(req, res, operacao) {
  try {
    const identidade = { usuarioId: res.locals.carrinhoUsuarioId, visitanteHash: res.locals.carrinhoVisitanteHash }
    const sku = operacao === 'adicionar' ? req.body.produto_sku : Number(req.params.sku)
    const dados = { sku, quantidade: req.body?.quantidade }
    res.json(await executarCarrinho(identidade, operacao, dados))
  } catch (erro) {
    // Erros inesperados (sem status) ficam registrados no terminal para investigação
    if (!erro.status) console.log(erro)
    const limite = ['ER_WARN_DATA_OUT_OF_RANGE', 'ER_DATA_OUT_OF_RANGE'].includes(erro.code)
    const status = erro.status || (limite ? 400 : 500)
    let mensagem = 'Não foi possível atualizar ou consultar o carrinho.'
    if (erro.status) mensagem = erro.message
    else if (limite) mensagem = 'Valor do carrinho excede o limite permitido.'
    res.status(status).json({ erro: mensagem })
  }
}

router.get('/', (req, res) => responderCarrinho(req, res, 'listar'))
router.post('/itens', (req, res) => {
  if (!inteiroPositivo(req.body && req.body.produto_sku) || !inteiroPositivo(req.body && req.body.quantidade)) {
    return res.status(400).json({ erro: 'Informe produto_sku e quantidade como números inteiros positivos.' })
  }
  return responderCarrinho(req, res, 'adicionar')
})
router.use('/itens/:sku', (req, res, next) => {
  if (!/^\d+$/.test(req.params.sku) || !inteiroPositivo(Number(req.params.sku))) return res.status(400).json({ erro: 'Produto inválido.' })
  next()
})
router.patch('/itens/:sku', (req, res) => {
  if (!inteiroPositivo(req.body && req.body.quantidade)) return res.status(400).json({ erro: 'Informe uma quantidade inteira positiva.' })
  return responderCarrinho(req, res, 'quantidade')
})
router.delete('/itens/:sku', (req, res) => responderCarrinho(req, res, 'remover'))

router.use((erro, req, res, next) => {
  if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' })
  if (erro.type === 'entity.too.large') return res.status(413).json({ erro: 'Corpo da requisição muito grande.' })
  return res.status(500).json({ erro: 'Não foi possível processar a requisição.' })
})

module.exports = router
