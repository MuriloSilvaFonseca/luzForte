(() => {
  const menu = document.getElementById('account-menu')
  if (!menu) return

  const trigger = document.querySelector('[data-account-menu-trigger]')
  if (!trigger) return

  const setOpen = open => {
    menu.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
  }

  trigger.addEventListener('click', () => {
    setOpen(menu.hidden)
  })

  menu.querySelectorAll('.account-menu__option').forEach(option => {
    option.addEventListener('click', () => setOpen(false))
  })

  document.addEventListener('click', event => {
    if (!trigger.contains(event.target) && !menu.contains(event.target)) setOpen(false)
  })

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false)
      trigger.focus()
    }
  })
})()
