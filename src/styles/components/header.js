const btn = document.getElementById('categoriaBtn');
const list = document.getElementById('dropdownList');

btn.addEventListener('click', () => list.classList.toggle('open'));

list.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        // redirecionar ou usar o valor:
        console.log(item.dataset.value);
        list.classList.remove('open');
    });
});

// fecha ao clicar fora
document.addEventListener('click', (e) => {
    if (!btn.contains(e.target)) list.classList.remove('open');
});