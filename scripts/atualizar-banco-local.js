async function atualizarBanco(banco) {
  async function adicionarColuna(tabela, nome, definicao) {
    const [colunas] = await banco.query('SHOW COLUMNS FROM ?? LIKE ?', [tabela, nome])
    if (!colunas.length) await banco.query('ALTER TABLE ?? ADD COLUMN ?? ' + definicao, [tabela, nome])
  }

  await adicionarColuna('usuario', 'ativo', 'TINYINT(1) NOT NULL DEFAULT 1')
  await adicionarColuna('avaliacao_produto', 'status', "ENUM('pendente','aprovada','rejeitada') NOT NULL DEFAULT 'pendente'")
  await adicionarColuna('avaliacao_produto', 'motivo_rejeicao', 'VARCHAR(100) NULL')
  await adicionarColuna('avaliacao_produto', 'resposta', 'TEXT NULL')
  await adicionarColuna('avaliacao_produto', 'data_resposta', 'TIMESTAMP NULL DEFAULT NULL')
  await adicionarColuna('produto', 'categoria_id', 'INT NULL AFTER marca_id')
  await banco.query(`UPDATE produto p JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
    SET p.categoria_id = s.categoria_id WHERE p.categoria_id IS NULL`)
  const [[semCategoria]] = await banco.query('SELECT COUNT(*) AS total FROM produto WHERE categoria_id IS NULL')
  if (Number(semCategoria.total)) throw new Error('Há produtos sem categoria. Confira os vínculos antes de continuar.')
  await banco.query('ALTER TABLE produto MODIFY categoria_id INT NOT NULL, MODIFY subcategoria_id INT NULL')
  const [chaves] = await banco.query(`SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produto' AND CONSTRAINT_NAME = 'fk_produto_categoria'`)
  if (!chaves.length) {
    await banco.query('ALTER TABLE produto ADD CONSTRAINT fk_produto_categoria FOREIGN KEY (categoria_id) REFERENCES categoria (id_categoria) ON DELETE RESTRICT')
  }

  // Biblioteca de textos (mesmas tabelas de database/luzForte.sql). Não apaga textos existentes.
  await banco.query(`CREATE TABLE IF NOT EXISTS modelo_texto (
    id_modelo_texto INT NOT NULL AUTO_INCREMENT,
    tipo ENUM('descricao', 'especificacao', 'instalacao') NOT NULL,
    nome VARCHAR(70) NOT NULL,
    texto TEXT NOT NULL,
    PRIMARY KEY (id_modelo_texto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`)
  await banco.query(`CREATE TABLE IF NOT EXISTS produto_modelo_texto (
    produto_sku INT NOT NULL,
    modelo_texto_id INT NOT NULL,
    PRIMARY KEY (produto_sku, modelo_texto_id),
    CONSTRAINT fk_produto_modelo_produto FOREIGN KEY (produto_sku)
      REFERENCES produto (sku) ON DELETE CASCADE,
    CONSTRAINT fk_produto_modelo_texto FOREIGN KEY (modelo_texto_id)
      REFERENCES modelo_texto (id_modelo_texto) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`)
  await adicionarColuna('modelo_texto', 'assinatura', `BINARY(32)
    GENERATED ALWAYS AS (UNHEX(SHA2(CONCAT(TRIM(nome), CHAR(0), TRIM(REPLACE(REPLACE(texto, CHAR(13,10), CHAR(10)), CHAR(13), CHAR(10)))), 256))) STORED`)
  const [repetidos] = await banco.query('SELECT tipo, assinatura, COUNT(*) AS total FROM modelo_texto GROUP BY tipo, assinatura HAVING COUNT(*) > 1')
  if (repetidos.length) throw new Error('Há textos duplicados. Nenhum foi apagado; confira os vínculos antes de continuar.')
  const [indices] = await banco.query("SHOW INDEX FROM modelo_texto WHERE Key_name = 'uq_modelo_tipo_conteudo'")
  if (!indices.length) await banco.query('ALTER TABLE modelo_texto ADD UNIQUE KEY uq_modelo_tipo_conteudo (tipo, assinatura)')
}

if (require.main === module) {
  require('dotenv').config({ quiet: true })
  const pool = require('../config/database')
  const banco = pool.promise()
  async function executar() {
    try {
      if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
        throw new Error('Esta atualização só pode ser executada no MySQL local.')
      }
      await atualizarBanco(banco)
      console.log('Estrutura atualizada. Contas, produtos e pedidos existentes foram preservados.')
    } catch (erro) {
      console.error(erro.message)
      process.exitCode = 1
    } finally {
      await banco.end()
    }
  }
  executar()
}

module.exports = { atualizarBanco }
