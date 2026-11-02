const banco = require('../config/database').promise()

module.exports = async (req, res, next) => {
  if (!req.session.usuario) return next()
  try {
    const [usuarios] = await banco.query('SELECT ativo, acesso FROM usuario WHERE id_usuario = ? LIMIT 1', [req.session.usuario.id_usuario])
    if (!usuarios.length || Number(usuarios[0].ativo) !== 1) {
      return req.session.destroy(() => {
        res.clearCookie('connect.sid')
        if (req.path.startsWith('/api/')) return res.status(403).json({ erro: 'Sua conta está desativada. Entre novamente para continuar.' })
        res.redirect('/login?conta=desativada')
      })
    }
    req.session.usuario.acesso = usuarios[0].acesso
    res.locals.usuario = req.session.usuario
    next()
  } catch (erro) {
    console.error('Falha ao verificar situação da conta:', erro.code)
    res.status(503).send('Não foi possível verificar sua conta. Tente novamente.')
  }
}
