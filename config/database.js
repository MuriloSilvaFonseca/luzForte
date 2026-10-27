const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('A variável DATABASE_URL não foi configurada no arquivo .env.')
}

const conexao = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
})

conexao.on('error', (erro) => {
  console.error('Erro inesperado no pool PostgreSQL:', erro.message)
})

async function testarConexao() {
  let cliente

  try {
    cliente = await conexao.connect()
    const { rows } = await cliente.query(
      'SELECT NOW() AS horario, current_database() AS banco'
    )
    console.log('PostgreSQL conectado:', rows[0].banco, '-', rows[0].horario)
  } catch (erro) {
    console.error('Erro ao conectar ao PostgreSQL:', erro.message)
  } finally {
    if (cliente) cliente.release()
  }
}

testarConexao()

module.exports = conexao