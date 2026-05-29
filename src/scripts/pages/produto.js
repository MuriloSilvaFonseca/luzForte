// Script da pagina de detalhes do produto.
let produtoAtual = null;

function resolveImagePath(path) {
  return `../../${path}`;
}

function formatPrice(value) {
  return value.toFixed(2).replace(".", ",");
}

function renderStars(nota) {
  return "★".repeat(nota) + "☆".repeat(5 - nota);
}

function getProdutoFromUrl(produtos) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const slug = params.get("slug");

  if (slug) {
    const porSlug = produtos.find((p) => p.slug === slug);
    if (porSlug) return porSlug;
  }

  if (id) {
    const porId = produtos.find((p) => String(p.id) === String(id));
    if (porId) return porId;
  }

  return produtos.find((p) => p.id === 5) || produtos[0];
}

function renderBreadcrumb(items) {
  const el = document.getElementById("breadcrumbProduto");
  if (!el || !items?.length) return;

  el.innerHTML = items
    .map((item, index) => {
      const isLast = index === items.length - 1;
      if (isLast) return `<span>${item}</span>`;
      return `<a href="#">${item}</a>`;
    })
    .join(" / ");
}

function renderGallery(produto) {
  const mainImg = document.querySelector("#mainImage img");
  const thumbnailsEl = document.getElementById("thumbnailsProduto");
  const imagens = produto.imagens?.length ? produto.imagens : [produto.imagemCard];

  if (mainImg && imagens[0]) {
    mainImg.src = resolveImagePath(imagens[0]);
    mainImg.alt = produto.nome;
  }

  if (!thumbnailsEl) return;

  thumbnailsEl.innerHTML = imagens
    .map(
      (img, index) => `
      <div class="thumbnail_produto${index === 0 ? " active_produto" : ""}" onclick="changeImage(${index})">
        <img src="${resolveImagePath(img)}" alt="${produto.nome}">
      </div>
    `
    )
    .join("");
}

function renderProductInfo(produto) {
  document.title = `LuzForte | ${produto.nome}`;

  const classificationEl = document.getElementById("classificationLabel");
  if (classificationEl) {
    if (produto.classificacao) {
      classificationEl.textContent = produto.classificacao;
      classificationEl.style.display = "";
    } else {
      classificationEl.style.display = "none";
    }
  }

  const nameEl = document.getElementById("productName");
  if (nameEl) nameEl.textContent = produto.nome;

  const codeEl = document.getElementById("productCode");
  if (codeEl) codeEl.textContent = `Cód: ${produto.codigo}`;

  const starsEl = document.getElementById("productStars");
  if (starsEl) starsEl.textContent = renderStars(produto.avaliacao.nota);

  const reviewsEl = document.getElementById("productReviews");
  if (reviewsEl) {
    reviewsEl.textContent = `(${produto.avaliacao.totalAvaliacoes} avaliações)`;
  }

  const stockEl = document.getElementById("productStock");
  if (stockEl) stockEl.textContent = produto.estoque;

  const oldPriceEl = document.getElementById("productOldPrice");
  if (oldPriceEl) {
    oldPriceEl.textContent = `De R$ ${formatPrice(produto.precoAntigo)}`;
    oldPriceEl.style.display = produto.precoAntigo > produto.precoAtual ? "" : "none";
  }

  const currentPriceEl = document.getElementById("productCurrentPrice");
  if (currentPriceEl) {
    currentPriceEl.textContent = `R$ ${formatPrice(produto.precoAtual)}`;
  }

  const installmentsEl = document.getElementById("productInstallments");
  if (installmentsEl && produto.parcelas) {
    const { quantidade, valor, semJuros } = produto.parcelas;
    const juros = semJuros ? " sem juros" : "";
    installmentsEl.textContent = `ou ${quantidade}x de R$ ${formatPrice(valor)}${juros}`;
  }
}

function renderDescription(produto) {
  const el = document.getElementById("description");
  if (!el || !produto.descricao) return;

  const { resumo, caracteristicas, textoCompleto } = produto.descricao;
  const lista = caracteristicas
    .map((item) => `<li>${item}</li>`)
    .join("");

  el.innerHTML = `
    <h2>Descrição do Produto</h2>
    <p>${resumo}</p>
    <h3>Características Principais:</h3>
    <ul>${lista}</ul>
    <p>${textoCompleto}</p>
  `;
}

function renderSpecs(produto) {
  const el = document.getElementById("specs");
  if (!el || !produto.especificacoes?.length) return;

  const rows = produto.especificacoes
    .map(
      (spec) => `
      <tr>
        <td>${spec.label}</td>
        <td>${spec.valor}</td>
      </tr>
    `
    )
    .join("");

  el.innerHTML = `
    <h2>Especificações Técnicas</h2>
    <table class="specs_table_produto">${rows}</table>
  `;
}

function renderInstallation(produto) {
  const el = document.getElementById("installation");
  if (!el || !produto.instalacao) return;

  const { aviso, passos, dicas } = produto.instalacao;
  const passosHtml = passos.map((passo) => `<li>${passo}</li>`).join("");
  const dicasHtml = dicas.map((dica) => `<li>${dica}</li>`).join("");

  el.innerHTML = `
    <h2>Instruções de Instalação</h2>
    <h3>Segurança em Primeiro Lugar</h3>
    <p><strong>ATENÇÃO:</strong> ${aviso}</p>
    <h3>Passo a Passo:</h3>
    <ol>${passosHtml}</ol>
    <h3>Dicas Importantes:</h3>
    <ul>${dicasHtml}</ul>
  `;
}

function renderProduct(produto) {
  produtoAtual = produto;
  renderBreadcrumb(produto.breadcrumb);
  renderGallery(produto);
  renderProductInfo(produto);
  renderDescription(produto);
  renderSpecs(produto);
  renderInstallation(produto);
}

async function loadProduct() {
  try {
    const response = await fetch("../../data/produtos.json");
    if (!response.ok) throw new Error("Não foi possível carregar os produtos.");

    const data = await response.json();
    const produto = getProdutoFromUrl(data.produtos);

    if (!produto) throw new Error("Produto não encontrado.");

    renderProduct(produto);
  } catch (error) {
    console.error(error);
    const nameEl = document.getElementById("productName");
    if (nameEl) nameEl.textContent = "Produto não encontrado";
  }
}

function changeImage(index) {
  const mainImage = document.querySelector("#mainImage img");
  const thumbnails = document.querySelectorAll(".thumbnail_produto");
  const selectedImage = thumbnails[index]?.querySelector("img");

  if (!mainImage || !selectedImage) return;

  mainImage.src = selectedImage.src;
  mainImage.alt = selectedImage.alt;

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

function addToCart() {
  const quantity = document.getElementById("quantity").value;
  const notification = document.getElementById("notification");

  notification.style.display = "block";

  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);

  console.log(
    `Adicionado ${quantity} unidade(s) de "${produtoAtual?.nome}" ao carrinho`
  );
}

function buyNow() {
  const quantity = document.getElementById("quantity").value;
  alert(`Comprando ${quantity} unidade(s). Redirecionando para o checkout...`);
  console.log(`Compra rápida: ${quantity} unidade(s) de "${produtoAtual?.nome}"`);
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
  loadProduct();

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
