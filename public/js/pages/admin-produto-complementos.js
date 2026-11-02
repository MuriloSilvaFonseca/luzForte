const categoriaProduto = document.querySelector('#categoria-produto')
const categoriaPai = document.querySelector('#cadastro-categoria-pai')
const paineisCadastro = document.querySelectorAll('.admin-complementos-painel')
let cadastroSalvando = false

async function carregarCategorias(selecionada = categoriaProduto.value || categoriaPai.value) {
  const painel = document.querySelector('#cadastro-subcategoria')
  const mensagem = painel.querySelector('[data-mensagem]')
  const salvar = painel.querySelector('[data-salvar-cadastro]')
  categoriaPai.disabled = true
  salvar.disabled = true
  try {
    const resposta = await fetch('/admin/cadastros/categorias')
    if (!resposta.ok) throw new Error('Não foi possível carregar as categorias. Clique em Recarregar categorias.')
    const categorias = await resposta.json()
    categoriaPai.replaceChildren(new Option('Selecione uma categoria', ''))
    categorias.forEach(c => categoriaPai.add(new Option(c.nome, c.id)))
    categoriaPai.value = selecionada
    mensagem.textContent = categorias.length ? '' : 'Cadastre uma categoria para continuar.'
    return true
  } catch (erro) {
    categoriaPai.replaceChildren(new Option('Recarregue as categorias', ''))
    mensagem.textContent = erro.message
    return false
  } finally {
    categoriaPai.disabled = false
    salvar.disabled = false
  }
}

function fecharCadastros() {
  paineisCadastro.forEach(painel => { painel.hidden = true })
  document.querySelectorAll('[data-abrir-cadastro]').forEach(botao => botao.setAttribute('aria-expanded', 'false'))
}

function abrirCadastro(tipo, recarregar = true) {
  fecharCadastros()
  const painel = document.getElementById('cadastro-' + tipo)
  painel.hidden = false
  document.querySelector('[data-abrir-cadastro="' + tipo + '"]').setAttribute('aria-expanded', 'true')
  if (tipo === 'subcategoria' && recarregar) carregarCategorias()
  painel.querySelector('[name="nome"]').focus()
}

document.querySelectorAll('[data-abrir-cadastro]').forEach(botao => {
  botao.addEventListener('click', () => abrirCadastro(botao.dataset.abrirCadastro))
})
document.querySelector('#recarregar-categorias').addEventListener('click', () => carregarCategorias())
document.querySelectorAll('[data-fechar-cadastro]').forEach(botao => {
  botao.addEventListener('click', () => {
    fecharCadastros()
    document.querySelector('[data-abrir-cadastro="' + botao.dataset.fecharCadastro + '"]').focus()
  })
})

document.querySelectorAll('form[data-cadastro]').forEach(formulario => {
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault()
    if (cadastroSalvando) return
    const tipo = formulario.dataset.cadastro
    const painel = document.getElementById('cadastro-' + tipo)
    const mensagem = painel.querySelector('[data-mensagem]')
    const dados = new URLSearchParams(new FormData(formulario))
    const botoes = [...document.querySelectorAll('[data-salvar-cadastro], [data-abrir-cadastro], [data-fechar-cadastro], #recarregar-categorias')]
    cadastroSalvando = true
    botoes.forEach(botao => { botao.disabled = true })
    mensagem.textContent = 'Salvando…'
    try {
      const resposta = await fetch(formulario.action, { method: 'POST', body: dados })
      if (resposta.status === 403) throw new Error('Sua sessão terminou ou não tem acesso de administrador. Entre novamente para continuar.')
      const resultado = await resposta.json()
      if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível salvar. Tente novamente.')
      formulario.reset()
      if (tipo === 'categoria') {
        categoriaProduto.add(new Option(resultado.nome, resultado.id, true, true))
        categoriaProduto.dispatchEvent(new Event('change'))
        fecharCadastros()
        document.querySelector('[data-retorno-cadastro="categoria"]').textContent = 'Categoria salva e selecionada. A subcategoria é opcional.'
        categoriaProduto.focus()
      } else {
        const select = document.querySelector(tipo === 'marca' ? '#marca-produto' : '#subcategoria-produto')
        if (tipo === 'subcategoria') {
          categoriaProduto.value = dados.get('categoria_id')
          categoriaProduto.dispatchEvent(new Event('change'))
        }
        const opcao = new Option(resultado.nome, resultado.id, true, true)
        if (tipo === 'subcategoria') opcao.dataset.categoria = dados.get('categoria_id')
        select.add(opcao)
        fecharCadastros()
        document.querySelector('[data-retorno-cadastro="' + tipo + '"]').textContent = 'Cadastro salvo e selecionado no produto.'
        select.focus()
      }
      mensagem.textContent = ''
    } catch (erro) {
      mensagem.textContent = erro.message
    } finally {
      cadastroSalvando = false
      botoes.forEach(botao => { botao.disabled = false })
    }
  })
})

document.querySelector('.admin-produto-formulario').addEventListener('submit', evento => {
  const painelAberto = [...paineisCadastro].find(painel => !painel.hidden)
  if (cadastroSalvando || painelAberto) {
    evento.preventDefault()
    if (painelAberto) {
      painelAberto.querySelector('[data-mensagem]').textContent = cadastroSalvando ? 'Aguarde o cadastro terminar de salvar.' : 'Salve ou cancele este cadastro antes de salvar o produto.'
      painelAberto.querySelector('[name="nome"]').focus()
    }
  }
})

const listaDetalhes = document.querySelector('#detalhes-adicionais')
let proximoDetalhe = listaDetalhes.children.length
document.querySelectorAll('[data-adicionar-detalhe]').forEach(botao => {
  botao.addEventListener('click', () => {
    const indice = proximoDetalhe++
    const prefixo = 'detalhes[' + indice + ']'
    const grupo = document.createElement('fieldset')
    grupo.className = 'admin-complementos-detalhe'
    const legenda = document.createElement('legend')
    legenda.textContent = { descricao: 'Nova descrição', especificacao: 'Nova especificação', instalacao: 'Nova orientação de instalação' }[botao.dataset.adicionarDetalhe]
    grupo.append(legenda)
    const id = document.createElement('input')
    id.type = 'hidden'
    id.name = prefixo + '[id]'
    grupo.append(id)
    const tipo = document.createElement('input')
    tipo.type = 'hidden'
    tipo.name = prefixo + '[tipo]'
    tipo.value = botao.dataset.adicionarDetalhe
    grupo.append(tipo)
    for (const campo of ['nome', 'texto']) {
      const label = document.createElement('label')
      label.className = 'admin-produto-label'
      label.htmlFor = 'novo-detalhe-' + campo + '-' + indice
      label.textContent = campo === 'nome' ? 'Título' : 'Texto'
      const input = document.createElement(campo === 'nome' ? 'input' : 'textarea')
      input.id = label.htmlFor
      input.name = prefixo + '[' + campo + ']'
      input.className = 'admin-produto-input'
      input.required = true
      if (campo === 'nome') input.maxLength = 70
      else input.rows = 3
      grupo.append(label, input)
    }
    const remover = document.createElement('button')
    remover.type = 'button'
    remover.className = 'adm-btn adm-btn--sm'
    remover.textContent = 'Cancelar este detalhe'
    remover.addEventListener('click', () => { grupo.remove(); botao.focus() })
    grupo.append(remover)
    listaDetalhes.append(grupo)
    grupo.querySelector('[name$="[nome]"]').focus()
  })
})
