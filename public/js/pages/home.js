// Script da página inicial: carrossel do banner e botões "Adicionar ao carrinho".
// Os produtos "Mais vendidos" já vêm prontos do servidor (routes/loja.js), sem fetch.

const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');

let ativoSlide = 0;
let timerSlide = null;

function showSlide(index) {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    slides[index].classList.add('active');
    dots[index].classList.add('active');
}

function nextSlide() {
    ativoSlide++;
    if (ativoSlide >= slides.length) {
        ativoSlide = 0;
    }
    showSlide(ativoSlide);
}

// Começa a contagem de 4 segundos do zero.
// clearInterval para o timer antigo; sem isso, depois de clicar numa bolinha
// o slide podia pular logo em seguida porque o timer antigo continuava contando.
function reiniciarTimer() {
    clearInterval(timerSlide);
    timerSlide = setInterval(nextSlide, 4000);
}

dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        ativoSlide = index;
        showSlide(ativoSlide);
        reiniciarTimer();
    });
});

if (slides.length) reiniciarTimer();

// Botões "Adicionar ao carrinho": um único ouvinte na lista inteira.
// O SKU vem do data-id que o EJS colocou no botão.
const listaProdutos = document.querySelector('.products');
if (listaProdutos) {
    listaProdutos.addEventListener('click', async evento => {
        const botao = evento.target.closest('button[data-id]');
        if (!botao) return;
        await window.adicionarPeloBotao(botao, botao.dataset.id);
    });
}
