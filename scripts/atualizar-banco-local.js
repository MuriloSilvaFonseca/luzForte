const fs = require('node:fs/promises')
const path = require('node:path')

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

  const sql = await fs.readFile(path.join(__dirname, '../database/migracao_biblioteca_textos.sql'), 'utf8')
  for (const comando of sql.replace(/^--.*$/gm, '').split(';')) {
    if (comando.trim()) await banco.query(comando)
  }
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
