// Envio de e-mails pelo EmailJS, feito no SERVIDOR.
//
// Antes, o EmailJS era chamado no navegador e as chaves ficavam expostas no
// arquivo public/js/pages/forgot-password.js. Agora as chaves ficam no .env e
// só o servidor conversa com o EmailJS.
//
// Configuração necessária no painel do EmailJS:
// - Account > Security: marcar "Allow EmailJS API for non-browser applications"
// - O template precisa usar as variáveis {{to_email}}, {{nome}} e {{code}}

async function enviarCodigoRedefinicao(email, nome, codigo) {
  const resposta = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY, // chave privada: nunca no navegador
      template_params: {
        to_email: email,
        nome: nome,
        code: codigo
      }
    })
  })

  if (!resposta.ok) {
    // O EmailJS devolve o motivo do erro como texto
    const motivo = await resposta.text()
    throw new Error('EmailJS: ' + resposta.status + ' ' + motivo)
  }
}

module.exports = { enviarCodigoRedefinicao }
