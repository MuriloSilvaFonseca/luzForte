const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');

let ativoSlide = 0;

/* MOSTRAR SLIDE */

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

/* PROXIMO SLIDE */

function nextSlide(){

    ativoSlide++;

    if(ativoSlide >= slides.length){
        ativoSlide = 0;
    }

    showSlide(ativoSlide);
}

/* CLICK NAS BOLINHAS */

dots.forEach((dot, index) => {

    dot.addEventListener('click', () => {

        ativoSlide = index;

        showSlide(ativoSlide);

    });

});

/* AUTO PLAY */

setInterval(nextSlide, 4000);x