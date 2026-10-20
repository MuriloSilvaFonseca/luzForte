function formatarTelefone(telefone) {
  let numeros = String(telefone || '').replace(/\D/g, '')
  if (numeros.length === 10 || numeros.length === 11) {
    numeros = '55' + numeros
  }
  return numeros
}

function formatarReais(valor) {
  return 'R$ ' + Number(valor).toFixed(2).replace('.', ',')
}

function montarLinkWhatsApp(pedido) {
  const numeroLoja = formatarTelefone(process.env.WHATSAPP_LOJA)
  if (!numeroLoja) return null

  let listaItens = ''
  for (let i = 0; i < pedido.itens.length; i++) {
    const item = pedido.itens[i]
    listaItens += '- ' + item.quantidade + 'x ' + item.titulo_produto + ' — ' + formatarReais(item.subtotal) + '\n'
  }

  const mensagem =
    'Olá! Acabei de fazer um pedido no site da LuzForte.\n\n' +
    'Pedido #' + pedido.id_pedido + '\n' +
    'Cliente: ' + pedido.nome_cliente + '\n\n' +
    'Itens:\n' + listaItens + '\n' +
    'Pagamento: ' + pedido.nome_pagamento + '\n' +
    'Retirada na loja\n' +
    'Total: ' + formatarReais(pedido.total)

  return 'https://wa.me/' + numeroLoja + '?text=' + encodeURIComponent(mensagem)
}

module.exports = { montarLinkWhatsApp }
