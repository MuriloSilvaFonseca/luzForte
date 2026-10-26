// Mostra ou esconde cada senha quando a pessoa clica no icone do olho.
document.querySelectorAll('.show-pass').forEach(botao => {
  botao.addEventListener('click', () => {
    const grupo = botao.closest('.password-row, .login-password-row')
    const campo = grupo && grupo.querySelector('input')
    if (!campo) return

    const mostrar = campo.type === 'password'
    campo.type = mostrar ? 'text' : 'password'
    botao.setAttribute('aria-pressed', String(mostrar))
    botao.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha')

    const imagem = botao.querySelector('img')
    if (imagem) imagem.src = mostrar ? '/img/icons/visao.png' : '/img/icons/olho-fechado.png'
  })
})

// Formata telefones brasileiros enquanto a pessoa digita.
document.querySelectorAll('[data-mascara="telefone"]').forEach(campo => {
  campo.addEventListener('input', () => {
    const digitos = campo.value.replace(/\D/g, '').slice(0, 11)
    if (!digitos) {
      campo.value = ''
      return
    }

    const ddd = digitos.slice(0, 2)
    const numero = digitos.slice(2)
    if (digitos.length <= 2) {
      campo.value = `(${ddd}`
      return
    }

    const tamanhoPrimeiraParte = digitos.length === 11 ? 5 : 4
    const primeiraParte = numero.slice(0, tamanhoPrimeiraParte)
    const segundaParte = numero.slice(tamanhoPrimeiraParte)
    campo.value = `(${ddd}) ${primeiraParte}${segundaParte ? `-${segundaParte}` : ''}`
  })
})

// Remove espaços acidentais do e-mail antes de enviar qualquer formulário.
document.querySelectorAll('form').forEach(formulario => {
  formulario.addEventListener('submit', () => {
    const email = formulario.querySelector('input[name="email"]')
    if (email) email.value = email.value.trim()
  })
})

// Evita envios duplicados no login e no cadastro enquanto o servidor responde.
const formulariosDeAutenticacao = document.querySelectorAll('#login-form, .cadastro-form')
formulariosDeAutenticacao.forEach(formulario => {
  const botaoEnviar = formulario.querySelector('button[type="submit"]')
  if (!botaoEnviar) return

  const textoOriginal = botaoEnviar.textContent
  formulario.addEventListener('submit', evento => {
    if (formulario.dataset.enviando === 'true') {
      evento.preventDefault()
      return
    }

    formulario.dataset.enviando = 'true'
    formulario.setAttribute('aria-busy', 'true')
    botaoEnviar.disabled = true
    botaoEnviar.textContent = 'Enviando...'
  })

  // Reabilita o botão se o navegador restaurar a página pelo histórico.
  window.addEventListener('pageshow', () => {
    delete formulario.dataset.enviando
    formulario.removeAttribute('aria-busy')
    botaoEnviar.disabled = false
    botaoEnviar.textContent = textoOriginal
  })
})
