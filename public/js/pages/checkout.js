// Script da página de checkout.
//
// 1. Ao clicar em "Confirmar pedido", abre um modal (SweetAlert2) pedindo confirmação
//    e avisando que o cliente será levado ao WhatsApp da loja.
// 2. Na tela de confirmação, abre o WhatsApp automaticamente com a mensagem pronta.
//
// Se o SweetAlert2 não carregar (sem internet, por exemplo), usa o confirm() do navegador.

// Mostra o modal de confirmação. Devolve uma promise com true (confirmou) ou false.
function perguntar(titulo, texto) {
  if (typeof Swal === 'undefined') {
    return Promise.resolve(window.confirm(titulo + '\n\n' + texto))
  }
  return Swal.fire({
    title: titulo,
    text: texto,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sim, finalizar pedido',
    cancelButtonText: 'Revisar pedido',
    confirmButtonColor: '#25d366',
    cancelButtonColor: '#6b7280',
    reverseButtons: true
  }).then(resultado => resultado.isConfirmed)
}

// ---------- Formulário "Finalizar pedido" ----------
function configurarFormulario() {
  const formulario = document.getElementById('form-checkout')
  if (!formulario) return

  const vaiParaWhatsApp = formulario.dataset.whatsapp === 'sim'
  const texto = vaiParaWhatsApp
    ? 'Seu pedido será registrado e você será redirecionado para o WhatsApp da loja para enviar a mensagem com os detalhes.'
    : 'Seu pedido será registrado e enviado para a loja.'

  formulario.addEventListener('submit', evento => {
    // O navegador já conferiu o "required" da forma de pagamento antes de chegar aqui
    evento.preventDefault()

    perguntar('Tem certeza que deseja finalizar o pedido?', texto).then(confirmou => {
      if (!confirmou) return
      const botao = formulario.querySelector('button[type="submit"]')
      botao.disabled = true // evita enviar o pedido duas vezes
      botao.textContent = 'Enviando pedido...'
      formulario.submit() // envia de verdade (não dispara o "submit" de novo)
    })
  })
}

// ---------- Tela de confirmação ----------
function abrirWhatsAppAutomaticamente() {
  const confirmacao = document.getElementById('confirmacao-pedido')
  if (!confirmacao || !confirmacao.dataset.linkWhatsapp) return

  const link = confirmacao.dataset.linkWhatsapp
  const pedido = confirmacao.dataset.pedido

  // Abre só uma vez por pedido: se o cliente voltar do WhatsApp para esta página,
  // não é mandado de novo (o botão verde continua disponível)
  const chave = 'whatsapp-aberto-' + pedido
  try {
    if (sessionStorage.getItem(chave)) return
    sessionStorage.setItem(chave, 'sim')
  } catch (_) { /* navegador sem sessionStorage: segue normalmente */ }

  if (typeof Swal === 'undefined') {
    window.location.href = link
    return
  }

  Swal.fire({
    title: 'Pedido #' + pedido + ' registrado!',
    text: 'Abrindo o WhatsApp da loja com a mensagem do seu pedido...',
    icon: 'success',
    timer: 2500,
    timerProgressBar: true,
    showConfirmButton: false
  }).then(() => {
    window.location.href = link
  })
}

document.addEventListener('DOMContentLoaded', () => {
  configurarFormulario()
  abrirWhatsAppAutomaticamente()
})
