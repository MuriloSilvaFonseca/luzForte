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

function exibirCaminhoProduto(produto) {
  const el = document.getElementById('breadcrumbProduto');
  if (!el) return;
  const itens = [{ texto: 'Início', href: '/' }];
  if (produto.categoria) {
    itens.push({
      texto: produto.categoria,
      href: produto.idCategoria ? '/catalogo?categoria=' + encodeURIComponent(produto.idCategoria) : null
    });
  }
  itens.push({ texto: produto.nome, href: null });

  el.replaceChildren();
  itens.forEach((item, indice) => {
    if (indice) {
      const separador = document.createElement('span');
      separador.className = 'sep_produto';
      separador.setAttribute('aria-hidden', 'true');
      separador.textContent = '›';
      el.appendChild(separador);
    }
    if (item.href) {
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.texto;
      el.appendChild(link);
    } else {
      const parte = document.createElement('span');
      parte.textContent = item.texto;
      if (indice === itens.length - 1) parte.setAttribute('aria-current', 'page');
      el.appendChild(parte);
    }
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

    // Resposta pública que o admin escreveu em /admin/avaliacoes
    if (a.resposta) {
      const resposta = document.createElement('p');
      resposta.className = 'avaliacao_resposta_produto';
      const titulo = document.createElement('strong');
      titulo.textContent = 'Resposta da LuzForte: ';
      resposta.append(titulo, document.createTextNode(a.resposta));
      item.appendChild(resposta);
    }
    listaEl.appendChild(item);
  });
}

function criarCardRelacionado(item) {
  const card = document.createElement('a');
  card.className = 'relacionado_card_produto';
  card.href = '/produto?id=' + encodeURIComponent(item.sku);

  const imagem = document.createElement('img');
  imagem.loading = 'lazy';
  imagem.alt = item.titulo_produto;
  imagem.addEventListener('error', () => { imagem.src = '/img/icons/icons8-caixa-128.png'; }, { once: true });
  imagem.src = window.imagemProdutoSegura(item.imagem);

  const nome = document.createElement('p');
  nome.className = 'relacionado_nome_produto';
  nome.textContent = item.titulo_produto;

  const preco = document.createElement('p');
  preco.className = 'relacionado_preco_produto';
  preco.textContent = `R$ ${formatarPreco(Number(item.preco_produto))}`;

  card.append(imagem, nome, preco);
  return card;
}

// Usa a rota que já existe: /api/produtos?categoria=<id>. Se falhar, o bloco simplesmente fica escondido.
async function carregarRelacionados(produto) {
  const bloco = document.getElementById('produtosRelacionados');
  const grade = document.getElementById('relacionadosGrid');
  if (!bloco || !grade || !produto.idCategoria) return;
  try {
    const resposta = await fetch('/api/produtos?categoria=' + encodeURIComponent(produto.idCategoria));
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro);
    const lista = dados.produtos
      .filter(item => String(item.sku) !== String(produto.sku))
      .slice(0, 4);
    if (!lista.length) return;
    grade.replaceChildren(...lista.map(criarCardRelacionado));
    bloco.hidden = false;
  } catch (erro) {
    console.error(erro);
  }
}

function exibirProduto(produto) {
  
  produtoAtual = produto;
  exibirCaminhoProduto(produto);
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
    const data = await response.json().catch(() => ({ erro: 'Não foi possível carregar o produto.' }));
    if (!response.ok) throw new Error(data.erro);
    const registro = data.produto;
    const produto = {
      sku: registro.sku, nome: registro.titulo_produto, codigo: registro.sku, classificacao: registro.marca,
      precoAtual: Number(registro.preco_produto), precoAntigo: Number(registro.preco_produto),
      estoque: registro.estoque_produto + ' em estoque',
      estoqueDisponivel: Number(registro.estoque_produto),
      avaliacao: { nota: Number(data.avaliacao.media), totalAvaliacoes: data.avaliacao.quantidade },
      imagens: data.imagens.map(imagem => imagem.url),
      categoria: registro.categoria, idCategoria: registro.id_categoria,
      descricoes: data.descricoes, especificacoes: data.especificacoes, instalacoes: data.instalacoes
    };
    exibirProduto(produto);
    renderAvaliacoes(data);
atualizarControlesQuantidade();
carregarRelacionados(produto);
  } catch (error) {
    console.error(error);
    const nome = document.getElementById("productName");
    if (nome) nome.textContent = "Produto não encontrado";
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

function atualizarControlesQuantidade() {
  const input = document.getElementById('quantity');
  const maximo = produtoAtual?.estoqueDisponivel || 0;
  input.max = maximo;
  input.value = maximo ? Math.min(maximo, Math.max(1, Math.floor(Number(input.value) || 1))) : 0;
  input.disabled = !maximo;
  document.querySelector('[onclick="decrementQuantity()"]').disabled = Number(input.value) <= 1;
  document.querySelector('[onclick="incrementQuantity()"]').disabled = Number(input.value) >= maximo;
  document.querySelectorAll('.action_buttons_produto button').forEach(botao => { botao.disabled = !maximo; });
  const aviso = document.getElementById('mensagemEstoqueProduto');
  aviso.textContent = '';
  if (!maximo) aviso.textContent = 'Produto esgotado no momento.';
  else if (Number(input.value) >= maximo) aviso.textContent = 'Não há mais unidades disponíveis em estoque para este produto.';
}

function incrementQuantity() {
  const input = document.getElementById("quantity");
  const currentValue = parseInt(input.value, 10);
  if (currentValue < produtoAtual?.estoqueDisponivel) {
    input.value = currentValue + 1;
    atualizarControlesQuantidade();
  }
}

function decrementQuantity() {
  const input = document.getElementById("quantity");
  const currentValue = parseInt(input.value, 10);
  if (currentValue > 1) {
    input.value = currentValue - 1;
    atualizarControlesQuantidade();
  }
}

let adicionandoCarrinho = false;
async function addToCart() {
  if (!produtoAtual || !produtoAtual.estoqueDisponivel || adicionandoCarrinho) return false;
  adicionandoCarrinho = true;
  try {
    await window.adicionarProdutoCarrinho(produtoAtual.sku, Number(document.getElementById('quantity').value));
    atualizarControlesQuantidade();
    const aviso = document.getElementById('notification');
    aviso.style.display = 'block';
    setTimeout(() => { aviso.style.display = 'none'; }, 3000);
    return true;
  } catch (erro) {
    document.getElementById('mensagemEstoqueProduto').textContent = erro.message;
    return false;
  }
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

  document.getElementById("quantity").addEventListener("input", function () {
    atualizarControlesQuantidade();
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

    // Depois do envio, a rota volta para a página com ?avaliado=<resultado>
    const resultadoAvaliacao = new URLSearchParams(location.search).get('avaliado');
    const mensagensAvaliacao = {
        repetida: 'Você já avaliou este produto.',
        invalida: 'Escolha uma nota e escreva um comentário entre 10 e 500 caracteres.',
        erro: 'Não foi possível enviar sua avaliação agora. Tente novamente.'
    };
    if (resultadoAvaliacao) {
        const aviso = document.getElementById('avaliacaoMensagem');
        if (mensagensAvaliacao[resultadoAvaliacao]) aviso.textContent = mensagensAvaliacao[resultadoAvaliacao];
        aviso.hidden = false;
        if (resultadoAvaliacao === '1') formAvaliar.reset();
    }
}