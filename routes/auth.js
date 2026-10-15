const express = require('express')
const bcrypt = require('bcryptjs')
const conexao = require('../config/database')
const router = express.Router()

router.get('/registro', (req, res) => {
  res.render('auth/registro')
})


// ROTA POST PARA CADASTRO DE USUÁRIO
router.post('/registro', (req, res) => {
  const { nome, email, telefone, senha, confirm_senha } = req.body

  if (!nome || !email || !telefone || !senha) {
    return res.render('auth/registro', { erro: 'Preencha todos os campos' })
  }

  if (senha.length < 8) {
    return res.render('auth/registro', { erro: 'A senha precisa ter no mínimo 8 caracteres' })
  }

  if (senha !== confirm_senha) {
    return res.render('auth/registro', {  erro: 'As senhas não conferem'  })
  }

  const sqlSelectEmail = 'SELECT COUNT(*) AS Existe FROM usuario WHERE email = ?'

  conexao.query(sqlSelectEmail, [email], (erro, resultado) => {
    if(erro) {
      console.log(erro);
      return res.status(500).send('Erro do servidor')
    }

    if(resultado[0].Existe > 0) {
      return res.render('auth/registro', { erro: 'Esse e-mail já existe' })
    }

    // AQUI É GERADO O HASH PARA PROTEGER A SENHA
    bcrypt.hash(senha, 10, (erro, hash) => {
      if(erro) {
        console.log(erro);
        return res.status(500).send('Erro do servidor')
      }

      const sqlInsert = 'INSERT INTO usuario(nome_usuario, email, telefone, senha) VALUES (?, ?, ?, ?)'

      conexao.query(sqlInsert, [nome, email, telefone, hash], (erroInsert, resultadoInsert) => {
        if(erroInsert) {
          if(erroInsert.code === 'ER_DUP_ENTRY') {
            return res.render('auth/registro', { erro: 'Esse e-mail já existe' })
          }
          console.log(erroInsert);
          return res.status(500).send('Erro do servidor')
        }

        return res.redirect('/login')
      })
    })
  })
})

router.get('/login', (req, res) => {
  res.render('auth/login')
})

router.get('/esqueci-senha', (req, res) => {
  res.render('auth/esqueci-senha')
})



module.exports = router
