const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')
const session = require('express-session')
const bcrypt = require('bcryptjs')

test('login escolhe o destino usando o perfil salvo no MySQL', async t => {
  const senha = 'senha-somente-teste'
  const hash = await bcrypt.hash(senha, 4)
  const caminhoBanco = require.resolve('../config/database')
  require.cache[caminhoBanco] = {
    id: caminhoBanco, filename: caminhoBanco, loaded: true,
    exports: {
      query(sql, valores, callback) {
        assert.match(sql, /^SELECT id_usuario, nome_usuario, acesso, senha, ativo FROM usuario WHERE email = \? LIMIT 1$/)
        const perfil = valores[0] === 'admin@example.com' ? 'admin' : 'cliente'
        callback(null, [{ id_usuario: 1, nome_usuario: 'Conta de teste', acesso: perfil, senha: hash, ativo: 1 }])
      }
    }
  }
  const caminhoCarrinho = require.resolve('../services/carrinho')
  require.cache[caminhoCarrinho] = {
    id: caminhoCarrinho, filename: caminhoCarrinho, loaded: true,
    exports: { transferirCarrinhoVisitante: async () => {} }
  }
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '../views'))
  app.use(express.urlencoded({ extended: true }))
  app.use(session({ secret: 'apenas-sessao-de-teste', resave: false, saveUninitialized: false }))
  app.use(require('../routes/auth'))
  app.get('/sessao-teste', (req, res) => res.json(req.session.usuario || null))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise(resolve => servidor.once('listening', resolve))
  const base = 'http://127.0.0.1:' + servidor.address().port

  try {
    for (const perfil of ['admin', 'cliente']) {
      await t.test(perfil + ' recebe o destino correto e uma sessão sem senha', async () => {
        const resposta = await fetch(base + '/login', {
          method: 'POST', redirect: 'manual',
          body: new URLSearchParams({ email: perfil + '@example.com', password: senha, acesso: 'admin' })
        })
        assert.equal(resposta.status, 302)
        assert.equal(resposta.headers.get('location'), perfil === 'admin' ? '/admin' : '/carrinho')
        const cookie = resposta.headers.get('set-cookie').split(';')[0]
        const sessao = await (await fetch(base + '/sessao-teste', { headers: { cookie } })).json()
        assert.deepEqual(sessao, { id_usuario: 1, nome_usuario: 'Conta de teste', acesso: perfil })
      })
    }

    await t.test('senha errada não autentica nem redireciona para o dashboard', async () => {
      const resposta = await fetch(base + '/login', {
        method: 'POST', redirect: 'manual',
        body: new URLSearchParams({ email: 'admin@example.com', password: 'incorreta' })
      })
      assert.equal(resposta.status, 401)
      assert.equal(resposta.headers.get('location'), null)
      assert.equal(resposta.headers.get('set-cookie'), null)
    })
  } finally {
    servidor.closeAllConnections()
    await new Promise(resolve => servidor.close(resolve))
  }
})
