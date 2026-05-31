
// CONFIGURACOES PRINCIPAIS

const API_KEY = 'AIzaSyBlDjVzC79dtO9PGh9JCZTrXDn1IPXC-Ic';
const SHEET_ID = '18QIWbkM92lOlJKQFILgyX3lPvOYWOh4qD_0t5psiQ5c';
const RANGE = 'Usuarios';


// FUNCAO PRINCIPAL DE REGISTRO

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

    // Mostrar que esta processando
    mostrarMensagem('Criando sua conta...', 'carregando');
    
    // Fazer requisicao para adicionar usuario
    adicionarUsuario(nome, email, telefone, cpf, senha);
}



// ADICIONAR USUARIO AO GOOGLE SHEETS

function adicionarUsuario(nome, email, telefone, cpf, senha){
    // Gerar um ID unico
    const id = Date.now();
    
    // Preparar dados para enviar
    const values = [[id, nome, email, cpf, senha]];
    
    // Montar URL da API
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}:append?valueInputOption=USER_ENTERED&key=${API_KEY}`;
    
    console.log('URL:', url);
    console.log('Dados:', values);
    
    // Fazer requisicao AJAX
    $.ajax({
        url: url,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ values: values }),
        
        // Se conseguir adicionar
        success: function(response) {
            console.log('Usuario registrado com sucesso!');
            console.log('Resposta:', response);
            
            registroSucesso();
        },
        
        // Se der erro
        error: function(error) {
            console.error('Erro ao registrar:', error);
            mostrarMensagem('Erro ao criar conta. Tente novamente!', 'erro');
        }
    });
}


// EXECUTAR APOS REGISTRO BEM-SUCEDIDO

function registroSucesso(){
    console.log('Registro concluído!');
    
    // Mostrar mensagem de sucesso
    mostrarMensagem('Conta criada com sucesso! Redirecionando...', 'sucesso');
    
    // Aguardar 2 segundos e redirecionar para login
    setTimeout(function() {
        console.log('Redirecionando para login...');
        window.location.href = '../login/index.html';
    }, 2000);
}


// MOSTRAR MENSAGENS NA TELA

function mostrarMensagem(mensagem, tipo) {
    alert(mensagem);
}


// CONFIGURAR EVENTOS DO FORMULARIO

document.addEventListener('DOMContentLoaded', function() {
    // Capturar submit do formulario
    const form = document.querySelector('.cadastro-form');
    
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            registrar();
        });
    }
    
    // Mostrar/ocultar senha
    const showPassButtons = document.querySelectorAll('.show-pass');
    showPassButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const passwordInput = this.parentElement.querySelector('input[type="password"]');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.textContent = 'Ocultar';
            } else {
                passwordInput.type = 'password';
                this.textContent = 'Mostrar';
            }
        });
    });
});