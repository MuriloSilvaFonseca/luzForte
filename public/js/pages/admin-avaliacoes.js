// Moderação de avaliações: abre/fecha formulários e conta caracteres da resposta.
document.addEventListener('DOMContentLoaded', function () {
  function alternar(id, abrir) {
    var form = document.getElementById(id);
    if (!form) return;
    form.classList.toggle('is-open', abrir);
    if (abrir) {
      var campo = form.querySelector('select, textarea');
      if (campo) campo.focus();
    }
  }

  document.querySelectorAll('[data-abrir]').forEach(function (botao) {
    botao.addEventListener('click', function () { alternar(botao.dataset.abrir, true); });
  });

  document.querySelectorAll('[data-fechar]').forEach(function (botao) {
    botao.addEventListener('click', function () { alternar(botao.dataset.fechar, false); });
  });

  document.querySelectorAll('textarea[data-contador]').forEach(function (area) {
    var contador = document.getElementById(area.dataset.contador);
    function atualizar() {
      if (contador) contador.textContent = area.value.length + '/' + area.maxLength;
    }
    area.addEventListener('input', atualizar);
    atualizar();
  });
});
