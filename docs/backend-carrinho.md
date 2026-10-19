# Backend do carrinho: estado atual

## Onde estudar o codigo

- `app.js`: configura Express, sessao, paginas e rotas.
- `middlewares/navbar.js`: consulta categorias e subcategorias; envia dados ao EJS.
- `routes/produtos.js`: filtros parametrizados e consultas de produtos e detalhes.
- `routes/auth.js`: cadastro existente e login com bcrypt e regeneracao de sessao.
- `middlewares/identificar-carrinho.js`: identifica usuario ou cria o token do visitante.
- `routes/carrinho.js`: valida HTTP/JSON e devolve a resposta da operacao.
- `services/carrinho.js`: consulta o pedido, modifica itens e calcula totais em transacao.
- `public/js/modules/carrinho-api.js`: faz requisicoes e compartilha o comportamento dos botoes.
- `public/js/pages/carrinho-integrado.js`: mostra os itens e conecta os controles da pagina.

As rotas HTTP, os campos JSON, as classes antigas do layout e as funcoes usadas
nos atributos onclick foram mantidos para preservar as interfaces existentes.
Funcoes internas novas usam nomes em portugues. Os bloqueios, o hash de visitante,
as verificacoes de proprietario e os calculos DECIMAL continuam no backend.

Implementadas quatro operacoes JSON para clientes autenticados e visitantes.
Clientes usam `req.session.usuario.id_usuario`; visitantes usam token aleatorio
de 32 bytes salvo na sessao, com apenas seu SHA-256 no banco. Nenhuma identidade
recebida no corpo ou na query string define o proprietario do carrinho.

| Metodo | Rota | Corpo JSON |
| --- | --- | --- |
| GET | `/api/carrinho` | Sem corpo |
| POST | `/api/carrinho/itens` | `{"produto_sku":1001,"quantidade":2}` |
| PATCH | `/api/carrinho/itens/1001` | `{"quantidade":3}` |
| DELETE | `/api/carrinho/itens/1001` | Sem corpo; enviar Content-Type application/json |

As mutacoes exigem `Content-Type: application/json`. Os SKUs acima sao exemplos:
usar um SKU real ativo ao testar manualmente em banco de desenvolvimento.
Testes manuais de mutacao gravam no banco e devem ser autorizados previamente.

Adicionar novamente soma quantidades, preservando o preco registrado no item.
Alterar quantidade define a nova quantidade, sem soma. Quantidade deve ser
inteira positiva; remocao usa DELETE. Carrinho inexistente na listagem retorna
lista vazia; alteracao/remocao inexistente retorna 404.

Cada operacao usa uma conexao e uma transacao. O bloqueio da linha do usuario
serializa criacoes simultaneas feitas por esta API. Mais de um carrinho ativo
preexistente resulta em 409, sem excluir ou mesclar pedidos. Outros escritores
do banco precisam obedecer ao mesmo protocolo de bloqueio. Visitantes usam uma
trava nomeada MySQL por hash, liberada ao final, para serializar a criacao e as
mutacoes do mesmo carrinho. Timeout retorna 409 para permitir nova tentativa.

Subtotais e totais sao calculados pelo MySQL com DECIMAL. O pedido vazio e
preservado, sempre com status carrinho. Nao ha checkout, pagamento ou finalizacao.
Adicionar valida a existencia e a situacao ativa do produto; nao reserva nem
baixa estoque. A resposta inclui titulo, SKU, quantidade, preco unitario,
subtotal e totais, sem custos internos ou dados pessoais.

## Integracao e limitacoes

- POST /login agora verifica bcrypt, regenera a sessao e salva somente ID,
  nome e acesso. As senhas do seed continuam desabilitadas: usar uma conta
  cadastrada pelo formulario existente. Nenhuma senha do banco foi alterada.
- A alteracao de database/proposta_carrinho_visitantes.sql foi autorizada e
  aplicada em 17/10/2026 no banco luz_forte, apos verificacao e novo backup.
  usuario_id aceita NULL; visitante_token_hash tem indice unico e restricao
  que exige um unico proprietario e status carrinho para visitantes. Os 10
  pedidos e 19 itens preexistentes foram comparados e preservados. Nao
  reexecutar esse arquivo em um banco onde a alteracao ja foi aplicada.
- Home, catalogo e pagina do produto usam GET /api/produtos para obter SKUs
  reais e chamam a API do carrinho. Catalogo aceita categoria/subcategoria
  enviados pela navbar. O layout e as classes da navbar foram preservados.
- Carrinho usa carrinho-integrado.js e um template com as classes existentes.
  O arquivo antigo carrinho.js (dados de teste) foi removido.
  Cupom demonstrativo nao altera valores reais; o botao informa indisponibilidade.
  Continuar compra esta desabilitado. Comprar Agora apenas adiciona e abre o
  carrinho; nao confirma compra nem altera status.
- A sessao atual fica na memoria do servidor e o cookie dura 30 minutos.
  Reiniciar o servidor ou perder a sessao pode perder acesso ao carrinho de
  visitante; os registros permanecem no MySQL. Persistencia de sessoes e uma
  etapa separada.
- Login transfere o carrinho do visitante (services/carrinho.js,
  transferirCarrinhoVisitante): se o usuario nao tem carrinho aberto, o carrinho
  do visitante passa a ser dele; se ja tem, os itens sao juntados e produtos
  repetidos tem as quantidades somadas (mantendo o preco ja registrado no
  carrinho do usuario). Falha na transferencia nao impede o login e fica no log.
- A estrutura de visitante (visitante_token_hash, usuario_id NULL e
  chk_pedido_proprietario) agora faz parte do database/Luz_ForteDB.sql.
- As consultas de marca, imagens e detalhes de origin/catalogo-banco foram
  adaptadas para a API existente, sem merge ou mudanca no CSS/navbar. Imagens
  ausentes do seed usam o icone de caixa existente como alternativa.

## Validacao segura

Executar `node --test tests/*.test.js`. Os testes padrao usam HTTP local e banco
simulado. Os testes MySQL ficam desabilitados por padrao. Cobre criacao,
reutilizacao, soma, listagem, atualizacao, remocao, isolamento e validacao.

Para incluir o teste real: definir LUZ_FORTE_TESTE_MYSQL=1 somente no processo
de testes e executar `node --test tests/carrinho-mysql.test.js`. Ele usa sessoes
reais separadas e SQL real, mas troca COMMIT por savepoints e executa ROLLBACK
ao final. Compara os pedidos e itens existentes antes/depois. Valores de
AUTO_INCREMENT podem avancar mesmo com rollback; IDs nao sao necessariamente
consecutivos. Esse teste nao valida durabilidade apos COMMIT nem carga concorrente.

Na refatoracao, os testes de escrita MySQL foram desabilitados para respeitar
a restricao de nao alterar registros. Foram ampliados os testes simulados de
visitantes, navbar, botoes e filtros; as verificacoes reais usaram apenas SELECT/SHOW.

Nesta integracao foram executados SHOW CREATE TABLE pedido e SELECTs de produtos,
categorias e subcategorias. A API real retornou os 10 produtos ativos do seed.
Paginas home/catalogo/produto/carrinho renderizaram via HTTP com cinco categorias.
Login foi validado com bcrypt e sessoes reais usando usuarios simulados. O
teste MySQL validou adicionar/listar/alterar/remover, valores DECIMAL, pedido
vazio mantido em carrinho, dois visitantes isolados e um usuario autenticado.
Nenhum registro de teste foi confirmado no banco. Sem validacao visual em navegador.

Teste manual: iniciar o servidor, abrir o catalogo em uma janela normal e
outra anonima, adicionar produtos e conferir os carrinhos separados. Abas da
mesma sessao compartilham o carrinho por definicao. Para cliente autenticado,
usar uma conta cadastrada pela aplicacao; senhas do seed nao permitem login.
