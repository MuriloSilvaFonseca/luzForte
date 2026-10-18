const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const session = require('express-session')
const bcrypt = require('bcryptjs')

test('login cria sessão sem expor senha; rejeita senha incorreta e usuário do seed', async () => {
  const hash = await bcrypt.hash('senha-apenas-do-teste', 4)
  const path = require.resolve('../config/database')
  require.cache[path] = { id: path, filename: path, loaded: true, exports: {
    query: (sql, args, callback) => {
      assert.ok(sql.startsWith('SELECT'))
      let usuarios = []
      if (args[0] === 'seed@example.com') usuarios = [{ id_usuario: 2, nome_usuario: 'Seed', acesso: 'cliente', senha: '!LOGIN_DESABILITADO_SEED!' }]
      if (args[0] === 'teste@example.com') usuarios = [{ id_usuario: 1, nome_usuario: 'Teste', acesso: 'cliente', senha: hash }]
      queueMicrotask(() => callback(null, usuarios))
    }
  } }
  const app = express()
  app.set('view engine', 'ejs')
  app.use(express.urlencoded({ extended: false }))
  app.use(session({ secret: 'somente-testes-isolados', resave: false, saveUninitialized: false }))
  app.use(require('../routes/auth'))
  app.get('/sessao-teste', (req, res) => res.json(req.session.usuario || null))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  const login = (email, password) => fetch(base + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ email, password }) })
  try {
    assert.equal((await login('teste@example.com', 'errada')).status, 401)
    assert.equal((await login('seed@example.com', 'qualquer')).status, 401)
    assert.equal((await login('inexistente@example.com', 'qualquer')).status, 401)
    const response = await login('teste@example.com', 'senha-apenas-do-teste')
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), '/carrinho')
    const cookie = response.headers.get('set-cookie').split(';')[0]
    const logged = await (await fetch(base + '/sessao-teste', { headers: { cookie } })).json()
    assert.deepEqual(logged, { id_usuario: 1, nome_usuario: 'Teste', acesso: 'cliente' })
    assert.equal(await (await fetch(base + '/sessao-teste')).json(), null)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
