# Estrutura do Projeto LuzForte

O projeto usa Node.js com Express e EJS. O servidor (`app.js`) recebe cada URL, a rota correspondente em `routes/` escolhe a view em `views/` e o EJS monta o HTML final que é enviado ao navegador.

## Pastas principais

- `app.js`: configura o Express, o EJS, a pasta `public/` e registra as rotas.
- `routes/`: define as URLs do sistema e qual página cada uma mostra.
- `views/`: páginas em EJS (HTML com a possibilidade de exibir dados vindos do servidor).
  - `partials/`: trechos reutilizados em todas as páginas, como cabeçalho e rodapé.
  - `loja/`: telas do cliente.
  - `auth/`: login, registro e recuperação de senha.
  - `admin/`: telas do painel administrativo.
- `public/`: arquivos enviados diretamente ao navegador (CSS, imagens, JavaScript do navegador e dados JSON provisórios).
- `config/`: configurações, como a conexão com o banco de dados.
- `database/`: script de criação do banco MySQL.
- `docs/`: documentação acadêmica e técnica.

## Observação

Nesta etapa as rotas apenas exibem as páginas. Os dados de produtos ainda vêm de `public/data/produtos.json`; a integração com MySQL será feita nas próximas etapas.
