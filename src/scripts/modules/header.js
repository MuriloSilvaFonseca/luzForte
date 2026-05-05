// Header Script
function carregarComponente(idElemento, caminhoArquivo) {
    fetch(caminhoArquivo)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro ao carregar: ${caminhoArquivo}`);
            }

            return response.text();
        })
        .then(html => {
            document.getElementById(idElemento).innerHTML = html;
        })
        .catch(error => {
            console.error(error);
        });
}

carregarComponente("header", "../../components/header/header.html");
carregarComponente("footer", "../../components/footer/footer.html");