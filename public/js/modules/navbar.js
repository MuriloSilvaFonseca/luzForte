// Abre o menu ao passar o mouse.
document.querySelectorAll('.barra-categorias .menu-suspenso').forEach(menu => {
  menu.addEventListener('pointerenter', evento => {
    if (evento.pointerType === 'mouse') menu.open = true
  })
  menu.addEventListener('pointerleave', evento => {
    if (evento.pointerType === 'mouse' && !menu.contains(document.activeElement)) {
      menu.open = false
    }
  })
  menu.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') {
      evento.stopPropagation()
      menu.open = false
      menu.querySelector('summary').focus()
    }
  })
  menu.addEventListener('focusout', evento => {
    if (!menu.contains(evento.relatedTarget)) menu.open = false
  })
})
