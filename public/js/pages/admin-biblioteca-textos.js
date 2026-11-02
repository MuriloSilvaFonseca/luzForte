document.querySelectorAll('[data-biblioteca]').forEach(grupo => {
  const tipo = grupo.dataset.biblioteca
  const seletor = grupo.querySelector('[data-seletor]')
  const lista = grupo.querySelector('[data-lista-modelos]')
  const busca = grupo.querySelector('[data-busca-modelo]')
  const editor = grupo.querySelector('[data-editor]')
  const nome = grupo.querySelector('[data-nome-modelo]')
  const texto = grupo.querySelector('[data-texto-modelo]')
  const mensagem = grupo.querySelector('[data-mensagem-biblioteca]')
  const salvar = grupo.querySelector('[data-salvar-modelo]')
  let modelos = []
  let editando = null
  let modeloBase = null

  function fecharEditor() {
    editor.hidden = true
    nome.setCustomValidity('')
    texto.setCustomValidity('')
  }

  async function respostaJson(resposta) {
    if (resposta.status === 403) throw new Error('Sua sessão terminou ou não tem acesso de administrador. Entre novamente para continuar.')
    const dados = await resposta.json()
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir. Tente novamente.')
    return dados
  }

  async function carregar() {
    const botao = grupo.querySelector('[data-buscar-modelos]')
    botao.disabled = true
    lista.disabled = true
    grupo.querySelector('[data-usar-modelo]').disabled = true
    mensagem.textContent = 'Carregando textos…'
    try {
      modelos = await respostaJson(await fetch('/admin/textos/' + tipo + '?q=' + encodeURIComponent(busca.value.trim())))
      lista.replaceChildren(new Option('Selecione um texto', ''))
      modelos.forEach(m => lista.add(new Option(m.nome + ' — ' + m.texto.replace(/\s+/g, ' ').slice(0, 60) + ' · ' + m.usos + ' produto(s)', m.id)))
      grupo.querySelector('[data-previa]').textContent = ''
      mensagem.textContent = modelos.length ? 'Selecione um texto para ver o conteúdo. A busca mostra até 100 resultados.' : 'Nenhum texto encontrado. Você pode criar um novo.'
    } catch (erro) {
      modelos = []
      lista.replaceChildren(new Option('Não foi possível carregar', ''))
      mensagem.textContent = erro.message
    } finally {
      botao.disabled = false
      lista.disabled = false
    }
  }

  function abrirEditor(modelo = null, usarComoBase = false) {
    editando = usarComoBase ? null : modelo
    modeloBase = usarComoBase ? modelo.id : null
    nome.value = modelo?.nome || ''
    texto.value = modelo?.texto || ''
    nome.setCustomValidity('')
    texto.setCustomValidity('')
    grupo.querySelector('[data-aviso-modelo]').textContent = usarComoBase
      ? 'Edite esta nova versão, por exemplo a voltagem. O texto original e os outros produtos serão mantidos.'
      : modelo
      ? 'Ao salvar, este texto será atualizado em todos os produtos vinculados. Atualmente: ' + modelo.usos + ' produto(s).'
      : 'O novo texto ficará na biblioteca e será selecionado para este produto.'
    salvar.textContent = editando ? 'Salvar para todos' : 'Salvar novo texto e usar'
    seletor.hidden = true
    editor.hidden = false
    nome.focus()
  }

  function vincular(modelo) {
    let item = [...grupo.querySelectorAll('[data-modelo-id]')].find(el => el.dataset.modeloId === String(modelo.id))
    if (!item) {
      item = document.createElement('article')
      item.className = 'admin-textos-vinculo'
      item.dataset.modeloId = modelo.id
      const id = document.createElement('input')
      id.type = 'hidden'
      id.name = 'modelos'
      id.value = modelo.id
      const titulo = document.createElement('strong')
      titulo.dataset.nome = ''
      const detalhes = document.createElement('details')
      const resumo = document.createElement('summary')
      resumo.textContent = 'Ver texto'
      const conteudo = document.createElement('p')
      conteudo.className = 'admin-textos-conteudo'
      conteudo.dataset.texto = ''
      detalhes.append(resumo, conteudo)
      const acoes = document.createElement('div')
      acoes.className = 'admin-complementos-botoes'
      for (const [atributo, rotulo] of [['copiarModelo', 'Usar como base e editar'], ['editarModelo', 'Editar texto compartilhado'], ['desvincular', 'Retirar deste produto']]) {
        const botao = document.createElement('button')
        botao.type = 'button'
        botao.className = 'adm-btn adm-btn--sm'
        botao.dataset[atributo] = ''
        botao.textContent = rotulo
        acoes.append(botao)
      }
      const usos = document.createElement('span')
      usos.hidden = true
      usos.dataset.usos = ''
      item.append(id, titulo, detalhes, acoes, usos)
      grupo.querySelector('.admin-textos-vinculados').append(item)
    }
    item.querySelector('[data-nome]').textContent = modelo.nome
    item.querySelector('[data-texto]').textContent = modelo.texto
    item.querySelector('[data-usos]').textContent = modelo.usos
  }

  grupo.querySelector('[data-escolher-texto]').addEventListener('click', () => {
    seletor.hidden = false
    fecharEditor()
    carregar()
    busca.focus()
  })
  grupo.querySelector('[data-buscar-modelos]').addEventListener('click', carregar)
  busca.addEventListener('keydown', evento => {
    if (evento.key === 'Enter') { evento.preventDefault(); carregar() }
  })
  lista.addEventListener('change', () => {
    const modelo = modelos.find(m => String(m.id) === lista.value)
    grupo.querySelector('[data-previa]').textContent = modelo?.texto || ''
    grupo.querySelector('[data-usar-modelo]').disabled = !modelo
  })
  grupo.querySelector('[data-usar-modelo]').addEventListener('click', () => {
    const modelo = modelos.find(m => String(m.id) === lista.value)
    if (!modelo) return
    vincular(modelo)
    seletor.hidden = true
    mensagem.textContent = 'Texto selecionado. Salve o produto para confirmar o vínculo.'
  })
  grupo.querySelector('[data-usar-base]').addEventListener('click', () => {
    const modelo = modelos.find(m => String(m.id) === lista.value)
    if (modelo) abrirEditor(modelo, true)
    else mensagem.textContent = 'Selecione um texto para usar como base.'
  })
  grupo.querySelector('[data-fechar-seletor]').addEventListener('click', () => { seletor.hidden = true; grupo.querySelector('[data-escolher-texto]').focus() })
  grupo.querySelector('[data-novo-modelo]').addEventListener('click', () => abrirEditor())
  grupo.querySelector('[data-cancelar-modelo]').addEventListener('click', () => { fecharEditor(); grupo.querySelector('[data-novo-modelo]').focus() })
  grupo.addEventListener('click', evento => {
    const item = evento.target.closest('[data-modelo-id]')
    if (!item || salvar.disabled) return
    if (evento.target.closest('[data-desvincular]')) {
      item.remove()
      mensagem.textContent = 'Texto retirado do formulário. Salve o produto para confirmar. Ele continua na biblioteca.'
    }
    if (evento.target.closest('[data-editar-modelo]')) abrirEditor({
      id: Number(item.dataset.modeloId), tipo,
      nome: item.querySelector('[data-nome]').textContent,
      texto: item.querySelector('[data-texto]').textContent,
      usos: Number(item.querySelector('[data-usos]').textContent)
    })
    if (evento.target.closest('[data-copiar-modelo]')) abrirEditor({
      id: Number(item.dataset.modeloId), tipo,
      nome: item.querySelector('[data-nome]').textContent,
      texto: item.querySelector('[data-texto]').textContent
    }, true)
  })
  nome.addEventListener('input', () => nome.setCustomValidity(''))
  texto.addEventListener('input', () => texto.setCustomValidity(''))
  salvar.addEventListener('click', async () => {
    nome.setCustomValidity(nome.value.trim() ? '' : 'Informe o título do texto.')
    texto.setCustomValidity(texto.value.trim() ? '' : 'Informe o conteúdo do texto.')
    if (!nome.reportValidity() || !texto.reportValidity()) return
    const botoes = [...grupo.querySelectorAll('button')].map(botao => [botao, botao.disabled])
    botoes.forEach(([botao]) => { botao.disabled = true })
    nome.disabled = true
    texto.disabled = true
    mensagem.textContent = 'Salvando texto…'
    try {
      const dados = new URLSearchParams({ nome: nome.value.trim(), texto: texto.value.trim() })
      const modelo = await respostaJson(await fetch('/admin/textos/' + tipo + (editando ? '/' + editando.id : ''), { method: 'POST', body: dados }))
      if (modeloBase && modeloBase !== modelo.id) {
        const anterior = [...grupo.querySelectorAll('[data-modelo-id]')].find(item => item.dataset.modeloId === String(modeloBase))
        if (anterior) anterior.remove()
      }
      vincular(modelo)
      editor.hidden = true
      mensagem.textContent = modelo.existente ? 'Esse conteúdo já estava na biblioteca e foi reutilizado. Salve o produto para confirmar.' : editando ? 'Texto atualizado em todos os produtos vinculados.' : 'Novo texto salvo. Salve o produto para confirmar o vínculo.'
    } catch (erro) {
      mensagem.textContent = erro.message
    } finally {
      botoes.forEach(([botao, desabilitado]) => { botao.disabled = desabilitado })
      nome.disabled = false
      texto.disabled = false
    }
  })
  grupo.closest('form').addEventListener('submit', evento => {
    if (!editor.hidden || salvar.disabled) {
      evento.preventDefault()
      mensagem.textContent = salvar.disabled ? 'Aguarde o texto terminar de salvar.' : 'Salve ou cancele a edição do texto antes de salvar o produto.'
      if (!salvar.disabled) nome.focus()
    }
  })
})
