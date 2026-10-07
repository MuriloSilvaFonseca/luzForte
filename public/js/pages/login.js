// ============================================================
// 📋 CONFIGURAÇÕES PRINCIPAIS
// ============================================================

const API_KEY = 'AIzaSyBlDjVzC79dtO9PGh9JCZTrXDn1IPXC-Ic';
const SHEET_ID = '18QIWbkM92lOlJKQFILgyX3lPvOYWOh4qD_0t5psiQ5c';
const RANGE = 'Usuarios!A2:E9999';


// ============================================================
// 🔐 FUNÇÃO PRINCIPAL DE LOGIN
// ============================================================

function login(){
    // --- Capturar dados do formulário ---
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    console.log('Email:', email);
    console.log('Password:', password);

    // --- Validar se os campos estão preenchidos ---
    if (!email || !password) {
        mostrarMensagem('Preencha email e senha!', 'erro');
        return;
    }

    // --- Mostrar que está carregando ---
    mostrarMensagem('Verificando credenciais...', 'carregando');
    
    // --- Fazer requisição à API do Google Sheets ---
    fazerRequisicaoGoogle(email, password);
}


// ============================================================
// 🌐 REQUISIÇÃO AJAX AO GOOGLE SHEETS
// ============================================================

function fazerRequisicaoGoogle(email, password){
    // --- Montar URL da API ---
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    
    // --- Fazer requisição AJAX ---
    $.ajax({
        url: url,
        method: 'GET',
        dataType: 'json',
        
        // --- Se conseguir conectar ---
        success: function(response) {
            console.log('Conexão bem-sucedida!');
            console.log('Dados recebidos:', response);
            
            procurarUsuario(email, password, response.values);
        },
        
        // --- Se der erro na conexão ---
        error: function(error) {
            console.error('Erro na requisição:', error);
            mostrarMensagem('Erro ao conectar com o servidor', 'erro');
        }
    });
}


// ============================================================
// 🔍 PROCURAR USUÁRIO NOS DADOS
// ============================================================

function procurarUsuario(email, password, rows){
    console.log('Procurando usuário...');
    console.log('Total de linhas:', rows.length);
    
    let usuarioEncontrado = null;
    
    // --- Loop através de todas as linhas ---
    for (let i = 0; i < rows.length; i++) {
        // --- Destruir a linha em variáveis ---
        const [id, nome, emailSheet, cpf, senhaSheet] = rows[i];
        
        console.log(`Linha ${i + 1}:`, {id, nome, emailSheet, cpf, senhaSheet});
        
        // --- Comparar email e senha ---
        if (emailSheet === email && senhaSheet === password) {
            console.log('Usuário encontrado!');
            
            usuarioEncontrado = {
                id: id,
                nome: nome,
                email: emailSheet,
                cpf: cpf
            };
            break;
        }
    }
    
    // --- Se encontrou, fazer login ---
    if (usuarioEncontrado) {
        fazerLoginSucesso(usuarioEncontrado);
    } else {
        // --- Se não encontrou, mostrar erro ---
        mostrarMensagem('Email ou senha incorretos', 'erro');
        document.getElementById('password').value = ''; // Limpar senha
    }
}


// ============================================================
// ✅ EXECUTAR APÓS LOGIN BEM-SUCEDIDO
// ============================================================

function fazerLoginSucesso(usuario){
    console.log('Login bem-sucedido!');
    console.log('Dados do usuário:', usuario);
    
    // --- Mostrar mensagem de sucesso ---
    mostrarMensagem('Login realizado com sucesso!', 'sucesso');
    
    // --- Guardar dados no localStorage ---
    localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
    localStorage.setItem('estaLogado', 'true');
    
    console.log('Dados guardados no localStorage');
    
    // --- Aguardar 1 segundo e redirecionar ---
    setTimeout(function() {
        console.log('Redirecionando...');
        window.location.href = '/'; 
    }, 1500);
}


// ============================================================
// 💬 MOSTRAR MENSAGENS NA TELA
// ============================================================

function mostrarMensagem(mensagem, tipo) {
    alert(mensagem);
}


// ============================================================
// 🔧 FUNÇÕES ÚTEIS
// ============================================================

// Verificar se usuário está logado (usar em outras páginas)
function verificarLogin() {
    if (localStorage.getItem('estaLogado') !== 'true') {
        window.location.href = '/login';
    }
}

// Pegar dados do usuário logado
function obterDadosUsuario() {
    const usuario = localStorage.getItem('usuarioLogado');
    return usuario ? JSON.parse(usuario) : null;
}

// Fazer logout
function fazerLogout() {
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('estaLogado');
    window.location.href = '/login';
}