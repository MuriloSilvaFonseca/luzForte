const test = require('node:test')
const assert = require('node:assert/strict')

test('contas desativadas perdem acesso mesmo com sessão já criada', async () => {
  let ativo = 1
  let falhar = false
  const arquivo = require.resolve('../config/database')
  require.cache[arquivo] = { id: arquivo, filename: arquivo, loaded: true, exports: { promise: () => ({ query: async (sql, valores) => {
    assert.deepEqual(valores, [2])
    if (falhar) throw new Error('Indisponível')
    return [[{ ativo, acesso: 'cliente' }]]
  } }) } }
  const verificar = require('../middlewares/usuario-ativo')
  function contexto(caminho) {
    const resultado = { next: false, destruida: false, status: 200, destino: '', json: null }
    const req = { path: caminho, session: { usuario: { id_usuario: 2, acesso: 'admin' }, destroy(callback) { resultado.destruida = true; callback() } } }
    const res = { locals: {}, clearCookie() {}, status(n) { resultado.status = n; return this }, json(dados) { resultado.json = dados }, redirect(url) { resultado.destino = url }, send() {} }
    return { req, res, resultado, next() { resultado.next = true } }
  }
  let c = contexto('/checkout')
  await verificar(c.req, c.res, c.next)
  assert.equal(c.resultado.next, true)
  assert.equal(c.req.session.usuario.acesso, 'cliente')
  ativo = 0; c = contexto('/checkout')
  await verificar(c.req, c.res, c.next)
  assert.equal(c.resultado.destruida, true)
  assert.equal(c.resultado.destino, '/login?conta=desativada')
  c = contexto('/api/carrinho')
  await verificar(c.req, c.res, c.next)
  assert.equal(c.resultado.status, 403)
  assert.equal(c.resultado.next, false)
  falhar = true; c = contexto('/checkout')
  await verificar(c.req, c.res, c.next)
  assert.equal(c.resultado.status, 503)
  assert.equal(c.resultado.next, false)
})
