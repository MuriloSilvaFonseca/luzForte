let passo1 = document.getElementById('step-1');
let passo2 = document.getElementById('step-2');
let passo3 = document.getElementById('step-3');
let doneSection = document.getElementById('done-section');

passo1.style.display = 'block';
passo2.style.display = 'none';
passo3.style.display = 'none';
doneSection.style.display = 'none';

$(document).ready(function() {
    
    const code = "123456";

    const forgotEmail = document.getElementById('email');
    const forgotCode = document.getElementById('code');
    const newPassword = document.getElementById('new-password');
    const confirmPassword = document.getElementById('confirm-password');

    $('#step-1 .step-btn').click(function() {
        if(forgotEmail.value.trim() === '') {
            $('#email-error').css('display', 'block');
            return;
        }else{
            $('#email-error').css('display', 'none');
            $('#email-success').css('display', 'block');
            passo2.style.display = 'block'
        }
    });

    $('#step-2 .step-btn').click(function() {
        if(forgotCode.value.trim() === '' || forgotCode.value.trim() !== code) {
            $('#code-error').css('display', 'block');
            return;
        }else{
            $('#code-error').css('display', 'none');
            $('#code-success').css('display', 'block');
            passo1.style.display = 'none';
            passo2.style.display = 'none';
            passo3.style.display = 'block';
        }
    });
    $('#step-3 .step-btn').click(function() {
        if(newPassword.value.trim() !== confirmPassword.value.trim() || newPassword.value.trim() === '' || confirmPassword.value.trim() === '') {
            $('#password-error').css('display', 'block');
            return;
        }else{
            let senha = newPassword.value;
            $('#confirm-password-error').css('display', 'none');
            $('#password-error').css('display', 'none');
            passo1.style.display = 'none';
            passo2.style.display = 'none';
            passo3.style.display = 'none';
            doneSection.style.display = 'block';
        }
    });
});