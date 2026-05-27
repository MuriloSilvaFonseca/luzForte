// Script da pagina de detalhes do produto.
function changeImage(index) {
    const mainImage = document.querySelector('#mainImage img');
    const thumbnails = document.querySelectorAll('.thumbnail_produto');
    const selectedImage = thumbnails[index].querySelector('img');

    mainImage.src = selectedImage.src;

    thumbnails.forEach(thumb => thumb.classList.remove('active_produto'));
    thumbnails[index].classList.add('active_produto');
}

function incrementQuantity() {
    const input = document.getElementById('quantity');
    const currentValue = parseInt(input.value);
    if (currentValue < 99) {
        input.value = currentValue + 1;
    }
}

function decrementQuantity() {
    const input = document.getElementById('quantity');
    const currentValue = parseInt(input.value);
    if (currentValue > 1) {
        input.value = currentValue - 1;
    }
}

function addToCart() {
    const quantity = document.getElementById('quantity').value;
    const notification = document.getElementById('notification');

    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);

    console.log(`Adicionado ${quantity} produto(s) ao carrinho`);
}

function buyNow() {
    const quantity = document.getElementById('quantity').value;
    alert(`Comprando ${quantity} unidade(s). Redirecionando para o checkout...`);
    console.log(`Compra rapida: ${quantity} produto(s)`);
}

function openTab(tabName) {
    const tabs = document.querySelectorAll('.tab_content_produto');
    const buttons = document.querySelectorAll('.tab_btn_produto');

    tabs.forEach(tab => tab.classList.remove('active_produto'));
    buttons.forEach(btn => btn.classList.remove('active_produto'));

    document.getElementById(tabName).classList.add('active_produto');
    event.target.classList.add('active_produto');
}

document.getElementById('quantity').addEventListener('input', function(e) {
    let value = parseInt(e.target.value);

    if (isNaN(value) || value < 1) {
        e.target.value = 1;
    } else if (value > 99) {
        e.target.value = 99;
    }
});
