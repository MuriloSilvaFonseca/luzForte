require('dotenv').config()
const { neon } = require('@neondatabase/serverless')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definida. Crie o .env na raiz do projeto.')
}

const sql = neon(process.env.DATABASE_URL)

module.exports = sql