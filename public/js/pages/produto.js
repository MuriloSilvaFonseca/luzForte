// Script da pagina de detalhes do produto.
let produtoAtual = null;

function formatarPreco(valor) {
  return valor.toFixed(2).replace(".", ",");
}

const ESTRELAS = {
  0:   '0 star.png',
  0.5: '0.5 star.png',
  1:   '1-star.png',
  1.5: '1.5 star.png',
  2:   '2-star.png',
  2.5: '2.5-star.png',
  3:   '3-star.png',
  3.5: '3.5-star.png',
  4:   '4-star.png',
  4.5: '4.5-star.png',
  5:   '5-star.png'
}

function criarEstrelas(nota) {
  let valor = Number(nota);
  if (!Number.isFinite(valor)) valor = 0;
  valor = Math.min(5, Math.max(0, Math.round(valor * 2) / 2));

  const img = document.createElement('img');
  img.src = '/img/icons/avaliacao-star/' + encodeURIComponent(ESTRELAS[valor]);
  img.alt = `Nota ${valor} de 5`;
  img.className = 'estrelas';
  return img;
}

function exibirCaminhoProduto(itens) {
  const el = document.getElementById('breadcrumbProduto');
  if (!el) return;
  el.replaceChildren();
  itens.forEach((texto, indice) => {
    if (indice) el.appendChild(document.createTextNode(' / '));
    const parte = document.createElement('span');
    parte.textContent = texto;
    el.appendChild(parte);
  });
}

function exibirImagens(produto) {
  const principal = document.querySelector('#mainImage img');
  const lista = document.getElementById('thumbnailsProduto');
  const imagens = produto.imagens.length ? produto.imagens : ['/img/icons/icons8-caixa-128.png'];
  function configurar(imagem, caminho) {
    imagem.src = window.imagemProdutoSegura(caminho);
    imagem.alt = produto.nome;
    imagem.onerror = () => { imagem.onerror = null; imagem.src = '/img/icons/icons8-caixa-128.png'; };
  }
  configurar(principal, imagens[0]);
  lista.replaceChildren();
  imagens.forEach((caminho, indice) => {
    const miniatura = document.createElement('div');
    miniatura.className = 'thumbnail_produto' + (indice === 0 ? ' active_produto' : '');
    const imagem = document.createElement('img');
    configurar(imagem, caminho);
    miniatura.appendChild(imagem);
    miniatura.addEventListener('click', () => changeImage(indice));
    lista.appendChild(miniatura);
  });
}

function exibirInformacoes(produto) {
  document.title = `LuzForte | ${produto.nome}`;

  const classificacao = document.getElementById("classificationLabel");
  if (classificacao) {
    if (produto.classificacao) {
      classificacao.textContent = produto.classificacao;
      classificacao.style.display = "";
    } else {
      classificacao.style.display = "none";
    }
  }

  const nome = document.getElementById("productName");
  if (nome) nome.textContent = produto.nome;

  const codigo = document.getElementById("productCode");
  if (codigo) codigo.textContent = `Cód: ${produto.codigo}`;

  const estrelas = document.getElementById("productStars");
  if (estrelas) estrelas.replaceChildren(criarEstrelas(produto.avaliacao.nota));

  const avaliacoes = document.getElementById("productReviews");
  if (avaliacoes) {
    const total = produto.avaliacao.totalAvaliacoes;
    avaliacoes.textContent = `(${total} ${total === 1 ? 'avaliação' : 'avaliações'})`;
  }

  const estoque = document.getElementById("productStock");
  if (estoque) estoque.textContent = produto.estoque;

  const precoAnterior = document.getElementById("productOldPrice");
  if (precoAnterior) {
    precoAnterior.textContent = `De R$ ${formatarPreco(produto.precoAntigo)}`;
    precoAnterior.style.display = produto.precoAntigo > produto.precoAtual ? "" : "none";
  }

  const precoAtual = document.getElementById("productCurrentPrice");
  if (precoAtual) {
    precoAtual.textContent = `R$ ${formatarPreco(produto.precoAtual)}`;
  }

  const parcelamento = document.getElementById("productInstallments");
  if (parcelamento && produto.parcelas) {
    const { quantidade, valor, semJuros } = produto.parcelas;
    const juros = semJuros ? " sem juros" : "";
    parcelamento.textContent = `ou ${quantidade}x de R$ ${formatarPreco(valor)}${juros}`;
  }
}

function exibirDescricoes(produto) {
  const el = document.getElementById('description');
  el.replaceChildren();
  produto.descricoes.forEach(descricao => {
    const titulo = document.createElement('h2');
    titulo.textContent = descricao.nome_descricao;
    const texto = document.createElement('p');
    texto.textContent = descricao.texto_descricao;
    el.append(titulo, texto);
  });
  if (!produto.descricoes.length) el.textContent = 'Descrição não cadastrada.';
}

function exibirEspecificacoes(produto) {
  const el = document.getElementById('specs');
  el.replaceChildren();
  const tabela = document.createElement('table');
  tabela.className = 'specs_table_produto';
  produto.especificacoes.forEach(spec => {
    const linha = document.createElement('tr');
    for (const texto of [spec.nome_especificacao, spec.texto_especificacao]) {
      const celula = document.createElement('td');
      celula.textContent = texto;
      linha.appendChild(celula);
    }
    tabela.appendChild(linha);
  });
  if (produto.especificacoes.length) el.appendChild(tabela);
  else el.textContent = 'Especificações não cadastradas.';
}

function exibirInstalacao(produto) {
  const el = document.getElementById('installation');
  el.replaceChildren();
  produto.instalacoes.forEach(instalacao => {
    const titulo = document.createElement('h3');
    titulo.textContent = instalacao.nome_instalacao;
    const texto = document.createElement('p');
    texto.textContent = instalacao.texto_instalacao;
    el.append(titulo, texto);
  });
  if (!produto.instalacoes.length) el.textContent = 'Instruções não cadastradas.';
}

function renderAvaliacoes(data) {
  const { avaliacao, lista } = data;
  const resumo = document.getElementById('avaliacoesResumo');
  const listaEl = document.getElementById('avaliacoesLista');
  if (!resumo || !listaEl) return;

  if (avaliacao.quantidade === 0) {
    resumo.textContent = 'Este produto ainda não tem avaliações.';
    listaEl.replaceChildren();
    return;
  }

resumo.replaceChildren(
  criarEstrelas(avaliacao.media),
  document.createTextNode(` ${avaliacao.media.toFixed(1)}/5 (${avaliacao.quantidade} ${avaliacao.quantidade === 1 ? 'avaliação' : 'avaliações'})`)
);

  listaEl.replaceChildren();
  lista.forEach(a => {
    const item = document.createElement('article');
    item.className = 'avaliacao_item_produto';

    const topo = document.createElement('header');
    topo.className = 'avaliacao_topo_produto';
    topo.replaceChildren(
      criarEstrelas(a.nota),
      document.createTextNode(' · ' + a.nome_usuario.split(' ')[0] + ' · ' +
    new Date(a.data_criacao).toLocaleDateString('pt-BR'))
    );

    const texto = document.createElement('p');
    texto.className = 'avaliacao_texto_produto';
    texto.textContent = a.comentario || '';

    item.append(topo, texto);
    listaEl.appendChild(item);
  });
}

function exibirProduto(produto) {
  
  produtoAtual = produto;
  exibirCaminhoProduto(produto.breadcrumb);
  exibirImagens(produto);
  exibirInformacoes(produto);
  exibirDescricoes(produto);
  exibirEspecificacoes(produto);
  exibirInstalacao(produto);
}

async function carregarProduto() {
  try {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^\d+$/.test(id)) throw new Error('Produto não encontrado.');
    const response = await fetch('/api/produtos/' + encodeURIComponent(id));
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro);
    const registro = data.produto;
    const produto = {
      sku: registro.sku, nome: registro.titulo_produto, codigo: registro.sku, classificacao: registro.marca,
      precoAtual: Number(registro.preco_produto), precoAntigo: Number(registro.preco_produto),
      estoque: registro.estoque_produto + ' em estoque',
      avaliacao: { nota: Math.round(Number(data.avaliacao.media)), totalAvaliacoes: data.avaliacao.quantidade },
      imagens: data.imagens.map(imagem => imagem.url),
      breadcrumb: [registro.categoria, registro.subcategoria, registro.titulo_produto].filter(Boolean),
      descricoes: data.descricoes, especificacoes: data.especificacoes, instalacoes: data.instalacoes
    };
    exibirProduto(produto);
    renderAvaliacoes(data);
    document.querySelectorAll('.action_buttons_produto button').forEach(botao => { botao.disabled = false; });
    document.querySelectorAll('.action_buttons_produto button').forEach(botao => { botao.disabled = false; });
  } catch (error) {
    console.error(error);
    const nome = document.getElementById("productName");
    if (nome) nome.textContent = "Produto não encontrado";
  }
}

function renderizarResumo(media, total) {
  const resumo = document.getElementById('avaliacoesResumo')
  if (!resumo) return

  const nota = document.createElement('p')
  nota.textContent = `${Number(media).toFixed(1)}/5`

  const qtd = document.createElement('span')
  qtd.textContent = `(${total} ${total === 1 ? 'avaliação' : 'avaliações'})`

  resumo.replaceChildren(nota, criarEstrelas(media), qtd)
}

function renderizarLista(avaliacoes) {
  const lista = document.getElementById('avaliacoesLista')
  if (!lista) return

  if (!avaliacoes.length) {
    lista.textContent = 'Este produto ainda não tem avaliações.'
    return
  }

  lista.replaceChildren(...avaliacoes.map(a => {
    const item = document.createElement('article')

    const cabecalho = document.createElement('p')
    cabecalho.replaceChildren(
      criarEstrelas(a.nota),
      document.createTextNode(` · ${a.nome} · ${a.data}`)
    )

    const texto = document.createElement('p')
    texto.textContent = a.comentario

    item.append(cabecalho, texto)
    return item
}))
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

let adicionandoCarrinho = false;
async function addToCart() {
  if (!produtoAtual || adicionandoCarrinho) return false;
  adicionandoCarrinho = true;
  try {
    await window.adicionarProdutoCarrinho(produtoAtual.sku, Number(document.getElementById('quantity').value));
    const aviso = document.getElementById('notification');
    aviso.style.display = 'block';
    setTimeout(() => { aviso.style.display = 'none'; }, 3000);
    return true;
  } catch (erro) { alert(erro.message); return false; }
  finally { adicionandoCarrinho = false; }
}
async function buyNow() {
  if (await addToCart()) window.location.href = '/carrinho';
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
  document.querySelectorAll('.action_buttons_produto button').forEach(botao => { botao.disabled = true; });
  carregarProduto();

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

const formAvaliar = document.getElementById('formAvaliar');
if (formAvaliar) {
    // Use aqui o mesmo SKU que você já usa para montar a página
    document.getElementById('avaliacaoSku').value = new URLSearchParams(location.search).get('id');
    const texto = document.getElementById('avaliacaoTexto');
    const contador = document.getElementById('avaliacaoContador');
    texto.addEventListener('input', () => {
        contador.textContent = `${texto.value.length}/${texto.maxLength}`;
    });

    // Depois do envio, a rota volta para a página com ?avaliado=1
    if (new URLSearchParams(location.search).get('avaliado') === '1') {
        document.getElementById('avaliacaoMensagem').hidden = false;
        formAvaliar.reset();
    }
}
