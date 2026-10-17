const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ejs = require('ejs')

test('navbar renderiza cinco destaques, todas as categorias e trata falha do banco', async () => {
  const categorias = Array.from({ length: 6 }, (_, indice) => ({ id_categoria: indice + 1, nome: indice ? 'Categoria ' + indice : '<teste>' }))
  let falhar = false
  const caminho = require.resolve('../config/database')
  require.cache[caminho] = { id: caminho, filename: caminho, loaded: true, exports: {
    promise: () => ({ query: async ({ sql }) => {
      if (falhar) throw Object.assign(new Error('detalhes internos'), { code: 'TESTE' })
      assert.ok(sql.trim().startsWith('SELECT'))
      return [sql.includes('COUNT') ? categorias : [{ id_subcategoria: 1, categoria_id: 1, nome: 'Subcategoria teste' }]]
    } })
  } }
  const carregarNavbar = require('../middlewares/navbar')
  const resposta = { locals: { usuario: null } }
  await carregarNavbar({}, resposta, () => {})
  assert.equal(resposta.locals.navbarPrincipais.length, 5)
  assert.equal(resposta.locals.navbarCategorias.length, 6)
  const arquivo = fs.readFileSync('views/partials/header.ejs', 'utf8')
  const html = ejs.render(arquivo, resposta.locals)
  assert.equal((html.match(/class="menu-suspenso categoria-principal"/g) || []).length, 5)
  assert.equal((html.match(/class="menu-suspenso categoria-submenu"/g) || []).length, 6)
  assert.ok(html.includes('&lt;teste&gt;'))
  assert.ok(html.includes('subcategoria=1'))
  falhar = true
  const log = console.error
  console.error = () => {}
  try { await carregarNavbar({}, resposta, () => {}) } finally { console.error = log }
  assert.equal(resposta.locals.navbarIndisponivel, true)
  assert.deepEqual(resposta.locals.navbarPrincipais, [])
  assert.ok(!ejs.render(arquivo, resposta.locals).includes('detalhes internos'))
})

test('menus mantêm hover, fechamento por Escape e comportamento nativo de toque', () => {
  const eventos = {}
  let recebeuFoco = false
  const menu = { open: false, contains: () => false, querySelector: () => ({ focus: () => { recebeuFoco = true } }), addEventListener: (nome, acao) => { eventos[nome] = acao } }
  vm.runInNewContext(fs.readFileSync('public/js/modules/navbar.js', 'utf8'), { document: { activeElement: null, querySelectorAll: () => [menu] } })
  eventos.pointerenter({ pointerType: 'touch' }); assert.equal(menu.open, false)
  eventos.pointerenter({ pointerType: 'mouse' }); assert.equal(menu.open, true)
  eventos.pointerleave({ pointerType: 'mouse' }); assert.equal(menu.open, false)
  menu.open = true
  eventos.keydown({ key: 'Escape', stopPropagation() {} })
  assert.equal(menu.open, false); assert.ok(recebeuFoco)
})
