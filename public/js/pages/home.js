const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');

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
