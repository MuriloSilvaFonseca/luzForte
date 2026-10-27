// Página Minha Conta: troca de abas, mostrar/esconder edição, filtro de pedidos e checagem da senha.
// Salvar dados e senha é feito pelo servidor (routes/conta.js); aqui só melhora a experiência.

document.addEventListener('DOMContentLoaded', () => {
  initNavegacao();
  initEdicaoDados();
  initFiltroPedidos();
  initFormSenha();
});

// ---------- Navegação entre seções ----------
function initNavegacao() {
  const botoes = document.querySelectorAll('.conta-nav-item[data-section]');
  const secoes = document.querySelectorAll('.conta-section');

  botoes.forEach(btn => {
    btn.addEventListener('click', () => {
      const alvo = btn.dataset.section;

      botoes.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      secoes.forEach(s => s.classList.remove('active'));
      const secao = document.getElementById(`section-${alvo}`);
      if (secao) secao.classList.add('active');
    });
  });
}

// ---------- Editar dados pessoais ----------
function initEdicaoDados() {
  const btnEditar = document.getElementById('btnEditarDados');
  const btnCancelar = document.getElementById('btnCancelarDados');
  const view = document.getElementById('dadosView');
  const form = document.getElementById('dadosForm');

  if (!btnEditar || !form) return;

  btnEditar.addEventListener('click', () => {
    view.hidden = true;
    form.hidden = false;
    btnEditar.hidden = true;
  });

  btnCancelar.addEventListener('click', () => {
    form.reset(); // volta os campos para os valores originais
    form.hidden = true;
    view.hidden = false;
    btnEditar.hidden = false;
  });
  // O envio é normal (method="post"): o servidor salva e recarrega a página com a mensagem.
}

// ---------- Filtro de status dos pedidos ----------
function initFiltroPedidos() {
  const filtros = document.querySelectorAll('.filtro-status');
  const cards = document.querySelectorAll('.pedido-card');
  const avisoVazio = document.getElementById('pedidosVazioFiltro');

  filtros.forEach(filtro => {
    filtro.addEventListener('click', () => {
      filtros.forEach(f => f.classList.remove('active'));
      filtro.classList.add('active');

      const status = filtro.dataset.status;
      let visiveis = 0;

      cards.forEach(card => {
        const mostrar = status === 'todos' || card.dataset.status === status;
        card.hidden = !mostrar;
        if (mostrar) visiveis++;
      });

      if (avisoVazio) avisoVazio.hidden = visiveis > 0;
    });
  });
}

// ---------- Formulário de senha ----------
// Confere antes de enviar só para avisar mais rápido. O servidor confere de novo.
function initFormSenha() {
  const form = document.getElementById('senhaForm');
  const aviso = document.getElementById('senhaErro');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    const nova = form.nova_senha.value;
    const confirma = form.confirma_senha.value;
    let mensagem = '';

    if (nova.length < 8) mensagem = 'A nova senha precisa ter no mínimo 8 caracteres.';
    else if (nova !== confirma) mensagem = 'A confirmação não confere com a nova senha.';

    if (mensagem) {
      e.preventDefault(); // só bloqueia o envio quando tem erro
      aviso.textContent = mensagem;
      aviso.hidden = false;
    }
  });
}
