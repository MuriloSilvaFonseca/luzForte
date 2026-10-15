function userEstaLogado(req, res, next) {
    if(req.session.usuario) {
        return next()
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