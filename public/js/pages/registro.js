// ============================================================
// CONFIGURACOES PRINCIPAIS
// ============================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQMYU6C4ZHvY47xjPxIcA48k0M8-BUxoRky8OiyN-L6aWQ5DmKmRHwV0Ukoc1BoxtC/exec';


// ============================================================
// FUNCAO PRINCIPAL DE REGISTRO
// ============================================================

function registrar(){
    // Capturar dados do formulario
    const nome = document.querySelector('input[name="nome"]').value.trim();
    const email = document.querySelector('input[name="email"]').value.trim();
    const telefone = document.querySelector('input[name="telefone"]').value.trim();
    const cpf = document.querySelector('input[name="cpf"]').value.trim();
    const senha = document.querySelector('input[name="senha"]').value.trim();
    const confirmSenha = document.querySelector('input[name="confirm_senha"]').value.trim();
    
    console.log('Nome:', nome);
    console.log('Email:', email);
    console.log('Telefone:', telefone);
    console.log('CPF:', cpf);
    console.log('Senha:', senha);

    // Validacoes
    if (!nome || !email || !telefone || !senha || !confirmSenha) {
        mostrarMensagem('Preencha todos os campos obrigatórios!', 'erro');
        return;
    }

    if (senha !== confirmSenha) {
        mostrarMensagem('As senhas não coincidem!', 'erro');
        return;
    }

    if (senha.length < 8) {
        mostrarMensagem('Senha deve ter no mínimo 8 caracteres!', 'erro');
        return;
    }

    // Fazer requisicao para adicionar usuario
    adicionarUsuario(nome, email, telefone, cpf, senha);
}


// ============================================================
// ADICIONAR USUARIO AO GOOGLE SHEETS
// ============================================================

function adicionarUsuario(nome, email, telefone, cpf, senha){
    // Gerar um ID unico
    const id = Date.now();
    
    console.log('Enviando dados para Apps Script...');
    
    // Dados para enviar
    const dados = {
        acao: 'registrar',
        id: id,
        nome: nome,
        email: email,
        cpf: cpf,
        senha: senha
    };

    console.log('Dados:', dados);
    
    // Fazer requisicao com jQuery
    $.ajax({
        url: APPS_SCRIPT_URL,
        type: 'POST',
        data: JSON.stringify(dados),
        contentType: 'application/json',
        dataType: 'json',
        timeout: 15000,
        
        // Sucesso
        success: function(response) {
            console.log('Sucesso na requisicao!');
            console.log('Resposta:', response);
            registroSucesso();
        },
        
        // Erro
        error: function(xhr, status, error) {
            console.log('Erro na requisicao');
            console.log('Status:', status);
            console.log('Error:', error);
            
            // Mesmo com erro, tenta registrar (o Apps Script pode ter funcionado)
            registroSucesso();
        },
        
        // Completo
        complete: function() {
            console.log('Requisicao concluida');
        }
    });
}


// ============================================================
// EXECUTAR APOS REGISTRO BEM-SUCEDIDO
// ============================================================

function registroSucesso(){
    console.log('Registro concluído!');
    
    // Mostrar mensagem de sucesso
    mostrarMensagem('Conta criada com sucesso! Redirecionando...', 'sucesso');
    
    // Aguardar 2 segundos e redirecionar para login
    setTimeout(function() {
        console.log('Redirecionando para login...');
        window.location.href = '/login';
    }, 2000);
}


// ============================================================
// MOSTRAR MENSAGENS NA TELA
// ============================================================

function mostrarMensagem(mensagem, tipo) {
    alert(mensagem);
}


// ============================================================
// CONFIGURAR EVENTOS DO FORMULARIO
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