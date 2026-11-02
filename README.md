# LuzForte

LuzForte é um projeto acadêmico de e-commerce de materiais elétricos, feito com **Node.js + Express + EJS + MySQL**.

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão 18 ou superior).

1. Abra o terminal na pasta do projeto.
2. Instale as dependências (só na primeira vez ou quando o `package.json` mudar):

   ```
   npm install
   ```

3. Configure o `.env` a partir do `.env.example`, incluindo MySQL e `SESSION_SECRET`.
   Em um banco local já existente, prepare os campos e tabelas do admin com:

   ```
   node scripts/atualizar-banco-local.js
   ```

   Esse comando adiciona a estrutura necessária e preserva os registros. Faça backup
   antes de atualizar um banco com dados importantes. O dump `database/Luz_ForteDB.sql`
   contém exclusões de tabelas e deve ser usado somente na preparação de banco vazio.

4. Suba o servidor:

   ```
   npm run dev
   ```

5. Abra **http://localhost:3000** no navegador.

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
config/           conexão com o banco
database/         Luz_ForteDB.sql (schema e dados de demonstração)
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

## Banco de dados

Para criar o banco completo em uma instalação nova, execute apenas
`database/Luz_ForteDB.sql` no MySQL. O arquivo reúne a estrutura atual e os
dados de demonstração; ele recria as tabelas existentes, então não deve ser
executado sobre um banco com dados que precisam ser preservados.

`database/queriesInsertMYSQL_local.sql` é uma alternativa para inserir o mesmo
conjunto de dados em tabelas vazias já criadas com esse schema. Não execute os
dois arquivos em sequência, pois o dump principal já inclui esses dados.

## Como criar uma página nova

1. Crie a view em `views/<area>/minha-pagina.ejs`, com `<%- include("../partials/header") %>` e `<%- include("../partials/footer") %>`.
2. CSS em `public/css/pages/`, JS em `public/js/pages/`. Nos links use caminho começando com `/` (ex.: `/css/pages/minha-pagina.css`), sem `public`.
3. Adicione a rota em `routes/`:

   ```js
   router.get('/minha-pagina', (req, res) => {
     res.render('area/minha-pagina')
   })
   ```

Para verificar o código com banco simulado: `node --test tests/*.test.js`. Esses testes não alteram o MySQL.
