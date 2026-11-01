const banco = require('../config/database').promise()

function userEstaLogado(req, res, next) {
    if(req.session.usuario) {
        return next()
    }

    // O painel administrativo responde com negação explícita para visitantes.
    const caminho = req.originalUrl.split('?')[0]
    if (req.baseUrl === '/admin' || caminho === '/admin' || caminho.startsWith('/admin/')) {
        return res.status(403).send('Acesso negado')
    }

    res.redirect('/login')
}

async function userAdmin(req, res, next) {
    const usuario = req.session.usuario
    const usuarioId = Number(usuario && usuario.id_usuario)
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        return res.status(403).send('Acesso negado')
    }

    try {
        // A sessão pode ter sido criada antes de a conta receber o perfil admin.
        // Confere o perfil atual para não depender do valor antigo salvo no login.
        const [usuarios] = await banco.execute(
            'SELECT acesso FROM usuario WHERE id_usuario = ? LIMIT 1',
            [usuarioId]
        )
        if (!usuarios.length || usuarios[0].acesso !== 'admin') {
            return res.status(403).send('Acesso negado')
        }

        req.session.usuario.acesso = usuarios[0].acesso
        res.locals.usuario = req.session.usuario
        return next()
    } catch (erro) {
        console.error('Falha ao validar perfil administrativo:', erro.code || erro.message)
        return res.status(503).send('Não foi possível validar o acesso administrativo. Tente novamente.')
    }
}

module.exports = { userEstaLogado, userAdmin }
