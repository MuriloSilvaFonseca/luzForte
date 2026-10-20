const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
const card = document.querySelector('.product-card');

let ativoSlide = 0;



function showSlide(index){

    slides.forEach(slide => {
        slide.classList.remove('active');
    });

    dots.forEach(dot => {
        dot.classList.remove('active');
    });

    slides[index].classList.add('active');
    dots[index].classList.add('active');
}



function nextSlide(){

    ativoSlide++;

    if(ativoSlide >= slides.length){
        ativoSlide = 0;
    }

    showSlide(ativoSlide);
}



dots.forEach((dot, index) => {

    dot.addEventListener('click', () => {

        ativoSlide = index;

        showSlide(ativoSlide);

    });

});



setInterval(nextSlide, 4000);

  


// Mantém os cards e usa produtos reais.
(async () => {
  const cards = [...document.querySelectorAll('.products .product-card')];
  cards.forEach(card => { card.querySelector('button').disabled = true; });
  try {
    const resposta = await fetch('/api/produtos');
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro);
    cards.forEach((card, indice) => {
      const produto = dados.produtos[indice];
      if (!produto) { card.hidden = true; return; }
      card.querySelector('.product-name').textContent = produto.titulo_produto;
      const imagem = card.querySelector('img');
      imagem.src = window.imagemProdutoSegura(produto.imagem);
      imagem.alt = produto.titulo_produto;
      imagem.addEventListener('error', () => { imagem.src = '/img/icons/icons8-caixa-128.png'; }, { once: true });
      card.querySelector('.old-price').textContent = '';
      card.querySelector('h3').textContent = Number(produto.preco_produto).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
      const botao = card.querySelector('button');
      botao.disabled = false;
      botao.addEventListener('click', async evento => {
        evento.stopPropagation();
        await window.adicionarPeloBotao(botao, produto.sku);
      });
      card.addEventListener('click', evento => { if (!evento.target.closest('button')) window.location.href = '/produto?id=' + produto.sku; });
    });
  } catch (erro) {
    console.error('Erro ao carregar os produtos da home:', erro);
    cards.forEach(card => { card.querySelector('.product-name').textContent = 'Produtos indisponíveis no momento.'; }); }
})();
