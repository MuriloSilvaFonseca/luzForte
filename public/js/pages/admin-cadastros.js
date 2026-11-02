const editorTexto = document.querySelector('#editor-texto')
const formTexto = document.querySelector('#form-texto')
const tipoTexto = document.querySelector('#tipo-texto')
const nomeTexto = document.querySelector('#nome-texto')
const conteudoTexto = document.querySelector('#conteudo-texto')
const mensagemTexto = document.querySelector('#mensagem-texto')

function abrirTexto(base = null) {
  formTexto.reset()
  tipoTexto.value = base?.dataset.tipo || 'descricao'
  nomeTexto.value = base?.querySelector('[data-nome]').textContent || ''
  conteudoTexto.value = base?.querySelector('[data-conteudo]').textContent || ''
  mensagemTexto.textContent = ''
  document.querySelector('#editor-texto-titulo').textContent = base ? 'Criar uma versão a partir deste texto' : 'Novo texto'
  editorTexto.hidden = false
  nomeTexto.focus()
}
document.querySelector('#novo-texto').addEventListener('click', () => abrirTexto())
document.querySelectorAll('[data-usar-base]').forEach(botao => botao.addEventListener('click', () => abrirTexto(botao.closest('[data-texto-base]'))))
document.querySelector('#cancelar-texto').addEventListener('click', () => { editorTexto.hidden = true; document.querySelector('#novo-texto').focus() })
formTexto.addEventListener('submit', async evento => {
  evento.preventDefault()
  const botoes = [...document.querySelectorAll('button')]
  botoes.forEach(botao => { botao.disabled = true })
  mensagemTexto.textContent = 'Salvando…'
  try {
    const resposta = await fetch('/admin/textos/' + tipoTexto.value, {
      method: 'POST', body: new URLSearchParams({ nome: nomeTexto.value, texto: conteudoTexto.value })
    })
    if (resposta.status === 403) throw new Error('Entre novamente como administrador para continuar.')
    const resultado = await resposta.json()
    if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível salvar.')
    window.location.href = '/admin/cadastros?tipo=textos&salvo=' + (resultado.existente ? 'existente' : '1') + '#cadastros-textos'
  } catch (erro) {
    mensagemTexto.textContent = erro.message
    botoes.forEach(botao => { botao.disabled = false })
  }
})
