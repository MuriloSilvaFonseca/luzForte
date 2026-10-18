const criptografia = require('node:crypto')
const inicializacoesDeSessao = new Map()

async function garantirTokenVisitante(req) {
  if (req.session.tokenCarrinhoVisitante) return
  await new Promise(resolve => req.session.reload(() => resolve()))
  if (req.session.tokenCarrinhoVisitante) return
  req.session.tokenCarrinhoVisitante = criptografia.randomBytes(32).toString('hex')
  await new Promise((resolve, reject) => req.session.save(erro => erro ? reject(erro) : resolve()))
}

async function identificarCarrinho(req, res, next) {
  const usuarioId = req.session.usuario && req.session.usuario.id_usuario
  if (req.session.usuario) {
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) return res.status(401).json({ erro: 'Sessão inválida. Entre novamente.' })
    res.locals.carrinhoUsuarioId = usuarioId
    return next()
  }
  // Serializa a primeira gravação da sessão para não gerar dois tokens por visitante.
  const anterior = inicializacoesDeSessao.get(req.sessionID) || Promise.resolve()
  const atual = anterior.catch(() => {}).then(() => garantirTokenVisitante(req))
  inicializacoesDeSessao.set(req.sessionID, atual)
  try {
    await atual
    const token = req.session.tokenCarrinhoVisitante
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Token inválido')
    res.locals.carrinhoVisitanteHash = criptografia.createHash('sha256').update(token).digest('hex')
    next()
  } catch (_) {
    res.status(500).json({ erro: 'Não foi possível iniciar a sessão do carrinho.' })
  } finally {
    if (inicializacoesDeSessao.get(req.sessionID) === atual) inicializacoesDeSessao.delete(req.sessionID)
  }
}

module.exports = identificarCarrinho
