-- ATENCAO: estas alteracoes ja fazem parte do database/Luz_ForteDB.sql.
-- Quem importar o Luz_ForteDB.sql atualizado NAO precisa rodar este arquivo.
-- Use-o somente em um banco criado com a versao antiga do Luz_ForteDB.sql
-- (sem a coluna visitante_token_hash). Rodar duas vezes da erro de coluna duplicada.
--
-- Migracao aplicada no banco local luz_forte; aplicacao em outros ambientes nao confirmada.
-- Aplicar apenas depois de revisar backup, versao e estrutura do banco de destino.
-- Nao cria usuarios ficticios. Preserva usuarios e pedidos existentes.
-- O backend de visitantes ainda precisa ser implementado depois da aprovacao.
-- Gerar 32 bytes aleatorios no servidor; guardar o token na sessao e apenas
-- seu hash SHA-256 hexadecimal (64 caracteres) em visitante_token_hash.
-- Nunca aceitar pedido_id ou identidade de visitante fornecidos pelo cliente.
-- Nao reutilizar tokens entre visitantes. Perder a sessao pode perder o acesso
-- ao carrinho: a sessao atual em memoria nao sobrevive a reinicios do servidor.

ALTER TABLE pedido
  MODIFY COLUMN usuario_id INT NULL,
  ADD COLUMN visitante_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD UNIQUE KEY uq_pedido_visitante_token_hash (visitante_token_hash),
  ADD CONSTRAINT chk_pedido_proprietario CHECK (
    (usuario_id IS NOT NULL AND visitante_token_hash IS NULL)
    OR
    (usuario_id IS NULL AND visitante_token_hash IS NOT NULL AND status = 'carrinho')
  );

-- A chave estrangeira existente de usuario_id e preservada.
-- O indice UNIQUE permite varios NULL para pedidos de usuarios autenticados.
-- Cada hash de visitante identifica somente um pedido.
-- Login, transferencia/mesclagem de carrinho e persistencia de sessoes precisam
-- de decisoes separadas; esta proposta nao implementa essas funcionalidades.
