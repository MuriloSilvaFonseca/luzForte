const campoImagensProduto = document.getElementById('imagens-produto')
const ajudaImagensProduto = document.getElementById('imagens-produto-ajuda')

if (campoImagensProduto && ajudaImagensProduto) {
  const mensagemPadrao = ajudaImagensProduto.textContent
  campoImagensProduto.addEventListener('change', () => {
    const arquivos = [...campoImagensProduto.files]
    campoImagensProduto.setCustomValidity('')

    if (arquivos.length > 5) {
      campoImagensProduto.setCustomValidity('Selecione no máximo 5 imagens.')
      ajudaImagensProduto.textContent = 'Selecione no máximo 5 imagens.'
      campoImagensProduto.reportValidity()
      return
    }

    if (arquivos.some(arquivo => arquivo.size > 5 * 1024 * 1024)) {
      campoImagensProduto.setCustomValidity('Cada imagem pode ter no máximo 5 MB.')
      ajudaImagensProduto.textContent = 'Cada imagem pode ter no máximo 5 MB.'
      campoImagensProduto.reportValidity()
      return
    }

    ajudaImagensProduto.textContent = arquivos.length
      ? `${arquivos.length} ${arquivos.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}. ${mensagemPadrao}`
      : mensagemPadrao
  })
}
