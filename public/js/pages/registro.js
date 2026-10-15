// ============================================================
// MOSTRAR / ESCONDER SENHA (botao do olho)
// ============================================================

$(document).ready(function() {
    $('.show-pass').click(function(e) {
        e.preventDefault();
        
        const passwordInput = $(this).siblings('input[type="password"], input[type="text"]');
        const icon = $(this).find('img');
        
        if (passwordInput.attr('type') === 'password') {
            passwordInput.attr('type', 'text');
            icon.attr('src', '/img/icons/visao.png');
        } else {
            passwordInput.attr('type', 'password');
            icon.attr('src', '/img/icons/olho-fechado.png');
        }
    });
});