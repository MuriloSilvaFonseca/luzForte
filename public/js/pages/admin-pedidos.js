document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modal-cancelar-pedido')
  const formulario = document.getElementById('form-cancelar-pedido')
  const campoMotivo = document.getElementById('motivo-cancelamento')
  const identificacaoPedido = document.getElementById('cancelar-pedido-id')
  if (!modal || !formulario || !campoMotivo || !identificacaoPedido) return

  document.querySelectorAll('[data-cancelar-pedido]').forEach(botao => {
    botao.addEventListener('click', () => {
      formulario.action = botao.dataset.action
      const linha = botao.closest('tr')
      identificacaoPedido.textContent = linha?.querySelector('td strong')?.textContent || ''
      campoMotivo.value = ''
      modal.showModal()
      campoMotivo.focus()
    })
  })

  modal.querySelector('[data-fechar-modal]')?.addEventListener('click', () => modal.close())
  modal.addEventListener('click', evento => {
    if (evento.target === modal) modal.close()
  })

  configurarDetalhesPedido()
})

function configurarDetalhesPedido() {
  const modal = document.getElementById('modal-detalhes-pedido')
  const estado = document.getElementById('modal-detalhes-status')
  const conteudo = document.getElementById('detalhes-pedido-conteudo')
  if (!modal || !estado || !conteudo) return

  document.querySelectorAll('[data-ver-pedido]').forEach(botao => {
    botao.addEventListener('click', async () => {
      modal.showModal()
      estado.textContent = 'Carregando detalhes do pedido...'
      conteudo.replaceChildren()
      conteudo.setAttribute('aria-busy', 'true')

      try {
        const resposta = await fetch(botao.dataset.url, { headers: { Accept: 'application/json' } })
        const dados = await resposta.json()
        if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível carregar o pedido.')
        renderizarDetalhesPedido(conteudo, dados)
        estado.textContent = 'Pedido #' + dados.pedido.id
      } catch (erro) {
        estado.textContent = erro.message || 'Não foi possível carregar os detalhes do pedido.'
      } finally {
        conteudo.setAttribute('aria-busy', 'false')
      }
    })
  })

  modal.querySelector('[data-fechar-detalhes]')?.addEventListener('click', () => modal.close())
  modal.addEventListener('click', evento => {
    if (evento.target === modal) modal.close()
  })
}

function renderizarDetalhesPedido(conteudo, dados) {
  const { pedido, itens } = dados
  const resumo = document.createElement('dl')
  resumo.className = 'adm-pedido-resumo'

  const campos = [
    ['Cliente', pedido.cliente || 'Cliente visitante'],
    ['E-mail', pedido.email || 'Não informado'],
    ['Data', pedido.data],
    ['Status', rotuloStatusPedido(pedido.status)],
    ['Pagamento', pedido.pagamento || 'Não informado'],
    ['Total', formatarMoeda(pedido.total)]
  ]
  campos.forEach(([rotulo, valor]) => {
    const grupo = document.createElement('div')
    const termo = document.createElement('dt')
    const descricao = document.createElement('dd')
    termo.textContent = rotulo
    descricao.textContent = valor
    grupo.append(termo, descricao)
    resumo.append(grupo)
  })
  conteudo.append(resumo)

  const tituloItens = document.createElement('h3')
  tituloItens.className = 'adm-pedido-itens-titulo'
  tituloItens.textContent = 'Itens do pedido'
  conteudo.append(tituloItens)

  if (!itens.length) {
    const vazio = document.createElement('p')
    vazio.className = 'adm-pedido-sem-itens'
    vazio.textContent = 'Este pedido não possui itens registrados.'
    conteudo.append(vazio)
  } else {
    const tabela = document.createElement('div')
    tabela.className = 'adm-pedido-itens-wrap'
    const tabelaItens = document.createElement('table')
    tabelaItens.className = 'adm-table adm-pedido-itens'
    const cabecalho = document.createElement('thead')
    const linhaCabecalho = document.createElement('tr')
    ;['Produto', 'SKU', 'Qtd.', 'Unitário', 'Subtotal'].forEach(rotulo => {
      const th = document.createElement('th')
      th.textContent = rotulo
      linhaCabecalho.append(th)
    })
    cabecalho.append(linhaCabecalho)

    const corpo = document.createElement('tbody')
    itens.forEach(item => {
      const linha = document.createElement('tr')
      const valores = [item.produto, item.sku, item.quantidade, formatarMoeda(item.preco_unitario), formatarMoeda(item.subtotal)]
      valores.forEach(valor => {
        const td = document.createElement('td')
        td.textContent = valor
        linha.append(td)
      })
      corpo.append(linha)
    })
    tabelaItens.append(cabecalho, corpo)
    tabela.append(tabelaItens)
    conteudo.append(tabela)
  }

  if (pedido.observacoes) {
    const observacoes = document.createElement('section')
    observacoes.className = 'adm-pedido-observacoes'
    const titulo = document.createElement('h3')
    const texto = document.createElement('p')
    titulo.textContent = 'Observações / motivo do cancelamento'
    texto.textContent = pedido.observacoes
    observacoes.append(titulo, texto)
    conteudo.append(observacoes)
  }
}

function rotuloStatusPedido(status) {
  const rotulos = { carrinho: 'Carrinho', solicitado: 'Solicitado', aprovado: 'Aprovado', finalizado: 'Finalizado', cancelado: 'Cancelado' }
  return rotulos[status] || status
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
