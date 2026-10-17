const test = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')

test('cliente HTTP envia SKU/quantidade e atualiza contador somente em sucesso', async () => {
  const badge = { textContent: '' }
  let chamada
  let falhar = false
  const contexto = { window: {}, document: { querySelectorAll: () => [badge], addEventListener() {} }, fetch: async (url, opcoes) => {
    chamada = { url, opcoes }
    return { ok: !falhar, json: async () => falhar ? { erro: 'Sessão indisponível.' } : { itens: [{ quantidade: 2 }, { quantidade: 1 }] } }
  } }
  vm.runInNewContext(fs.readFileSync('public/js/modules/carrinho-api.js', 'utf8'), contexto)
  await contexto.window.adicionarProdutoCarrinho('1001', '2')
  assert.equal(chamada.url, '/api/carrinho/itens')
  assert.equal(chamada.opcoes.method, 'POST')
  assert.equal(chamada.opcoes.credentials, 'same-origin')
  assert.deepEqual(JSON.parse(chamada.opcoes.body), { produto_sku: 1001, quantidade: 2 })
  assert.equal(badge.textContent, 3)
  falhar = true
  await assert.rejects(contexto.window.carrinhoApi(), /Sessão indisponível/)
  assert.equal(badge.textContent, 3)
})

test('primeira leitura estabelece sessão antes de adicionar e bloqueia URLs de imagem inseguras', async () => {
  const chamadas = []
  let liberar
  const espera = new Promise(resolve => { liberar = resolve })
  const contexto = { window: {}, document: { querySelectorAll: () => [], addEventListener() {} }, fetch: async (url, options) => {
    chamadas.push(options.method)
    if (chamadas.length === 1) await espera
    return { ok: true, json: async () => ({ itens: [] }) }
  } }
  vm.runInNewContext(fs.readFileSync('public/js/modules/carrinho-api.js', 'utf8'), contexto)
  const primeira = contexto.window.carrinhoApi()
  const adicionar = contexto.window.adicionarProdutoCarrinho(1001, 1)
  assert.deepEqual(chamadas, ['GET'])
  liberar()
  await Promise.all([primeira, adicionar])
  assert.deepEqual(chamadas, ['GET', 'POST'])
  assert.equal(contexto.window.imagemProdutoSegura('javascript:alert(1)'), '/img/icons/icons8-caixa-128.png')
  assert.equal(contexto.window.imagemProdutoSegura('//outro-site/imagem'), '/img/icons/icons8-caixa-128.png')
  assert.equal(contexto.window.imagemProdutoSegura('/img/products/lampada.png'), '/img/products/lampada.png')
})

test('botão compartilhado impede clique duplicado e recupera estado após erro', async () => {
  const avisos = []
  const temporizadores = []
  const contexto = {
    window: {}, document: { querySelectorAll: () => [], addEventListener() {} },
    alert: mensagem => avisos.push(mensagem), setTimeout: acao => temporizadores.push(acao)
  }
  vm.runInNewContext(fs.readFileSync('public/js/modules/carrinho-api.js', 'utf8'), contexto)
  let liberar
  let chamadas = 0
  contexto.window.adicionarProdutoCarrinho = async () => {
    chamadas++
    await new Promise(resolve => { liberar = resolve })
  }
  const botao = { disabled: false, textContent: 'Adicionar ao carrinho' }
  const primeiroClique = contexto.window.adicionarPeloBotao(botao, 1001)
  await contexto.window.adicionarPeloBotao(botao, 1001)
  assert.equal(chamadas, 1); assert.equal(botao.disabled, true)
  liberar(); await primeiroClique
  assert.equal(botao.textContent, 'Adicionado!'); assert.equal(botao.disabled, false)
  temporizadores[0]()
  assert.equal(botao.textContent, 'Adicionar ao carrinho')
  contexto.window.adicionarProdutoCarrinho = async () => { throw new Error('Falha simulada') }
  await contexto.window.adicionarPeloBotao(botao, 1001)
  assert.equal(botao.disabled, false); assert.deepEqual(avisos, ['Falha simulada'])
})
