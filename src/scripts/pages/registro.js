// Registro Script
const form = document.querySelector('.cadastro-form');

$(document).ready(function() {
    form.addEventListener('submit', function(event) {
            event.preventDefault();
            const nome = nomeInput.value.trim();
            const email = emailInput.value.trim();
            const senha = senhaInput.value;
            const confirmarSenha = confirmarSenhaInput.value;
            if (senha !== confirmarSenha) {
                alert('As senhas não coincidem. Por favor, tente novamente.');
                return;
            }
            // Aqui você pode adicionar a lógica para enviar os dados para o servidor
            alert('Registro bem-sucedido! Bem-vindo, ' + nome + '!');
            form.reset();
        });
    });