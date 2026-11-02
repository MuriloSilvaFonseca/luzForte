require('dotenv').config({ quiet: true })
const fs = require('node:fs/promises')
const path = require('node:path')
const banco = require('../config/database').promise()
async function migrar() {
  if (!['localhost', '127.0.0.1', '::1'].includes((process.env.DB_HOST || '').trim().toLowerCase())) throw new Error('Este comando só pode alterar o MySQL local.')
  const [colunas] = await banco.query("SHOW COLUMNS FROM usuario LIKE 'ativo'")
  if (!colunas.length) {
    const sql = await fs.readFile(path.join(__dirname, '../database/migracao_usuario_ativo.sql'), 'utf8')
    await banco.query(sql)
  }
  console.log('Situação das contas preparada. Os usuários existentes permanecem ativos.')
}
migrar().catch(erro => { console.error(erro.message); process.exitCode = 1 }).finally(() => banco.end())
