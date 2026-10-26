-- Alinha avaliacao_produto ao esquema usado pela API pública e pelo painel.
-- Avaliações existentes passam a aguardar moderação.
ALTER TABLE avaliacao_produto
  ADD COLUMN status ENUM('pendente', 'aprovada', 'rejeitada') NOT NULL DEFAULT 'pendente' AFTER comentario,
  ADD COLUMN motivo_rejeicao VARCHAR(100) DEFAULT NULL AFTER status,
  ADD COLUMN resposta TEXT DEFAULT NULL AFTER motivo_rejeicao,
  ADD COLUMN data_resposta TIMESTAMP NULL DEFAULT NULL AFTER resposta;
