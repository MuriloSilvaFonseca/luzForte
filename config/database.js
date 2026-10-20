const mysql = require('mysql2')

const conexao = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10
})

// Testa a conexão ao iniciar e avisa no terminal
conexao.getConnection((erro, con) => {
    if (erro) {
        console.error('❌ Erro ao conectar no MySQL:', erro.code, '-', erro.message)
        return
    }
    console.log('Banco conectado com sucesso')
    con.release()
})

module.exports = conexao


