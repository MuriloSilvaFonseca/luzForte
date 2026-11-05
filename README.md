# LuzForte

LuzForte é um projeto acadêmico de e-commerce de materiais elétricos, feito com **Node.js + Express + EJS + MySQL**.

O cliente monta o carrinho, finaliza o pedido e envia a mensagem pronta para o WhatsApp da loja. A retirada e o pagamento são feitos na loja. O administrador aprova os pedidos, controla o estoque, os produtos, os usuários, as avaliações e acompanha o faturamento e o lucro.

---

## Como rodar o projeto (passo a passo)

Este guia parte do zero, num computador **Windows**. Siga na ordem; cada passo diz o que você deve ver quando der certo.

### Passo 1 — Instalar os programas necessários

Você precisa de três programas. Se já tiver algum, pule para o próximo.

| Programa | Para que serve | Onde baixar |
|---|---|---|
| **Node.js** (versão **22 LTS**) | Roda o servidor do site | https://nodejs.org → botão "LTS" |
| **MySQL 8** + **MySQL Workbench** | Banco de dados e programa para mexer nele | https://dev.mysql.com/downloads/installer/ |
| **VS Code** (recomendado) | Abrir o projeto e o terminal | https://code.visualstudio.com |

**Node.js:** instale com as opções padrão (só "Next" até o fim).

**MySQL:** no *MySQL Installer*, escolha o tipo **"Full"** ou marque pelo menos **MySQL Server 8** e **MySQL Workbench**. Durante a instalação:

- ele vai pedir uma **senha para o usuário `root`**. **Anote essa senha**: você vai usá-la no Passo 5;
- deixe a porta **3306** (padrão);
- deixe marcado para o MySQL **iniciar junto com o Windows** ("Start the MySQL Server at System Startup").

> ⚠️ **Não use o MySQL do XAMPP.** O XAMPP vem com o *MariaDB*, que não entende alguns comandos do arquivo do banco (por exemplo a collation `utf8mb4_0900_ai_ci`) e dá erro na criação das tabelas. Use o MySQL 8 oficial.

**Conferindo se o Node instalou:** abra o terminal (no VS Code: menu **Terminal → New Terminal**) e digite:

```
node -v
```

```
npm -v
```

✅ Deu certo se aparecerem números de versão (ex.: `v22.11.0` e `10.9.0`). Se aparecer *"não é reconhecido como comando"*, feche e abra o VS Code de novo (ou reinicie o computador) depois de instalar o Node.

### Passo 2 — Baixar o projeto

Escolha **uma** das formas:

- **Com Git:** abra o terminal na pasta onde quer guardar o projeto (ex.: Documentos) e rode:

  ```
  git clone https://github.com/MuriloSilvaFonseca/luzForte.git
  ```

- **Sem Git:** no GitHub do projeto, clique em **Code → Download ZIP** e extraia o arquivo.

Depois, no VS Code: **File → Open Folder** e escolha a pasta **`luzForte`** (a que tem o arquivo `package.json` dentro).

> Todos os comandos dos próximos passos devem ser rodados **dentro dessa pasta**. No terminal do VS Code isso já acontece automaticamente.

### Passo 3 — Instalar as bibliotecas do projeto

No terminal do VS Code, rode:

```
npm install
```

Isso baixa o Express, o EJS, o driver do MySQL etc. para a pasta `node_modules`. Pode levar um minuto.

✅ Deu certo se terminar com algo como `added 120 packages` e **sem** a palavra `ERR!`.

> Só é preciso rodar de novo se alguém adicionar uma biblioteca nova (quando o `package.json` mudar).

### Passo 4 — Criar o banco de dados

O banco é criado com **dois arquivos**, **nesta ordem**:

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1º | `database/luzForte.sql` | Cria o banco `luz_forte` e todas as tabelas (só a estrutura, sem dados). |
| 2º | `database/queriesInsertMYSQL_local.sql` | Insere os dados de demonstração: categorias, marcas, produtos, pedidos, avaliações e usuários. |

**Pelo MySQL Workbench (recomendado):**

1. Abra o **MySQL Workbench**.
2. Na tela inicial, clique na conexão **Local instance MySQL80** e digite a senha do `root` (a do Passo 1).
3. Menu **File → Open SQL Script...** e abra o arquivo **`database/luzForte.sql`** que está dentro da pasta do projeto.
4. Clique no **raio ⚡** (o primeiro da barra, "Execute the selected portion of the script or everything").
5. Na parte de baixo (*Output*), todas as linhas devem ficar com **✔ verde**.
6. Repita os itens 3, 4 e 5 com o arquivo **`database/queriesInsertMYSQL_local.sql`**.
7. Na lateral esquerda (*Schemas*), clique no ícone de **atualizar** 🔄. O banco **`luz_forte`** deve aparecer.

**Conferindo:** abra uma aba nova de consulta (ícone **SQL+** no canto superior esquerdo), cole e execute:

```sql
SELECT COUNT(*) AS produtos FROM luz_forte.produto;
```

✅ Deu certo se o resultado for **12**.

> ⚠️ O `luzForte.sql` **apaga e recria as tabelas**. Se você já tinha dados nesse banco, eles são perdidos.
> O arquivo de dados (2º) deve rodar **uma única vez**. Se rodar duas vezes, dá erro de `Duplicate entry`: nesse caso rode o 1º de novo e depois o 2º.

<details>
<summary>Prefere o terminal em vez do Workbench?</summary>

O programa `mysql` precisa estar no PATH do Windows (normalmente fica em `C:\Program Files\MySQL\MySQL Server 8.0\bin`). No terminal, dentro da pasta do projeto:

```
mysql -u root -p -e "source database/luzForte.sql"
```

```
mysql -u root -p -e "source database/queriesInsertMYSQL_local.sql"
```

Ele pede a senha do `root` a cada comando. (O formato `mysql ... < arquivo.sql` **não funciona no PowerShell**, que é o terminal padrão do VS Code.)
</details>

### Passo 5 — Criar o arquivo `.env` (senhas do seu computador)

O `.env` guarda os dados de acesso ao **seu** MySQL. Ele **não vai para o GitHub** (cada pessoa tem o seu).

1. Faça uma cópia do arquivo `.env.example` com o nome **`.env`**. No terminal:

   ```
   copy .env.example .env
   ```

   (ou, no VS Code, clique com o botão direito em `.env.example` → *Copy*, depois *Paste*, e renomeie a cópia para `.env`).

2. Abra o `.env` e preencha **pelo menos** estas linhas:

   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=a_senha_do_root_que_voce_anotou
   DB_NAME=luz_forte
   ```

3. **Recomendado:** gere um `SESSION_SECRET` (é o que assina o cookie de login). No terminal:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Copie o texto que aparecer e cole depois do `SESSION_SECRET=`. Se deixar vazio, o site funciona do mesmo jeito, mas quem estiver logado sai toda vez que o servidor reiniciar.

4. **Opcional:** em `WHATSAPP_LOJA`, coloque um número com DDI e DDD, só números (ex.: `5519999999999`). Para testar, use o seu próprio número. Vazio = o botão do WhatsApp não aparece.

5. Salve o arquivo (**Ctrl + S**).

### Passo 6 — Ligar o servidor

No terminal:

```
npm run dev
```

✅ Deu certo se aparecerem estas duas mensagens:

```
Servidor rodando em http://localhost:3000
Banco conectado com sucesso
```

Se aparecer `❌ Erro ao conectar no MySQL`, veja a seção [Problemas comuns](#problemas-comuns).

> Deixe esse terminal **aberto**: enquanto ele estiver rodando, o site funciona. O `nodemon` reinicia o servidor sozinho quando você salva um arquivo `.js`. Mudanças em `.ejs` e `.css` aparecem só recarregando a página (F5).

### Passo 7 — Abrir o site

No navegador, acesse **http://localhost:3000**.

> As páginas **não** abrem clicando no arquivo `.ejs` nem pelo Live Server: quem monta as páginas é o servidor do Passo 6.

### Passo 8 — Desligar

No terminal onde o servidor está rodando, aperte **Ctrl + C**. (Se perguntar *"Deseja finalizar o arquivo em lotes?"*, digite `S` e Enter.)

Para ligar de novo outro dia, basta abrir a pasta no VS Code e repetir o **Passo 6**. Os passos 1 a 5 são feitos **uma vez só**.

---

## Roteiro rápido para testar

**Como administrador**

1. Acesse http://localhost:3000/login e entre com o admin de demonstração:
   - **E-mail:** `teste@gmail.com`
   - **Senha:** informada pelo grupo junto com a entrega (no banco ela fica salva só como hash bcrypt).
2. Você cai no **painel** (`/admin`), com faturamento, custo, lucro bruto e margem.
3. Em **Pedidos**, abra um pedido *Solicitado* e clique em **Aprovar**: o estoque dos produtos baixa e a venda entra no faturamento.
4. Em **Avaliações**, aprove algumas: elas passam a aparecer na home e na página do produto.

**Como cliente**

1. Saia da conta de admin (menu do usuário → Sair) e crie uma conta em http://localhost:3000/registro.
2. Navegue pelo **Catálogo**, adicione produtos ao **Carrinho** e clique em **Continuar com a compra**.
3. No **Checkout**, escolha a forma de pagamento e confirme. O pedido fica *Solicitado* e (se o `WHATSAPP_LOJA` estiver preenchido) aparece o botão para enviar a mensagem pelo WhatsApp.
4. Em **Minha conta → Meus pedidos**, acompanhe a situação do pedido.

Os usuários `usuario1@example.com` a `usuario8@example.com` do banco de demonstração são apenas dados para consulta e **não conseguem fazer login**.

---

## Problemas comuns

| O que aparece | O que significa | Como resolver |
|---|---|---|
| `'node'` ou `'npm'` não é reconhecido como comando | O Node não foi instalado ou o terminal foi aberto antes da instalação | Instale o Node (Passo 1) e feche/abra o VS Code |
| `❌ Erro ao conectar no MySQL: ER_ACCESS_DENIED_ERROR` | Usuário ou senha errados no `.env` | Confira `DB_USER` e `DB_PASSWORD` no `.env` (Passo 5) e salve |
| `❌ Erro ao conectar no MySQL: ER_BAD_DB_ERROR` | O banco `luz_forte` não existe | Rode o `database/luzForte.sql` (Passo 4) e confira `DB_NAME=luz_forte` |
| `❌ Erro ao conectar no MySQL: ECONNREFUSED` | O MySQL está desligado | Tecla Windows → digite **Serviços** → procure **MySQL80** → botão direito → **Iniciar** |
| `Error: listen EADDRINUSE ... :3000` | Já tem outro programa usando a porta 3000 (talvez o próprio site aberto em outro terminal) | Feche o outro terminal, ou coloque `PORT=3001` no `.env` e acesse http://localhost:3001 |
| `Unknown collation: 'utf8mb4_0900_ai_ci'` ao rodar o `.sql` | O banco instalado é o MariaDB (XAMPP) ou um MySQL antigo (5.7) | Instale o **MySQL 8** (Passo 1) |
| `Duplicate entry` ao rodar o arquivo de dados | O arquivo de dados já tinha sido executado | Rode o `luzForte.sql` de novo e depois o arquivo de dados (Passo 4) |
| `Table 'luz_forte.xxx' doesn't exist` | O arquivo de dados foi executado antes da estrutura | Rode primeiro o `luzForte.sql`, depois o arquivo de dados |
| A página abre, mas sem produtos | O banco foi criado, mas o arquivo de dados não foi executado | Rode o `queriesInsertMYSQL_local.sql` (Passo 4) |
| Aviso `SESSION_SECRET não definido no .env` | O `.env` está sem `SESSION_SECRET` | Funciona assim mesmo; para evitar o aviso, gere um (Passo 5, item 3) |
| O login cai depois de salvar um arquivo `.js` | O servidor reiniciou e as sessões ficam na memória | Normal durante o desenvolvimento; é só entrar de novo |
| "Esqueci a senha" diz que enviou, mas o e-mail não chega | As variáveis `EMAILJS_*` não estão no `.env` | Veja o aviso no terminal; preencha as chaves do EmailJS se for usar essa função |
| Página "Não encontramos essa página" | O endereço digitado não existe | Confira a URL na tabela [Principais URLs](#principais-urls) |

### Banco antigo de uma versão anterior do projeto

Se você já tinha um banco `luz_forte` de uma versão anterior e quer **manter os dados** (em vez de recriar), rode:

```
node scripts/atualizar-banco-local.js
```

Ele só adiciona as colunas e tabelas que faltarem, sem apagar registros. Faça um backup antes (Workbench: **Server → Data Export**).

---

## Variáveis do .env

| Variável | Obrigatória? | Para que serve |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Sim | Conexão com o MySQL. |
| `SESSION_SECRET` | Recomendada | Assina o cookie de login. Vazia = o servidor sorteia uma a cada vez que inicia (quem estiver logado sai ao reiniciar). |
| `PORT` | Não | Porta do servidor (padrão: 3000). |
| `WHATSAPP_LOJA` | Não | Número que recebe os pedidos (formato `5519XXXXXXXXX`). Vazio = o botão do WhatsApp não aparece. |
| `EMAILJS_*` | Não | Envio do código do "Esqueci a senha". Sem elas, o código não é enviado. |

O `.env` tem senhas e **nunca** vai para o GitHub (está no `.gitignore`).

---

## Estrutura

```
app.js            liga o Express, o EJS, a sessão, a pasta public/ e as rotas
routes/           as URLs do sistema (loja, login, conta, carrinho, admin...)
services/         regras de negócio reaproveitadas (carrinho, pedido, WhatsApp, e-mail)
middlewares/      verificações que rodam antes das rotas (login, admin, menu)
config/           conexão com o MySQL
views/            as páginas (.ejs)
  partials/       header, footer e trechos usados em várias páginas
  loja/           páginas do cliente
  auth/           login, registro, esqueci a senha
  admin/          painel administrativo
public/           arquivos enviados direto ao navegador (css/, img/, js/)
database/         scripts SQL do banco
scripts/          utilitários para atualizar bancos antigos
tests/            testes automatizados
docs/             documentação do projeto
```

## Principais URLs

**Loja**

| Página | URL |
|---|---|
| Home | `/` |
| Catálogo | `/catalogo` |
| Produto | `/produto?id=1001` |
| Carrinho | `/carrinho` |
| Checkout (exige login) | `/checkout` |
| Como comprar | `/como-comprar` |
| Minha conta (exige login) | `/minha-conta` |
| Sobre nós | `/sobre-nos` |
| Contato | `/contato` |
| Login / Registro | `/login`, `/registro` |
| Esqueci a senha | `/esqueci-senha` |

**Administração** (exige login de admin)

| Página | URL |
|---|---|
| Visão geral | `/admin` |
| Pedidos | `/admin/pedidos` |
| Produtos | `/admin/produtos` |
| Cadastros (categorias, marcas...) | `/admin/cadastros` |
| Usuários | `/admin/usuarios` |
| Avaliações | `/admin/avaliacoes` |

## Testes

```
npm test
```

Os testes usam um banco simulado e **não alteram o MySQL**. Precisam do Node 22 (o site em si roda a partir do Node 18).

## Regras de negócio importantes

- **Venda só conta depois da aprovação.** Pedido "solicitado" não baixa estoque nem entra no faturamento. Ao **aprovar**, o estoque baixa e o custo de cada item fica gravado no pedido.
- **Cancelar um pedido aprovado devolve o estoque.** Pedido finalizado (já retirado) não pode ser cancelado.
- **Faturamento e lucro** (painel do admin) somam só pedidos aprovados e finalizados. O lucro é **bruto**: venda menos o custo dos produtos (sem impostos ou despesas da loja).
- **O carrinho usa sempre o preço atual** do produto. Se o admin mudar o preço, o cliente vê e paga o valor novo.
- **Editar um produto aplica só a diferença do estoque** digitada pelo admin, para não desfazer vendas aprovadas enquanto a tela estava aberta.

## Limitações conhecidas

Pontos que ficaram fora do escopo do projeto acadêmico:

- **Sessões na memória do servidor:** quem estiver logado sai quando o servidor reinicia. Num site real, as sessões ficariam no banco (ex.: `express-mysql-session`).
- **Proteção contra CSRF** feita pelo cookie `sameSite: 'lax'`, que vale nos navegadores atuais. Não há token CSRF nos formulários.
- **Limite de tentativas de login** (5 erros = 15 minutos de bloqueio) fica na memória e zera quando o servidor reinicia.
- **O cadastro avisa quando o e-mail já existe.** Isso revela quais e-mails têm conta; evitar exigiria confirmação de cadastro por e-mail.
- **Carrinhos de visitantes abandonados** ficam no banco (não há limpeza automática).
- **Esqueci a senha** depende das variáveis `EMAILJS_*`. Sem elas, o código não é enviado (o erro aparece no terminal).
- **Imagens dos produtos de demonstração** são ilustrativas; só alguns produtos têm foto.

## Como criar uma página nova

1. Crie a view em `views/<area>/minha-pagina.ejs`, com `<%- include("../partials/header") %>` e `<%- include("../partials/footer") %>`.
2. CSS em `public/css/pages/`, JS em `public/js/pages/`. Nos links use caminho começando com `/` (ex.: `/css/pages/minha-pagina.css`), sem `public`.
3. Adicione a rota em `routes/`:

   ```js
   router.get('/minha-pagina', (req, res) => {
     res.render('area/minha-pagina')
   })
   ```
