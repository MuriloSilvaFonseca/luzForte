emailjs.init('l1R827WkqGCUeL9CL');

let passo1 = document.getElementById('step-1');
let passo2 = document.getElementById('step-2');
let passo3 = document.getElementById('step-3');
let doneSection = document.getElementById('done-section');
let code;

passo1.style.display = 'block';
passo2.style.display = 'none';
passo3.style.display = 'none';
doneSection.style.display = 'none';

$(document).ready(function () {

    const forgotEmail = document.getElementById('email');
    const forgotCode = document.getElementById('code');
    const newPassword = document.getElementById('new-password');
    const confirmPassword = document.getElementById('confirm-password');

    $('#step-1 .step-btn').click(function () {
        if (forgotEmail.value.trim() === '') {
            $('#email-error').css('display', 'block');
            return;
        }

        code = gerarCodigo();
        console.log('Código gerado:', code); 
        // Exibe o código no console para testes

        // isso aqui é para enviar o email pela API
        emailjs.send('service_kaqt165', 'template_264o0hf', {
            to_email: forgotEmail.value.trim(),
            code: code.toString()
        })
        .then(function () {
            $('#email-error').css('display', 'none');
            $('#email-success').css('display', 'block');
            passo2.style.display = 'block';
        })
        .catch(function (error) {
            console.error('Erro ao enviar email:', error);
            $('#email-error').text('Erro ao enviar o e-mail. Tente novamente.').css('display', 'block');
        });
        // fim do envio do email
    });

    $('#step-2 .step-btn').click(function () {
        // console.log(code);  Exibe o código inserido no console para testes

        if (forgotCode.value.trim() === '' || forgotCode.value.trim() !== code.toString()) {
            $('#code-error').css('display', 'block');
            return;
        } else {
            $('#code-error').css('display', 'none');
            $('#code-success').css('display', 'block');
            passo1.style.display = 'none';
            passo2.style.display = 'none';
            passo3.style.display = 'block';
        }
    });

    $('#step-3 .step-btn').click(function () {
        if (newPassword.value.trim() !== confirmPassword.value.trim() || newPassword.value.trim() === '' || confirmPassword.value.trim() === '') {
            $('#password-error').css('display', 'block');
            return;
        } else {
            let senha = newPassword.value;
            $('#confirm-password-error').css('display', 'none');
            $('#password-error').css('display', 'none');
            passo1.style.display = 'none';
            passo2.style.display = 'none';
            passo3.style.display = 'none';
            doneSection.style.display = 'block';
        }
    });

    $('#code').on('input', function() {
    if (this.value.length > 6) {
        this.value = this.value.slice(0, 6);
    }
});

});

function gerarCodigo() {
    const code = Math.floor(100000 + Math.random() * 900000);
    return code;
}

