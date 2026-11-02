require('dotenv').config({ quiet: true })
const banco = require('../config/database').promise()

async function migrar() {
  if (!['localhost', '127.0.0.1', '::1'].includes((process.env.DB_HOST || '').trim().toLowerCase())) {
    throw new Error('Esta migração só pode ser executada no MySQL local.')
  }
  const [colunas] = await banco.query('SHOW COLUMNS FROM produto')
  if (!colunas.some(c => c.Field === 'categoria_id')) {
    await banco.query('ALTER TABLE produto ADD COLUMN categoria_id INT NULL AFTER marca_id')
  }
  await banco.query(`UPDATE produto p JOIN subcategoria s ON s.id_subcategoria = p.subcategoria_id
    SET p.categoria_id = s.categoria_id WHERE p.categoria_id IS NULL`)
  const [semCategoria] = await banco.query('SELECT COUNT(*) AS total FROM produto WHERE categoria_id IS NULL')
  if (Number(semCategoria[0].total)) throw new Error('Há produtos sem categoria. Confira os vínculos antes de continuar.')
  await banco.query('ALTER TABLE produto MODIFY categoria_id INT NOT NULL, MODIFY subcategoria_id INT NULL')
  const [chaves] = await banco.query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produto' AND CONSTRAINT_NAME = 'fk_produto_categoria'")
  if (!chaves.length) await banco.query('ALTER TABLE produto ADD CONSTRAINT fk_produto_categoria FOREIGN KEY (categoria_id) REFERENCES categoria (id_categoria) ON DELETE RESTRICT')

  const [assinatura] = await banco.query("SHOW COLUMNS FROM modelo_texto LIKE 'assinatura'")
  if (!assinatura.length) {
    await banco.query(`ALTER TABLE modelo_texto ADD COLUMN assinatura BINARY(32)
      GENERATED ALWAYS AS (UNHEX(SHA2(CONCAT(TRIM(nome), CHAR(0), TRIM(REPLACE(REPLACE(texto, CHAR(13,10), CHAR(10)), CHAR(13), CHAR(10)))), 256))) STORED`)
  }
  if (assinatura.length) {
    await banco.query(`ALTER TABLE modelo_texto MODIFY COLUMN assinatura BINARY(32)
      GENERATED ALWAYS AS (UNHEX(SHA2(CONCAT(TRIM(nome), CHAR(0), TRIM(REPLACE(REPLACE(texto, CHAR(13,10), CHAR(10)), CHAR(13), CHAR(10)))), 256))) STORED`)
  }
  const [repetidos] = await banco.query('SELECT tipo, assinatura, COUNT(*) AS total FROM modelo_texto GROUP BY tipo, assinatura HAVING COUNT(*) > 1')
  if (repetidos.length) throw new Error('Há textos idênticos na biblioteca. Nenhum foi apagado; confira os vínculos antes de consolidar.')
  const [indices] = await banco.query("SHOW INDEX FROM modelo_texto WHERE Key_name = 'uq_modelo_tipo_conteudo'")
  if (!indices.length) await banco.query('ALTER TABLE modelo_texto ADD UNIQUE KEY uq_modelo_tipo_conteudo (tipo, assinatura)')
  console.log('Categorias diretas e proteção contra textos duplicados preparadas. Dados existentes preservados.')
}

migrar().catch(erro => { console.error(erro.message); process.exitCode = 1 }).finally(() => banco.end())
