require('dotenv').config({ quiet: true })
const fs = require('node:fs/promises')
const path = require('node:path')
const banco = require('../config/database').promise()

async function migrar() {
  const host = (process.env.DB_HOST || '').trim().toLowerCase()
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Este comando só pode executar a migração no MySQL local.')
  }
  const sql = await fs.readFile(path.join(__dirname, '../database/migracao_biblioteca_textos.sql'), 'utf8')
  for (const comando of sql.split(/;\s*(?:\r?\n|$)/)) {
    if (comando.trim()) await banco.query(comando)
  }
  for (const tipo of ['descricao', 'especificacao', 'instalacao']) {
    const [registros] = await banco.query(`SELECT nome_${tipo} AS nome, texto_${tipo} AS texto FROM ${tipo}`)
    for (const registro of registros) {
      const texto = registro.texto.replace(/\r\n?/g, '\n').trim()
      const [existentes] = await banco.query('SELECT id_modelo_texto FROM modelo_texto WHERE tipo = ? AND BINARY nome = BINARY ? AND BINARY texto = BINARY ? LIMIT 1', [tipo, registro.nome.trim(), texto])
      if (!existentes.length) await banco.query('INSERT INTO modelo_texto (tipo, nome, texto) VALUES (?, ?, ?)', [tipo, registro.nome, texto])
    }
  }
  console.log('Biblioteca de textos preparada. Os textos e produtos existentes foram preservados.')
}

migrar().catch(erro => {
  console.error('Falha na migração:', erro.message)
  process.exitCode = 1
}).finally(() => banco.end())
