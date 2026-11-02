const seletorCategoria = document.querySelector('[data-categoria-select]')
const seletorSubcategoria = document.querySelector('[data-subcategoria-select]')
if (seletorCategoria && seletorSubcategoria) {
  function filtrarSubcategorias() {
    const categoria = seletorCategoria.value
    for (const opcao of seletorSubcategoria.options) {
      if (!opcao.value) continue
      const visivel = categoria ? opcao.dataset.categoria === categoria : seletorSubcategoria.dataset.todasSemCategoria === 'sim'
      opcao.hidden = !visivel
      opcao.disabled = !visivel
      if (!visivel && opcao.selected) seletorSubcategoria.value = ''
    }
  }
  seletorCategoria.addEventListener('change', filtrarSubcategorias)
  filtrarSubcategorias()
}
