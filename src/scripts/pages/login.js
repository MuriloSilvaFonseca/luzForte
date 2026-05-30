

const API_KEY = 'AIzaSyBlDjVzC79dtO9PGh9JCZTrXDn1IPXC-Ic'; // ← COLOQUE SUA CHAVE
const SHEET_ID = '18QIWbkM92lOlJKQFILgyX3lPvOYWOh4qD_0t5psiQ5c'; //código da planilha, que é a parte depois de /d/ e antes de /edit no link da sua planilha
const RANGE = 'Login!A2:B2'; //intervalo que a coluna vai pegar
$(document).ready(function() {

    $('#login-form').submit(function(event) {
        event.preventDefault();
        fazerLogin();
     });
        
    
});

function fazerLogin() {
    const email = $('#email').val();
    const senha = $('#password').val();
        console.log('Email:', email);
        console.log('Senha:', senha);

        }
    
        // essa é a url do google sheets, onde o RANGE é o nome da aba e o intervalo de células que você quer acessar, por exemplo: 'A1:C10' ou 'A:C' para pegar toda a coluna A até C
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;



    $.ajax({
        url: url,
        method: 'GET',
        success: function(response) {    
        const rows = response.values;
        let usuarioEncontrado = null;

                for(let i = 0; i < rows.length; i++){
                const [idSheet, nomeSheet, emailSheet, cpfSheet, senhaSheet] = rows[i];

                        if (emailSheet === email && senhaSheet === senha) {
                            usuarioEncontrado = {
                                id: idSheet,
                                nome: nomeSheet,
                                email: emailSheet,
                                cpf: cpfSheet};
                        break;
                }
                
                }
            }
        }
    });



