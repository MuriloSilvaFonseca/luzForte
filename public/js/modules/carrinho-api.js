window.imagemProdutoSegura = function (caminho) {
  if (typeof caminho !== 'string' || !caminho.trim()) return '/img/icons/icons8-caixa-128.png'
  const valor = caminho.trim()
  if (/^https?:\/\//i.test(valor) || /^\/(?!\/)/.test(valor)) return valor
  if (/^img\//.test(valor)) return '/' + valor
  return '/img/icons/icons8-caixa-128.png'
}
let leituraInicialCarrinho
async function requisitarCarrinho(caminho = '', metodo = 'GET', dados) {
  const resposta = await fetch('/api/carrinho' + caminho, {
    method: metodo, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...(dados ? { body: JSON.stringify(dados) } : {})
  })
  const resultado = await resposta.json()
  if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível acessar o carrinho.')
  document.querySelectorAll('.cart-badge').forEach(elemento => {
    elemento.textContent = resultado.itens.reduce((total, item) => total + item.quantidade, 0)
  })
  return resultado
}
window.carrinhoApi = async function (caminho = '', metodo = 'GET', dados) {
  if (!leituraInicialCarrinho) {
    leituraInicialCarrinho = requisitarCarrinho().catch(erro => {
      leituraInicialCarrinho = null
      throw erro
    })
    // Evita rejeição não tratada caso a chamada inicial seja uma mutação.
    if (!caminho && metodo === 'GET') return leituraInicialCarrinho
    await leituraInicialCarrinho
  } else {
    await leituraInicialCarrinho
  }
  return requisitarCarrinho(caminho, metodo, dados)
}
window.adicionarProdutoCarrinho = async function (sku, quantidade = 1) {
  return window.carrinhoApi('/itens', 'POST', { produto_sku: Number(sku), quantidade: Number(quantidade) })
}
window.adicionarPeloBotao = async function (botao, sku) {
  if (botao.disabled) return
  const texto = botao.textContent
  botao.disabled = true
  try {
    await window.adicionarProdutoCarrinho(sku)
    botao.textContent = 'Adicionado!'
    setTimeout(() => { botao.textContent = texto }, 1200)
  } catch (erro) {
    alert(erro.message)
  } finally {
    botao.disabled = false
  }
}
document.addEventListener('DOMContentLoaded', () => {
  window.carrinhoApi().catch(() => {})
})
