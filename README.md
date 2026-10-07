# LuzForte

LuzForte é um projeto acadêmico de e-commerce de materiais elétricos, feito com **Node.js + Express + EJS** (banco MySQL nas próximas etapas).

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão 18 ou superior).

1. Abra o terminal na pasta do projeto.
2. Instale as dependências (só na primeira vez ou quando o `package.json` mudar):

   ```
   npm install
   ```

3. Suba o servidor:

   ```
   npm run dev
   ```

4. Abra **http://localhost:3000** no navegador.

O `nodemon` reinicia o servidor sozinho quando você salva um arquivo `.js`. Mudanças em `.ejs` e `.css` aparecem ao recarregar a página.

> As páginas não abrem mais clicando no arquivo ou pelo Live Server: o servidor precisa estar rodando para montar o EJS.

## Estrutura

```
app.js            liga o Express, o EJS, a pasta public/ e as rotas
routes/           qual página aparece em cada URL (loja.js, auth.js)
views/            as páginas (.ejs)
  partials/       header e footer, incluídos em todas as páginas
  loja/           home, catálogo, produto, carrinho, checkout, sobre nós, contato
  auth/           login, registro, esqueci a senha
  admin/          páginas do painel administrativo (a criar)
public/           arquivos enviados direto ao navegador
  css/  img/  js/  data/
config/           conexão com o banco (a criar)
database/         schema.sql do MySQL (a criar)
docs/             documentação do projeto
```

## URLs

| Página | URL |
|---|---|
| Home | `/` |
| Catálogo | `/catalogo` |
| Produto | `/produto?slug=...` |
| Carrinho | `/carrinho` |
| Checkout | `/checkout` |
| Sobre nós | `/sobre-nos` |
| Contato | `/contato` |
| Login | `/login` |
| Esqueci a senha | `/esqueci-senha` |
| Registro | `/registro` |

## Como criar uma página nova

1. Crie a view em `views/<area>/minha-pagina.ejs`, com `<%- include("../partials/header") %>` e `<%- include("../partials/footer") %>`.
2. CSS em `public/css/pages/`, JS em `public/js/pages/`. Nos links use caminho começando com `/` (ex.: `/css/pages/minha-pagina.css`), sem `public`.
3. Adicione a rota em `routes/`:

   ```js
   router.get('/minha-pagina', (req, res) => {
     res.render('area/minha-pagina')
   })
   ```
