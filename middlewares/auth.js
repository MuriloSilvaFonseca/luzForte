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

function userAdmin(req, res, next) {
    if(req.session.usuario && req.session.usuario.acesso === 'admin') {
        return next()
    }

    res.status(403).send('Acesso negado')
}

module.exports = { userEstaLogado, userAdmin }
