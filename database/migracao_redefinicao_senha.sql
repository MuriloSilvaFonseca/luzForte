-- Cria a tabela do "esqueci a senha" em um banco que ja existe.
-- Quem importar o database/Luz_ForteDB.sql atualizado NAO precisa rodar este arquivo.
-- Pode rodar mais de uma vez sem problema (IF NOT EXISTS).

USE `luz_forte`;

CREATE TABLE IF NOT EXISTS `redefinicao_senha` (
  `id_redefinicao` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `codigo_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expira_em` datetime NOT NULL,
  `tentativas` int NOT NULL DEFAULT '0',
  `enviado_em` datetime NOT NULL,
  PRIMARY KEY (`id_redefinicao`),
  UNIQUE KEY `uq_redefinicao_usuario` (`usuario_id`),
  CONSTRAINT `fk_redefinicao_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
