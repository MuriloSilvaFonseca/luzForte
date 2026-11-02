-- Executar no banco selecionado no .env. Não apaga nem altera os textos atuais.
CREATE TABLE IF NOT EXISTS modelo_texto (
  id_modelo_texto INT NOT NULL AUTO_INCREMENT,
  tipo ENUM('descricao', 'especificacao', 'instalacao') NOT NULL,
  nome VARCHAR(70) NOT NULL,
  texto TEXT NOT NULL,
  PRIMARY KEY (id_modelo_texto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS produto_modelo_texto (
  produto_sku INT NOT NULL,
  modelo_texto_id INT NOT NULL,
  PRIMARY KEY (produto_sku, modelo_texto_id),
  CONSTRAINT fk_produto_modelo_produto FOREIGN KEY (produto_sku)
    REFERENCES produto (sku) ON DELETE CASCADE,
  CONSTRAINT fk_produto_modelo_texto FOREIGN KEY (modelo_texto_id)
    REFERENCES modelo_texto (id_modelo_texto) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
