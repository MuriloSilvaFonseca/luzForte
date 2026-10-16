// Script da página de detalhes do produto.
// Os dados do produto agora vêm do servidor (rota /produto/:sku) e já chegam prontos no HTML.
// Aqui fica só o comportamento da tela: trocar imagem, quantidade, abas e aviso do carrinho.

function changeImage(index) {
  const mainImage = document.querySelector("#mainImage img");
  const thumbnails = document.querySelectorAll(".thumbnail_produto");
  const selectedImage = thumbnails[index]?.querySelector("img");

  if (!mainImage || !selectedImage) return;

  mainImage.src = selectedImage.src;

  thumbnails.forEach((thumb) => thumb.classList.remove("active_produto"));
  thumbnails[index].classList.add("active_produto");
}

function incrementQuantity() {
  const input = document.getElementById("quantity");
  const currentValue = parseInt(input.value, 10);
  if (currentValue < 99) {
    input.value = currentValue + 1;
  }
}

function decrementQuantity() {
  const input = document.getElementById("quantity");
  const currentValue = parseInt(input.value, 10);
  if (currentValue > 1) {
    input.value = currentValue - 1;
  }
}

// O carrinho ainda não funciona de verdade: por enquanto só mostra o aviso.
function addToCart() {
  const notification = document.getElementById("notification");

  notification.style.display = "block";

  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

function buyNow() {
  const quantity = document.getElementById("quantity").value;
  alert(`Comprando ${quantity} unidade(s). Redirecionando para o checkout...`);
}

function openTab(tabName, button) {
  const tabs = document.querySelectorAll(".tab_content_produto");
  const buttons = document.querySelectorAll(".tab_btn_produto");

  tabs.forEach((tab) => tab.classList.remove("active_produto"));
  buttons.forEach((btn) => btn.classList.remove("active_produto"));

  document.getElementById(tabName)?.classList.add("active_produto");
  button?.classList.add("active_produto");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab_btn_produto").forEach((btn) => {
    btn.addEventListener("click", () => {
      openTab(btn.dataset.tab, btn);
    });
  });

  document.getElementById("quantity").addEventListener("input", function (e) {
    let value = parseInt(e.target.value, 10);

    if (isNaN(value) || value < 1) {
      e.target.value = 1;
    } else if (value > 99) {
      e.target.value = 99;
    }
  });
});
